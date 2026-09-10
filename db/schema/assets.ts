import { pgTable, uuid, varchar, text, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { books } from "./books";
import { bookPages } from "./books";

export const assetKindEnum = pgEnum("asset_kind", ["cover", "illustration", "narration", "avatar"]);
export const assetStatusEnum = pgEnum("asset_status", ["pending", "ready", "failed", "deleted"]);

export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: assetKindEnum("kind").notNull(),
  storageKey: varchar("storage_key", { length: 500 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  sizeBytes: integer("size_bytes"),
  width: integer("width"),
  height: integer("height"),
  durationMs: integer("duration_ms"),
  checksum: varchar("checksum", { length: 64 }),
  status: assetStatusEnum("status").notNull().default("ready"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const bookPageAssets = pgTable("book_page_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookPageId: uuid("book_page_id").notNull().references(() => bookPages.id, { onDelete: "cascade" }),
  assetId: uuid("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  kind: assetKindEnum("kind").notNull(),
  voice: varchar("voice", { length: 50 }),
  isPrimary: boolean("is_primary").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
