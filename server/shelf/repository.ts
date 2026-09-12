import { eq, and } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import { shelfItems } from "../../db/schema/shelf.js";

export type ShelfStatus = "want-to-read" | "reading" | "finished";

export type ShelfItem = {
  id: string;
  bookId: string;
  status: ShelfStatus;
  favorite: boolean;
  progressPage: number;
  addedAt: string;
  lastOpenedAt: string | null;
};

function toShelfItem(row: typeof shelfItems.$inferSelect): ShelfItem {
  return {
    id: row.id,
    bookId: row.bookId,
    status: row.status,
    favorite: row.favorite,
    progressPage: row.progressPage,
    addedAt: row.addedAt.toISOString(),
    lastOpenedAt: row.lastOpenedAt ? row.lastOpenedAt.toISOString() : null,
  };
}

export async function listShelf(childId: string): Promise<ShelfItem[]> {
  const db = getDb();
  const rows = await db.select().from(shelfItems).where(eq(shelfItems.childId, childId));
  return rows.map(toShelfItem);
}

export type AddToShelfResult =
  | { ok: true; item: ShelfItem }
  | { ok: false; error: "ALREADY_ON_SHELF" };

export async function addToShelf(childId: string, bookId: string): Promise<AddToShelfResult> {
  const db = getDb();

  const [existing] = await db
    .select()
    .from(shelfItems)
    .where(and(eq(shelfItems.childId, childId), eq(shelfItems.bookId, bookId)))
    .limit(1);
  if (existing) return { ok: false, error: "ALREADY_ON_SHELF" };

  const [inserted] = await db
    .insert(shelfItems)
    .values({ childId, bookId })
    // Belt-and-suspenders against a race with the SELECT above — the real
    // guarantee is the shelf_items_unique index from migration 0004.
    .onConflictDoNothing()
    .returning();

  if (!inserted) {
    return { ok: false, error: "ALREADY_ON_SHELF" };
  }

  return { ok: true, item: toShelfItem(inserted) };
}

export type UpdateShelfInput = {
  status?: ShelfStatus;
  favorite?: boolean;
  progressPage?: number;
};

export async function updateShelfItem(
  childId: string,
  bookId: string,
  input: UpdateShelfInput
): Promise<ShelfItem | null> {
  const db = getDb();

  const patch: Partial<typeof shelfItems.$inferInsert> = {};
  if (input.status !== undefined) patch.status = input.status;
  if (input.favorite !== undefined) patch.favorite = input.favorite;
  if (input.progressPage !== undefined) patch.progressPage = input.progressPage;
  if (input.status === "reading" || (input.progressPage ?? 0) > 0) {
    patch.lastOpenedAt = new Date();
  }

  const [updated] = await db
    .update(shelfItems)
    .set(patch)
    .where(and(eq(shelfItems.childId, childId), eq(shelfItems.bookId, bookId)))
    .returning();

  return updated ? toShelfItem(updated) : null;
}

export async function removeFromShelf(childId: string, bookId: string): Promise<boolean> {
  const db = getDb();
  const deleted = await db
    .delete(shelfItems)
    .where(and(eq(shelfItems.childId, childId), eq(shelfItems.bookId, bookId)))
    .returning({ id: shelfItems.id });
  return deleted.length > 0;
}
