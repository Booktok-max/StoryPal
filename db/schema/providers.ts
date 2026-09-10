import { pgTable, uuid, varchar, text, boolean, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { books } from "./books";
import { bookEditions } from "./books";

export const providerTypeEnum = pgEnum("provider_type", ["metadata", "full-text", "ai", "hybrid"]);

export const providerRegistry = pgTable("provider_registry", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  type: providerTypeEnum("type").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  priority: integer("priority").notNull().default(0),
  baseUrl: varchar("base_url", { length: 500 }),
  configuration: text("configuration"), // JSON object stored as text
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const bookSources = pgTable("book_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookId: uuid("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  editionId: uuid("edition_id"),
  providerId: uuid("provider_id").notNull().references(() => providerRegistry.id, { onDelete: "cascade" }),
  externalId: varchar("external_id", { length: 255 }),
  sourceUrl: varchar("source_url", { length: 1000 }),
  license: varchar("license", { length: 255 }),
  rightsStatus: varchar("rights_status", { length: 50 }),
  publicDomain: boolean("public_domain").default(false),
  attributionRequired: boolean("attribution_required").default(false),
  redistributionAllowed: boolean("redistribution_allowed").default(false),
  metadataAvailable: boolean("metadata_available").default(false),
  coverAvailable: boolean("cover_available").default(false),
  previewAvailable: boolean("preview_available").default(false),
  fullTextAvailable: boolean("full_text_available").default(false),
  downloadAvailable: boolean("download_available").default(false),
  purchaseAvailable: boolean("purchase_available").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
