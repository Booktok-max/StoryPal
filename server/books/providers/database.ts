import { eq, asc, ilike, and, or } from "drizzle-orm";
import { getDb } from "../../../db/client";
import { books, bookPages } from "../../../db/schema/books";
import { bookSources } from "../../../db/schema/providers";
import type { Book, BookPage } from "../../../src/types";
import type { BookProvider, BookSearchQuery, BookSearchResult } from "../types";


// Maps the DB's short-form level enum to the full display string the
// frontend expects. Kept local to this provider so the DB schema doesn't
// need to know about UI copy.
const LEVEL_DISPLAY: Record<string, Book["level"]> = {
  "Level 1": "Level 1 (Early Reader)",
  "Level 2": "Level 2 (Developing)",
  "Level 3": "Level 3 (Confident)",
};

function toBookPage(row: typeof bookPages.$inferSelect): BookPage {
  return {
    pageNumber: row.pageNumber,
    text: row.text,
    illustrationPrompt: row.illustrationPrompt ?? "",
    keyWords: row.keywords ? (JSON.parse(row.keywords) as string[]) : [],
    phonicsFocus: row.phonicsFocus ?? undefined,
  };
}

async function loadBook(row: typeof books.$inferSelect): Promise<Book> {
  const db = getDb();
  const pageRows = await db
    .select()
    .from(bookPages)
    .where(eq(bookPages.bookId, row.id))
    .orderBy(asc(bookPages.pageNumber));

  const [sourceRow] = await db
    .select()
    .from(bookSources)
    .where(eq(bookSources.bookId, row.id))
    .limit(1);

  return {
    id: row.id,
    title: row.title,
    author: row.author,
    coverImage: row.coverUrl ?? "", // falls back to withGuaranteedCover() in server.ts if still empty
    level: row.level ? LEVEL_DISPLAY[row.level] : "Level 1 (Early Reader)",
    levelShort: (row.level as Book["levelShort"]) ?? "Level 1",
    colorTheme: row.colorTheme ?? "amber",
    summary: row.summary ?? "",
    pages: pageRows.map(toBookPage),
    category: row.category ?? undefined,
    moral: row.moral ?? undefined,
    language: row.language ?? "en",
    ageMin: row.ageMin ?? undefined,
    ageMax: row.ageMax ?? undefined,
    wordCount: row.wordCount ?? undefined,
    estimatedMinutes: row.estimatedMinutes ?? undefined,
    status: row.status,
    aiEnhanced: row.aiEnhanced ?? false,
    source: {
      type: "public-domain",
      providerId: "database",
      externalId: row.id,
      sourceUrl: sourceRow?.sourceUrl ?? undefined,
    },
    rights: sourceRow
      ? {
          license: sourceRow.license ?? undefined,
          publicDomain: sourceRow.publicDomain ?? undefined,
          attributionRequired: sourceRow.attributionRequired ?? undefined,
          redistributionAllowed: sourceRow.redistributionAllowed ?? undefined,
        }
      : undefined,
  };
}

/**
 * The first BookProvider backed by Postgres instead of JSON/in-memory data.
 * Reads/writes the `books` / `book_pages` / `book_sources` tables that have
 * existed since migration 0000 but were never wired to any provider.
 *
 * Registered alongside — not yet replacing — the JSON-backed providers.
 * New imports should write here going forward; existing JSON-backed
 * catalogs migrate over via scripts/migrate-catalog-to-db.ts.
 */
export const databaseProvider: BookProvider = {
  id: "database",
  name: "StoryPals Durable Catalog (Postgres)",
  type: "public-domain",
  capabilities: { metadata: true, fullText: true, covers: false, requiresApiKey: false },

  async search(query: BookSearchQuery): Promise<BookSearchResult[]> {
    const db = getDb();
    const conditions = [eq(books.status, "approved")];

    if (query.q?.trim()) {
      const q = `%${query.q.trim()}%`;
      conditions.push(or(ilike(books.title, q), ilike(books.author, q))!);
    }
    if (query.level) conditions.push(eq(books.level, query.level as any));
    if (query.category) conditions.push(eq(books.category, query.category as any));

    const rows = await db
      .select()
      .from(books)
      .where(and(...conditions))
      .limit(Math.min(100, query.pageSize ?? 100))
      .offset(((query.page ?? 1) - 1) * (query.pageSize ?? 100));

    const results = await Promise.all(rows.map(loadBook));
    return results.map((book) => ({ book, providerId: "database" }));
  },

  async getBook(externalId: string): Promise<Book | null> {
    const db = getDb();
    const [row] = await db.select().from(books).where(eq(books.id, externalId)).limit(1);
    if (!row) return null;
    return loadBook(row);
  },

  async updatePageImage(id, pageIndex, imageUrl, imageSize): Promise<Book | null> {
    const db = getDb();
    const [row] = await db.select().from(books).where(eq(books.id, id)).limit(1);
    if (!row) return null;
    // Illustration URLs live on assets/book_page_assets once object storage
    // is wired (next Sprint C step); until then this is a documented no-op
    // so callers know the write path exists but isn't durable yet.
    console.warn(
      `[database provider] updatePageImage(${id}, page ${pageIndex}) called before ` +
        `object storage is wired — image not persisted. See Sprint C spec.`
    );
    return loadBook(row);
  },

  async updateBookLevel(id, levelShort, level): Promise<Book | null> {
    const db = getDb();
    const [updated] = await db
      .update(books)
      .set({ level: levelShort as any })
      .where(eq(books.id, id))
      .returning();
    if (!updated) return null;
    return loadBook(updated);
  },

  async updateBookStatus(id, status): Promise<Book | null> {
    const db = getDb();
    const [updated] = await db
      .update(books)
      .set({ status })
      .where(eq(books.id, id))
      .returning();
    if (!updated) return null;
    return loadBook(updated);
  },
};
