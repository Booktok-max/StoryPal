import { eq, and, asc } from "drizzle-orm";
import { getDb } from "../../../db/client.js";
import { books, bookPages } from "../../../db/schema/books.js";
import { assets, bookPageAssets } from "../../../db/schema/assets.js";
import { isStorageConfigured, uploadBase64Image, randomKeySuffix, getPublicUrl } from "../../storage/objectStorage.js";

export type SavedIllustration = {
  currentImageUrl: string;
  imageSize: string;
};

/**
 * Persists a generated illustration for one page of a DB-backed book:
 * uploads the base64 image to object storage, then records it in
 * `assets` + `book_page_assets` (many-to-many, so history isn't destroyed —
 * only the newest illustration is marked isPrimary).
 *
 * `pageIndex` is the 0-based index into Book.pages, matching the frontend's
 * convention (see PATCH /api/books/:id/illustration) — NOT the 1-based
 * `book_pages.page_number` column, so pages are fetched in page-number
 * order and indexed into, rather than assuming pageNumber === pageIndex + 1.
 *
 * Returns null if the book/page doesn't exist, or if object storage isn't
 * configured (STORAGE_* env vars unset) — callers should treat that as
 * "not persisted, but not an error", same as before this existed.
 */
export async function saveIllustration(
  bookId: string,
  pageIndex: number,
  imageDataUrl: string,
  imageSize: string
): Promise<SavedIllustration | null> {
  if (!isStorageConfigured()) {
    console.warn(
      `[illustrations] STORAGE_* env vars not set — illustration for book ${bookId} page ${pageIndex} not persisted.`
    );
    return null;
  }

  const db = getDb();

  const [book] = await db.select({ id: books.id }).from(books).where(eq(books.id, bookId)).limit(1);
  if (!book) return null;

  const pages = await db
    .select()
    .from(bookPages)
    .where(eq(bookPages.bookId, bookId))
    .orderBy(asc(bookPages.pageNumber));
  const page = pages[pageIndex];
  if (!page) return null;

  const key = `illustrations/${bookId}/${page.pageNumber}-${imageSize}-${randomKeySuffix()}.png`;
  const uploaded = await uploadBase64Image(key, imageDataUrl);

  const [asset] = await db
    .insert(assets)
    .values({
      kind: "illustration",
      storageKey: uploaded.storageKey,
      mimeType: uploaded.mimeType,
      sizeBytes: uploaded.sizeBytes,
      status: "ready",
    })
    .returning();

  // Demote any previous primary illustration for this page before
  // inserting the new one, rather than deleting it — keeps history without
  // ambiguity about which one is "current".
  await db
    .update(bookPageAssets)
    .set({ isPrimary: false })
    .where(
      and(
        eq(bookPageAssets.bookPageId, page.id),
        eq(bookPageAssets.kind, "illustration"),
        eq(bookPageAssets.isPrimary, true)
      )
    );

  await db.insert(bookPageAssets).values({
    bookPageId: page.id,
    assetId: asset.id,
    kind: "illustration",
    isPrimary: true,
  });

  return { currentImageUrl: uploaded.url, imageSize };
}

/** Loads each page's current (isPrimary) illustration, if any, keyed by
 * book_pages.id — used by providers/database.ts's loadBook(). */
export async function loadPrimaryIllustrations(
  pageIds: string[]
): Promise<Map<string, SavedIllustration>> {
  if (pageIds.length === 0) return new Map();
  const db = getDb();

  const rows = await db
    .select({ pageId: bookPageAssets.bookPageId, storageKey: assets.storageKey })
    .from(bookPageAssets)
    .innerJoin(assets, eq(bookPageAssets.assetId, assets.id))
    .where(and(eq(bookPageAssets.kind, "illustration"), eq(bookPageAssets.isPrimary, true)));

  const result = new Map<string, SavedIllustration>();
  for (const row of rows) {
    if (!pageIds.includes(row.pageId)) continue;
    try {
      result.set(row.pageId, { currentImageUrl: getPublicUrl(row.storageKey), imageSize: "2K" });
    } catch {
      // STORAGE_PUBLIC_URL unset — skip rather than throw; page just falls
      // back to no illustration, same as before this existed.
    }
  }
  return result;
}
