import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { childProfiles } from "./childProfiles";
import { books } from "./books";

export const chatSessions = pgTable("chat_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  childId: uuid("child_id").notNull().references(() => childProfiles.id, { onDelete: "cascade" }),
  bookId: uuid("book_id").references(() => books.id, { onDelete: "set null" }),
  buddyRole: varchar("buddy_role", { length: 20 }).default("owl"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => chatSessions.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(), // "user" | "model"
  content: text("content").notNull(),
  modelUsed: varchar("model_used", { length: 100 }),
  taskType: varchar("task_type", { length: 50 }), // "general" | "complex" | "fast"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
