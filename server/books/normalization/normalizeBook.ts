import type { Book, BookPage, BookSourceType } from "../../../src/types";
import { analyzeTextReadingLevel } from "./readingLevel";
import { reviewText } from "./safety";

// ─── Chapter detection ────────────────────────────────────────────────────────
// Matches common classic/Gutenberg chapter headings.
const CHAPTER_HEADING_RE =
  /^(chapter\s+[IVXLCDM\d]+|chapter\s+[a-z]+|part\s+[IVXLCDM\d]+|part\s+[a-z]+|section\s+\d+|book\s+[IVXLCDM\d]+|prologue|epilogue|introduction|preface)\b/i;

function isChapterHeading(paragraph: string): boolean {
  const firstLine = paragraph.split("\n")[0].trim();
  return CHAPTER_HEADING_RE.test(firstLine) && firstLine.length < 80;
}

// ─── Page splitter ────────────────────────────────────────────────────────────
// Strategy:
//   1. Chapter headings always start a new page.
//   2. Within a chapter, accumulate paragraphs until we hit targetWords.
//   3. Never split mid-paragraph.
function splitIntoPages(text: string, targetWords = 140): string[] {
  const paragraphs = text
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const pages: string[] = [];
  let currentParagraphs: string[] = [];
  let currentWordCount = 0;

  const flushPage = () => {
    if (currentParagraphs.length) {
      pages.push(currentParagraphs.join("\n\n"));
      currentParagraphs = [];
      currentWordCount = 0;
    }
  };

  for (const paragraph of paragraphs) {
    const wordCount = paragraph.split(/\s+/).filter(Boolean).length;

    // Chapter heading → always start a fresh page
    if (isChapterHeading(paragraph)) {
      flushPage();
      currentParagraphs.push(paragraph);
      currentWordCount = wordCount;
      continue;
    }

    // Would overflow target → flush first, then start new page
    if (currentParagraphs.length && currentWordCount + wordCount > targetWords) {
      flushPage();
    }

    currentParagraphs.push(paragraph);
    currentWordCount += wordCount;
  }

  flushPage();
  return pages.length ? pages : [text.trim()];
}

// ─── Illustration prompt generator ───────────────────────────────────────────
// Extracts key nouns and the opening sentence to build a specific,
// scene-grounded prompt rather than the generic fallback.
const STOP_WORDS = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with",
  "was","is","are","were","had","have","has","he","she","it","they","we",
  "his","her","its","their","that","this","then","than","as","be","been",
  "said","what","who","which","when","where","how","if","not","no","so",
  "do","did","up","out","one","all","by","from","into","about","over",
]);

function extractNouns(text: string): string[] {
  const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? [];
  return [...new Set(words.filter((w) => !STOP_WORDS.has(w)))].slice(0, 6);
}

function buildIllustrationPrompt(pageText: string): string {
  // Take the first sentence as the scene anchor
  const firstSentence = (pageText.match(/[^.!?]+[.!?]/) ?? [pageText])[0].trim();
  const nouns = extractNouns(pageText);

  const subjects = nouns.length
    ? `Key elements: ${nouns.join(", ")}.`
    : "";

  return [
    `Warm, child-friendly watercolour storybook illustration.`,
    `Scene: ${firstSentence}`,
    subjects,
    `Style: soft pastel palette, expressive characters, gentle lighting, suitable for ages 4–10.`,
  ]
    .filter(Boolean)
    .join(" ");
}

// ─── Page assembler ───────────────────────────────────────────────────────────
function toPages(text: string): BookPage[] {
  return splitIntoPages(text).map((pageText, index) => {
    const uniqueWords = Array.from(
      new Set(pageText.toLowerCase().match(/[a-zA-ZÀ-ÿ]{5,}/g) ?? [])
    ).slice(0, 8);

    return {
      pageNumber: index + 1,
      text: pageText,
      illustrationPrompt: buildIllustrationPrompt(pageText),
      keyWords: uniqueWords,
    };
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────
export interface TextBookInput {
  title: string;
  author: string;
  text: string;
  sourceUrl?: string;
  license: string;
  publicDomain: boolean;
  attributionRequired?: boolean;
  language?: string;
  summary?: string;
  category?: Book["category"];
  coverImage?: string;
  subjects?: string[];
  externalId?: string;

  // Provider identity overrides — default to the manually-imported
  // public-domain path (importer.ts). A provider like Gutenberg that fetches
  // and normalizes full text itself sets these so the resulting Book carries
  // its own source type/tag instead of being mislabeled "public-domain".
  sourceType?: BookSourceType;
  providerId?: string;
  tag?: string;
  colorTheme?: string;

  // Discovery-import path (Phase 4 item 3): the safety scan can still
  // reject content outright, but anything that would otherwise pass as
  // "approved" is held at this status instead — an externally-sourced
  // import always needs a parent/teacher's eyes on it before a child sees
  // it, even when nothing looked unsafe.
  forceStatus?: Book["status"];
}

export function normalizeTextBook(input: TextBookInput): Book {
  const pages = toPages(input.text);
  const normalizedText = pages.map((page) => page.text).join("\n");
  const levelShort = analyzeTextReadingLevel(normalizedText);
  const safety = reviewText(normalizedText);
  const status =
    input.forceStatus && safety.status !== "rejected"
      ? input.forceStatus
      : safety.status;
  const wordCount = normalizedText.split(/\s+/).filter(Boolean).length;

  const sourceType = input.sourceType ?? "public-domain";
  const providerId = input.providerId ?? "public-domain";
  const externalId = input.externalId ?? slugify(input.title);

  return {
    id: `${providerId}:${externalId}-${hashText(normalizedText)}`,
    title: input.title.trim(),
    author: input.author.trim() || "Unknown author",
    coverImage: input.coverImage ?? "",
    level:
      levelShort === "Level 1"
        ? "Level 1 (Early Reader)"
        : levelShort === "Level 2"
        ? "Level 2 (Developing)"
        : "Level 3 (Confident)",
    levelShort,
    colorTheme: input.colorTheme ?? "amber",
    summary:
      input.summary?.trim() || `A StoryPals reading edition of ${input.title}.`,
    pages,
    category: input.category ?? "classic",
    tag: input.tag ?? "Public Domain",
    source: {
      type: sourceType,
      providerId,
      externalId,
      sourceUrl: input.sourceUrl,
    },
    rights: {
      license: input.license,
      publicDomain: input.publicDomain,
      attributionRequired: input.attributionRequired ?? false,
      redistributionAllowed: input.publicDomain,
    },
    language: input.language ?? "en",
    subjects: input.subjects ?? [],
    wordCount,
    estimatedMinutes: Math.max(1, Math.ceil(wordCount / 130)),
    status,
    aiEnhanced: false,
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function hashText(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
