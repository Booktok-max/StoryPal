/**
 * Express middleware for Sprint B authentication.
 *
 * Session token lives in an HTTP-only cookie named `sp_session`.
 * Each request resolves the token to a full session object and attaches
 * it to `req.session`.  Routes that need auth call `requireAuth()`;
 * routes that need admin call `requireAdmin()`.
 */

import { Request, Response, NextFunction } from "express";
import { resolveSession, type ResolvedSession } from "./repository.js";

// Extend Express request so TypeScript knows about req.session.
declare global {
  namespace Express {
    interface Request {
      session: ResolvedSession | null;
    }
  }
}

export const SESSION_COOKIE = "sp_session";
export const SESSION_TTL_DAYS = 14;

/**
 * Load-session middleware.  Always runs; does NOT block unauthenticated requests.
 * Place this before any route that reads req.session.
 */
export async function loadSession(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  req.session = token ? await resolveSession(token).catch(() => null) : null;
  next();
}

/**
 * Route guard: rejects the request with 401 if the caller has no valid session.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session) {
    res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } });
    return;
  }
  next();
}

/**
 * Route guard: rejects the request with 403 if the caller is not an admin.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session) {
    res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } });
    return;
  }
  if (req.session.userRole !== "admin") {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Admin access required." } });
    return;
  }
  next();
}

/**
 * Route guard: rejects if the caller has not switched into a child context.
 * Sets req.childId for downstream handlers.
 */
export function requireChildContext(req: Request, res: Response, next: NextFunction) {
  if (!req.session) {
    res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Please log in." } });
    return;
  }
  if (!req.session.activeChildId) {
    res.status(403).json({ error: { code: "NO_CHILD_SELECTED", message: "Select a child profile first." } });
    return;
  }
  next();
}

/**
 * Sets a secure HTTP-only session cookie.
 */
export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

/**
 * Clears the session cookie.
 */
export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}
