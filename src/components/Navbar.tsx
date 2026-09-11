import React, { useState } from "react";
import {
  BookOpen,
  Sparkles,
  Flame,
  Award,
  Settings,
  MessageCircle,
  Volume2,
  Type,
  Check,
  Users,
} from "lucide-react";
import { UserProgress, ReaderSettings, BuddyRole } from "../types";

const ADMIN_MODE = import.meta.env.VITE_ADMIN_MODE === "true";

interface NavbarProps {
  progress: UserProgress;
  activeView: "shelf" | "reader" | "passport" | "parent";
  setActiveView: (view: "shelf" | "reader" | "passport" | "parent") => void;
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  buddyRole: BuddyRole;
  setBuddyRole: (role: BuddyRole) => void;
  settings: ReaderSettings;
  setSettings: React.Dispatch<React.SetStateAction<ReaderSettings>>;
  hasActiveBook: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  progress,
  activeView,
  setActiveView,
  isChatOpen,
  setIsChatOpen,
  buddyRole,
  setBuddyRole,
  settings,
  setSettings,
  hasActiveBook,
}) => {
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  return (
    <header
      id="main-app-header"
      className="sticky top-0 z-40 bg-amber-50/90 backdrop-blur-md border-b border-amber-200/80 px-4 lg:px-8 py-3 transition-colors"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <button
            id="brand-logo-btn"
            onClick={() => setActiveView("shelf")}
            className="flex items-center gap-2.5 text-left group focus:outline-none"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center text-white shadow-md shadow-amber-200 group-hover:scale-105 transition-transform">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-display font-bold text-xl text-amber-950 tracking-tight">
                  StoryPals
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-800 font-semibold">
                  Kids
                </span>
              </div>
              <p className="text-[11px] text-amber-800/80 font-medium hidden sm:block">
                Children&apos;s Books &amp; Classics Library
              </p>
            </div>
          </button>

          {/* Navigation tabs */}
          <nav className="hidden md:flex items-center gap-1 ml-4 bg-amber-200/50 p-1 rounded-2xl border border-amber-300/60">
            <button
              id="nav-tab-shelf"
              onClick={() => setActiveView("shelf")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeView === "shelf"
                  ? "bg-white text-amber-950 shadow-sm"
                  : "text-amber-800 hover:text-amber-950"
              }`}
            >
              📚 Library
            </button>
            {hasActiveBook && (
              <button
                id="nav-tab-reader"
                onClick={() => setActiveView("reader")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeView === "reader"
                    ? "bg-white text-amber-950 shadow-sm"
                    : "text-amber-800 hover:text-amber-950"
                }`}
              >
                📖 Reading Now
              </button>
            )}
            <button
              id="nav-tab-passport"
              onClick={() => setActiveView("passport")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                activeView === "passport"
                  ? "bg-white text-amber-950 shadow-sm"
                  : "text-amber-800 hover:text-amber-950"
              }`}
            >
              <Award className="w-3.5 h-3.5 text-amber-600" />
              <span>My Passport & Badges</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-100 text-[10px] text-amber-700 font-bold">
                {progress.unlockedBadges.length}
              </span>
            </button>
          </nav>
        </div>

        {/* Right side: Gamified badges, reading buddy, and reader settings */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Streak indicator */}
          <div
            id="streak-indicator"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-orange-100/90 border border-orange-200 text-orange-800 text-xs font-bold shadow-xs"
            title="Reading Streak: consecutive reading days"
          >
            <Flame className="w-4 h-4 text-orange-500 fill-orange-500 animate-pulse" />
            <span>{progress.readingStreakDays}d Streak</span>
          </div>

          {/* Stars Counter */}
          <button
            id="stars-indicator-btn"
            onClick={() => setActiveView("passport")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100/90 border border-amber-300 text-amber-900 text-xs font-bold shadow-xs hover:bg-amber-200/80 transition-colors"
            title="Total reading stars collected"
          >
            <Sparkles className="w-4 h-4 text-amber-500 fill-amber-400" />
            <span>{progress.totalStars} Stars</span>
          </button>

          {/* Parent View entry point — hidden from children by default */}
          {ADMIN_MODE && (
            <button
              id="parent-view-btn"
              onClick={() => setActiveView("parent")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                activeView === "parent"
                  ? "bg-stone-800 text-white border-stone-900 shadow-md"
                  : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
              }`}
              title="Parent Dashboard: reading history, time, and words explored"
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Parent View</span>
            </button>
          )}

          {/* Reading Buddy toggle */}
          <button
            id="toggle-buddy-chat-btn"
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              isChatOpen
                ? "bg-indigo-600 text-white border-indigo-700 shadow-md shadow-indigo-200"
                : "bg-indigo-50 text-indigo-900 border-indigo-200 hover:bg-indigo-100"
            }`}
            title="Chat with Barnaby or Pip for story help and quiz games"
          >
            <span className="text-base">{buddyRole === "owl" ? "🦉" : "🐲"}</span>
            <span className="hidden sm:inline">
              {buddyRole === "owl" ? "Barnaby" : "Pip"}
            </span>
            <MessageCircle className="w-3.5 h-3.5 ml-0.5" />
          </button>

          {/* Reader Settings button */}
          <div className="relative">
            <button
              id="reader-settings-btn"
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className="p-2 rounded-xl bg-white border border-amber-200 text-amber-800 hover:text-amber-950 hover:bg-amber-50 transition-colors shadow-xs"
              title="Reader Font & Voice Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {showSettingsMenu && (
              <div
                id="reader-settings-dropdown"
                className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-amber-200 p-4 z-50 text-stone-800 text-sm animate-in fade-in slide-in-from-top-2"
              >
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-stone-100">
                  <div className="flex items-center gap-2 font-bold text-amber-950">
                    <Type className="w-4 h-4 text-amber-600" />
                    <span>Reader Options</span>
                  </div>
                  <button
                    onClick={() => setShowSettingsMenu(false)}
                    className="text-xs text-stone-400 hover:text-stone-600 font-semibold"
                  >
                    Done
                  </button>
                </div>

                {/* Text Size */}
                <div className="mb-3">
                  <label className="text-xs font-bold text-stone-600 mb-1.5 block">
                    Text Size
                  </label>
                  <div className="grid grid-cols-3 gap-1 bg-stone-100 p-1 rounded-xl">
                    {(["normal", "large", "extra-large"] as const).map((size) => (
                      <button
                        key={size}
                        onClick={() => setSettings((s) => ({ ...s, fontSize: size }))}
                        className={`py-1 text-xs font-semibold rounded-lg capitalize transition-all ${
                          settings.fontSize === size
                            ? "bg-white text-stone-900 shadow-xs font-bold"
                            : "text-stone-600 hover:text-stone-900"
                        }`}
                      >
                        {size === "extra-large" ? "Huge" : size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Style */}
                <div className="mb-3">
                  <label className="text-xs font-bold text-stone-600 mb-1.5 block">
                    Font Style
                  </label>
                  <div className="grid grid-cols-3 gap-1 bg-stone-100 p-1 rounded-xl">
                    <button
                      onClick={() => setSettings((s) => ({ ...s, fontFamily: "quicksand" }))}
                      className={`py-1 text-xs rounded-lg font-sans transition-all ${
                        settings.fontFamily === "quicksand"
                          ? "bg-white text-stone-900 shadow-xs font-bold"
                          : "text-stone-600 hover:text-stone-900"
                      }`}
                    >
                      Rounded
                    </button>
                    <button
                      onClick={() => setSettings((s) => ({ ...s, fontFamily: "fredoka" }))}
                      className={`py-1 text-xs rounded-lg font-bold transition-all ${
                        settings.fontFamily === "fredoka"
                          ? "bg-white text-stone-900 shadow-xs"
                          : "text-stone-600 hover:text-stone-900"
                      }`}
                    >
                      Playful
                    </button>
                    <button
                      onClick={() => setSettings((s) => ({ ...s, fontFamily: "dyslexic" }))}
                      className={`py-1 text-xs rounded-lg font-mono transition-all ${
                        settings.fontFamily === "dyslexic"
                          ? "bg-white text-stone-900 shadow-xs font-bold"
                          : "text-stone-600 hover:text-stone-900"
                      }`}
                      title="Clear, weighted letterforms for easy reading"
                    >
                      Readable
                    </button>
                  </div>
                </div>

                {/* Phonics Syllables Toggle */}
                <div className="mb-3 flex items-center justify-between py-1.5 px-2 rounded-xl bg-amber-50 border border-amber-200/70">
                  <div>
                    <div className="text-xs font-bold text-amber-900">
                      Show Word Syllables
                    </div>
                    <div className="text-[11px] text-amber-700/80">
                      e.g. straw·ber·ry
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setSettings((s) => ({ ...s, showSyllables: !s.showSyllables }))
                    }
                    className={`w-10 h-6 rounded-full transition-colors relative ${
                      settings.showSyllables ? "bg-amber-600" : "bg-stone-300"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform transform absolute top-1 ${
                        settings.showSyllables ? "translate-x-5" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {/* Voice Selection for Gemini TTS */}
                <div className="mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-stone-600 mb-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-amber-600" />
                    <span>Story Narration Voice</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { id: "Puck", label: "Puck (Cheerful)" },
                      { id: "Kore", label: "Kore (Warm)" },
                      { id: "Zephyr", label: "Zephyr (Calm)" },
                    ].map((v) => (
                      <button
                        key={v.id}
                        onClick={() =>
                          setSettings((s) => ({
                            ...s,
                            voice: v.id as "Puck" | "Kore" | "Zephyr",
                          }))
                        }
                        className={`p-1.5 rounded-xl border text-[11px] text-center transition-all ${
                          settings.voice === v.id
                            ? "bg-amber-100 border-amber-400 text-amber-900 font-bold"
                            : "bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100"
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Buddy Role Selection */}
                <div className="pt-2 border-t border-stone-100 mt-2">
                  <div className="text-xs font-bold text-stone-600 mb-1">
                    Choose Reading Buddy
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setBuddyRole("owl")}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-bold transition-all ${
                        buddyRole === "owl"
                          ? "bg-amber-100 border-amber-400 text-amber-900"
                          : "bg-stone-50 border-stone-200 text-stone-600"
                      }`}
                    >
                      <span className="text-lg">🦉</span>
                      <div className="text-left">
                        <div>Barnaby</div>
                        <div className="text-[10px] text-stone-500 font-normal">
                          Wise Owl Tutor
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => setBuddyRole("dragon")}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-bold transition-all ${
                        buddyRole === "dragon"
                          ? "bg-amber-100 border-amber-400 text-amber-900"
                          : "bg-stone-50 border-stone-200 text-stone-600"
                      }`}
                    >
                      <span className="text-lg">🐲</span>
                      <div className="text-left">
                        <div>Pip</div>
                        <div className="text-[10px] text-stone-500 font-normal">
                          Playful Dragon
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
