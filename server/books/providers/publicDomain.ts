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

// Serializes writes so two near-simultaneous saves can't race and clobber
// each other via a read-modify-write on the same file.
let writeQueue: Promise<void> = Promise.resolve();

async function saveBooks(books: Book[]): Promise<void> {
  const tmpFile = `${DATA_FILE}.tmp`;
  await fs.writeFile(tmpFile, JSON.stringify(books, null, 2), "utf8");
  await fs.rename(tmpFile, DATA_FILE);
}

export const publicDomainProvider: BookProvider = {
  id: "public-domain",
  name: "StoryPals Public-Domain Library",
  type: "public-domain",
  capabilities: { metadata: true, fullText: true, covers: true, requiresApiKey: false },

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

  async updatePageImage(
    id: string,
    pageIndex: number,
    imageUrl: string,
    imageSize: string
  ): Promise<Book | null> {
    const result = writeQueue.then(async () => {
      const books = await loadBooks();
      const bookIndex = books.findIndex((book) => book.id === id);
      if (bookIndex === -1) return null;

      const book = books[bookIndex];
      const page = book.pages[pageIndex];
      if (!page) return null;

      const updatedBook: Book = {
        ...book,
        pages: book.pages.map((p, i) =>
          i === pageIndex
            ? { ...p, currentImageUrl: imageUrl, imageSize: imageSize as Book["pages"][number]["imageSize"] }
            : p
        ),
      };
      books[bookIndex] = updatedBook;

      await saveBooks(books);
      return updatedBook;
    });

    writeQueue = result.then(
      () => undefined,
      () => undefined
    );

    return result;
  },

  async updateBookLevel(
    id: string,
    levelShort: Book["levelShort"],
    level: Book["level"]
  ): Promise<Book | null> {
    const result = writeQueue.then(async () => {
      const books = await loadBooks();
      const bookIndex = books.findIndex((book) => book.id === id);
      if (bookIndex === -1) return null;

      const updatedBook: Book = {
        ...books[bookIndex],
        levelShort,
        level,
      };
      books[bookIndex] = updatedBook;

      await saveBooks(books);
      return updatedBook;
    });

    writeQueue = result.then(
      () => undefined,
      () => undefined
    );

    return result;
  },

  async updateBookStatus(
    id: string,
    status: "approved" | "rejected"
  ): Promise<Book | null> {
    const result = writeQueue.then(async () => {
      const books = await loadBooks();
      const bookIndex = books.findIndex((book) => book.id === id);
      if (bookIndex === -1) return null;

      const updatedBook: Book = { ...books[bookIndex], status };
      books[bookIndex] = updatedBook;

      await saveBooks(books);
      return updatedBook;
    });

    writeQueue = result.then(
      () => undefined,
      () => undefined
    );

    return result;
  },

  async updateBookCover(
    id: string,
    coverImage: string
  ): Promise<Book | null> {
    const result = writeQueue.then(async () => {
      const books = await loadBooks();
      const bookIndex = books.findIndex((book) => book.id === id);
      if (bookIndex === -1) return null;

      const updatedBook: Book = { ...books[bookIndex], coverImage };
      books[bookIndex] = updatedBook;

      await saveBooks(books);
      return updatedBook;
    });

    writeQueue = result.then(
      () => undefined,
      () => undefined
    );

    return result;
  },
};
