import { DailyReadingActivity } from "../types";

export const DAILY_GOAL_PAGES_DEFAULT = 3;

/**
 * Returns today's date as YYYY-MM-DD using the client's local calendar day,
 * not UTC. `Date().toISOString()` is always UTC, which credits reading done
 * late at night (in timezones ahead of UTC) to the wrong day and breaks
 * streaks. Use this everywhere a "today" or "which day is this" comparison
 * is needed.
 */
export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Returns an array of the last 7 days (including today) in chronological order
 */
export function getLast7DaysLabels(): Array<{ date: string; dayLabel: string; isToday: boolean }> {
  const days: Array<{ date: string; dayLabel: string; isToday: boolean }> = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = localDateStr(d);
    const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" }); // "Mon", "Tue"
    days.push({
      date: dateStr,
      dayLabel,
      isToday: i === 0,
    });
  }

  return days;
}

/**
 * Generate default initial 7 days reading activity showing positive momentum
 */
export function generateInitial7DayActivity(): DailyReadingActivity[] {
  const days = getLast7DaysLabels();
  // Sample reading pattern: encouraging habit building (e.g. 2, 3, 4, 2, 4, 3, 2 pages)
  const pattern = [2, 3, 4, 1, 3, 4, 2];

  return days.map((day, idx) => {
    const pages = pattern[idx % pattern.length];
    return {
      date: day.date,
      dayLabel: day.dayLabel,
      pages,
      minutes: pages * 4,
      stars: Math.max(1, Math.round(pages * 1.5)),
      goalMet: pages >= DAILY_GOAL_PAGES_DEFAULT,
    };
  });
}

/**
 * Ensures dailyActivity array contains all of the last 7 days, padding missing days with 0
 */
export function reconcile7DayActivity(
  existingActivity: DailyReadingActivity[] = []
): DailyReadingActivity[] {
  const days = getLast7DaysLabels();
  const map = new Map<string, DailyReadingActivity>();

  existingActivity.forEach((act) => {
    map.set(act.date, act);
  });

  return days.map((d) => {
    const existing = map.get(d.date);
    if (existing) {
      return {
        ...existing,
        dayLabel: d.dayLabel,
        goalMet: existing.pages >= DAILY_GOAL_PAGES_DEFAULT,
      };
    }
    return {
      date: d.date,
      dayLabel: d.dayLabel,
      pages: 0,
      minutes: 0,
      stars: 0,
      goalMet: false,
    };
  });
}

/**
 * Record a new page read into today's activity record
 */
export function recordPageReadActivity(
  activity: DailyReadingActivity[] = [],
  pagesReadCount: number = 1
): DailyReadingActivity[] {
  const reconciled = reconcile7DayActivity(activity);
  const todayStr = localDateStr();

  return reconciled.map((item) => {
    if (item.date === todayStr) {
      const newPages = item.pages + pagesReadCount;
      return {
        ...item,
        pages: newPages,
        minutes: item.minutes + pagesReadCount * 4,
        stars: item.stars + 1,
        goalMet: newPages >= DAILY_GOAL_PAGES_DEFAULT,
      };
    }
    return item;
  });
}

/**
 * Retrieve today's reading activity item
 */
export function getTodayReadingActivity(
  activity: DailyReadingActivity[] = []
): DailyReadingActivity {
  const reconciled = reconcile7DayActivity(activity);
  const todayStr = localDateStr();
  return (
    reconciled.find((d) => d.date === todayStr) || {
      date: todayStr,
      dayLabel: "Today",
      pages: 0,
      minutes: 0,
      stars: 0,
      goalMet: false,
    }
  );
}
