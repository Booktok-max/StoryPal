import type { Book } from "../../../src/types";
import type { BookProvider, BookSearchQuery, BookSearchResult } from "../types";

const OPEN_LIBRARY_SEARCH_URL = "https://openlibrary.org/search.json";
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 20;
const CACHE_TTL_MS = 5 * 60 * 1000;

const CHILD_SUBJECT_TERMS = [
  "juvenile",
  "children",
  "childrens",
  "children's",
  "juvenile fiction",
  "juvenile literature",
  "picture books",
  "early readers",
  "young readers",
  "school stories",
];

const BLOCKED_SUBJECT_TERMS = [
  "adult",
  "erotica",
  "pornography",
  "sexual",
  "true crime",
  "occult",
];

type OpenLibraryDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  author_key?: string[];
  cover_i?: number;
  first_publish_year?: number;
  subject?: string[];
  language?: string[];
  number_of_pages_median?: number;
  edition_key?: string[];
  ebook_access?: string;
  has_fulltext?: boolean;
};

type OpenLibraryResponse = {
  numFound?: number;
  num_found?: number;
  docs?: OpenLibraryDoc[];
};

type CacheEntry = {
  expiresAt: number;
  value: OpenLibraryResponse;
};

const cache = new Map<string, CacheEntry>();

function getUserAgent(): string {
  return process.env.OPEN_LIBRARY_USER_AGENT || "StoryPals/Phase2 (children's reading discovery)";
}

function isChildRelevant(doc: OpenLibraryDoc): boolean {
  const subjects = (doc.subject ?? []).map((s) => s.toLowerCase());
  if (subjects.some((subject) => BLOCKED_SUBJECT_TERMS.some((term) => subject.includes(term)))) {
    return false;
  }

  // If Open Library gives us subjects, require a child-oriented signal.
  // This keeps unmoderated general search results out of the child-facing catalog.
  if (subjects.length > 0) {
    return subjects.some((subject) =>
      CHILD_SUBJECT_TERMS.some((term) => subject.includes(term))
    );
  }

  // For sparse records, only allow books with a cover and a title into discovery.
  return Boolean(doc.title && doc.cover_i);
}

function normalizeLanguage(languages?: string[]): string {
  if (!languages?.length) return "en";
  const language = languages[0];
  const map: Record<string, string> = {
    eng: "en",
    en: "en",
    fre: "fr",
    fra: "fr",
    spa: "es",
    deu: "de",
    ger: "de",
    por: "pt",
    swa: "sw",
  };
  return map[language] || language;
}

function classifyLevel(doc: OpenLibraryDoc): Book["levelShort"] {
  const subjects = (doc.subject ?? []).join(" ").toLowerCase();
  if (subjects.includes("picture books") || subjects.includes("early readers")) return "Level 1";
  if (subjects.includes("juvenile") || subjects.includes("children")) return "Level 2";
  return "Level 3";
}

function toBook(doc: OpenLibraryDoc): Book | null {
  if (!doc.key || !doc.title) return null;

  const workId = doc.key.replace(/^\//, "");
  const externalId = workId.replace(/^works\//, "");
  const author = doc.author_name?.[0] || "Unknown author";
  const coverImage = doc.cover_i
    ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg?default=false`
    : "";
  const subjects = (doc.subject ?? []).slice(0, 12);
  const levelShort = classifyLevel(doc);
  const pageCount = doc.number_of_pages_median || 0;

  return {
    id: `openlibrary:${externalId}`,
    title: doc.title,
    author,
    coverImage,
    level: levelShort === "Level 1"
      ? "Level 1 (Early Reader)"
      : levelShort === "Level 2"
      ? "Level 2 (Developing)"
      : "Level 3 (Confident)",
    levelShort,
    colorTheme: "sky",
    summary: `Discover ${doc.title} through Open Library. Full StoryPals reading content is not imported yet.`,
    pages: [],
    category: "classic",
    tag: "Open Library",
    source: {
      type: "openlibrary",
      providerId: "openlibrary",
      externalId,
      sourceUrl: `https://openlibrary.org/${workId}`,
      hasFullText: doc.has_fulltext === true,
      ebookAccess: doc.ebook_access,
    },
    rights: {
      attributionRequired: true,
    },
    language: normalizeLanguage(doc.language),
    subjects,
    wordCount: pageCount > 0 ? pageCount * 250 : undefined,
    estimatedMinutes: pageCount > 0 ? Math.max(1, Math.round(pageCount * 1.5)) : undefined,
    status: "approved",
    aiEnhanced: false,
  };
}

async function fetchSearch(query: string, page: number, limit: number): Promise<OpenLibraryResponse> {
  const url = new URL(OPEN_LIBRARY_SEARCH_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("page", String(page));
  url.searchParams.set("limit", String(limit));
  url.searchParams.set(
    "fields",
    "key,title,author_name,author_key,cover_i,first_publish_year,subject,language,number_of_pages_median,edition_key,ebook_access,has_fulltext"
  );
  url.searchParams.set("lang", "en");

  const cacheKey = url.toString();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": getUserAgent(),
    },
  });

  if (!response.ok) {
    throw new Error(`Open Library returned HTTP ${response.status}`);
  }

  const data = (await response.json()) as OpenLibraryResponse;
  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value: data });
  return data;
}

export const openLibraryProvider: BookProvider = {
  id: "openlibrary",
  name: "Open Library",
  type: "openlibrary",
  capabilities: { metadata: true, fullText: false, covers: true, requiresApiKey: false },

  async search(query: BookSearchQuery): Promise<BookSearchResult[]> {
    const q = query.q?.trim();
    if (!q) return [];

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, query.pageSize ?? DEFAULT_LIMIT));
    const data = await fetchSearch(q, page, limit);

    return (data.docs ?? [])
      .filter(isChildRelevant)
      .map(toBook)
      .filter((book): book is Book => Boolean(book))
      .map((book) => ({ book, providerId: "openlibrary" }));
  },

  async getBook(externalId: string): Promise<Book | null> {
    const normalized = externalId.replace(/^openlibrary:/, "").replace(/^works\//, "");
    const response = await fetch(`https://openlibrary.org/works/${encodeURIComponent(normalized)}.json`, {
      headers: {
        Accept: "application/json",
        "User-Agent": getUserAgent(),
      },
    });

    if (!response.ok) return null;
    const work = await response.json() as {
      key?: string;
      title?: string;
      description?: string | { value?: string };
      subjects?: string[];
      covers?: number[];
    };

    if (!work.key || !work.title) return null;

    const book: Book = {
      id: `openlibrary:${normalized}`,
      title: work.title,
      author: "Open Library record",
      coverImage: work.covers?.[0]
        ? `https://covers.openlibrary.org/b/id/${work.covers[0]}-M.jpg?default=false`
        : "",
      level: "Level 2 (Developing)",
      levelShort: "Level 2",
      colorTheme: "sky",
      summary: typeof work.description === "string"
        ? work.description
        : work.description?.value || "Discover this book through Open Library.",
      pages: [],
      category: "classic",
      tag: "Open Library",
      source: {
        type: "openlibrary",
        providerId: "openlibrary",
        externalId: normalized,
        sourceUrl: `https://openlibrary.org/works/${normalized}`,
      },
      rights: { attributionRequired: true },
      language: "en",
      subjects: work.subjects?.slice(0, 12),
      status: "approved",
    };

    return book;
  },
};
