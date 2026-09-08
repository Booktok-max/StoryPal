import { useState, useEffect } from "react";
import { checkApiHealth, isAiAvailable, hasHealthChecked, type ApiHealth } from "../api/client";

/**
 * Hook to check if the server's Gemini API key is configured.
 * Runs once on mount; caches the result via the API client module.
 */
export function useApiHealth() {
  const [health, setHealth] = useState<ApiHealth | null>(null);
  const [loading, setLoading] = useState(!hasHealthChecked());

  useEffect(() => {
    if (hasHealthChecked()) {
      setHealth({
        status: "ok",
        hasApiKey: isAiAvailable() === true,
        env: "cached",
        uptime: "—",
        memory: { rss: "—", heapUsed: "—" },
        providers: [],
      });
      setLoading(false);
      return;
    }

    let cancelled = false;
    checkApiHealth().then((data) => {
      if (!cancelled) {
        setHealth(data);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, []);

  return {
    health,
    loading,
    aiAvailable: isAiAvailable(),
  };
}
