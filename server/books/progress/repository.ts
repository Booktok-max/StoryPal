import { eq, and, gte } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import { users } from "../../db/schema/users.js";
import { childProfiles } from "../../db/schema/childProfiles.js";
import { readingProgress, dailyActivity } from "../../db/schema/progress.js";
import { achievements, childAchievements } from "../../db/schema/achievements.js";
import type { UserProgress, DailyReadingActivity } from "../../src/types";

type ReadingProgressInsert = typeof readingProgress.$inferInsert;
type DailyActivityInsert = typeof dailyActivity.$inferInsert;

const DEFAULT_PARENT_EMAIL = "default@local.storypals.app";
const DEFAULT_CHILD_NAME = "Reader";
const DAILY_GOAL_PAGES_DEFAULT = 3;

// ── Default child (no auth yet) ─────────────────────────────────────────────
// There's no login flow yet, so the client works against a single
// auto-provisioned child profile stored in localStorage after first fetch.
// TODO: replace with the session's actual childId once auth exists.
export async function getOrCreateDefaultChildId(): Promise<string> {
  const db = getDb();

  let [parent] = await db.select().from(users).where(eq(users.email, DEFAULT_PARENT_EMAIL)).limit(1);
  if (!parent) {
    const insertValues: typeof users.$inferInsert = { email: DEFAULT_PARENT_EMAIL, displayName: "Default Parent", role: "parent" };
    const inserted = await db.insert(users).values(insertValues).onConflictDoNothing().returning();
    parent = inserted[0] ?? (await db.select().from(users).where(eq(users.email, DEFAULT_PARENT_EMAIL)).limit(1))[0];
  }

  let [child] = await db.select().from(childProfiles).where(eq(childProfiles.parentUserId, parent.id)).limit(1);
  if (!child) {
    const insertValues: typeof childProfiles.$inferInsert = { parentUserId: parent.id, displayName: DEFAULT_CHILD_NAME, dailyGoalPages: DAILY_GOAL_PAGES_DEFAULT };
    [child] = await db.insert(childProfiles).values(insertValues).returning();
  }

  return child.id;
}

// ── Day-label helpers (mirrors src/utils/readingHabits.ts) ─────────────────
function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function last7DayDates(): string[] {
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(localDateStr(d));
  }
  return dates;
}

function dayLabelFor(dateStr: string): string {
  // Parse as local date (not UTC) so the label matches the activity_date.
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short" });
}

// ── Reads ────────────────────────────────────────────────────────────────────
export async function getProgress(childId: string): Promise<UserProgress> {
  const db = getDb();

  const [progressRows, activityRows, unlockedRows, child] = await Promise.all([
    db.select().from(readingProgress).where(eq(readingProgress.childId, childId)),
    db.select().from(dailyActivity).where(
      and(gte(dailyActivity.activityDate, last7DayDates()[0]), eq(dailyActivity.childId, childId))
    ),
    db
      .select({ name: achievements.name })
      .from(childAchievements)
      .innerJoin(achievements, eq(childAchievements.achievementId, achievements.id))
      .where(eq(childAchievements.childId, childId)),
    db.select().from(childProfiles).where(eq(childProfiles.id, childId)).limit(1).then((r) => r[0]),
  ]);

  const bookProgress: UserProgress["bookProgress"] = {};
  let totalStars = 0;
  let totalPagesRead = 0;
  const booksCompleted: string[] = [];

  for (const row of progressRows) {
    bookProgress[row.bookId] = {
      currentPage: row.currentPage,
      completed: row.completed,
      pagesRead: Array.from({ length: row.pagesRead }, (_, i) => i + 1), // page numbers aren't individually tracked in the DB row; length is
      starsEarned: row.starsEarned,
    };
    totalStars += row.starsEarned;
    totalPagesRead += row.pagesRead;
    if (row.completed) booksCompleted.push(row.bookId);
  }

  const activityByDate = new Map(activityRows.map((row) => [row.activityDate, row]));
  const dailyActivityOut: DailyReadingActivity[] = last7DayDates().map((date) => {
    const row = activityByDate.get(date);
    return {
      date,
      dayLabel: dayLabelFor(date),
      pages: row?.pages ?? 0,
      minutes: row?.minutes ?? 0,
      stars: row?.stars ?? 0,
      goalMet: row?.goalMet ?? false,
    };
  });

  const totalXp = activityRows.reduce((sum, row) => sum + row.xp, 0);
  const readingStreakDays = computeStreak(dailyActivityOut);

  return {
    totalStars,
    readingStreakDays,
    totalPagesRead,
    xp: totalXp,
    booksCompleted,
    bookProgress,
    unlockedBadges: unlockedRows.map((r) => r.name),
    wordsExplored: [], // words_explored has its own table but isn't wired to a read endpoint yet
    dailyActivity: dailyActivityOut,
    dailyGoalPages: child?.dailyGoalPages ?? DAILY_GOAL_PAGES_DEFAULT,
  };
}

