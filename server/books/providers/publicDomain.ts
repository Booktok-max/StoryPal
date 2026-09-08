import fs from "node:fs/promises";
import path from "node:path";
import type { Book } from "../../../src/types";
import type { BookProvider, BookSearchQuery, BookSearchResult } from "../types";

const DATA_FILE = path.resolve(process.cwd(), "data/public-domain-books.json");

async function loadBooks(): Promise<Book[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as Book[];
  } catch {
    return [];
  }
}

export const publicDomainProvider: BookProvider = {
  id: "public-domain",
  name: "StoryPals Public-Domain Library",
  type: "public-domain",

  async search(query: BookSearchQuery): Promise<BookSearchResult[]> {
    const books = await loadBooks();
    const q = query.q?.trim().toLowerCase();
    const filtered = books.filter((book) => {
      if (book.status !== "approved") return false;
      if (query.level && book.levelShort !== query.level) return false;
      if (query.category && book.category !== query.category) return false;
      if (!q) return true;
      return [book.title, book.author, book.summary, ...(book.subjects ?? [])]
        .join(" ").toLowerCase().includes(q);
    });
    return filtered.map((book) => ({ book, providerId: "public-domain" }));
  },

  async getBook(externalId: string): Promise<Book | null> {
    const books = await loadBooks();
    const id = externalId.replace(/^public-domain:/, "");
    return books.find((book) => book.id === externalId || book.source?.externalId === id) ?? null;
  },
};
