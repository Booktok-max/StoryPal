import { pgTable, uuid, varchar, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { users } from "./users";

export const importFormatEnum = pgEnum("import_format", ["text", "epub", "pdf"]);
export const importStatusEnum = pgEnum("import_status", [
  "queued",
  "processing",
  "pending-review",
  "approved",
  "rejected",
  "failed",
]);

export const importJobs = pgTable("import_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  bookId: uuid("book_id"), // set once the job produces a books row; nullable while queued/processing
  filename: varchar("filename", { length: 500 }),
  format: importFormatEnum("format").notNull().default("text"),
  status: importStatusEnum("status").notNull().default("queued"),
  progress: integer("progress").notNull().default(0), // 0-100
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
