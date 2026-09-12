import type { Book } from "../../../src/types";
import type { BookProvider, BookSearchQuery, BookSearchResult } from "../types";

const GOOGLE_BOOKS_URL = "https://www.googleapis.com/books/v1/volumes";
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 20;
const CACHE_TTL_MS = 5 * 60 * 1000;
// Same over-fetch pattern as openlibrary.ts (6.4): fetch several raw pages
// and keep collecting until we have enough child-relevant survivors, rather
// than filtering a single small page and showing whatever's left.
const RAW_PAGE_SIZE = 40;
const MAX_RAW_PAGES = 3;

const CHILD_CATEGORY_TERMS = [
  "juvenile",
  "children",
  "children's",
  "picture book",
  "early readers",
  "young readers",
  "middle grade",
  "family",
];

const BLOCKED_CATEGORY_TERMS = [
  "adult",
  "erotica",
  "pornography",
  "sexual",
  "true crime",
  "occult",
  "horror",
];

type GoogleVolume = {
  id?: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    description?: string;
    categories?: string[];
    language?: string;
    pageCount?: number;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    industryIdentifiers?: Array<{ type?: string; identifier?: string }>;
    maturityRating?: string;
  };
  accessInfo?: {
    viewability?: string;
    publicDomain?: boolean;
  };
};

type GoogleVolumesResponse = {
  totalItems?: number;
  items?: GoogleVolume[];
};

type CacheEntry = { expiresAt: number; value: GoogleVolumesResponse };
const cache = new Map<string, CacheEntry>();

function getApiKey(): string | undefined {
  return process.env.GOOGLE_BOOKS_API_KEY;
}

function isChildRelevant(vol: GoogleVolume): boolean {
  const info = vol.volumeInfo;
  if (!info?.title) return false;

  if (info.maturityRating && info.maturityRating !== "NOT_MATURE") return false;

  const categories = (info.categories ?? []).map((c) => c.toLowerCase());
  const text = `${categories.join(" ")} ${info.description ?? ""}`.toLowerCase();

  if (BLOCKED_CATEGORY_TERMS.some((term) => text.includes(term))) return false;

  if (categories.length > 0) {
    return CHILD_CATEGORY_TERMS.some((term) => text.includes(term));
  }

  // Sparse records: only let through if there's at least a cover to show.
  return Boolean(info.imageLinks?.thumbnail);
}

/** Quality heuristic mirroring openlibrary.ts's ranking (6.4): cover
 * presence + category richness + public-access signal, highest first. */
function qualityScore(vol: GoogleVolume): number {
  const info = vol.volumeInfo;
  let score = 0;
  if (info?.imageLinks?.thumbnail) score += 2;
  score += Math.min(3, info?.categories?.length ?? 0);
  if (vol.accessInfo?.publicDomain) score += 1;
  if (info?.description) score += 1;
  return score;
}

function getIsbn(vol: GoogleVolume): string | undefined {
  const ids = vol.volumeInfo?.industryIdentifiers ?? [];
  return (
    ids.find((i) => i.type === "ISBN_13")?.identifier ??
    ids.find((i) => i.type === "ISBN_10")?.identifier
  );
}

function normalizeLanguage(lang?: string): string {
  return lang || "en";
}

function classifyLevel(vol: GoogleVolume): Book["levelShort"] {
  const categories = (vol.volumeInfo?.categories ?? []).join(" ").toLowerCase();
  if (categories.includes("picture book") || categories.includes("early readers")) return "Level 1";
  if (categories.includes("juvenile") || categories.includes("children")) return "Level 2";
  return "Level 3";
}

