import crypto from "crypto";
import { getDb } from "../../db/client.js";
import { users, userStatusEnum } from "../../db/schema/users.js";
import {
  userPasswords,
  sessions,
  passwordResetTokens,
  rateLimitAttempts,
} from "../../db/schema/auth.js";
import { childProfiles } from "../../db/schema/childProfiles.js";
import { eq, and, gt, count, sql } from "drizzle-orm";

// db/client.ts exposes a lazy getDb() (so the app can boot before
// DATABASE_URL is configured), not a top-level `db` export. This proxy lets
// every call site below read as plain `db.select()/.insert()/...` while
// still only resolving the real connection the moment a query actually runs.
// ── Constants ─────────────────────────────────────────────────────────────────

const db = new Proxy(
  {},
  { get: (_target, prop) => (getDb() as any)[prop] },
) as ReturnType<typeof getDb>;


const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const RESET_TTL_MS = 60 * 60 * 1000;              // 1 hour
const LOGIN_WINDOW_MS = 15 * 60 * 1000;           // 15 minutes
const LOGIN_MAX_ATTEMPTS = 10;
const RESET_WINDOW_MS = 60 * 60 * 1000;
const RESET_MAX_ATTEMPTS = 3;

// ── Bcrypt shim ───────────────────────────────────────────────────────────────
// Dynamic import so TypeScript compiles without requiring bcrypt in devDeps.
// Add  "bcrypt": "^5.1.1"  to package.json dependencies before deploying.

let bcrypt: { hash: (p: string, r: number) => Promise<string>; compare: (p: string, h: string) => Promise<boolean> } | null = null;

async function getBcrypt() {
  if (bcrypt) return bcrypt;
  try {
    const mod = await import("bcrypt" as string) as typeof import("bcrypt");
    bcrypt = { hash: mod.hash, compare: mod.compare };
  } catch {
    throw new Error("bcrypt is not installed — run: npm install bcrypt @types/bcrypt");
  }
  return bcrypt;
}

// ── Token helpers ─────────────────────────────────────────────────────────────

function generateToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString("hex");
}

// ── Rate limiting ─────────────────────────────────────────────────────────────

async function countRecentAttempts(
  identifier: string,
  action: string,
  windowMs: number,
): Promise<number> {
  const since = new Date(Date.now() - windowMs);
  const [row] = await db
    .select({ n: count() })
    .from(rateLimitAttempts)
    .where(
      and(
        eq(rateLimitAttempts.identifier, identifier),
        eq(rateLimitAttempts.action, action),
        gt(rateLimitAttempts.attemptedAt, since),
      ),
    );
  return Number(row?.n ?? 0);
}

async function recordAttempt(identifier: string, action: string): Promise<void> {
  await db.insert(rateLimitAttempts).values({ identifier, action });
}

// ── User lookup ───────────────────────────────────────────────────────────────

export async function findUserByEmail(email: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()));
  return user ?? null;
}

export async function findUserById(id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user ?? null;
}

// ── Registration ──────────────────────────────────────────────────────────────

export interface RegisterInput {
  email: string;
  displayName: string;
  password: string;
}

export type RegisterResult =
  | { ok: true; userId: string }
  | { ok: false; error: "EMAIL_TAKEN" | "WEAK_PASSWORD" };

export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const email = input.email.toLowerCase().trim();

  if (input.password.length < 8) {
    return { ok: false, error: "WEAK_PASSWORD" };
  }

  const existing = await findUserByEmail(email);
  if (existing) return { ok: false, error: "EMAIL_TAKEN" };

  const bc = await getBcrypt();
  const passwordHash = await bc.hash(input.password, 12);

  const [user] = await db
    .insert(users)
    .values({ email, displayName: input.displayName.trim() })
    .returning({ id: users.id });

  await db.insert(userPasswords).values({ userId: user.id, passwordHash });

  return { ok: true, userId: user.id };
}

// ── Login ─────────────────────────────────────────────────────────────────────

export interface LoginInput {
  email: string;
  password: string;
  /** Caller's IP address for rate-limiting. */
  ipAddress?: string;
}

export type LoginResult =
  | { ok: true; sessionToken: string; userId: string }
  | { ok: false; error: "INVALID_CREDENTIALS" | "RATE_LIMITED" | "ACCOUNT_SUSPENDED" };

