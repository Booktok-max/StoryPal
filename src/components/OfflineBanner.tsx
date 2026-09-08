import React, { useState } from "react";
import { WifiOff, Wifi, Sparkles, X, BookOpen, Volume2 } from "lucide-react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

export const OfflineBanner: React.FC = () => {
  const { isOnline, wasOffline } = useOnlineStatus();
  const [dismissed, setDismissed] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  // If connection comes back after being offline, show a quick reconnection celebration
  React.useEffect(() => {
    if (isOnline && wasOffline) {
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (showReconnected) {
    return (
      <aside
        aria-label="Wi-Fi restored"
        className="bg-emerald-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all animate-in fade-in"
      >
        <Wifi className="w-4 h-4 text-emerald-200" />
        <span>Wi-Fi Connected! AI Illustration Studio and Story Maker are ready.</span>
      </aside>
    );
  }

  if (isOnline || dismissed) return null;

  return (
    <aside
      aria-label="Offline reading mode active"
      className="bg-gradient-to-r from-amber-600 via-amber-700 to-orange-700 text-white px-4 py-2.5 text-xs shadow-sm flex items-center justify-between gap-3 transition-all z-50"
    >
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-amber-500/80 text-white font-bold shrink-0">
          <WifiOff className="w-3.5 h-3.5" />
        </span>
        <span className="font-extrabold tracking-wide">Offline Reading Mode:</span>
        <span className="text-amber-100 font-medium">
          Story text, page turning, stars, and voice narration work without Wi-Fi!
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-900/40 text-[11px] font-semibold text-amber-200">
          <Sparkles className="w-3 h-3 text-yellow-300" />
          <span>Connect to Wi-Fi to paint AI illustrations</span>
        </span>
      </div>

      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss offline banner"
        className="p-1 rounded-lg text-amber-200 hover:text-white hover:bg-amber-800/60 transition-colors shrink-0"
        title="Dismiss banner"
      >
        <X className="w-4 h-4" />
      </button>
    </aside>
  );
};
