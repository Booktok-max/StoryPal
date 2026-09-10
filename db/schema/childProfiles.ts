import { pgTable, uuid, varchar, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { users } from "./users";

export const ageBandEnum = pgEnum("age_band", ["4-5", "6-7", "8-9"]);
export const buddyRoleEnum = pgEnum("buddy_role", ["owl", "dragon"]);

export const childProfiles = pgTable("child_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  parentUserId: uuid("parent_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  avatarKey: varchar("avatar_key", { length: 50 }),
  readingLevel: varchar("reading_level", { length: 50 }),
  ageBand: ageBandEnum("age_band"),
  preferredLanguage: varchar("preferred_language", { length: 10 }).default("en"),
  buddyRole: buddyRoleEnum("buddy_role").default("owl"),
  dailyGoalPages: integer("daily_goal_pages").default(10),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const themeEnum = pgEnum("theme", ["light", "dark", "auto"]);
export const voiceEnum = pgEnum("voice", ["Puck", "Kore", "Zephyr"]);
export const fontFamilyEnum = pgEnum("font_family", ["quicksand", "fredoka", "dyslexic"]);
export const fontSizeEnum = pgEnum("font_size", ["normal", "large", "extra-large"]);

export const childSettings = pgTable("child_settings", {
  childId: uuid("child_id").primaryKey().references(() => childProfiles.id, { onDelete: "cascade" }),
  fontSize: fontSizeEnum("font_size").default("normal"),
  fontFamily: fontFamilyEnum("font_family").default("quicksand"),
  showSyllables: text("show_syllables").$type<boolean>().default(true),
  voice: voiceEnum("voice").default("Puck"),
  autoplayNarration: text("autoplay_narration").$type<boolean>().default(false),
  soundEnabled: text("sound_enabled").$type<boolean>().default(true),
  theme: themeEnum("theme").default("light"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});
