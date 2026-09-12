import type { Book } from "../../../src/types";

const NYT_BASE_URL = "https://api.nytimes.com/svc/books/v3/lists/current";
// NYT list data updates weekly — cache far longer than the 5-min live-search
// TTL used by openlibrary/google-books (spec 6.3 step 6).
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export const NYT_ATTRIBUTION = "Based on reporting from The New York Times";

/** The subset of NYT's 50+ list names relevant to a children's reading app. */
export const NYT_LIST_NAMES = {
  "middle-grade-hardcover": "Children's Middle Grade Hardcover",
  "picture-books": "Picture Books",
  "series-books": "Series Books for Young People",
  "chapter-books": "Chapter Books",
} as const;

export type NytListSlug = keyof typeof NYT_LIST_NAMES;

type NytBook = {
  rank?: number;
  weeks_on_list?: number;
  title?: string;
  author?: string;
  publisher?: string;
  primary_isbn13?: string;
  primary_isbn10?: string;
  amazon_product_url?: string;
  description?: string;
};

type NytListResponse = {
  results?: {
    list_name?: string;
    books?: NytBook[];
  };
};

type CacheEntry = { expiresAt: number; value: Book[] };
const cache = new Map<string, CacheEntry>();

function getApiKey(): string | undefined {
  return process.env.NYT_API_KEY;
}

/** NYT doesn't host cover images — cross-reference the ISBN against Open
 * Library's cover endpoint instead (spec 6.3 step 4). */
function coverForIsbn(isbn: string | undefined): string {
  if (!isbn) return "";
  return `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`;
}

function toBook(nytBook: NytBook, listSlug: NytListSlug): Book | null {
  if (!nytBook.title || !nytBook.author) return null;

  const isbn = nytBook.primary_isbn13 || nytBook.primary_isbn10;
  const id = isbn || `${listSlug}:${nytBook.rank ?? 0}`;

  return {
    id: `nytimes:${id}`,
    title: nytBook.title,
    author: nytBook.author,
    coverImage: coverForIsbn(isbn),
    level: "Level 2 (Developing)",
    levelShort: "Level 2",
    colorTheme: "amber",
    summary: nytBook.description || `#${nytBook.rank ?? "?"} on the NYT ${NYT_LIST_NAMES[listSlug]} bestseller list.`,
    pages: [],
    category: "classic",
    tag: "NYT Bestseller",
    source: {
      type: "nytimes",
      providerId: "nytimes",
      externalId: id,
      sourceUrl: nytBook.amazon_product_url,
    },
    rights: { attributionRequired: true },
    language: "en",
    subjects: [NYT_LIST_NAMES[listSlug]],
    status: "approved",
    aiEnhanced: false,
  };
}

/**
 * List-based, not query-based — NYT's API has no free-text search, so this
 * intentionally doesn't implement BookProvider.search(). Meant to back a
 * dedicated GET /api/books/featured endpoint / "Bestsellers" rail (spec
 * 6.3 step 3 & 5), not the combined search results.
 */
export async function listBestsellers(listSlug: NytListSlug): Promise<Book[]> {
  if (!NYT_LIST_NAMES[listSlug]) {
    throw new Error(`Unknown NYT list: ${listSlug}`);
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[nytimes] NYT_API_KEY not set; returning no bestsellers.");
    return [];
  }

  const cached = cache.get(listSlug);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const url = new URL(`${NYT_BASE_URL}/${listSlug}.json`);
  url.searchParams.set("api-key", apiKey);

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`NYT Books API returned HTTP ${response.status}`);
  }

  const data = (await response.json()) as NytListResponse;
  const books = (data.results?.books ?? [])
    .map((b) => toBook(b, listSlug))
    .filter((b): b is Book => Boolean(b));

  cache.set(listSlug, { expiresAt: Date.now() + CACHE_TTL_MS, value: books });
  return books;
}

export const nytimesProviderInfo = {
  id: "nytimes",
  name: "NYT Books",
  type: "nytimes" as const,
  capabilities: { metadata: true, fullText: false, covers: false, requiresApiKey: true },
};
