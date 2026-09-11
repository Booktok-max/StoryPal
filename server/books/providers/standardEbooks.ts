import type { Book } from "../../../src/types";
import type { BookProvider, BookSearchQuery, BookSearchResult } from "../types";

// Standard Ebooks publishes per-subject Atom/OPDS feeds rather than a
// search API, so we pull the children's-relevant ones and filter/search
// client-side (same pattern OPDS itself expects consumers to use).
const FEED_URLS = [
  "https://standardebooks.org/feeds/opds/subjects/childrens",
  "https://standardebooks.org/feeds/opds/subjects/juvenile-fiction",
];

const CACHE_TTL_MS = 10 * 60 * 1000;

type OpdsEntry = {
  id: string;
  title: string;
  author: string;
  summary: string;
  coverUrl?: string;
  subjects: string[];
};

type CacheEntry = {
  expiresAt: number;
  value: OpdsEntry[];
};

const cache = new Map<string, CacheEntry>();

function getUserAgent(): string {
  return process.env.OPEN_LIBRARY_USER_AGENT || "StoryPals/Phase4 (children's reading discovery)";
}

// ─── Minimal Atom/OPDS parsing ──────────────────────────────────────────────
// No XML dependency in this project, and OPDS entries are regular enough
// that a small tag-scoped regex parser is reliable here without pulling one
// in just for this.

function decodeXmlText(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(block: string, tag: string): string | undefined {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? decodeXmlText(match[1]) : undefined;
}

function extractLinkHref(block: string, relPattern: RegExp): string | undefined {
  const linkTags = block.match(/<link\b[^>]*\/?>/gi) ?? [];
  for (const tag of linkTags) {
    if (relPattern.test(tag)) {
      const href = tag.match(/href="([^"]+)"/i)?.[1];
      if (href) return href;
    }
  }
  return undefined;
}

function extractSubjects(block: string): string[] {
  const tags = block.match(/<category\b[^>]*\/?>/gi) ?? [];
  return tags
    .map((tag) => tag.match(/label="([^"]+)"/i)?.[1] ?? tag.match(/term="([^"]+)"/i)?.[1])
    .filter((v): v is string => Boolean(v))
    .map((v) => decodeXmlText(v));
}

function parseOpdsEntries(xml: string): OpdsEntry[] {
  const entryBlocks = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];

  return entryBlocks
    .map((block): OpdsEntry | null => {
      const id = extractTag(block, "id");
      const title = extractTag(block, "title");
      if (!id || !title) return null;

      const authorBlock = block.match(/<author>[\s\S]*?<\/author>/i)?.[0] ?? "";
      const author = extractTag(authorBlock, "name") || "Unknown author";
      const summary =
        extractTag(block, "summary") || extractTag(block, "content") || "";
      const coverUrl = extractLinkHref(block, /rel="http:\/\/opds-spec\.org\/image"/i);
      const subjects = extractSubjects(block);

      return { id, title, author, summary, coverUrl, subjects };
    })
    .filter((e): e is OpdsEntry => e !== null);
}

async function fetchFeed(url: string): Promise<OpdsEntry[]> {
  const cached = cache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const response = await fetch(url, {
    headers: { Accept: "application/atom+xml", "User-Agent": getUserAgent() },
  });
  if (!response.ok) throw new Error(`Standard Ebooks feed returned HTTP ${response.status}`);

  const xml = await response.text();
  const entries = parseOpdsEntries(xml);
  cache.set(url, { expiresAt: Date.now() + CACHE_TTL_MS, value: entries });
  return entries;
}

async function fetchAllEntries(): Promise<OpdsEntry[]> {
  const feeds = await Promise.all(
    FEED_URLS.map((url) => fetchFeed(url).catch(() => [] as OpdsEntry[]))
  );

  const seen = new Set<string>();
  const merged: OpdsEntry[] = [];
  for (const entry of feeds.flat()) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    merged.push(entry);
  }
  return merged;
}

function classifyLevel(subjects: string[]): Book["levelShort"] {
  const joined = subjects.join(" ").toLowerCase();
  if (joined.includes("picture book") || joined.includes("early reader")) return "Level 1";
  if (joined.includes("juvenile") || joined.includes("children")) return "Level 2";
  return "Level 3";
}

function slugFromId(id: string): string {
  // Standard Ebooks ids are typically ebook URLs like
  // https://standardebooks.org/ebooks/author-name/book-title — keep the
  // path as the external id, it's already a stable, readable slug.
  try {
    const url = new URL(id);
    return url.pathname.replace(/^\/+|\/+$/g, "") || id;
  } catch {
    return id;
  }
}

function toBook(entry: OpdsEntry): Book {
  const externalId = slugFromId(entry.id);
  const levelShort = classifyLevel(entry.subjects);

  return {
    id: `standardebooks:${externalId}`,
    title: entry.title,
    author: entry.author,
    coverImage: entry.coverUrl
      ? entry.coverUrl.startsWith("http")
        ? entry.coverUrl
        : `https://standardebooks.org${entry.coverUrl}`
      : "",
    level:
      levelShort === "Level 1"
        ? "Level 1 (Early Reader)"
        : levelShort === "Level 2"
        ? "Level 2 (Developing)"
        : "Level 3 (Confident)",
    levelShort,
    colorTheme: "emerald",
    summary: entry.summary || `Discover ${entry.title} on Standard Ebooks.`,
    pages: [],
    category: "classic",
    tag: "Standard Ebooks",
    source: {
      type: "standardebooks",
      providerId: "standardebooks",
      externalId,
      sourceUrl: entry.id,
      // Standard Ebooks editions are all curated public-domain texts, but
      // unlike Open Library there's no plain-text/OCR file to pull — only
      // an EPUB, which this project has no parser for yet. Leaving
      // hasFullText/ebookAccess unset here (rather than claiming "public")
      // keeps the "Add to My Library" button correctly hidden until a real
      // EPUB-to-text import path exists — see BOOK_PLATFORM_PHASE4.md.
    },
    rights: {
      license: "Public domain (Standard Ebooks edition)",
      publicDomain: true,
      attributionRequired: true,
    },
    language: "en",
    subjects: entry.subjects.slice(0, 12),
    status: "approved",
    aiEnhanced: false,
  };
}

export const standardEbooksProvider: BookProvider = {
  id: "standardebooks",
  name: "Standard Ebooks",
  type: "standardebooks",
  // Discovery/metadata only for now — see the rights note in toBook() above
  // and BOOK_PLATFORM_PHASE4.md item 4 for why full text isn't pulled yet.
  capabilities: { metadata: true, fullText: false, covers: true, requiresApiKey: false },

  async search(query: BookSearchQuery): Promise<BookSearchResult[]> {
    const entries = await fetchAllEntries();
    const q = query.q?.trim().toLowerCase();

    const filtered = entries.filter((entry) => {
      if (!q) return true;
      return [entry.title, entry.author, entry.summary, ...entry.subjects]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.max(1, query.pageSize ?? 20);
    const start = (page - 1) * pageSize;

    return filtered
      .slice(start, start + pageSize)
      .map(toBook)
      .filter((book) => (query.level ? book.levelShort === query.level : true))
      .map((book) => ({ book, providerId: "standardebooks" }));
  },

  async getBook(externalId: string): Promise<Book | null> {
    const id = externalId.replace(/^standardebooks:/, "");
    const entries = await fetchAllEntries();
    const match = entries.find((entry) => slugFromId(entry.id) === id);
    return match ? toBook(match) : null;
  },
};
