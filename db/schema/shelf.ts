import { pgTable, uuid, varchar, boolean, integer, timestamp, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { childProfiles } from "./childProfiles";

// A shelf item can point at a DB-backed `books.id` (uuid) OR at a
// provider-catalog id string (e.g. "openlibrary:OL123W") — mirrors the same
// dual-addressing pattern already used in progress.ts / achievements.ts,
// since not every book source is DB-backed yet (see Sprint C status note).
export const shelfStatusEnum = pgEnum("shelf_status", ["want-to-read", "reading", "finished"]);

export const shelfItems = pgTable("shelf_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  childId: uuid("child_id").notNull().references(() => childProfiles.id, { onDelete: "cascade" }),
  bookId: varchar("book_id", { length: 500 }).notNull(),
  status: shelfStatusEnum("status").notNull().default("want-to-read"),
  favorite: boolean("favorite").notNull().default(false),
  progressPage: integer("progress_page").notNull().default(0),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  lastOpenedAt: timestamp("last_opened_at", { withTimezone: true }),
}, (table) => ({
  shelfItemsUnique: uniqueIndex("shelf_items_unique").on(table.childId, table.bookId),
}));
