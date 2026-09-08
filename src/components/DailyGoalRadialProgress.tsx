import React, { useState, useEffect, useRef } from "react";
import { Target, CheckCircle2, Flame, Sparkles, BookOpen, ArrowRight, PartyPopper } from "lucide-react";
import confetti from "canvas-confetti";
import { DailyReadingActivity } from "../types";
import { DAILY_GOAL_PAGES_DEFAULT } from "../utils/readingHabits";

interface DailyGoalRadialProgressProps {
  todayActivity: DailyReadingActivity;
  dailyGoalPages?: number;
  streakDays: number;
  onSelectBook?: () => void;
  onUpdateDailyGoal?: (newGoal: number) => void;
}

export const DailyGoalRadialProgress: React.FC<DailyGoalRadialProgressProps> = ({
  todayActivity,
  dailyGoalPages = DAILY_GOAL_PAGES_DEFAULT,
  streakDays,
  onSelectBook,
  onUpdateDailyGoal,
}) => {
  const pagesReadToday = todayActivity.pages;
  const goal = Math.max(1, dailyGoalPages);
  const rawPercentage = Math.round((pagesReadToday / goal) * 100);
  const clampedPercentage = Math.min(100, rawPercentage);
  const isGoalMet = pagesReadToday >= goal;
  const pagesRemaining = Math.max(0, goal - pagesReadToday);

  // Trigger small celebratory confetti burst
  const triggerGoalConfetti = () => {
    try {
      // Left side burst
      confetti({
        particleCount: 28,
        angle: 60,
        spread: 55,
        origin: { x: 0.3, y: 0.45 },
        colors: ["#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#fbbf24"],
        scalar: 0.95,
        disableForReducedMotion: true,
      });
      // Right side burst
      confetti({
        particleCount: 28,
        angle: 120,
        spread: 55,
        origin: { x: 0.7, y: 0.45 },
        colors: ["#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#fbbf24"],
        scalar: 0.95,
        disableForReducedMotion: true,
      });
    } catch (e) {
      console.debug("Confetti error", e);
    }
  };

  // Ref to trigger confetti once when reaching the daily goal
  const hasFiredForGoalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isGoalMet && hasFiredForGoalRef.current !== goal) {
      hasFiredForGoalRef.current = goal;
      // Delay slightly so confetti bursts right as radial circle animation completes
      const timer = setTimeout(() => {
        triggerGoalConfetti();
      }, 1150);
      return () => clearTimeout(timer);
    } else if (!isGoalMet) {
      hasFiredForGoalRef.current = null;
    }
  }, [isGoalMet, goal, pagesReadToday]);

  // Smooth counter animation from 0% to current progress
  const [displayPercentage, setDisplayPercentage] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    const duration = 1300;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplayPercentage(Math.round(easeOut * rawPercentage));

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      }
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [rawPercentage]);

  // SVG Radial Circle Calculations
  const size = 160;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Offset formula: circumference - (percent / 100) * circumference
  const strokeDashoffset = circumference - (clampedPercentage / 100) * circumference;

  return (
    <div
      id="daily-goal-radial-card"
      className="bg-white rounded-3xl p-6 sm:p-7 border border-amber-200/80 shadow-sm flex flex-col justify-between"
    >
      {/* Dynamic CSS Keyframe Animation for Radial Circle Fill */}
      <style>{`
        @keyframes radialProgressLoad {
          0% {
            stroke-dashoffset: ${circumference};
          }
          100% {
            stroke-dashoffset: ${strokeDashoffset};
          }
        }
        .animate-radial-circle-load {
          animation: radialProgressLoad 1.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center text-base">
            🎯
          </div>
          <div>
            <h3 className="font-display font-extrabold text-lg sm:text-xl text-amber-950">
              Daily Reading Goal
            </h3>
            <p className="text-xs text-stone-500">Today&apos;s habit target</p>
          </div>
        </div>

        {/* Status Pill */}
        {isGoalMet ? (
          <button
            onClick={triggerGoalConfetti}
            title="Click to celebrate with confetti! 🎉"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-extrabold shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Goal Reached! 🎉</span>
          </button>
        ) : (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">
            <span>{displayPercentage}% Complete</span>
          </span>
        )}
      </div>

      {/* Goal Reached Celebration Banner */}
      {isGoalMet && (
        <div className="mb-4 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-amber-50 via-emerald-50 to-orange-50 border border-emerald-200/90 flex items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
            <span className="text-base animate-bounce">🎉</span>
            <span>Target Achieved! Daily reading goal completed!</span>
          </div>
          <button
            onClick={triggerGoalConfetti}
            className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] shadow-xs active:scale-95 transition-all flex items-center gap-1 cursor-pointer shrink-0"
          >
            <PartyPopper className="w-3 h-3" />
            <span>Celebrate</span>
          </button>
        </div>
      )}

      {/* Main Radial Circle Display with Side-by-Side Comparison */}
      <div className="flex flex-col sm:flex-row items-center justify-around gap-6 my-2">
        {/* Radial Progress SVG Circle */}
        <div className="relative flex items-center justify-center select-none">
          <svg
            width={size}
            height={size}
            className="transform -rotate-90"
            viewBox={`0 0 ${size} ${size}`}
          >
            <defs>
              {/* Gradient for standard progress */}
              <linearGradient id="goalProgressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#ea580c" />
              </linearGradient>

              {/* Gradient for completed goal */}
              <linearGradient id="goalCompletedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#059669" />
              </linearGradient>
            </defs>

            {/* Background Track Circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#fef3c7"
              strokeWidth={strokeWidth}
              fill="transparent"
              className="transition-all"
            />

            {/* Animated Radial Progress Arc with CSS Keyframe Animation from 0% */}
            <circle
              key={`radial-arc-${goal}-${pagesReadToday}`}
              id="radial-progress-circle-arc"
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={isGoalMet ? "url(#goalCompletedGradient)" : "url(#goalProgressGradient)"}
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="animate-radial-circle-load transition-all duration-1000 ease-out"
            />
          </svg>

          {/* Center Content Inside the Circle */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <div className="text-3xl font-display font-extrabold text-amber-950 leading-none">
              {pagesReadToday}
              <span className="text-sm font-bold text-stone-400">/{goal}</span>
            </div>
            <span className="text-[11px] font-bold text-stone-500 mt-0.5">
              Pages Read
            </span>
            <div className="mt-1">
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  isGoalMet
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-800"
                }`}
              >
                {displayPercentage}%
              </span>
            </div>
          </div>
        </div>

        {/* Visual Target Comparison Breakdown */}
        <div className="flex-1 w-full space-y-3">
          <div className="p-3 rounded-2xl bg-amber-50/60 border border-amber-200/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white text-amber-800 flex items-center justify-center font-bold text-xs shadow-2xs">
                🎯
              </div>
              <span className="text-xs font-bold text-stone-700">Target Goal</span>
            </div>
            <span className="text-sm font-extrabold text-amber-950">
              {goal} {goal === 1 ? "page" : "pages"} / day
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-orange-50/60 border border-orange-200/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white text-orange-700 flex items-center justify-center font-bold text-xs shadow-2xs">
                📖
              </div>
              <span className="text-xs font-bold text-stone-700">Read Today</span>
            </div>
            <span className="text-sm font-extrabold text-orange-900">
              {pagesReadToday} {pagesReadToday === 1 ? "page" : "pages"}
            </span>
          </div>

          <div
            className={`p-3 rounded-2xl border flex items-center justify-between ${
              isGoalMet
                ? "bg-emerald-50/60 border-emerald-200/70 text-emerald-900"
                : "bg-stone-50 border-stone-200/80 text-stone-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shadow-2xs ${
                  isGoalMet ? "bg-emerald-500 text-white" : "bg-white text-stone-600"
                }`}
              >
                {isGoalMet ? "✓" : "⏳"}
              </div>
              <span className="text-xs font-bold">
                {isGoalMet ? "Goal Status" : "Remaining"}
              </span>
            </div>
            <span className="text-xs font-extrabold">
              {isGoalMet
                ? "Completed! 🎉"
                : `${pagesRemaining} more ${pagesRemaining === 1 ? "page" : "pages"}`}
            </span>
          </div>
        </div>
      </div>

      {/* Motivational Message & Streak Banner */}
      <div className="mt-4 pt-4 border-t border-stone-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-amber-900">
          <Flame className="w-4 h-4 text-orange-500 fill-orange-500 shrink-0" />
          <span className="font-medium">
            {isGoalMet
              ? `Awesome job! You kept your ${streakDays}-day reading streak burning bright!`
              : `Read ${pagesRemaining} more ${pagesRemaining === 1 ? "page" : "pages"} today to preserve your ${streakDays}-day streak!`}
          </span>
        </div>

        {/* Goal Quick Adjuster */}
        {onUpdateDailyGoal && (
          <div className="flex items-center gap-1 text-xs self-end sm:self-auto">
            <span className="text-stone-400 font-semibold text-[10px] mr-1">Goal:</span>
            {[2, 3, 5].map((g) => (
              <button
                key={g}
                onClick={() => onUpdateDailyGoal(g)}
                className={`px-2 py-0.5 rounded-lg font-bold text-[11px] transition-all ${
                  goal === g
                    ? "bg-amber-600 text-white shadow-2xs"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
                title={`Set daily goal to ${g} pages`}
              >
                {g}p
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
