import { pgTable, uuid, varchar, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { childProfiles } from "./childProfiles";
import { books } from "./books";

export const storyStatusEnum = pgEnum("story_status", ["generating", "complete", "failed"]);

export const generatedStories = pgTable("generated_stories", {
  id: uuid("id").primaryKey().defaultRandom(),
  childId: uuid("child_id").notNull().references(() => childProfiles.id, { onDelete: "cascade" }),
  bookId: uuid("book_id").references(() => books.id, { onDelete: "set null" }),
  theme: varchar("theme", { length: 500 }).notNull(),
  favoriteCompanion: varchar("favorite_companion", { length: 200 }),
  readingLevel: varchar("reading_level", { length: 50 }),
  generationProvider: varchar("generation_provider", { length: 50 }).default("gemini"),
  generationModel: varchar("generation_model", { length: 100 }),
  promptVersion: varchar("prompt_version", { length: 20 }).default("1"),
  status: storyStatusEnum("status").notNull().default("generating"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