function toBook(vol: GoogleVolume): Book | null {
  const info = vol.volumeInfo;
  if (!vol.id || !info?.title) return null;

  const author = info.authors?.[0] || "Unknown author";
  // Google serves cover thumbnails over http:// by default; upgrade to https
  // so the browser doesn't block a mixed-content image.
  const coverImage = info.imageLinks?.thumbnail?.replace(/^http:\/\//, "https://") || "";
  const subjects = (info.categories ?? []).slice(0, 12);
  const levelShort = classifyLevel(vol);

  return {
    id: `google-books:${vol.id}`,
    title: info.title,
    author,
    coverImage,
    level:
      levelShort === "Level 1"
        ? "Level 1 (Early Reader)"
        : levelShort === "Level 2"
        ? "Level 2 (Developing)"
        : "Level 3 (Confident)",
    levelShort,
    colorTheme: "emerald",
    summary: info.description || `Discover ${info.title} through Google Books. Full StoryPals reading content is not imported yet.`,
    pages: [],
    category: "classic",
    tag: "Google Books",
    source: {
      type: "google-books",
      providerId: "google-books",
      externalId: vol.id,
      sourceUrl: `https://books.google.com/books?id=${vol.id}`,
      hasFullText: vol.accessInfo?.viewability === "ALL_PAGES",
      ebookAccess: vol.accessInfo?.publicDomain ? "public" : undefined,
    },
    rights: { attributionRequired: true },
    language: normalizeLanguage(info.language),
    subjects,
    wordCount: info.pageCount ? info.pageCount * 250 : undefined,
    estimatedMinutes: info.pageCount ? Math.max(1, Math.round(info.pageCount * 1.5)) : undefined,
    status: "approved",
    aiEnhanced: false,
  };
}

async function fetchPage(query: string, startIndex: number): Promise<GoogleVolumesResponse> {
  const apiKey = getApiKey();
  const url = new URL(GOOGLE_BOOKS_URL);
  url.searchParams.set("q", `${query}+subject:juvenile`);
  url.searchParams.set("startIndex", String(startIndex));
  url.searchParams.set("maxResults", String(RAW_PAGE_SIZE));
  url.searchParams.set("printType", "books");
  url.searchParams.set("langRestrict", "en");
  if (apiKey) url.searchParams.set("key", apiKey);

  const cacheKey = url.toString();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Google Books returned HTTP ${response.status}`);
  }

  const data = (await response.json()) as GoogleVolumesResponse;
  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: data });
  return data;
}

export const googleBooksProvider: BookProvider = {
  id: "google-books",
  name: "Google Books",
  type: "google-books",
  capabilities: { metadata: true, fullText: false, covers: true, requiresApiKey: true },

  async search(query: BookSearchQuery): Promise<BookSearchResult[]> {
    const q = query.q?.trim();
    if (!q) return [];
    if (!getApiKey()) {
      // Fail soft: an unconfigured optional provider shouldn't break a
      // combined search — just contribute nothing.
      console.warn("[google-books] GOOGLE_BOOKS_API_KEY not set; skipping search.");
      return [];
    }

    const limit = Math.min(MAX_LIMIT, Math.max(1, query.pageSize ?? DEFAULT_LIMIT));
    const survivors: GoogleVolume[] = [];

    for (let page = 0; page < MAX_RAW_PAGES && survivors.length < limit; page++) {
      const data = await fetchPage(q, page * RAW_PAGE_SIZE);
      const items = data.items ?? [];
      survivors.push(...items.filter(isChildRelevant));
      if (items.length < RAW_PAGE_SIZE) break; // no more pages available
    }

    return survivors
      .sort((a, b) => qualityScore(b) - qualityScore(a))
      .slice(0, limit)
      .map(toBook)
      .filter((book): book is Book => Boolean(book))
      .map((book) => ({ book, providerId: "google-books" }));
  },

  async getBook(externalId: string): Promise<Book | null> {
    const id = externalId.replace(/^google-books:/, "");
    const apiKey = getApiKey();
    const url = new URL(`${GOOGLE_BOOKS_URL}/${encodeURIComponent(id)}`);
    if (apiKey) url.searchParams.set("key", apiKey);

    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) return null;

    const vol = (await response.json()) as GoogleVolume;
    return toBook({ ...vol, id });
  },
};

/** Exposed in case other providers want Google's own ISBN parsing. */
export { getIsbn };
// Exposed for unit testing the filtering/ranking logic in isolation
// (spec 6.3 step 6 — no such tests existed yet for any provider).
export { isChildRelevant, qualityScore };
