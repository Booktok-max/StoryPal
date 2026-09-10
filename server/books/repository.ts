import type { Book } from "../../src/types";
import type { BookProvider, BookSearchQuery } from "./types";

export class BookRepository {
  constructor(private readonly providers: BookProvider[]) {}

  async list(query: BookSearchQuery = {}): Promise<Book[]> {
    // Metadata-only (discovery) providers — e.g. Open Library, Google Books —
    // don't have readable page content, so they're search-only and excluded
    // from the default unfiltered catalog listing.
    const providers = query.source
      ? this.providers.filter((p) => p.type === query.source)
      : this.providers.filter((p) => p.capabilities.fullText);

    const results = await Promise.all(
      providers.map((p) => p.search(query))
    );
    return dedupeBooks(results.flat().map((r) => r.book));
  }

  async search(query: BookSearchQuery): Promise<Book[]> {
    return this.list(query);
  }

  async getById(id: string): Promise<Book | null> {
    for (const provider of this.providers) {
      const book = await provider.getBook(id);
      if (book) return book;
    }
    return null;
  }

  /**
   * Persist a generated illustration back to whichever provider owns this
   * book. Returns the updated book, or null if no provider both has the
   * book and supports writing (e.g. Open Library results, which are
   * metadata-only and can't be persisted).
   */
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

  getProviders() {
    return this.providers.map(({ id, name, type, capabilities }) => ({ id, name, type, capabilities }));
  }
}

/**
 * Deduplicate books across providers.
 *
 * Strategy (in priority order):
 *   1. Exact ID match — fastest, catches same book from same provider twice.
 *   2. Title + author fingerprint — catches the same classic text imported
 *      as both a builtin entry and a public-domain import with different IDs.
 *
 * The first occurrence wins (providers are registered in priority order, so
 * builtin > public-domain > openlibrary).
 */
function dedupeBooks(books: Book[]): Book[] {
  const seenIds = new Set<string>();
  const seenFingerprints = new Set<string>();

  return books.filter((book) => {
    // 1. ID dedup
    if (seenIds.has(book.id)) return false;
    seenIds.add(book.id);

    // 2. Title + author fingerprint dedup
    const fingerprint = titleAuthorFingerprint(book.title, book.author);
    if (seenFingerprints.has(fingerprint)) return false;
    seenFingerprints.add(fingerprint);

    return true;
  });
}

function titleAuthorFingerprint(title: string, author: string): string {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]/g, "");
  return `${normalize(title)}::${normalize(author)}`;
}