export async function loginUser(input: LoginInput): Promise<LoginResult> {
  const email = input.email.toLowerCase().trim();
  const rateKey = input.ipAddress ? `ip:${input.ipAddress}` : `email:${email}`;

  const attempts = await countRecentAttempts(rateKey, "login", LOGIN_WINDOW_MS);
  if (attempts >= LOGIN_MAX_ATTEMPTS) {
    return { ok: false, error: "RATE_LIMITED" };
  }

  await recordAttempt(rateKey, "login");

  const user = await findUserByEmail(email);
  if (!user) {
    // Constant-time: still compare against a dummy hash to prevent timing attacks.
    const bc = await getBcrypt();
    await bc.compare(input.password, "$2b$12$invalidhashpadding000000000000000000000000000000000000");
    return { ok: false, error: "INVALID_CREDENTIALS" };
  }

  if (user.status === "suspended") {
    return { ok: false, error: "ACCOUNT_SUSPENDED" };
  }

  const [pwRow] = await db
    .select()
    .from(userPasswords)
    .where(eq(userPasswords.userId, user.id));

  if (!pwRow) {
    return { ok: false, error: "INVALID_CREDENTIALS" };
  }

  const bc = await getBcrypt();
  const match = await bc.compare(input.password, pwRow.passwordHash);
  if (!match) {
    return { ok: false, error: "INVALID_CREDENTIALS" };
  }

  const token = generateToken(48);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ token, userId: user.id, expiresAt });

  return { ok: true, sessionToken: token, userId: user.id };
}

// ── Session resolution ────────────────────────────────────────────────────────

export interface ResolvedSession {
  sessionId: string;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  userRole: string;
  activeChildId: string | null;
}

export async function resolveSession(token: string): Promise<ResolvedSession | null> {
  const now = new Date();
  const [row] = await db
    .select({
      sessionId: sessions.id,
      userId: sessions.userId,
      activeChildId: sessions.activeChildId,
      expiresAt: sessions.expiresAt,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      status: users.status,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.token, token));

  if (!row || row.expiresAt < now) return null;
  if (row.status !== "active") return null;

  return {
    sessionId: row.sessionId,
    userId: row.userId,
    userEmail: row.email,
    userDisplayName: row.displayName,
    userRole: row.role,
    activeChildId: row.activeChildId,
  };
}

// ── Child switching ───────────────────────────────────────────────────────────

export type SwitchChildResult =
  | { ok: true }
  | { ok: false; error: "NOT_FOUND" | "FORBIDDEN" };

export async function switchActiveChild(
  sessionToken: string,
  childId: string | null,
  parentUserId: string,
): Promise<SwitchChildResult> {
  if (childId !== null) {
    const [child] = await db
      .select({ parentUserId: childProfiles.parentUserId })
      .from(childProfiles)
      .where(eq(childProfiles.id, childId));

    if (!child) return { ok: false, error: "NOT_FOUND" };
    if (child.parentUserId !== parentUserId) return { ok: false, error: "FORBIDDEN" };
  }

  await db
    .update(sessions)
    .set({ activeChildId: childId })
    .where(eq(sessions.token, sessionToken));

  return { ok: true };
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logoutSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token));
}

export async function logoutAllSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

// ── Password reset ────────────────────────────────────────────────────────────

export type RequestResetResult =
  | { ok: true; token: string }   // caller must email this
  | { ok: false; error: "RATE_LIMITED" | "NOT_FOUND" };

export async function requestPasswordReset(
  email: string,
  ipAddress?: string,
): Promise<RequestResetResult> {
  const rateKey = ipAddress ? `ip:${ipAddress}` : `email:${email}`;
  const attempts = await countRecentAttempts(rateKey, "reset", RESET_WINDOW_MS);
  if (attempts >= RESET_MAX_ATTEMPTS) {
    return { ok: false, error: "RATE_LIMITED" };
  }
  await recordAttempt(rateKey, "reset");

  const user = await findUserByEmail(email.toLowerCase().trim());
  if (!user) return { ok: false, error: "NOT_FOUND" };

  const token = generateToken(32);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);
  await db.insert(passwordResetTokens).values({ userId: user.id, token, expiresAt });

  return { ok: true, token };
}

export type ConsumeResetResult =
  | { ok: true }
  | { ok: false; error: "INVALID_TOKEN" | "EXPIRED" | "WEAK_PASSWORD" };

export async function consumePasswordReset(
  token: string,
  newPassword: string,
): Promise<ConsumeResetResult> {
  if (newPassword.length < 8) return { ok: false, error: "WEAK_PASSWORD" };

  const [row] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token));

  if (!row) return { ok: false, error: "INVALID_TOKEN" };
  if (row.usedAt) return { ok: false, error: "INVALID_TOKEN" };
  if (row.expiresAt < new Date()) return { ok: false, error: "EXPIRED" };

  const bc = await getBcrypt();
  const passwordHash = await bc.hash(newPassword, 12);

  await db
    .update(userPasswords)
    .set({ passwordHash })
    .where(eq(userPasswords.userId, row.userId));

  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, row.id));

  // Invalidate all active sessions after a password change.
  await logoutAllSessions(row.userId);

  return { ok: true };
}

// ── Account deletion ──────────────────────────────────────────────────────────

export async function deleteAccount(userId: string): Promise<void> {
  // Cascade in DB handles sessions, children, progress, etc.
  await db.delete(users).where(eq(users.id, userId));
}

// ── Child profile helpers (used by auth middleware) ───────────────────────────

export async function getChildrenForParent(parentUserId: string) {
  return db
    .select()
    .from(childProfiles)
    .where(eq(childProfiles.parentUserId, parentUserId));
}
