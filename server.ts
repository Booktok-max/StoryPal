import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { GoogleGenAI, Modality } from "@google/genai";
import { bookRepository, listBestsellers, NYT_LIST_NAMES, NYT_ATTRIBUTION, nytimesProviderInfo } from "./server/books";
import type { NytListSlug } from "./server/books";
import { importTextBook } from "./server/books/importer";
import { isDbHealthy } from "./db/client.js";
import { discoverImportOpenLibraryWork, DiscoveryImportError } from "./server/books/openLibraryImport";
import { getProgress, recordPageRead, unlockBadge as unlockBadgeInDb } from "./server/progress/repository.js";
import authRoutes from "./server/auth/routes.js";
import childRoutes from "./server/auth/childRoutes.js";
import { loadSession, requireAuth, requireChildContext } from "./server/auth/middleware.js";

dotenv.config();

// ── Process-level safety net (Sprint C) ─────────────────────────────────────
// Discovered via Sprint C's runtime smoke test: an unguarded async route
// handler that rejects (e.g. a malformed request hitting a DB type error)
// becomes an unhandled promise rejection, which crashes the entire Node
// process — taking every family's session down, not just the one bad
// request. Route-level asyncHandler wrappers (server/auth/routes.ts,
// server/auth/childRoutes.ts) are the real fix; this is defense-in-depth
// for anywhere that doesn't have one yet.
process.on("unhandledRejection", (reason) => {
  console.error("[StoryPals] Unhandled promise rejection (process kept alive):", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[StoryPals] Uncaught exception (process kept alive):", err);
});

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

  // Railway sits in front of this app as a reverse proxy, so incoming
  // requests always carry X-Forwarded-For. Without telling Express to
  // trust it, express-rate-limit can't safely use it to key requests by
  // real client IP (see ERR_ERL_UNEXPECTED_X_FORWARDED_FOR) — every
  // request would otherwise risk being bucketed under Railway's edge IP
  // instead of the actual visitor, which also weakens our own
  // per-IP login/reset rate limiting in server/auth/routes.ts.
  app.set("trust proxy", 1);

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

  // ── Auth (Sprint B) ──────────────────────────────────────────────────────────
  // express.json() must be registered before these routes — they read req.body.
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(loadSession); // makes req.session available on every request
  app.use("/api/auth", authRoutes);
  app.use("/api/children", childRoutes);

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
    // NYT is list-based, not a BookProvider (see server/books/providers/nytimes.ts),
    // so it isn't in bookRepository's internal array — surfaced here manually
    // so the frontend knows it exists.
    res.json({ providers: [...bookRepository.getProviders(), nytimesProviderInfo] });
  });

  // Bestseller rail (Section 6.3) — list-based, separate from free-text
  // search results by design; do not merge into /api/books/search.
  app.get("/api/books/featured", async (req: Request, res: Response): Promise<any> => {
    try {
      const list = typeof req.query.list === "string" ? req.query.list : "picture-books";
      if (!(list in NYT_LIST_NAMES)) {
        return res.status(400).json({
          error: `Unknown list "${list}". Valid options: ${Object.keys(NYT_LIST_NAMES).join(", ")}`,
        });
      }
      const books = await listBestsellers(list as NytListSlug);
      return res.json({
        books: books.map((b: any) => withGuaranteedCover(req, b)),
        listName: NYT_LIST_NAMES[list as NytListSlug],
        attribution: NYT_ATTRIBUTION,
      });
    } catch (err: any) {
      console.error("NYT bestsellers error:", err);
      return res.status(500).json({ error: err?.message || "Failed to load bestsellers." });
    }
  });

  // ── Cover placeholder (Spec Section 6.1, tier 6) ────────────────────────────
  // Deterministic, dependency-free fallback so a book cover can NEVER fail to
  // render: same title+author always produces the same SVG, generated locally
  // (no network call, no third-party asset), so this route itself cannot 404.
  const PLACEHOLDER_PALETTE: Array<[string, string]> = [
    ["#F97362", "#7A2E24"], // coral
    ["#4C8577", "#1F3A33"], // teal
    ["#6C7BC4", "#2A2F5C"], // periwinkle
    ["#E8A93A", "#5C3E10"], // amber
    ["#9B6FB0", "#3B2245"], // plum
    ["#5CA5D8", "#1B3C55"], // sky
  ];

  function hashString(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (hash * 31 + input.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  function initialsFor(title: string): string {
    const t = title.trim();
    if (!t) return "?";
    const words = t.split(/\s+/).filter(Boolean);
    const first = words[0]?.[0] || "";
    const second = words.length > 1 ? words[1]?.[0] || "" : "";
    return (first + second).toUpperCase() || "?";
  }

  function escapeXml(input: string): string {
    return input
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function wrapTitle(title: string, maxCharsPerLine = 16, maxLines = 3): string[] {
    const words = title.trim().split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length > maxCharsPerLine && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
      if (lines.length === maxLines) break;
    }
    if (current && lines.length < maxLines) lines.push(current);
    if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
      lines[maxLines - 1] = lines[maxLines - 1].replace(/.{0,3}$/, "...");
    }
    return lines.length > 0 ? lines : ["Untitled"];
  }

  app.get("/api/covers/placeholder", (req: Request, res: Response): any => {
    const title = sanitizeString(req.query.title, 120) || "Untitled";
    const author = sanitizeString(req.query.author, 120) || "";

    const seed = hashString(`${title}::${author}`);
    const [bg, fg] = PLACEHOLDER_PALETTE[seed % PLACEHOLDER_PALETTE.length];
    const initials = initialsFor(title);
    const titleLines = wrapTitle(title);

    const width = 300;
    const height = 450;
    const titleStartY = height / 2 - ((titleLines.length - 1) * 24) / 2;

    const label = escapeXml(`Cover placeholder for ${title}${author ? " by " + author : ""}`);

    const titleLinesSvg = titleLines
      .map(
        (line, i) =>
          `<text x="50%" y="${titleStartY + i * 26}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="20" font-weight="600" fill="${fg}">${escapeXml(line)}</text>`
      )
      .join("\n  ");

    const authorSvg = author
      ? `<text x="50%" y="${height - 40}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="15" fill="${fg}" fill-opacity="0.8">${escapeXml(author)}</text>`
      : "";

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}">
  <rect width="${width}" height="${height}" fill="${bg}"/>
  <rect x="16" y="16" width="${width - 32}" height="${height - 32}" fill="none" stroke="${fg}" stroke-opacity="0.35" stroke-width="2"/>
  <text x="50%" y="90" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="48" font-weight="700" fill="${fg}" fill-opacity="0.55">${escapeXml(initials)}</text>
  ${titleLinesSvg}
  ${authorSvg}
</svg>`;

    res.setHeader("Content-Type", "image/svg+xml");
    // Deterministic output → safe to cache aggressively both client- and edge-side.
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.status(200).send(svg);
  });

  // Builds an absolute placeholder-cover URL for a given book, using this
  // request's own origin so it works in dev, behind Railway's proxy, and
  // behind any future CDN without hardcoding a host.
  function placeholderCoverUrl(req: Request, title: string, author?: string): string {
    const origin = `${req.protocol}://${req.get("host")}`;
    const params = new URLSearchParams({ title: title || "Untitled" });
    if (author) params.set("author", author);
    return `${origin}/api/covers/placeholder?${params.toString()}`;
  }

  // Tracks how often the placeholder tier had to be used, as a lightweight
  // in-process counter (Section 6.1 "Monitoring"). Reset on process restart;
  // a durable counter belongs in the Section 29/37 monitoring work.
  let coverFallbackCount = 0;
  let coverResolvedCount = 0;

  // Guarantees every book object leaving this API has a resolvable cover
  // (Section 6.1, tiers 1-6): pass through an existing coverImage untouched,
  // otherwise fill in the deterministic placeholder. Never mutates the
  // caller's object.
  function withGuaranteedCover<T extends { coverImage?: string | null; title?: string; author?: string }>(
    req: Request,
    book: T
  ): T & { coverImage: string; coverIsPlaceholder: boolean } {
    coverResolvedCount++;
    const hasCover = typeof book.coverImage === "string" && book.coverImage.trim().length > 0;
    if (hasCover) {
      return { ...book, coverImage: book.coverImage as string, coverIsPlaceholder: false };
    }
    coverFallbackCount++;
    return {
      ...book,
      coverImage: placeholderCoverUrl(req, book.title || "Untitled", book.author),
      coverIsPlaceholder: true,
    };
  }

  app.get("/api/covers/fallback-stats", (_req: Request, res: Response) => {
    res.json({
      resolved: coverResolvedCount,
      fallbackToPlaceholder: coverFallbackCount,
      fallbackRate: coverResolvedCount > 0 ? coverFallbackCount / coverResolvedCount : 0,
    });
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
        books: books.map((b: any) => withGuaranteedCover(req, b)),
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
      return res.json({ books: books.map((b: any) => withGuaranteedCover(req, b)), total: books.length, query: q });
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
      return res.json({ book: withGuaranteedCover(req, book as any) });
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

  // Admin: replace or force-regenerate a book's cover (Section 6.1
  // "Admin"). Requires the same BOOK_IMPORT_ADMIN_KEY header used by the
  // import and status endpoints. Pass either an explicit coverImage URL,
  // or refetchPlaceholder: true to reset the cover to our own
  // deterministic tier-6 placeholder (useful when a hotlinked cover has
  // gone stale/broken and no better source is available yet).
  app.patch("/api/books/:id/cover", async (req: Request, res: Response): Promise<any> => {
    const configuredKey = process.env.BOOK_IMPORT_ADMIN_KEY;
    const suppliedKey = req.header("x-storypals-admin-key");
    if (!configuredKey || suppliedKey !== configuredKey) {
      return res.status(403).json({ error: "Invalid or missing admin key." });
    }

    try {
      const { coverImage, refetchPlaceholder } = req.body;

      let nextCoverImage: string;
      if (refetchPlaceholder === true) {
        const book = await bookRepository.getById(req.params.id);
        if (!book) return res.status(404).json({ error: "Book not found." });
        nextCoverImage = placeholderCoverUrl(req, book.title, book.author);
      } else if (typeof coverImage === "string" && coverImage.trim().length > 0) {
        nextCoverImage = coverImage.trim();
      } else {
        return res.status(400).json({
          error: "Provide a non-empty coverImage URL, or refetchPlaceholder: true.",
        });
      }

      const updatedBook = await bookRepository.updateBookCover(req.params.id, nextCoverImage);
      // For non-writable providers (openlibrary, standardebooks) updatedBook
      // is null — same convention as /level and /status: the client applies
      // the change in local state and this still reports success, along
      // with the resolved coverImage so the client knows what to show.
      return res.json({
        persisted: !!updatedBook,
        book: updatedBook ?? null,
        coverImage: nextCoverImage,
      });
    } catch (err: any) {
      console.error("Cover override error:", err);
      return res.status(500).json({ error: err?.message || "Failed to update cover." });
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

  // ── Progress persistence (Sprint C: Identity) ───────────────────────────────
  // Session-scoped: the active child comes from req.session.activeChildId
  // (set by POST /api/auth/switch-child), never from a client-supplied id in
  // the URL. requireChildContext (401/403) closes the hole where any caller
  // could previously read or write any child's progress by guessing an id.
  // localStorage stays the fast optimistic cache on the client; the DB is
  // the source of truth once it's reachable.

  app.get("/api/progress", requireAuth, requireChildContext, async (req: Request, res: Response): Promise<any> => {
    try {
      const progress = await getProgress(req.session!.activeChildId!);
      return res.json({ progress });
    } catch (err: any) {
      console.error("Progress fetch error:", err);
      return res.status(503).json({ error: err?.message || "Failed to load progress." });
    }
  });

  app.patch("/api/progress/page", requireAuth, requireChildContext, async (req: Request, res: Response): Promise<any> => {
    try {
      const { bookId, pageNumber, starsEarned, totalPages } = req.body;
      if (typeof bookId !== "string" || !bookId) {
        return res.status(400).json({ error: "bookId is required." });
      }
      if (typeof pageNumber !== "number" || pageNumber < 1) {
        return res.status(400).json({ error: "A valid pageNumber is required." });
      }
      const stars = typeof starsEarned === "number" ? starsEarned : 1;

      await recordPageRead(req.session!.activeChildId!, bookId, pageNumber, stars, typeof totalPages === "number" ? totalPages : undefined);
      return res.json({ persisted: true });
    } catch (err: any) {
      console.error("Page-read persistence error:", err);
      return res.status(503).json({ error: err?.message || "Failed to save reading progress." });
    }
  });

  app.post("/api/progress/badge", requireAuth, requireChildContext, async (req: Request, res: Response): Promise<any> => {
    try {
      const { badgeId, badgeName, icon } = req.body;
      if (typeof badgeId !== "string" || !badgeId) {
        return res.status(400).json({ error: "badgeId is required." });
      }
      await unlockBadgeInDb(req.session!.activeChildId!, badgeId, badgeName || badgeId, icon || "🏅");
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
          abortSignal: controller.signal,
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
          abortSignal: imgController.signal,
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
        config: { systemInstruction, abortSignal: chatController.signal },
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
        config: { responseMimeType: "application/json", abortSignal: storyController.signal },
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