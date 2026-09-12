/**
 * Auth routes — Sprint B (Identity).
 *
 * POST /api/auth/register
 * POST /api/auth/login
 * POST /api/auth/logout
 * GET  /api/auth/me
 * POST /api/auth/switch-child
 * POST /api/auth/password-reset/request
 * POST /api/auth/password-reset/confirm
 * DELETE /api/auth/account
 *
 * Mount with:
 *   import authRoutes from "./server/auth/routes.js";
 *   app.use("/api/auth", authRoutes);
 */

import { Router, Request, Response } from "express";
import {
  registerUser,
  loginUser,
  logoutSession,
  logoutAllSessions,
  switchActiveChild,
  requestPasswordReset,
  consumePasswordReset,
  deleteAccount,
  findUserById,
  getChildrenForParent,
} from "./repository.js";
import {
  loadSession,
  requireAuth,
  setSessionCookie,
  clearSessionCookie,
  SESSION_COOKIE,
} from "./middleware.js";

const router = Router();

// All auth routes benefit from the session loader.
router.use(loadSession);

// ── Helpers ───────────────────────────────────────────────────────────────────

function sanitize(v: unknown, max = 320): string {
  return typeof v === "string" ? v.replace(/<[^>]*>/g, "").trim().slice(0, max) : "";
}

function getIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  return (Array.isArray(fwd) ? fwd[0] : fwd?.split(",")[0]) ?? req.socket.remoteAddress ?? "unknown";
}

/**
 * Wraps an async route handler so a rejected promise (a DB error, a bug, a
 * transient network blip) returns a 500 to the caller instead of becoming an
 * unhandled rejection that crashes the whole Node process for every user.
 * Discovered during Sprint C's runtime smoke test: a malformed
 * POST /switch-child body took the entire server down, not just that
 * request — every one of this router's handlers had the same gap.
 */
function asyncHandler(fn: (req: Request, res: Response) => Promise<any>) {
  return async (req: Request, res: Response) => {
    try {
      return await fn(req, res);
    } catch (err: any) {
      console.error("[auth] Unhandled route error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } });
      }
    }
  };
}

// ── Register ──────────────────────────────────────────────────────────────────

router.post("/register", asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const email = sanitize(req.body.email);
  const displayName = sanitize(req.body.displayName, 100);
  const password = typeof req.body.password === "string" ? req.body.password : "";

  if (!email || !displayName || !password) {
    return res.status(400).json({ error: { code: "MISSING_FIELDS", message: "email, displayName, and password are required." } });
  }

  const result = await registerUser({ email, displayName, password });

  if (!result.ok) {
    const status = result.error === "EMAIL_TAKEN" ? 409 : 400;
    return res.status(status).json({ error: { code: result.error, message: result.error === "EMAIL_TAKEN" ? "That email is already registered." : "Password must be at least 8 characters." } });
  }

  return res.status(201).json({ userId: result.userId });
}));

// ── Login ─────────────────────────────────────────────────────────────────────

router.post("/login", asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const email = sanitize(req.body.email);
  const password = typeof req.body.password === "string" ? req.body.password : "";

  if (!email || !password) {
    return res.status(400).json({ error: { code: "MISSING_FIELDS", message: "email and password are required." } });
  }

  const result = await loginUser({ email, password, ipAddress: getIp(req) });

  if (!result.ok) {
    const status = result.error === "RATE_LIMITED" ? 429 : result.error === "ACCOUNT_SUSPENDED" ? 403 : 401;
    const messages: Record<string, string> = {
      INVALID_CREDENTIALS: "Incorrect email or password.",
      RATE_LIMITED: "Too many login attempts. Please wait 15 minutes.",
      ACCOUNT_SUSPENDED: "This account has been suspended.",
    };
    return res.status(status).json({ error: { code: result.error, message: messages[result.error] } });
  }

  setSessionCookie(res, result.sessionToken);
  return res.json({ ok: true, userId: result.userId });
}));

// ── Me ────────────────────────────────────────────────────────────────────────

