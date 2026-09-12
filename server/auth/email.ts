/**
 * Transactional email helpers for auth flows.
 *
 * NOTE: this codebase snapshot does not yet have Resend (or any provider)
 * wired in anywhere — password-reset currently just console.logs its token
 * (see routes.ts `/password-reset/request`). This file follows that same
 * placeholder pattern for consistency, with a single seam
 * (sendViaResendIfConfigured) to swap in real delivery later without
 * touching call sites.
 */

const APP_URL = process.env.APP_URL || "http://localhost:3000";

async function sendViaResendIfConfigured(to: string, subject: string, text: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "StoryPals <no-reply@storypals.app>",
      to,
      subject,
      text,
    }),
  });

  if (!res.ok) {
    console.error(`[auth/email] Resend send failed (${res.status}):`, await res.text().catch(() => ""));
    return false;
  }
  return true;
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const link = `${APP_URL}/api/auth/verify-email?token=${token}`;
  const sent = await sendViaResendIfConfigured(
    to,
    "Verify your StoryPals email",
    `Confirm your email address to keep your StoryPals account secure:\n\n${link}\n\nThis link expires in 24 hours.`,
  );
  if (!sent) {
    console.log(`[auth] Email verification link for ${to}: ${link}`);
  }
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const link = `${APP_URL}/reset-password?token=${token}`;
  const sent = await sendViaResendIfConfigured(
    to,
    "Reset your StoryPals password",
    `Reset your StoryPals password:\n\n${link}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
  );
  if (!sent) {
    console.log(`[auth] Password reset link for ${to}: ${link}`);
  }
}
