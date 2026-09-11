import { pgTable, uuid, varchar, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { childProfiles } from "./childProfiles";

export const achievements = pgTable("achievements", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  description: text("description").notNull(),
  icon: varchar("icon", { length: 50 }).notNull(),
  requirementType: varchar("requirement_type", { length: 50 }).notNull(), // e.g. "pages_read", "books_completed", "streak_days"
  requirementValue: integer("requirement_value").notNull(),
});

export const childAchievements = pgTable("child_achievements", {
  childId: uuid("child_id").notNull().references(() => childProfiles.id, { onDelete: "cascade" }),
  achievementId: uuid("achievement_id").notNull().references(() => achievements.id, { onDelete: "cascade" }),
  unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  childAchievementsUnique: uniqueIndex("child_achievements_unique").on(table.childId, table.achievementId),
}));

// bookId is the catalog Book.id string, not a FK — see progress.ts for why.
export const wordsExplored = pgTable("words_explored", {
  id: uuid("id").primaryKey().defaultRandom(),
  childId: uuid("child_id").notNull().references(() => childProfiles.id, { onDelete: "cascade" }),
  bookId: varchar("book_id", { length: 500 }),
  word: varchar("word", { length: 100 }).notNull(),
  syllables: varchar("syllables", { length: 200 }),
  meaning: text("meaning"),
  exploredAt: timestamp("explored_at", { withTimezone: true }).notNull().defaultNow(),
});
