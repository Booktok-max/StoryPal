import { Router, Request, Response } from "express";
import { getDb } from "../../db/client.js";
import { childProfiles, childSettings } from "../../db/schema/childProfiles.js";
import { eq, and } from "drizzle-orm";
import { loadSession, requireAuth } from "./middleware.js";

// See server/auth/repository.ts for why this proxy exists.
const db = new Proxy(
  {},
  { get: (_target, prop) => (getDb() as any)[prop] },
) as ReturnType<typeof getDb>;

const router = Router();
router.use(loadSession, requireAuth);

function sanitize(v: unknown, max = 200): string {
  return typeof v === "string" ? v.replace(/<[^>]*>/g, "").trim().slice(0, max) : "";
}

const VALID_AGE_BANDS = ["4-5", "6-7", "8-9"] as const;
const VALID_BUDDY_ROLES = ["owl", "dragon"] as const;

/**
 * See server/auth/routes.ts for why this exists — a rejected promise in an
 * unguarded async Express handler crashes the whole process, not just the
 * one request. Found via Sprint C's runtime smoke test.
 */
function asyncHandler(fn: (req: Request, res: Response) => Promise<any>) {
  return async (req: Request, res: Response) => {
    try {
      return await fn(req, res);
    } catch (err: any) {
      console.error("[children] Unhandled route error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } });
      }
    }
  };
}

// ── List ──────────────────────────────────────────────────────────────────────

router.get("/", asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const { userId } = req.session!;
  const children = await db
    .select()
    .from(childProfiles)
    .where(eq(childProfiles.parentUserId, userId));
  return res.json({ children });
}));

// ── Create ────────────────────────────────────────────────────────────────────

router.post("/", asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const { userId } = req.session!;
  const displayName = sanitize(req.body.displayName, 100);
  const ageBand = req.body.ageBand;
  const readingLevel = sanitize(req.body.readingLevel, 50);
  const avatarKey = sanitize(req.body.avatarKey, 50);
  const buddyRole = req.body.buddyRole ?? "owl";

  if (!displayName) {
    return res.status(400).json({ error: { code: "MISSING_FIELDS", message: "displayName is required." } });
  }
  if (ageBand && !VALID_AGE_BANDS.includes(ageBand)) {
    return res.status(400).json({ error: { code: "INVALID_AGE_BAND" } });
  }
  if (!VALID_BUDDY_ROLES.includes(buddyRole)) {
    return res.status(400).json({ error: { code: "INVALID_BUDDY_ROLE" } });
  }

  // Limit to 5 child profiles per family.
  const existing = await db
    .select({ id: childProfiles.id })
    .from(childProfiles)
    .where(eq(childProfiles.parentUserId, userId));
  if (existing.length >= 5) {
    return res.status(409).json({ error: { code: "TOO_MANY_CHILDREN", message: "Maximum 5 child profiles per account." } });
  }

  const [child] = await db
    .insert(childProfiles)
    .values({ parentUserId: userId, displayName, ageBand: ageBand ?? null, readingLevel: readingLevel || null, avatarKey: avatarKey || null, buddyRole })
    .returning();

  // Create default settings row.
  await db.insert(childSettings).values({ childId: child.id });

  return res.status(201).json({ child });
}));

// ── Update ────────────────────────────────────────────────────────────────────

router.patch("/:id", asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const { userId } = req.session!;
  const { id } = req.params;

  const [existing] = await db
    .select()
    .from(childProfiles)
    .where(and(eq(childProfiles.id, id), eq(childProfiles.parentUserId, userId)));

  if (!existing) return res.status(404).json({ error: { code: "NOT_FOUND" } });

  const updates: Partial<typeof childProfiles.$inferInsert> = {};
  if (typeof req.body.displayName === "string") updates.displayName = sanitize(req.body.displayName, 100);
  if (typeof req.body.ageBand === "string") {
    if (!VALID_AGE_BANDS.includes(req.body.ageBand)) return res.status(400).json({ error: { code: "INVALID_AGE_BAND" } });
    updates.ageBand = req.body.ageBand;
  }
  if (typeof req.body.readingLevel === "string") updates.readingLevel = sanitize(req.body.readingLevel, 50);
  if (typeof req.body.avatarKey === "string") updates.avatarKey = sanitize(req.body.avatarKey, 50);
  if (typeof req.body.buddyRole === "string") {
    if (!VALID_BUDDY_ROLES.includes(req.body.buddyRole)) return res.status(400).json({ error: { code: "INVALID_BUDDY_ROLE" } });
    updates.buddyRole = req.body.buddyRole;
  }
  if (typeof req.body.dailyGoalPages === "number") {
    updates.dailyGoalPages = Math.max(1, Math.min(100, req.body.dailyGoalPages));
  }

  const [updated] = await db
    .update(childProfiles)
    .set(updates)
    .where(eq(childProfiles.id, id))
    .returning();

  return res.json({ child: updated });
}));

// ── Delete ────────────────────────────────────────────────────────────────────

router.delete("/:id", asyncHandler(async (req: Request, res: Response): Promise<any> => {
  const { userId } = req.session!;
  const { id } = req.params;

  const [existing] = await db
    .select({ id: childProfiles.id })
    .from(childProfiles)
    .where(and(eq(childProfiles.id, id), eq(childProfiles.parentUserId, userId)));

  if (!existing) return res.status(404).json({ error: { code: "NOT_FOUND" } });

  await db.delete(childProfiles).where(eq(childProfiles.id, id));
  return res.json({ ok: true });
}));

export default router;
