import { pgTable, uuid, varchar, text, integer, boolean, timestamp, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";

export const bookLevelEnum = pgEnum("book_level", ["Level 1", "Level 2", "Level 3"]);
export const bookCategoryEnum = pgEnum("book_category", ["fable", "classic", "adventure", "custom"]);
export const bookStatusEnum = pgEnum("book_status", ["draft", "pending-review", "approved", "rejected"]);

export const books = pgTable("books", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 500 }).notNull(),
  author: varchar("author", { length: 500 }).notNull(),
  summary: text("summary"),
  level: bookLevelEnum("level"),
  category: bookCategoryEnum("category"),
  moral: text("moral"),
  language: varchar("language", { length: 10 }).default("en"),
  ageMin: integer("age_min"),
  ageMax: integer("age_max"),
  wordCount: integer("word_count"),
  estimatedMinutes: integer("estimated_minutes"),
  status: bookStatusEnum("status").notNull().default("approved"),
  aiEnhanced: boolean("ai_enhanced").default(false),
  coverAssetId: uuid("cover_asset_id"),
  colorTheme: varchar("color_theme", { length: 50 }).default("amber"),
  // Sprint C.A (0004): direct cover URL for DB-backed books, separate from
  // coverAssetId (an internal generated-asset reference). Lets
  // providers/database.ts serve a cover without going through the asset
  // pipeline.
  coverUrl: varchar("cover_url", { length: 1000 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const bookEditions = pgTable("book_editions", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookId: uuid("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  isbn10: varchar("isbn10", { length: 10 }),
  isbn13: varchar("isbn13", { length: 13 }),
  publisher: varchar("publisher", { length: 255 }),
  publicationDate: varchar("publication_date", { length: 20 }),
  editionTitle: varchar("edition_title", { length: 500 }),
  language: varchar("language", { length: 10 }),
  pageCount: integer("page_count"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const bookPages = pgTable("book_pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookId: uuid("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  pageNumber: integer("page_number").notNull(),
  text: text("text").notNull(),
  illustrationPrompt: text("illustration_prompt"),
  phonicsFocus: varchar("phonics_focus", { length: 100 }),
  keywords: text("keywords"), // JSON array stored as text
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("book_pages_unique").on(table.bookId, table.pageNumber),
]);
