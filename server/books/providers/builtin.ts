import { INITIAL_BOOKS } from "../../../src/data/initialBooks";
import type { Book } from "../../../src/types";
import type { BookProvider, BookSearchQuery, BookSearchResult } from "../types";

const books: Book[] = INITIAL_BOOKS.map((book) => ({
  ...book,
  source: book.source ?? { type: "builtin", providerId: "builtin" },
  status: book.status ?? "approved",
  language: book.language ?? "en",
}));

export const builtinProvider: BookProvider = {
  id: "builtin",
  name: "StoryPals Built-in Library",
  type: "builtin",
  capabilities: { metadata: true, fullText: true, covers: true, requiresApiKey: false },

  async search(query: BookSearchQuery): Promise<BookSearchResult[]> {
    const q = query.q?.trim().toLowerCase();
    const filtered = books.filter((book) => {
      if (book.status && book.status !== "approved") return false;
      if (q) {
        const haystack = [
          book.title,
          book.author,
          book.summary,
          book.category,
          book.tag,
          ...(book.subjects ?? []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (query.level && book.levelShort !== query.level) return false;
      if (query.category && book.category !== query.category) return false;
      if (query.source && book.source?.type !== query.source) return false;
      return true;
    });

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 100));
    const start = (page - 1) * pageSize;

    return filtered.slice(start, start + pageSize).map((book) => ({
      book,
      providerId: "builtin",
    }));
  },

  async getBook(externalId: string): Promise<Book | null> {
    return books.find((book) => book.id === externalId) ?? null;
  },
};
