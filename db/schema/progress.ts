import { pgTable, uuid, varchar, integer, boolean, timestamp, date, uniqueIndex } from "drizzle-orm/pg-core";
import { childProfiles } from "./childProfiles";

// bookId is the catalog Book.id string (e.g. "openlibrary:OL123W",
// "builtin:tortoise-hare") — not a FK into the `books` table. The book
// catalog is provider-driven (Open Library, Standard Ebooks, public-domain
// JSON, etc.), not backed by DB rows, so there's no UUID to reference here.
export const readingProgress = pgTable("reading_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  childId: uuid("child_id").notNull().references(() => childProfiles.id, { onDelete: "cascade" }),
  bookId: varchar("book_id", { length: 500 }).notNull(),
  currentPage: integer("current_page").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
  pagesRead: integer("pages_read").notNull().default(0),
  starsEarned: integer("stars_earned").notNull().default(0),
  lastReadAt: timestamp("last_read_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  readingProgressUnique: uniqueIndex("reading_progress_unique").on(table.childId, table.bookId),
}));

export const readingSessions = pgTable("reading_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  childId: uuid("child_id").notNull().references(() => childProfiles.id, { onDelete: "cascade" }),
  bookId: varchar("book_id", { length: 500 }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  pagesRead: integer("pages_read").notNull().default(0),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  starsEarned: integer("stars_earned").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const dailyActivity = pgTable("daily_activity", {
  id: uuid("id").primaryKey().defaultRandom(),
  childId: uuid("child_id").notNull().references(() => childProfiles.id, { onDelete: "cascade" }),
  activityDate: date("activity_date").notNull(),
  pages: integer("pages").notNull().default(0),
  minutes: integer("minutes").notNull().default(0),
  stars: integer("stars").notNull().default(0),
  goalMet: boolean("goal_met").notNull().default(false),
  xp: integer("xp").notNull().default(0),
}, (table) => ({
  dailyActivityUnique: uniqueIndex("daily_activity_unique").on(table.childId, table.activityDate),
}));
