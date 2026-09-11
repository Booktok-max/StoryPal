export { bookRepository } from "./catalog";
export type { BookProvider, BookSearchQuery, BookSearchResult } from "./types";
import type { Book } from "../../src/types";
import type { BookProvider, BookSearchQuery } from "./types";

export class BookRepository {
  constructor(private readonly providers: BookProvider[]) {}

  async list(query: BookSearchQuery = {}): Promise<Book[]> {
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

  getProviders() {
    return this.providers.map(({ id, name, type, capabilities }) => ({ id, name, type, capabilities }));
  }
}

function dedupeBooks(books: Book[]): Book[] {
  const seenIds = new Set<string>();
  const seenFingerprints = new Set<string>();

  return books.filter((book) => {
    if (seenIds.has(book.id)) return false;
    seenIds.add(book.id);

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
