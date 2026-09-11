import React from "react";
import {
  ArrowLeft,
  Clock,
  BookOpen,
  Sparkles,
  Flame,
  CheckCircle2,
} from "lucide-react";
import { UserProgress, Book } from "../types";
import { ReadingHabitsChart } from "./ReadingHabitsChart";
import { reconcile7DayActivity, generateInitial7DayActivity } from "../utils/readingHabits";

interface ParentalDashboardProps {
  progress: UserProgress;
  books: Book[];
  onBackToShelf: () => void;
}

/**
 * Parent-facing view (issue 06). Distinct from the child-facing "Passport" —
 * no gamified rank/XP framing, just the numbers a parent actually wants:
 * time spent, per-book progress, words learned, and the same 7-day activity
 * chart the child sees. Reuses ReadingHabitsChart directly rather than a
 * separate WeeklyActivityChart component, since ReadingHabitsChart already
 * is the shared weekly bar chart both views need — duplicating it would
 * just be two copies of the same code to keep in sync.
 */
export const ParentalDashboard: React.FC<ParentalDashboardProps> = ({
  progress,
  books,
  onBackToShelf,
}) => {
  const weeklyActivity =
    progress.dailyActivity && progress.dailyActivity.length > 0
      ? reconcile7DayActivity(progress.dailyActivity)
      : generateInitial7DayActivity();

  const totalMinutesThisWeek = weeklyActivity.reduce((sum, d) => sum + d.minutes, 0);

  const booksInProgress = books.filter((book) => {
    const stat = progress.bookProgress[book.id];
    return stat && stat.pagesRead.length > 0 && !stat.completed;
  });

  const booksOpened = books.filter((book) => {
    const stat = progress.bookProgress[book.id];
    return stat && stat.pagesRead.length > 0;
  });

  return (
    <div id="parental-dashboard-container" className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <button
          id="parent-dashboard-back-btn"
          onClick={onBackToShelf}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-amber-200 text-amber-900 font-bold text-xs hover:bg-amber-50 transition-colors shadow-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Library</span>
        </button>

        <div className="text-center">
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-amber-950">
            Parent Dashboard 👨‍👩‍👧
          </h1>
          <p className="text-xs text-amber-800/80 font-medium">
            Reading progress, time spent, and words explored this week.
          </p>
        </div>

        <div className="w-24" />
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-4 border border-amber-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-extrabold text-stone-900">
              ~{totalMinutesThisWeek} min
            </div>
            <div className="text-[11px] font-semibold text-stone-500">Reading time this week</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-amber-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-extrabold text-stone-900">{booksInProgress.length}</div>
            <div className="text-[11px] font-semibold text-stone-500">Books in progress</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-amber-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-extrabold text-stone-900">
              {progress.wordsExplored.length}
            </div>
            <div className="text-[11px] font-semibold text-stone-500">Words explored</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-amber-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <div className="text-lg font-extrabold text-stone-900">
              {progress.readingStreakDays}d
            </div>
            <div className="text-[11px] font-semibold text-stone-500">Current streak</div>
          </div>
        </div>
      </div>

      {/* Weekly activity chart (shared with child passport) */}
      <div className="mb-10">
        <ReadingHabitsChart
          activity={weeklyActivity}
          streakDays={progress.readingStreakDays}
          dailyGoalPages={progress.dailyGoalPages}
        />
      </div>

      {/* Per-book progress table */}
      <div className="mb-10">
        <h3 className="font-display font-bold text-lg text-amber-950 mb-4">
          Progress by Book
        </h3>
        {booksOpened.length === 0 ? (
          <p className="text-sm text-stone-500">No books opened yet.</p>
        ) : (
          <div className="bg-white rounded-2xl border border-amber-200/80 shadow-xs overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-amber-100 bg-amber-50/60 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wide">
                  <th className="px-4 py-2.5">Book</th>
                  <th className="px-4 py-2.5">Level</th>
                  <th className="px-4 py-2.5">Pages read</th>
                  <th className="px-4 py-2.5">Stars</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {booksOpened.map((book) => {
                  const stat = progress.bookProgress[book.id];
                  return (
                    <tr key={book.id} className="border-b border-stone-100 last:border-0">
                      <td className="px-4 py-2.5 font-semibold text-stone-800">{book.title}</td>
                      <td className="px-4 py-2.5 text-stone-600">{book.levelShort}</td>
                      <td className="px-4 py-2.5 text-stone-600">
                        {stat.pagesRead.length} / {book.pages.length}
                      </td>
                      <td className="px-4 py-2.5 text-amber-700 font-bold">
                        ⭐ {stat.starsEarned}
                      </td>
                      <td className="px-4 py-2.5">
                        {stat.completed ? (
                          <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Completed
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-stone-500">In progress</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Words explored */}
      <div>
        <h3 className="font-display font-bold text-lg text-amber-950 mb-4">
          Words Explored
        </h3>
        {progress.wordsExplored.length === 0 ? (
          <p className="text-sm text-stone-500">No words looked up yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {progress.wordsExplored.map((w, idx) => (
              <div
                key={`${w.word}-${idx}`}
                className="bg-white rounded-xl border border-amber-200/80 shadow-xs p-3.5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display font-bold text-amber-950">{w.word}</span>
                  <span className="text-[11px] text-stone-400 font-mono">{w.syllables}</span>
                </div>
                <p className="text-xs text-stone-600 mt-1">{w.meaning}</p>
                <p className="text-[11px] text-stone-400 mt-1 italic">from {w.bookTitle}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
