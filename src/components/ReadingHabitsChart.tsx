import React, { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { Flame, Target, Trophy, Sparkles, Calendar, BookOpen, Clock } from "lucide-react";
import { DailyReadingActivity } from "../types";
import { DAILY_GOAL_PAGES_DEFAULT, localDateStr } from "../utils/readingHabits";

interface ReadingHabitsChartProps {
  activity: DailyReadingActivity[];
  streakDays: number;
  dailyGoalPages?: number;
  className?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: DailyReadingActivity;
  }>;
}

const HabitTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload;
    const isGoalMet = data.pages >= DAILY_GOAL_PAGES_DEFAULT;

    return (
      <div className="bg-white/95 backdrop-blur-md p-3.5 rounded-2xl shadow-xl border border-amber-200 text-xs z-50">
        <div className="flex items-center justify-between gap-3 mb-1.5 pb-1 border-b border-stone-100">
          <span className="font-extrabold text-amber-950">
            {data.dayLabel} ({data.date})
          </span>
          {isGoalMet ? (
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] flex items-center gap-1">
              <span>🎯 Goal Met</span>
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
              {DAILY_GOAL_PAGES_DEFAULT - data.pages} more to goal
            </span>
          )}
        </div>

        <div className="space-y-1 text-stone-700">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1 font-medium">
              <span>📖 Pages Read:</span>
            </span>
            <span className="font-extrabold text-stone-900">{data.pages}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1 font-medium">
              <span>⏱️ Reading Time:</span>
            </span>
            <span className="font-bold text-stone-700">~{data.minutes} mins</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1 font-medium">
              <span>⭐ Stars Earned:</span>
            </span>
            <span className="font-bold text-amber-600">+{data.stars}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const ReadingHabitsChart: React.FC<ReadingHabitsChartProps> = ({
  activity,
  streakDays,
  dailyGoalPages = DAILY_GOAL_PAGES_DEFAULT,
  className = "",
}) => {
  const [metric, setMetric] = useState<"pages" | "minutes">("pages");

  const todayStr = localDateStr();

  const totalPagesLast7 = activity.reduce((sum, d) => sum + d.pages, 0);
  const totalMinutesLast7 = activity.reduce((sum, d) => sum + d.minutes, 0);
  const daysGoalMet = activity.filter((d) => d.pages >= dailyGoalPages).length;

  const chartData = activity.map((item) => ({
    ...item,
    value: metric === "pages" ? item.pages : item.minutes,
    isToday: item.date === todayStr,
  }));

  const targetValue = metric === "pages" ? dailyGoalPages : dailyGoalPages * 4;

  return (
    <div
      id="reading-habits-section"
      className={`bg-white rounded-3xl p-6 sm:p-7 border border-amber-200/80 shadow-sm flex flex-col justify-between ${className}`}
    >
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center text-base">
              📈
            </div>
            <h3 className="font-display font-extrabold text-xl text-amber-950">
              7-Day Reading Activity
            </h3>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Build strong daily reading habits! Consistency helps young readers thrive.
          </p>
        </div>

        {/* View Toggle (Pages vs Minutes) */}
        <div className="flex items-center gap-2 bg-stone-100 p-1 rounded-2xl border border-stone-200/70 self-start sm:self-auto">
          <button
            id="chart-metric-pages-btn"
            onClick={() => setMetric("pages")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              metric === "pages"
                ? "bg-white text-amber-900 shadow-xs"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-600" />
            <span>Pages Read</span>
          </button>
          <button
            id="chart-metric-minutes-btn"
            onClick={() => setMetric("minutes")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              metric === "minutes"
                ? "bg-white text-amber-900 shadow-xs"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-orange-600" />
            <span>Minutes</span>
          </button>
        </div>
      </div>

      {/* Habit Highlights Pill Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs">
            <Flame className="w-5 h-5 fill-current" />
          </div>
          <div>
            <div className="text-base font-extrabold text-amber-950">
              {streakDays} Days
            </div>
            <div className="text-[11px] font-semibold text-amber-800/80">
              Active Streak
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold shadow-xs">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-extrabold text-emerald-950">
              {daysGoalMet} / 7 Days
            </div>
            <div className="text-[11px] font-semibold text-emerald-800/80">
              Goal Reached
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500 text-white flex items-center justify-center font-bold shadow-xs">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-extrabold text-sky-950">
              {totalPagesLast7} Pages
            </div>
            <div className="text-[11px] font-semibold text-sky-800/80">
              This Week
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200/60 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500 text-white flex items-center justify-center font-bold shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-extrabold text-purple-950">
              ~{totalMinutesLast7} mins
            </div>
            <div className="text-[11px] font-semibold text-purple-800/80">
              Story Time
            </div>
          </div>
        </div>
      </div>

      {/* Visual Recharts Bar Chart */}
      <div className="w-full h-64 sm:h-72 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 15, right: 10, left: -20, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#fef3c7"
            />
            <XAxis
              dataKey="dayLabel"
              axisLine={{ stroke: "#e7e5e4" }}
              tickLine={false}
              tick={{ fill: "#78716c", fontSize: 12, fontWeight: 700 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#a8a29e", fontSize: 11, fontWeight: 600 }}
              allowDecimals={false}
            />
            <Tooltip content={<HabitTooltip />} cursor={{ fill: "rgba(254, 243, 199, 0.4)" }} />
            <ReferenceLine
              y={targetValue}
              stroke="#f97316"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `Goal (${targetValue} ${metric})`,
                position: "insideTopRight",
                fill: "#ea580c",
                fontSize: 11,
                fontWeight: 700,
              }}
            />
            <Bar
              dataKey="value"
              radius={[10, 10, 0, 0]}
              maxBarSize={48}
              animationDuration={900}
            >
              {chartData.map((entry, index) => {
                // Color logic:
                // If today: bold highlight
                // If goal met: rich emerald or amber
                // If pages > 0: warm golden amber
                // If 0: faint stone
                let fillColor = "#e7e5e4";
                if (entry.isToday) {
                  fillColor = "#ea580c"; // bright warm flame orange for today
                } else if (entry.value >= targetValue) {
                  fillColor = "#f59e0b"; // golden amber when goal met
                } else if (entry.value > 0) {
                  fillColor = "#fcd34d"; // soft golden yellow
                }

                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={fillColor}
                    stroke={entry.isToday ? "#c2410c" : "transparent"}
                    strokeWidth={entry.isToday ? 2 : 0}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend and Habit Booster Tip */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-2 border-t border-stone-100 text-xs">
        <div className="flex items-center gap-4 text-stone-600 font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-[#ea580c]" />
            <span>Today</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-[#f59e0b]" />
            <span>Goal Reached (≥{dailyGoalPages} pages)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-[#fcd34d]" />
            <span>Some Reading</span>
          </div>
        </div>

        <div className="text-amber-800/90 font-bold flex items-center gap-1 bg-amber-50 px-3 py-1 rounded-full border border-amber-200/70">
          <span>🌟 Tip:</span>
          <span>Reading just 5 minutes before bed boosts comprehension by 40%!</span>
        </div>
      </div>
    </div>
  );
};
