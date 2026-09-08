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

export interface BookProvider {
  id: string;
  name: string;
  type: BookSourceType;
  search(query: BookSearchQuery): Promise<BookSearchResult[]>;
  getBook(externalId: string): Promise<Book | null>;
}
