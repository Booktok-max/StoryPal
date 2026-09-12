export { bookRepository } from "./catalog";
export type { BookProvider, BookSearchQuery, BookSearchResult } from "./types";
import { eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import { bookCoverCache } from "../../db/schema/shelf";
import type { Book } from "../../src/types";
import type { BookProvider, BookSearchQuery } from "./types";

// Matches the "providerId:externalId" id shape used by every non-DB
// provider (openlibrary.ts, googlebooks.ts, standardEbooks.ts,
// publicDomain.ts) — as opposed to a raw uuid, which is a DB-backed
// `books.id` and has its own coverUrl column (migration 0004), not this
// cache. See db/migrations/0004_shelf_and_cover_url.sql for why these are
// two separate mechanisms.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isExternalProviderId(id: string): boolean {
  return !UUID_RE.test(id);
}

/**
 * Fire-and-forget: cache an external provider's cover URL so a later
 * getById() for the same book can fall back to it without a live API call
 * (Sprint C.A step 4). Never awaited by callers — a failed cache write
 * should never fail or slow down a book response.
 */
function cacheCoverIfPresent(book: Book): void {
  if (!book.coverImage || !isExternalProviderId(book.id)) return;
  const db = getDb();
  db.insert(bookCoverCache)
    .values({ bookId: book.id, coverUrl: book.coverImage })
    .onConflictDoUpdate({
      target: bookCoverCache.bookId,
      set: { coverUrl: book.coverImage, cachedAt: new Date() },
    })
    .catch((err: unknown) => console.warn(`[book-cover-cache] failed to cache ${book.id}:`, err));
}

async function fillCoverFromCache(book: Book): Promise<Book> {
  if (book.coverImage || !isExternalProviderId(book.id)) return book;
  try {
    const db = getDb();
    const [cached] = await db.select().from(bookCoverCache).where(eq(bookCoverCache.bookId, book.id)).limit(1);
    if (cached) return { ...book, coverImage: cached.coverUrl };
  } catch (err) {
    console.warn(`[book-cover-cache] lookup failed for ${book.id}:`, err);
  }
  return book;
}

export class BookRepository {
  constructor(private readonly providers: BookProvider[]) {}

  async list(query: BookSearchQuery = {}): Promise<Book[]> {
    const providers = query.source
      ? this.providers.filter((p) => p.type === query.source)
      : this.providers.filter((p) => p.capabilities.fullText);

    const results = await Promise.all(
      providers.map((p) => p.search(query))
    );
    const books = dedupeBooks(results.flat().map((r) => r.book));
    books.forEach(cacheCoverIfPresent);
    return books;
  }

  async search(query: BookSearchQuery): Promise<Book[]> {
    return this.list(query);
  }

  async getById(id: string): Promise<Book | null> {
    for (const provider of this.providers) {
      const book = await provider.getBook(id);
      if (!book) continue;
      cacheCoverIfPresent(book);
      return book.coverImage ? book : fillCoverFromCache(book);
    }
    return null;
  }

  async updatePageImage(
    id: string,
    pageIndex: number,
    imageUrl: string,
    imageSize: string
  ): Promise<Book | null> {
    for (const provider of this.providers) {
      if (!provider.updatePageImage) continue;
      const updated = await provider.updatePageImage(id, pageIndex, imageUrl, imageSize);
      if (updated) return updated;
    }
    return null;
  }

  /**
   * Persist a parental reading-level override for one book. Only writable
   * providers (currently: public-domain) implement this — for all others
   * the override is applied client-side only and survives until next reload.
   */
  async updateBookLevel(
    id: string,
    levelShort: Book["levelShort"],
    level: Book["level"]
  ): Promise<Book | null> {
    for (const provider of this.providers) {
      if (!provider.updateBookLevel) continue;
      const updated = await provider.updateBookLevel(id, levelShort, level);
      if (updated) return updated;
    }
    return null;
  }

  /**
   * Approve or reject a pending-review book. Only writable providers
   * (currently: public-domain) persist the change — for all others this
   * returns null and the client applies the update to its own state.
   */
  async updateBookStatus(
    id: string,
    status: "approved" | "rejected"
  ): Promise<Book | null> {
    for (const provider of this.providers) {
      if (!provider.updateBookStatus) continue;
      const updated = await provider.updateBookStatus(id, status);
      if (updated) return updated;
    }
    return null;
  }

  /**
   * Admin manual cover replace/re-fetch (Section 6.1 "Admin"). Only
   * writable providers (currently: public-domain) persist the change —
   * for all others this returns null and the client applies the update
   * to its own state until the next reload.
   */
  async updateBookCover(
    id: string,
    coverImage: string
  ): Promise<Book | null> {
    for (const provider of this.providers) {
      if (!provider.updateBookCover) continue;
      const updated = await provider.updateBookCover(id, coverImage);
      if (updated) return updated;
    }
    return null;
  }

  getProviders() {
    return this.providers.map(({ id, name, type, capabilities }) => ({ id, name, type, capabilities }));
  }
}

function dedupeBooks(books: Book[]): Book[] {
  const seenIds = new Set<string>();
  const seenIsbns = new Set<string>();
  const seenFingerprints = new Set<string>();

  return books.filter((book) => {
    // 1. Exact provider ID (catches same book fetched twice from the same provider)
    if (seenIds.has(book.id)) return false;
    seenIds.add(book.id);

    // 2. ISBN-based (catches the same edition across different providers,
    //    e.g. Google Books + NYT both returning the same ISBN-13)
    if (book.isbn) {
      const normalizedIsbn = book.isbn.replace(/[^0-9X]/gi, "");
      if (seenIsbns.has(normalizedIsbn)) return false;
      seenIsbns.add(normalizedIsbn);
    }

    // 3. Normalised title + primary-author fingerprint (broadest net)
    const fingerprint = titleAuthorFingerprint(book.title, book.author);
    if (seenFingerprints.has(fingerprint)) return false;
    seenFingerprints.add(fingerprint);

    return true;
  });
}

function titleAuthorFingerprint(title: string, author: string): string {
  const normalize = (s: string) =>
    s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
  return `${normalize(title)}::${normalize(author)}`;
}