router.get("/me", requireAuth, asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const session = req.session!;
  const children = await getChildrenForParent(session.userId);

  return res.json({
    userId: session.userId,
    email: session.userEmail,
    displayName: session.userDisplayName,
    role: session.userRole,
    activeChildId: session.activeChildId,
    children: children.map((c) => ({
      id: c.id,
      displayName: c.displayName,
      ageBand: c.ageBand,
      readingLevel: c.readingLevel,
      avatarKey: c.avatarKey,
      buddyRole: c.buddyRole,
    })),
  });
}));

// ── Switch child context ──────────────────────────────────────────────────────

router.post("/switch-child", requireAuth, asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const session = req.session!;
  const token = req.cookies?.[SESSION_COOKIE] as string;
  const childId = req.body.childId ?? null; // null = switch back to parent context

  const result = await switchActiveChild(token, childId, session.userId);
  if (!result.ok) {
    const status = result.error === "NOT_FOUND" ? 404 : 403;
    return res.status(status).json({ error: { code: result.error, message: result.error === "NOT_FOUND" ? "Child not found." : "This child does not belong to your account." } });
  }

  return res.json({ ok: true, activeChildId: childId });
}));

// ── Logout ────────────────────────────────────────────────────────────────────

router.post("/logout", requireAuth, asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const token = req.cookies?.[SESSION_COOKIE] as string;
  await logoutSession(token);
  clearSessionCookie(res);
  return res.json({ ok: true });
}));

// ── Password reset — request ──────────────────────────────────────────────────

router.post("/password-reset/request", asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const email = sanitize(req.body.email);
  if (!email) {
    return res.status(400).json({ error: { code: "MISSING_FIELDS", message: "email is required." } });
  }

  const result = await requestPasswordReset(email, getIp(req));

  if (!result.ok) {
    const status = result.error === "RATE_LIMITED" ? 429 : 200; // Don't leak NOT_FOUND
    if (result.error === "RATE_LIMITED") {
      return res.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many reset requests. Please wait." } });
    }
  }

  // Always respond 200 to avoid email enumeration.
  // In production: email result.token via your transactional mail provider.
  // Log it for now so dev can test without SMTP.
  if (result.ok) {
    console.log(`[auth] Password reset token for ${email}: ${result.token}`);
  }

  return res.json({ ok: true, message: "If that email exists, a reset link has been sent." });
}));

// ── Password reset — confirm ──────────────────────────────────────────────────

router.post("/password-reset/confirm", asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const token = sanitize(req.body.token, 200);
  const newPassword = typeof req.body.newPassword === "string" ? req.body.newPassword : "";

  if (!token || !newPassword) {
    return res.status(400).json({ error: { code: "MISSING_FIELDS", message: "token and newPassword are required." } });
  }

  const result = await consumePasswordReset(token, newPassword);
  if (!result.ok) {
    const status = result.error === "WEAK_PASSWORD" ? 400 : 400;
    const messages: Record<string, string> = {
      INVALID_TOKEN: "This reset link is invalid or has already been used.",
      EXPIRED: "This reset link has expired. Please request a new one.",
      WEAK_PASSWORD: "Password must be at least 8 characters.",
    };
    return res.status(status).json({ error: { code: result.error, message: messages[result.error] } });
  }

  return res.json({ ok: true, message: "Password updated. Please log in with your new password." });
}));

// ── Account deletion ──────────────────────────────────────────────────────────

router.delete("/account", requireAuth, asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const session = req.session!;
  const password = typeof req.body.password === "string" ? req.body.password : "";

  // Require password confirmation to prevent accidental/CSRF deletion.
  if (!password) {
    return res.status(400).json({ error: { code: "MISSING_FIELDS", message: "password is required to delete your account." } });
  }

  // Re-authenticate before deleting.
  const user = await findUserById(session.userId);
  if (!user) return res.status(404).json({ error: { code: "NOT_FOUND" } });

  const loginCheck = await loginUser({ email: user.email, password });
  if (!loginCheck.ok) {
    return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Incorrect password." } });
  }

  await deleteAccount(session.userId);
  clearSessionCookie(res);
  return res.json({ ok: true, message: "Account deleted." });
}));

export default router;
