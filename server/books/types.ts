import type { Book, BookSourceType } from "../../src/types";

export interface BookSearchQuery {
  q?: string;
  level?: Book["levelShort"];
  category?: Book["category"];
  source?: BookSourceType;
  page?: number;
  pageSize?: number;
}

export interface BookSearchResult {
  book: Book;
  providerId: string;
}

export interface BookProviderCapabilities {
  /** Returns title/author/cover/subject metadata. */
  metadata: boolean;
  /** getBook() returns readable page content, not just metadata. */
  fullText: boolean;
  /** Search results include a usable cover image. */
  covers: boolean;
  /** Requires an API key to function (informational, for /api/providers). */
  requiresApiKey: boolean;
}

export interface BookProvider {
  id: string;
  name: string;
  type: BookSourceType;
  capabilities: BookProviderCapabilities;
  search(query: BookSearchQuery): Promise<BookSearchResult[]>;
  getBook(externalId: string): Promise<Book | null>;
  /**
   * Persist a generated illustration for one page back to this provider's
   * storage. Optional — only providers that own writable storage (e.g. the
   * public-domain JSON catalog) implement this. Providers that don't should
   * omit the method entirely so the repository knows to skip them.
   * Returns the updated book, or null if this provider doesn't have the book.
   */
  updatePageImage?(
    id: string,
    pageIndex: number,
    imageUrl: string,
    imageSize: string
  ): Promise<Book | null>;
}
