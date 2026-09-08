import fs from "node:fs/promises";
import path from "node:path";
import { normalizeTextBook, type TextBookInput } from "./normalization/normalizeBook";
import type { Book } from "../../src/types";

const DATA_FILE = path.resolve(process.cwd(), "data/public-domain-books.json");

export async function importTextBook(input: TextBookInput): Promise<Book> {
  if (!input.title.trim()) throw new Error("Book title is required.");
  if (!input.author.trim()) throw new Error("Book author is required.");
  if (!input.text.trim()) throw new Error("Book text is required.");
  if (!input.license.trim()) throw new Error("License is required.");
  if (!input.publicDomain) throw new Error("Phase 3 only imports content explicitly verified as public-domain for your intended distribution territory.");

  const book = normalizeTextBook(input);
  const books = await readCatalog();
  const withoutDuplicate = books.filter((existing) => existing.id !== book.id);
  withoutDuplicate.push(book);
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(withoutDuplicate, null, 2), "utf8");
  return book;
}

export async function importTextFile(options: Omit<TextBookInput, "text"> & { filePath: string }): Promise<Book> {
  const text = await fs.readFile(path.resolve(options.filePath), "utf8");
  return importTextBook({ ...options, text });
}

async function readCatalog(): Promise<Book[]> {
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, "utf8")) as Book[];
  } catch {
    return [];
  }
}