function computeStreak(activity: DailyReadingActivity[]): number {
  let streak = 0;
  for (let i = activity.length - 1; i >= 0; i--) {
    if (activity[i].pages > 0) streak += 1;
    else break;
  }
  return streak;
}

// ── Writes ───────────────────────────────────────────────────────────────────
export async function recordPageRead(
  childId: string,
  bookId: string,
  pageNumber: number,
  starsEarned: number,
  totalPagesInBook?: number
): Promise<void> {
  const db = getDb();
  const today = localDateStr();

  const [existing] = await db
    .select()
    .from(readingProgress)
    .where(and(eq(readingProgress.childId, childId), eq(readingProgress.bookId, bookId)))
    .limit(1);

  const newPagesRead = (existing?.pagesRead ?? 0) + 1;
  const completed = totalPagesInBook ? newPagesRead >= totalPagesInBook : existing?.completed ?? false;

  if (existing) {
    await db
      .update(readingProgress)
      .set({
        currentPage: Math.max(existing.currentPage, pageNumber),
        pagesRead: newPagesRead,
        starsEarned: existing.starsEarned + starsEarned,
        completed,
        lastReadAt: new Date(),
        completedAt: completed && !existing.completed ? new Date() : existing.completedAt,
      } satisfies Partial<ReadingProgressInsert>)
      .where(eq(readingProgress.id, existing.id));
  } else {
    const insertValues: ReadingProgressInsert = {
      childId,
      bookId,
      currentPage: pageNumber,
      pagesRead: 1,
      starsEarned,
      completed,
      startedAt: new Date(),
      lastReadAt: new Date(),
      completedAt: completed ? new Date() : undefined,
    };
    await db.insert(readingProgress).values(insertValues);
  }

  const [existingActivity] = await db
    .select()
    .from(dailyActivity)
    .where(and(eq(dailyActivity.childId, childId), eq(dailyActivity.activityDate, today)))
    .limit(1);

  const newPages = (existingActivity?.pages ?? 0) + 1;

  if (existingActivity) {
    await db
      .update(dailyActivity)
      .set({
        pages: newPages,
        minutes: existingActivity.minutes + 4,
        stars: existingActivity.stars + starsEarned,
        xp: existingActivity.xp + 15,
        goalMet: newPages >= DAILY_GOAL_PAGES_DEFAULT,
      } satisfies Partial<DailyActivityInsert>)
      .where(eq(dailyActivity.id, existingActivity.id));
  } else {
    const insertValues: DailyActivityInsert = {
      childId,
      activityDate: today,
      pages: newPages,
      minutes: 4,
      stars: starsEarned,
      xp: 15,
      goalMet: newPages >= DAILY_GOAL_PAGES_DEFAULT,
    };
    await db.insert(dailyActivity).values(insertValues);
  }
}

export async function unlockBadge(childId: string, badgeId: string, badgeName: string, icon: string): Promise<void> {
  const db = getDb();

  let [achievement] = await db.select().from(achievements).where(eq(achievements.name, badgeId)).limit(1);
  if (!achievement) {
    const insertValues: typeof achievements.$inferInsert = {
      name: badgeId,
      description: badgeName,
      icon,
      requirementType: "custom",
      requirementValue: 0,
    };
    const inserted = await db.insert(achievements).values(insertValues).onConflictDoNothing().returning();
    achievement = inserted[0] ?? (await db.select().from(achievements).where(eq(achievements.name, badgeId)).limit(1))[0];
  }

  const childAchievementValues: typeof childAchievements.$inferInsert = { childId, achievementId: achievement.id };
  await db.insert(childAchievements).values(childAchievementValues).onConflictDoNothing();
}
