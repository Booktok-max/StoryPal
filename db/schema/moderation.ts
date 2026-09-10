import { pgTable, uuid, varchar, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { users } from "./users";

export const reviewStatusEnum = pgEnum("review_status", ["pending", "approved", "rejected", "escalated"]);
export const riskLevelEnum = pgEnum("risk_level", ["low", "medium", "high", "critical"]);

export const contentReviews = pgTable("content_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentType: varchar("content_type", { length: 50 }).notNull(), // "book", "page", "illustration", "story", "chat"
  contentId: uuid("content_id").notNull(),
  status: reviewStatusEnum("status").notNull().default("pending"),
  riskLevel: riskLevelEnum("risk_level").default("low"),
  reviewerId: uuid("reviewer_id").references(() => users.id),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const moderationEvents = pgTable("moderation_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentType: varchar("content_type", { length: 50 }).notNull(),
  contentId: uuid("content_id").notNull(),
  provider: varchar("provider", { length: 50 }).notNull(),
  checkType: varchar("check_type", { length: 50 }).notNull(), // "keyword", "ai-review", "manual"
  result: varchar("result", { length: 50 }).notNull(), // "pass", "fail", "review"
  metadata: text("metadata"), // JSON
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
