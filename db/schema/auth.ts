import { pgTable, uuid, varchar, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Stores bcrypt password hashes for email+password parents.
 * Separated from users so OAuth-only accounts have no row here.
 */
export const userPasswords = pgTable("user_passwords", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/**
 * HTTP-only server-side sessions.  No JWT — just an opaque token stored in a
 * cookie, looked up here on every request.
 */
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** The child the parent has switched into, or null (parent context). */
  activeChildId: uuid("active_child_id"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Rate-limiting table for login and password-reset attempts.
 * A row per (identifier, action) pair; the server checks count before acting.
 */
export const rateLimitAttempts = pgTable("rate_limit_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  identifier: varchar("identifier", { length: 320 }).notNull(), // email or IP
  action: varchar("action", { length: 50 }).notNull(),           // "login" | "reset"
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One-time tokens for password reset.
 */
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
