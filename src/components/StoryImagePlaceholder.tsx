import React from "react";
import {
  Sparkles,
  Palette,
  BookOpen,
  WifiOff,
  Compass,
  Feather,
  Sun,
  Moon,
  Crown,
  Trees,
  Wand2,
} from "lucide-react";

interface StoryImagePlaceholderProps {
  title?: string;
  author?: string;
  category?: string;
  prompt?: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "cover";
  isOffline?: boolean;
  onPaintClick?: () => void;
  reason?: "ungenerated" | "offline" | "error";
  pageNumber?: number;
}

export const StoryImagePlaceholder: React.FC<StoryImagePlaceholderProps> = ({
  title = "Story Scene",
  author,
  category,
  prompt,
  className = "",
  size = "md",
  isOffline = false,
  onPaintClick,
  reason = isOffline ? "offline" : "ungenerated",
  pageNumber,
}) => {
  // Infer motif based on prompt, title, and category keywords
  const textCorpus = `${title} ${category || ""} ${prompt || ""}`.toLowerCase();

  let theme = {
    gradient: "from-amber-400/90 via-orange-300/80 to-amber-600/90",
    bgPattern: "#fef3c7",
    badgeBg: "bg-amber-100 text-amber-900 border-amber-300",
    accentColor: "#d97706",
    icon: Sparkles,
    label: "Story Scene",
    emoji: "✨",
  };

  if (
    textCorpus.includes("dragon") ||
    textCorpus.includes("magic") ||
    textCorpus.includes("wizard") ||
    textCorpus.includes("crystal") ||
    textCorpus.includes("enchanted") ||
    textCorpus.includes("fairy")
  ) {
    theme = {
      gradient: "from-purple-500/90 via-indigo-400/80 to-purple-700/90",
      bgPattern: "#ede9fe",
      badgeBg: "bg-purple-100 text-purple-900 border-purple-300",
      accentColor: "#9333ea",
      icon: Wand2,
      label: "Enchanted World",
      emoji: "🪄",
    };
  } else if (
    textCorpus.includes("space") ||
    textCorpus.includes("rocket") ||
    textCorpus.includes("planet") ||
    textCorpus.includes("moon") ||
    textCorpus.includes("night") ||
    textCorpus.includes("sleep")
  ) {
    theme = {
      gradient: "from-slate-700 via-indigo-900 to-slate-950",
      bgPattern: "#e0e7ff",
      badgeBg: "bg-indigo-100 text-indigo-900 border-indigo-300",
      accentColor: "#6366f1",
      icon: Moon,
      label: "Night Sky & Dreams",
      emoji: "🌙",
    };
  } else if (
    textCorpus.includes("hare") ||
    textCorpus.includes("tortoise") ||
    textCorpus.includes("lion") ||
    textCorpus.includes("mouse") ||
    textCorpus.includes("animal") ||
    textCorpus.includes("bear") ||
    textCorpus.includes("woodland") ||
    textCorpus.includes("fable")
  ) {
    theme = {
      gradient: "from-amber-600/90 via-amber-500/80 to-emerald-700/90",
      bgPattern: "#fef9c3",
      badgeBg: "bg-amber-100 text-amber-900 border-amber-300",
      accentColor: "#d97706",
      icon: Feather,
      label: "Classic Fable",
      emoji: "🦊",
    };
  } else if (
    textCorpus.includes("forest") ||
    textCorpus.includes("tree") ||
    textCorpus.includes("safari") ||
    textCorpus.includes("garden") ||
    textCorpus.includes("nature")
  ) {
    theme = {
      gradient: "from-emerald-600/90 via-teal-500/80 to-green-700/90",
      bgPattern: "#d1fae5",
      badgeBg: "bg-emerald-100 text-emerald-900 border-emerald-300",
      accentColor: "#059669",
      icon: Trees,
      label: "Nature Adventure",
      emoji: "🌲",
    };
  } else if (
    textCorpus.includes("king") ||
    textCorpus.includes("queen") ||
    textCorpus.includes("castle") ||
    textCorpus.includes("crown") ||
    textCorpus.includes("princess")
  ) {
    theme = {
      gradient: "from-rose-500/90 via-amber-400/80 to-purple-600/90",
      bgPattern: "#ffe4e6",
      badgeBg: "bg-rose-100 text-rose-900 border-rose-300",
      accentColor: "#e11d48",
      icon: Crown,
      label: "Royal Tale",
      emoji: "👑",
    };
  }

  const ThemeIcon = theme.icon;

  return (
    <div
      id="story-image-placeholder"
      className={`relative w-full h-full min-h-[220px] overflow-hidden rounded-2xl flex flex-col items-center justify-between p-5 text-white select-none bg-gradient-to-br ${theme.gradient} ${className}`}
    >
      {/* Decorative SVG Storybook Canvas Background */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-25"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        viewBox="0 0 400 300"
      >
        <defs>
          <radialGradient id="sunGlow" cx="80%" cy="20%" r="40%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Sun/Moon sphere */}
        <circle cx="320" cy="60" r="45" fill="url(#sunGlow)" />
        {/* Gentle rolling hills */}
        <path
          d="M0,230 Q90,180 200,220 T400,190 L400,300 L0,300 Z"
          fill="#ffffff"
          fillOpacity="0.15"
        />
        <path
          d="M0,250 Q130,210 260,260 T400,230 L400,300 L0,300 Z"
          fill="#ffffff"
          fillOpacity="0.25"
        />
        {/* Whimsical stars */}
        <circle cx="50" cy="40" r="2.5" fill="#ffffff" fillOpacity="0.8" />
        <circle cx="120" cy="70" r="2" fill="#ffffff" fillOpacity="0.6" />
        <circle cx="190" cy="30" r="3" fill="#ffffff" fillOpacity="0.9" />
        <circle cx="270" cy="90" r="2" fill="#ffffff" fillOpacity="0.7" />
      </svg>

      {/* Top Bar Status Badges */}
      <div className="w-full flex items-center justify-between z-10">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/35 backdrop-blur-md border border-white/20 text-white text-xs font-bold shadow-xs">
          <span>{theme.emoji}</span>
          <span>{theme.label}</span>
          {pageNumber && (
            <span className="opacity-75 text-[11px] ml-1">· Page {pageNumber}</span>
          )}
        </div>

        {isOffline ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/70 backdrop-blur-md border border-amber-300/40 text-amber-200 text-xs font-bold shadow-xs">
            <WifiOff className="w-3.5 h-3.5" />
            <span>Offline Storybook</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/30 backdrop-blur-md border border-white/20 text-white/90 text-xs font-medium">
            <Palette className="w-3.5 h-3.5" />
            <span>Canvas</span>
          </div>
        )}
      </div>

      {/* Center Motif / Icon & Story Title */}
      <div className="flex flex-col items-center justify-center text-center my-auto py-3 z-10 max-w-sm px-2">
        <div className="relative mb-3">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center shadow-lg transition-transform hover:scale-105">
            <ThemeIcon className="w-8 h-8 sm:w-10 sm:h-10 text-white drop-shadow-sm" />
          </div>
          {isOffline && (
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-500 border-2 border-white flex items-center justify-center shadow-xs">
              <WifiOff className="w-3 h-3 text-white" />
            </div>
          )}
        </div>

        <h4 className="font-display font-bold text-lg sm:text-xl text-white drop-shadow-md leading-tight line-clamp-2">
          {title}
        </h4>
        {author && (
          <p className="text-xs text-white/80 font-medium mt-0.5">{author}</p>
        )}

        {/* Offline notice or prompt preview */}
        {isOffline ? (
          <p className="text-xs text-amber-100/90 font-medium mt-2 bg-black/30 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/10 max-w-xs">
            No Wi-Fi needed! Story text &amp; sound-out audio are ready to enjoy offline.
          </p>
        ) : prompt ? (
          <p className="text-[11px] text-white/80 italic mt-2 line-clamp-2 max-w-xs px-2">
            &ldquo;{prompt}&rdquo;
          </p>
        ) : null}
      </div>

      {/* Bottom Action Footer */}
      <div className="w-full flex items-center justify-center z-10 pt-2">
        {onPaintClick && !isOffline ? (
          <button
            onClick={onPaintClick}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white text-stone-900 hover:bg-amber-50 font-extrabold text-xs shadow-md shadow-black/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Paint with AI Studio</span>
          </button>
        ) : isOffline ? (
          <div className="flex items-center gap-1.5 text-[11px] text-white/85 font-semibold bg-black/25 px-3 py-1 rounded-xl">
            <BookOpen className="w-3 h-3 text-amber-300" />
            <span>Turn pages to keep reading &amp; earning stars!</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-white/90 font-medium">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Ready for story time</span>
          </div>
        )}
      </div>
    </div>
  );
};
