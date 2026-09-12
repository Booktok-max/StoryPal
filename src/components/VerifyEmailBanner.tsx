import React, { useState } from "react";
import { Mail, X, Loader2 } from "lucide-react";
import { resendVerificationEmail } from "../api/client";

/**
 * Nudge-model banner: shown when the parent's email is unverified. Never
 * blocks any screen — just offers a resend link and a dismiss. Dismissal is
 * per-session (component state) rather than persisted, so it reappears on
 * the next full load as a gentle reminder.
 */
export const VerifyEmailBanner: React.FC = () => {
  const [dismissed, setDismissed] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  if (dismissed) return null;

  const handleResend = async () => {
    setStatus("sending");
    try {
      await resendVerificationEmail();
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-2.5 mb-4">
      <div className="flex items-center gap-2">
        <Mail className="w-4 h-4 shrink-0" />
        {status === "sent" ? (
          <span>Verification email sent — check your inbox.</span>
        ) : (
          <span>Please verify your email.</span>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {status !== "sent" && (
          <button
            type="button"
            onClick={handleResend}
            disabled={status === "sending"}
            className="flex items-center gap-1 font-medium underline hover:no-underline disabled:opacity-60"
          >
            {status === "sending" && <Loader2 className="w-3 h-3 animate-spin" />}
            {status === "error" ? "Try again" : "Resend link"}
          </button>
        )}
        <button type="button" onClick={() => setDismissed(true)} aria-label="Dismiss">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
