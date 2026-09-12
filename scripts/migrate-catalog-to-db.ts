/**
 * Sprint C — one-time cutover script.
 *
 * Copies the hard-coded builtin catalog (src/data/initialBooks.ts) into the
 * `books` / `book_pages` / `book_sources` tables that have existed since
 * migration 0000 but have never been written to.
 *
 * This does NOT remove the builtin provider or delete initialBooks.ts —
 * run it, verify the `database` provider serves the same books via
 * `/api/books?source=public-domain`, then retire the builtin provider in a
 * follow-up change once you're confident.
 *
 * Idempotent: re-running skips any book whose title+author already exists
 * in `book_sources` with providerId "builtin-migration", so it's safe to
 * run more than once.
 *
 * Usage:
 *   npx tsx scripts/migrate-catalog-to-db.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

const MIGRATION_SOURCE_ID = "builtin-migration";

async function main() {
  const { getDb, closeDb } = await import("../db/client");
  const { books, bookPages } = await import("../db/schema/books");
  const { bookSources, providerRegistry } = await import("../db/schema/providers");
  const { INITIAL_BOOKS } = await import("../src/data/initialBooks");
  const { eq, and } = await import("drizzle-orm");

  const db = getDb();

  async function ensureProviderRow(): Promise<string> {
    const [existing] = await db
      .select()
      .from(providerRegistry)
      .where(eq(providerRegistry.name, MIGRATION_SOURCE_ID))
      .limit(1);
    if (existing) return existing.id;

    const [created] = await db
      .insert(providerRegistry)
      .values({
        name: MIGRATION_SOURCE_ID,
        type: "full-text",
        enabled: true,
        priority: 0,
        configuration: JSON.stringify({ note: "one-time builtin catalog migration" }),
      })
      .returning();
    return created.id;
  }

  const providerId = await ensureProviderRow();

  let migrated = 0;
  let skipped = 0;

  for (const book of INITIAL_BOOKS) {
    const [already] = await db
      .select({ id: bookSources.id })
      .from(bookSources)
      .innerJoin(books, eq(books.id, bookSources.bookId))
      .where(
        and(
          eq(bookSources.providerId, providerId),
          eq(books.title, book.title),
          eq(books.author, book.author)
        )
      )
      .limit(1);

    if (already) {
      skipped++;
      continue;
    }

    const [row] = await db
      .insert(books)
      .values({
        title: book.title,
        author: book.author,
        summary: book.summary,
        level: book.levelShort,
        category: book.category,
        moral: book.moral,
        language: book.language ?? "en",
        ageMin: book.ageMin,
        ageMax: book.ageMax,
        wordCount: book.wordCount,
        estimatedMinutes: book.estimatedMinutes,
        status: "approved",
        aiEnhanced: book.aiEnhanced ?? false,
        colorTheme: book.colorTheme,
      })
      .returning();

    if (book.pages.length > 0) {
      await db.insert(bookPages).values(
        book.pages.map((page) => ({
          bookId: row.id,
          pageNumber: page.pageNumber,
          text: page.text,
          illustrationPrompt: page.illustrationPrompt,
          phonicsFocus: page.phonicsFocus,
          keywords: JSON.stringify(page.keyWords ?? []),
        }))
      );
    }

    await db.insert(bookSources).values({
      bookId: row.id,
      providerId,
      externalId: book.id, // original builtin id, kept for traceability
      publicDomain: true,
      redistributionAllowed: true,
      metadataAvailable: true,
      fullTextAvailable: true,
    });

    migrated++;
  }

  console.log(`Migrated ${migrated} book(s), skipped ${skipped} already-migrated.`);
  await closeDb();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});