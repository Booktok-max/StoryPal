import React from "react";
import {
  Award,
  Sparkles,
  Flame,
  BookOpen,
  CheckCircle2,
  Lock,
  ArrowLeft,
  Volume2,
  Star,
} from "lucide-react";
import { UserProgress, Book } from "../types";
import { BADGES_LIST } from "../data/initialBooks";
import { playBrowserSpeech } from "../utils/audioPlayer";
import { ReadingHabitsChart } from "./ReadingHabitsChart";
import { DailyGoalRadialProgress } from "./DailyGoalRadialProgress";
import {
  reconcile7DayActivity,
  generateInitial7DayActivity,
  getTodayReadingActivity,
} from "../utils/readingHabits";

interface ProgressDashboardProps {
  progress: UserProgress;
  books: Book[];
  onBackToShelf: () => void;
  onSelectBook: (book: Book) => void;
  onUpdateDailyGoal?: (newGoal: number) => void;
}

export const ProgressDashboard: React.FC<ProgressDashboardProps> = ({
  progress,
  books,
  onBackToShelf,
  onSelectBook,
  onUpdateDailyGoal,
}) => {
  // Reading rank based on XP
  const readingRank =
    progress.xp > 300
      ? "Master Storyteller 🌟"
      : progress.xp > 150
      ? "Book Explorer 🧭"
      : progress.xp > 50
      ? "Page Adventurer 🚀"
      : "Curious Sprout 🌱";

  const weeklyActivity =
    progress.dailyActivity && progress.dailyActivity.length > 0
      ? reconcile7DayActivity(progress.dailyActivity)
      : generateInitial7DayActivity();

  const todayActivity = getTodayReadingActivity(weeklyActivity);

  return (
    <div id="progress-dashboard-container" className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <button
          id="passport-back-btn"
          onClick={onBackToShelf}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-amber-200 text-amber-900 font-bold text-xs hover:bg-amber-50 transition-colors shadow-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Library</span>
        </button>

        <div className="text-center">
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-amber-950">
            My Reading Passport 🎖️
          </h1>
          <p className="text-xs text-amber-800/80 font-medium">
            Your reading achievements, earned stars, and word discoveries!
          </p>
        </div>

        <div className="w-20" />
      </div>

      {/* Gamified Hero Level Card */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-400 to-amber-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-amber-200/50 mb-8 border border-amber-300/40">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-3xl bg-white/20 backdrop-blur-md flex items-center justify-center text-4xl shadow-inner border border-white/30">
              ⭐
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/25 text-xs font-extrabold mb-1">
                <span>Rank:</span>
                <span>{readingRank}</span>
              </div>
              <h2 className="font-display font-extrabold text-2xl sm:text-3xl">
                {progress.totalStars} Stars Collected!
              </h2>
              <p className="text-xs sm:text-sm text-amber-100 font-medium">
                {progress.totalPagesRead} total pages read across {progress.booksCompleted.length} completed books.
              </p>
            </div>
          </div>

          {/* XP Progression Bar */}
          <div className="w-full sm:w-64 bg-black/20 backdrop-blur-md p-4 rounded-2xl border border-white/20">
            <div className="flex items-center justify-between text-xs font-bold mb-1">
              <span>Reader XP</span>
              <span>{progress.xp} XP</span>
            </div>
            <div className="w-full h-3 rounded-full bg-black/30 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-300 to-amber-200 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, (progress.xp / 400) * 100)}%` }}
              />
            </div>
            <div className="text-[10px] text-amber-100/80 text-right mt-1">
              {400 - (progress.xp % 400)} XP to next title!
            </div>
          </div>
        </div>
      </div>

      {/* Daily Goal Radial Progress Circle & 7-Day Reading Activity Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10 items-stretch">
        <div className="lg:col-span-5 flex flex-col">
          <DailyGoalRadialProgress
            todayActivity={todayActivity}
            dailyGoalPages={progress.dailyGoalPages}
            streakDays={progress.readingStreakDays}
            onUpdateDailyGoal={onUpdateDailyGoal}
            onSelectBook={books.length > 0 ? () => onSelectBook(books[0]) : undefined}
          />
        </div>
        <div className="lg:col-span-7 flex flex-col">
          <ReadingHabitsChart
            activity={weeklyActivity}
            streakDays={progress.readingStreakDays}
            dailyGoalPages={progress.dailyGoalPages}
            className="h-full"
          />
        </div>
      </div>

      {/* Book Progress Tracker Section */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-amber-800" />
          <h3 className="font-display font-bold text-lg text-amber-950">
            Progress Tracking by Book
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {books.map((book) => {
            const stat = progress.bookProgress[book.id] || {
              currentPage: 1,
              completed: false,
              pagesRead: [],
              starsEarned: 0,
            };
            const total = book.pages.length;
            const read = stat.pagesRead.length;
            const pct = Math.round((read / total) * 100);

            return (
              <div
                key={book.id}
                className="bg-white rounded-3xl p-5 border border-amber-200/80 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-extrabold px-2.5 py-1 rounded-xl bg-amber-100 text-amber-900">
                      {book.levelShort}
                    </span>
                    {stat.completed ? (
                      <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Completed!</span>
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-stone-500">
                        {read}/{total} pages
                      </span>
                    )}
                  </div>

                  <h4 className="font-display font-bold text-base text-amber-950 mb-1">
                    {book.title}
                  </h4>
                  <p className="text-xs text-stone-500 mb-4 line-clamp-1">
                    {book.summary}
                  </p>

                  {/* Progress bar */}
                  <div className="w-full h-2 rounded-full bg-stone-100 overflow-hidden mb-2">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-stone-500">
                    <span>{pct}% Read</span>
                    <span className="text-amber-800">⭐ {stat.starsEarned} Stars</span>
                  </div>
                </div>

                <button
                  onClick={() => onSelectBook(book)}
                  className="mt-4 w-full py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs border border-amber-200 transition-colors text-center"
                >
                  {stat.completed ? "Read Again" : "Continue Reading"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Collectible Badges Trophy Room */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-800" />
            <h3 className="font-display font-bold text-lg text-amber-950">
              Badge Trophy Showcase
            </h3>
          </div>
          <span className="text-xs font-bold text-amber-800 bg-amber-100 px-3 py-1 rounded-xl">
            {progress.unlockedBadges.length} of {BADGES_LIST.length} Unlocked
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {BADGES_LIST.map((badge) => {
            const isUnlocked = progress.unlockedBadges.includes(badge.id);

            return (
              <div
                key={badge.id}
                id={`badge-card-${badge.id}`}
                className={`p-4 rounded-3xl border transition-all flex flex-col items-center text-center ${
                  isUnlocked
                    ? "bg-white border-amber-300 shadow-md shadow-amber-100 scale-100"
                    : "bg-stone-50/80 border-stone-200/70 opacity-60"
                }`}
              >
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-3 shadow-xs ${
                    isUnlocked ? badge.color : "bg-stone-200 text-stone-400"
                  }`}
                >
                  {isUnlocked ? badge.icon : <Lock className="w-5 h-5" />}
                </div>
                <h4 className="font-display font-bold text-sm text-stone-900 mb-1">
                  {badge.name}
                </h4>
                <p className="text-[11px] text-stone-500 leading-relaxed mb-2">
                  {badge.description}
                </p>
                <div className="mt-auto">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isUnlocked
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-stone-200 text-stone-600"
                    }`}
                  >
                    {isUnlocked ? "✓ Unlocked!" : badge.requirement}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Word Vault (Vocabulary learned) */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <h3 className="font-display font-bold text-lg text-amber-950">
            My Word Vault ({progress.wordsExplored.length} Words Discovered)
          </h3>
        </div>

        {progress.wordsExplored.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-amber-200/80">
            <div className="text-3xl mb-2">✨</div>
            <h4 className="font-display font-bold text-base text-stone-800 mb-1">
              Your Word Vault is waiting!
            </h4>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              While reading any story page, tap any word to sound it out and see its kid-friendly definition. Each tapped word will be stored here in your vault!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {progress.wordsExplored.map((item, idx) => (
              <div
                key={`${item.word}-${idx}`}
                className="bg-white p-3.5 rounded-2xl border border-amber-200/80 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-display font-bold text-base text-amber-900 capitalize">
                      {item.word}
                    </span>
                    <button
                      onClick={() => playBrowserSpeech(item.word)}
                      className="p-1 text-stone-400 hover:text-amber-600 transition-colors"
                      title="Pronounce word"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-[11px] font-bold text-amber-700/80 mb-1">
                    {item.syllables}
                  </div>
                  <p className="text-[11px] text-stone-600 line-clamp-2 leading-relaxed">
                    {item.meaning}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
