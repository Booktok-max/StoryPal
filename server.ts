import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { GoogleGenAI, Modality } from "@google/genai";
import { bookRepository } from "./server/books";
import { importTextBook } from "./server/books/importer";
import { isDbHealthy } from "./db/client.js";
import { discoverImportOpenLibraryWork, DiscoveryImportError } from "./server/books/openLibraryImport";
import { getOrCreateDefaultChildId, getProgress, recordPageRead, unlockBadge as unlockBadgeInDb } from "./server/progress/repository.js";

dotenv.config();

// ── Environment ────────────────────────────────────────────────────────────────
const isPlatformHosted = !!process.env.PORT && !process.env.NODE_ENV;
const PORT = Number(process.env.PORT) || 3000;
const NODE_ENV = process.env.NODE_ENV || (isPlatformHosted ? "production" : "development");
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean);

console.log(`[StoryPals] NODE_ENV=${NODE_ENV} PORT=${PORT} isPlatformHosted=${isPlatformHosted}`);

// ── Input validation helpers ──────────────────────────────────────────────────
const MAX_TTS_TEXT_LENGTH = 2000;
const MAX_CHAT_MESSAGE_LENGTH = 500;
const MAX_CHAT_MESSAGES = 20;
const MAX_STORY_PROMPT_LENGTH = 500;

function sanitizeString(input: unknown, maxLen: number): string {
  if (typeof input !== "string") return "";
  return input.replace(/<[^>]*>/g, "").trim().slice(0, maxLen);
}

function validateMessages(messages: unknown): { valid: boolean; messages: Array<{ role: string; content: string }> } {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_CHAT_MESSAGES) {
    return { valid: false, messages: [] };
  }
  const cleaned = messages
    .filter((m: any) => m && typeof m === "object" && typeof m.content === "string")
    .map((m: any) => ({
      role: m.role === "model" || m.role === "assistant" ? "model" : "user",
      content: sanitizeString(m.content, MAX_CHAT_MESSAGE_LENGTH),
    }))
    .filter((m) => m.content.length > 0);
  return { valid: cleaned.length > 0, messages: cleaned };
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function startServer() {
  const app = express();

  // ── Security & infrastructure middleware ────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: NODE_ENV === "production" ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https://covers.openlibrary.org", "https://standardebooks.org"],
        connectSrc: ["'self'", "https://openlibrary.org", "https://generativelanguage.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
      },
    } : false,
    crossOriginEmbedderPolicy: false,
  }));

  if (ALLOWED_ORIGINS.length > 0) {
    app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
  } else if (NODE_ENV !== "production") {
    app.use(cors({ origin: true, credentials: true }));
  }

  app.use(rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please slow down." },
  }));

  const aiRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "AI request rate limit reached. Please wait a moment." },
  });

  const imageRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 6,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Image generation rate limit reached. Please wait before generating more illustrations." },
  });

  app.use(express.json({ limit: "1mb" }));

  // ── Health check ─────────────────────────────────────────────────────────────
  app.get("/api/health", async (_req: Request, res: Response) => {
    const hasKey = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY";
    const uptime = process.uptime();
    const mem = process.memoryUsage();
    const dbHealthy = await isDbHealthy().catch(() => false);
    res.json({
      status: "ok",
      hasApiKey: hasKey,
      db: dbHealthy ? "connected" : (process.env.DATABASE_URL ? "error" : "not_configured"),
      env: NODE_ENV,
      uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
      memory: {
        rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
      },
      providers: bookRepository.getProviders().map((p) => p.id),
    });
  });

  // ── Book catalog API ──────────────────────────────────────────────────────────
  app.get("/api/providers", (_req: Request, res: Response) => {
    res.json({ providers: bookRepository.getProviders() });
  });

  app.get("/api/books", async (req: Request, res: Response): Promise<any> => {
    try {
      const page = Number(req.query.page) || 1;
      const pageSize = Number(req.query.pageSize) || 100;
      const books = await bookRepository.list({
        q: typeof req.query.q === "string" ? req.query.q : undefined,
        level: typeof req.query.level === "string" ? req.query.level as any : undefined,
        category: typeof req.query.category === "string" ? req.query.category as any : undefined,
        source: typeof req.query.source === "string" ? req.query.source as any : undefined,
        page,
        pageSize,
      });

      return res.json({
        books,
        total: books.length,
        page,
        pageSize,
      });
    } catch (err: any) {
      console.error("Book catalog error:", err);
      return res.status(500).json({ error: err?.message || "Failed to load books." });
    }
  });

  app.get("/api/books/search", async (req: Request, res: Response): Promise<any> => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      if (!q) return res.json({ books: [], total: 0 });

      const source = typeof req.query.source === "string" ? req.query.source as any : undefined;
      const books = await bookRepository.search({ q, source, page: 1, pageSize: 20 });
      return res.json({ books, total: books.length, query: q });
    } catch (err: any) {
      console.error("Book search error:", err);
      return res.status(500).json({ error: err?.message || "Failed to search books." });
    }
  });

  // Phase 3: controlled import endpoint.
  app.post("/api/books/import", async (req: Request, res: Response): Promise<any> => {
    try {
      if (process.env.BOOK_IMPORT_ENABLED !== "true") {
        return res.status(403).json({ error: "Book importing is disabled." });
      }

      const configuredKey = process.env.BOOK_IMPORT_ADMIN_KEY;
      const suppliedKey = req.header("x-storypals-admin-key");
      if (!configuredKey || suppliedKey !== configuredKey) {
        return res.status(401).json({ error: "Unauthorized book import." });
      }

      const { title, author, text, sourceUrl, license, publicDomain, attributionRequired, language, summary, category } = req.body;
      const book = await importTextBook({
        title, author, text, sourceUrl, license, publicDomain, attributionRequired, language, summary, category,
      });

      return res.status(201).json({ book });
    } catch (err: any) {
      console.error("Book import error:", err);
      return res.status(400).json({ error: err?.message || "Failed to import book." });
    }
  });

  // Public discover-import: a child/parent browsing Open Library search
  // results clicks "Add to My Library". No admin key — rate-limited instead.
  app.post("/api/books/discover-import", aiRateLimiter, async (req: Request, res: Response): Promise<any> => {
    try {
      const { workId, title, author, summary, subjects, coverImage, sourceUrl } = req.body;
      if (!workId || !title || !author) {
        return res.status(400).json({ error: "workId, title and author are required." });
      }

      const book = await discoverImportOpenLibraryWork({ workId, title, author, summary, subjects, coverImage, sourceUrl });
      return res.status(201).json({ book });
    } catch (err: any) {
      if (err instanceof DiscoveryImportError && err.code === "not-available") {
        return res.status(422).json({ error: err.message });
      }
      console.error("Discover import error:", err);
      return res.status(500).json({ error: err?.message || "Failed to import book." });
    }
  });

  app.get("/api/books/:id", async (req: Request, res: Response): Promise<any> => {
    try {
      const book = await bookRepository.getById(req.params.id);
      if (!book) return res.status(404).json({ error: "Book not found." });
      return res.json({ book });
    } catch (err: any) {
      console.error("Book lookup error:", err);
      return res.status(500).json({ error: err?.message || "Failed to load book." });
    }
  });

  // Parental reading-level override. Persists for public-domain books
  // (stored in data/public-domain-books.json). For Open Library / Standard
  // Ebooks discovery results the update is applied client-side only and
  // survives until the next full page reload.
  app.patch("/api/books/:id/level", async (req: Request, res: Response): Promise<any> => {
    try {
      const { levelShort, level } = req.body;

      const validLevelShorts = ["Level 1", "Level 2", "Level 3"];
      const validLevels = [
        "Level 1 (Early Reader)",
        "Level 2 (Developing)",
        "Level 3 (Confident)",
      ];

      if (!validLevelShorts.includes(levelShort)) {
        return res.status(400).json({ error: "levelShort must be Level 1, Level 2, or Level 3." });
      }
      if (!validLevels.includes(level)) {
        return res.status(400).json({ error: "level value is invalid." });
      }

      const updatedBook = await bookRepository.updateBookLevel(
        req.params.id,
        levelShort,
        level
      );

      // For non-writable providers (openlibrary, standardebooks) updatedBook
      // is null — the client already applied the change in state, so this is
      // still a success from the client's perspective.
      return res.json({ persisted: !!updatedBook, book: updatedBook ?? null });
    } catch (err: any) {
      console.error("Level override error:", err);
      return res.status(500).json({ error: err?.message || "Failed to save level override." });
    }
  });

  // Admin: approve or reject a pending-review book. Requires the same
  // BOOK_IMPORT_ADMIN_KEY header used by the import endpoint.
  app.patch("/api/books/:id/status", async (req: Request, res: Response): Promise<any> => {
    const configuredKey = process.env.BOOK_IMPORT_ADMIN_KEY;
    const suppliedKey = req.header("x-storypals-admin-key");
    if (!configuredKey || suppliedKey !== configuredKey) {
      return res.status(403).json({ error: "Invalid or missing admin key." });
    }

    try {
      const { status } = req.body;
      if (status !== "approved" && status !== "rejected") {
        return res.status(400).json({ error: "status must be \"approved\" or \"rejected\"." });
      }

      const updatedBook = await bookRepository.updateBookStatus(req.params.id, status);
      return res.json({ persisted: !!updatedBook, book: updatedBook ?? null });
    } catch (err: any) {
      console.error("Book status update error:", err);
      return res.status(500).json({ error: err?.message || "Failed to update book status." });
    }
  });

  // Persist a generated illustration for one page so it survives a server
  // restart. Only writable providers (currently: public-domain) actually
  // save anything — for other sources this confirms the image is fine to
  // keep client-side-only and reports that nothing was persisted.
  app.patch("/api/books/:id/illustration", async (req: Request, res: Response): Promise<any> => {
    try {
      const { pageIndex, imageUrl, imageSize } = req.body;

      if (typeof pageIndex !== "number" || pageIndex < 0) {
        return res.status(400).json({ error: "A valid pageIndex is required." });
      }
      const validSizes = ["1K", "2K", "4K"];
      if (typeof imageUrl !== "string" || !imageUrl) {
        return res.status(400).json({ error: "imageUrl is required." });
      }
      if (typeof imageSize !== "string" || !validSizes.includes(imageSize)) {
        return res.status(400).json({ error: "imageSize must be one of 1K, 2K, 4K." });
      }
      if (imageUrl.length > 15_000_000) {
        return res.status(413).json({ error: "imageUrl payload is too large." });
      }

      const updatedBook = await bookRepository.updatePageImage(
        req.params.id,
        pageIndex,
        imageUrl,
        imageSize
      );

      if (!updatedBook) {
        return res.json({ persisted: false });
      }
      return res.json({ persisted: true, book: updatedBook });
    } catch (err: any) {
      console.error("Illustration persistence error:", err);
      return res.status(500).json({ error: err?.message || "Failed to save illustration." });
    }
  });

  // ── Progress persistence (Sprint 5, issue 02) ───────────────────────────────
  // No auth yet, so the client works against a single auto-provisioned
  // "default" child profile. localStorage stays the fast optimistic cache;
  // the DB is the source of truth once it's reachable.

  app.get("/api/child/default", async (_req: Request, res: Response): Promise<any> => {
    try {
      const childId = await getOrCreateDefaultChildId();
      return res.json({ childId });
    } catch (err: any) {
      console.error("Default child lookup error:", err);
      return res.status(503).json({ error: err?.message || "Database unavailable." });
    }
  });

  app.get("/api/progress/:childId", async (req: Request, res: Response): Promise<any> => {
    try {
      const progress = await getProgress(req.params.childId);
      return res.json({ progress });
    } catch (err: any) {
      console.error("Progress fetch error:", err);
      return res.status(503).json({ error: err?.message || "Failed to load progress." });
    }
  });

  app.patch("/api/progress/:childId/page", async (req: Request, res: Response): Promise<any> => {
    try {
      const { bookId, pageNumber, starsEarned, totalPages } = req.body;
      if (typeof bookId !== "string" || !bookId) {
        return res.status(400).json({ error: "bookId is required." });
      }
      if (typeof pageNumber !== "number" || pageNumber < 1) {
        return res.status(400).json({ error: "A valid pageNumber is required." });
      }
      const stars = typeof starsEarned === "number" ? starsEarned : 1;

      await recordPageRead(req.params.childId, bookId, pageNumber, stars, typeof totalPages === "number" ? totalPages : undefined);
      return res.json({ persisted: true });
    } catch (err: any) {
      console.error("Page-read persistence error:", err);
      return res.status(503).json({ error: err?.message || "Failed to save reading progress." });
    }
  });

  app.post("/api/progress/:childId/badge", async (req: Request, res: Response): Promise<any> => {
    try {
      const { badgeId, badgeName, icon } = req.body;
      if (typeof badgeId !== "string" || !badgeId) {
        return res.status(400).json({ error: "badgeId is required." });
      }
      await unlockBadgeInDb(req.params.childId, badgeId, badgeName || badgeId, icon || "🏅");
      return res.json({ persisted: true });
    } catch (err: any) {
      console.error("Badge persistence error:", err);
      return res.status(503).json({ error: err?.message || "Failed to save badge." });
    }
  });

  // ── 1. Text to Speech ─────────────────────────────────────────────────────────
  app.post("/api/tts", aiRateLimiter, async (req: Request, res: Response): Promise<any> => {
    try {
      const rawText = typeof req.body.text === "string" ? req.body.text : "";
      const text = sanitizeString(rawText, MAX_TTS_TEXT_LENGTH);
      if (!text) {
        return res.status(400).json({ error: "Text is required for TTS." });
      }
      const voice = req.body.voice || "Puck";

      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({
          error: "Gemini API key is not configured.",
          fallback: true,
        });
      }

      const validVoices = ["Puck", "Kore", "Zephyr", "Fenrir", "Charon"];
      const chosenVoice = validVoices.includes(voice) ? voice : "Puck";

      const promptText = `Please read this children's story text aloud in a cheerful, warm, expressive tone suitable for young readers:\n"${text}"`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: promptText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: chosenVoice },
            },
          },
        },
      });

      clearTimeout(timeout);

      const part = response.candidates?.[0]?.content?.parts?.[0];
      const inlineData = part?.inlineData;

      if (inlineData?.data) {
        return res.json({
          audioBase64: inlineData.data,
          mimeType: inlineData.mimeType || "audio/pcm;rate=24000",
          voice: chosenVoice,
        });
      }

      return res.status(500).json({
        error: "No audio data was returned by the TTS model.",
        fallback: true,
      });
    } catch (err: any) {
      console.error("TTS generation error:", err);
      return res.status(500).json({
        error: err?.message || "Failed to generate speech audio.",
        fallback: true,
      });
    }
  });

  // ── 2. Image Generation ───────────────────────────────────────────────────────
  app.post("/api/generate-illustration", imageRateLimiter, async (req: Request, res: Response): Promise<any> => {
    try {
      const rawPrompt = typeof req.body.prompt === "string" ? req.body.prompt : "";
      const prompt = sanitizeString(rawPrompt, 1000);
      if (!prompt) {
        return res.status(400).json({ error: "Image prompt is required." });
      }

      const {
        imageSize = "1K",
        aspectRatio = "4:3",
        style = "Whimsical Storybook Watercolor",
        pageNumber = 1,
        bookTitle = "Storybook",
      } = req.body;

      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({
          error: "Gemini API key is not configured.",
        });
      }

      const allowedSizes = ["1K", "2K", "4K"];
      const validatedSize = allowedSizes.includes(imageSize) ? imageSize : "1K";

      const allowedRatios = ["1:1", "3:4", "4:3", "16:9"];
      const validatedRatio = allowedRatios.includes(aspectRatio) ? aspectRatio : "4:3";

      const richPrompt = `High quality children's picture book illustration for the book "${bookTitle}", page ${pageNumber}. Art style: ${style}. Clean composition, vibrant cheerful colors, expressive characters, soft lighting, child-friendly atmosphere, magical detail: ${prompt}`;

      const imgController = new AbortController();
      const imgTimeout = setTimeout(() => imgController.abort(), 60_000);

      const response = await ai.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: {
          parts: [{ text: richPrompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: validatedRatio,
            imageSize: validatedSize,
          },
        },
      });

      clearTimeout(imgTimeout);

      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          const mime = part.inlineData.mimeType || "image/png";
          return res.json({
            imageUrl: `data:${mime};base64,${part.inlineData.data}`,
            imageSize: validatedSize,
            aspectRatio: validatedRatio,
          });
        }
      }

      return res.status(500).json({
        error: "Image generation completed but no image binary was received.",
      });
    } catch (err: any) {
      console.error("Image generation error:", err);
      return res.status(500).json({
        error: err?.message || "Failed to generate illustration with gemini-3-pro-image-preview.",
      });
    }
  });

  // ── 3. Reading Buddy Chat ─────────────────────────────────────────────────────
  app.post("/api/chat", aiRateLimiter, async (req: Request, res: Response): Promise<any> => {
    try {
      const { validation, messages: validMessages } = (() => {
        const result = validateMessages(req.body.messages);
        return { validation: result.valid, messages: result.messages };
      })();
      if (!validation) {
        return res.status(400).json({ error: `Valid messages array is required (1-${MAX_CHAT_MESSAGES} messages, max ${MAX_CHAT_MESSAGE_LENGTH} chars each).` });
      }

      const {
        taskType = "general",
        buddyRole = "owl",
        currentBook,
        currentPage,
      } = req.body;

      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({ error: "Gemini API key is not configured." });
      }

      let selectedModel = "gemini-3.5-flash";
      if (taskType === "complex") {
        selectedModel = "gemini-3.1-pro-preview";
      } else if (taskType === "fast") {
        selectedModel = "gemini-3.1-flash-lite";
      }

      const rolePersona =
        buddyRole === "dragon"
          ? `You are Pip the Playful Reading Dragon! You are a cozy, curious baby dragon who loves books, snacks, and reading with kids. You are enthusiastic, warm, use friendly dragon sounds (like *happy puff of smoke!* or *gentle tail wag*), and love cheering young readers on.`
          : `You are Barnaby the Wise Book Owl! You are a kind, gentle, glasses-wearing owl who is a wonderful reading tutor and story explorer. You speak warmly with gentle hoot puns (*hoot-hoot!*), encourage children when words are challenging, and celebrate curiosity.`;

      let contextInfo = "";
      if (currentBook) {
        contextInfo += `\nCurrent Book Title: "${currentBook.title}" (Reading Level: ${currentBook.level || "Early Reader"}).`;
      }
      if (currentPage) {
        contextInfo += `\nCurrent Page ${currentPage.pageNumber || 1} Text: "${currentPage.text || ""}"`;
      }

      const systemInstruction = `${rolePersona}
You are talking to a young reader (around 4 to 9 years old).
Your core directives:
1. Foster a joyful love of reading, phonics, and storytelling.
2. Keep your answers concise (2 to 4 sentences maximum), simple, and easy to read.
3. If the child asks about a difficult word, explain it in kid-friendly terms and show how to sound it out phonetically in syllables (e.g., "ex-plo-rer! 🗺️").
4. If asked for a quiz question, ask a fun, encouraging question about the current story page.
5. If asked a creative question (e.g., "what happens next?"), imagine a delightful, whimsical continuation!
6. Always end with a warm encouraging remark or a fun question back to the child.${contextInfo}`;

      const contents = validMessages.map((m) => ({
        role: m.role === "assistant" || m.role === "model" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      const chatController = new AbortController();
      const chatTimeout = setTimeout(() => chatController.abort(), 30_000);

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents,
        config: { systemInstruction },
      });

      clearTimeout(chatTimeout);

      const replyText = response.text || "That's a wonderful question! Let's keep exploring the story together!";

      return res.json({ reply: replyText, modelUsed: selectedModel, taskType });
    } catch (err: any) {
      console.error("Chat error:", err);
      return res.status(500).json({ error: err?.message || "Failed to get chatbot response." });
    }
  });

  // ── 4. Custom Story Generation ────────────────────────────────────────────────
  app.post("/api/create-story", aiRateLimiter, async (req: Request, res: Response): Promise<any> => {
    try {
      const childName = sanitizeString(req.body.childName || "Alex", 50);
      const theme = sanitizeString(req.body.theme || "An enchanted forest garden", MAX_STORY_PROMPT_LENGTH);
      const favoriteCompanion = sanitizeString(req.body.favoriteCompanion || "a friendly hedgehog", MAX_STORY_PROMPT_LENGTH);
      const readingLevel = ["Level 1", "Level 2", "Level 3"].includes(req.body.readingLevel) ? req.body.readingLevel : "Level 1";

      const ai = getGeminiClient();
      if (!ai) {
        return res.status(503).json({ error: "Gemini API key is not configured." });
      }

      const wordCountGuideline =
        readingLevel === "Level 3"
          ? "about 60-80 words per page with rich vocabulary"
          : readingLevel === "Level 2"
          ? "about 35-50 words per page with compound sentences"
          : "about 15-25 words per page with simple sight words and repetition";

      const prompt = `Write a charming, inspiring 4-page children's story for a child named "${childName}".
Theme: ${theme}.
Companion: ${favoriteCompanion}.
Reading Level: ${readingLevel} (${wordCountGuideline}).

Return ONLY a valid JSON object matching this structure:
{
  "title": "Story Title",
  "summary": "Brief 1-sentence book summary",
  "level": "${readingLevel}",
  "colorTheme": "emerald",
  "pages": [
    {
      "pageNumber": 1,
      "text": "Page text...",
      "illustrationPrompt": "Visual description of the scene for a children's storybook illustration in watercolor style",
      "keyWords": ["word1", "word2"]
    },
    {
      "pageNumber": 2,
      "text": "Page text...",
      "illustrationPrompt": "Visual description...",
      "keyWords": ["word3", "word4"]
    },
    {
      "pageNumber": 3,
      "text": "Page text...",
      "illustrationPrompt": "Visual description...",
      "keyWords": ["word5", "word6"]
    },
    {
      "pageNumber": 4,
      "text": "Page text...",
      "illustrationPrompt": "Visual description...",
      "keyWords": ["word7", "word8"]
    }
  ]
}`;

      const storyController = new AbortController();
      const storyTimeout = setTimeout(() => storyController.abort(), 30_000);

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });

      clearTimeout(storyTimeout);

      const responseText = response.text || "{}";
      let storyData;
      try {
        storyData = JSON.parse(responseText);
      } catch (parseErr) {
        console.error("Story JSON parse error:", parseErr);
        return res.status(502).json({ error: "AI returned invalid story format. Please try again." });
      }

      return res.json({ story: storyData });
    } catch (err: any) {
      console.error("Story creation error:", err);
      return res.status(500).json({ error: err?.message || "Failed to create custom story." });
    }
  });

  // ── Static / Vite ─────────────────────────────────────────────────────────────
  if (NODE_ENV === "development") {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (err: any) {
      console.warn("Vite dev server failed to start, falling back to static serving:", err?.message);
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (_req: Request, res: Response) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`StoryPals server running on http://0.0.0.0:${PORT} (${NODE_ENV})`);
    console.log(`[StoryPals] GEMINI_API_KEY present: ${!!process.env.GEMINI_API_KEY}`);
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY") {
      console.warn("⚠️  GEMINI_API_KEY is not set. AI features (TTS, illustrations, chat, story creation) will be disabled.");
    }
  });

  // ── Graceful shutdown ─────────────────────────────────────────────────────────
  const shutdown = (signal: string) => {
    console.log(`\n${signal} received — shutting down gracefully…`);
    server.close(async () => {
      console.log("HTTP server closed.");
      const { closeDb } = await import("./db/client.js");
      await closeDb();
      console.log("Database connection closed.");
      process.exit(0);
    });
    setTimeout(() => {
      console.warn("Forcing exit — connections did not drain in time.");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer();
