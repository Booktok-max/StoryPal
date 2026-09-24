import { Router, Request, Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import { shelfItems } from "../../db/schema/shelf.js";
import { requireAuth, requireChildContext } from "../auth/middleware.js";

const router = Router();
router.use(requireAuth, requireChildContext);

const VALID_STATUSES = ["want-to-read", "reading", "finished"] as const;
type ShelfStatus = (typeof VALID_STATUSES)[number];

function asyncHandler(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response) => {
    fn(req, res).catch((error) => {
      console.error("[shelf] Unhandled route error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } });
      }
    });
  };
}

function bookIdFromRequest(req: Request): string {
  return typeof req.body.bookId === "string" ? req.body.bookId.trim().slice(0, 500) : "";
}

router.get("/", asyncHandler(async (req, res) => {
  const db = getDb();
  const items = await db
    .select()
    .from(shelfItems)
    .where(eq(shelfItems.childId, req.session!.activeChildId!))
    .orderBy(desc(shelfItems.addedAt));
  return res.json({ items });
}));

router.post("/", asyncHandler(async (req, res) => {
  const bookId = bookIdFromRequest(req);
  if (!bookId) return res.status(400).json({ error: { code: "INVALID_BOOK_ID", message: "bookId is required." } });

  const status = req.body.status ?? "want-to-read";
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: { code: "INVALID_STATUS", message: "Invalid shelf status." } });
  }

  const db = getDb();
  const [item] = await db
    .insert(shelfItems)
    .values({
      childId: req.session!.activeChildId!,
      bookId,
      status: status as ShelfStatus,
      favorite: req.body.favorite === true,
    })
    .onConflictDoUpdate({
      target: [shelfItems.childId, shelfItems.bookId],
      set: { status: status as ShelfStatus },
    })
    .returning();
  return res.status(201).json({ item });
}));

router.patch("/:bookId", asyncHandler(async (req, res) => {
  const bookId = req.params.bookId;
  const updates: Partial<typeof shelfItems.$inferInsert> = {};
  if (req.body.status !== undefined) {
    if (!VALID_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ error: { code: "INVALID_STATUS", message: "Invalid shelf status." } });
    }
    updates.status = req.body.status as ShelfStatus;
  }
  if (req.body.favorite !== undefined) {
    if (typeof req.body.favorite !== "boolean") {
      return res.status(400).json({ error: { code: "INVALID_FAVORITE", message: "favorite must be boolean." } });
    }
    updates.favorite = req.body.favorite;
  }
  if (req.body.progressPage !== undefined) {
    if (!Number.isInteger(req.body.progressPage) || req.body.progressPage < 0) {
      return res.status(400).json({ error: { code: "INVALID_PROGRESS", message: "progressPage must be a non-negative integer." } });
    }
    updates.progressPage = req.body.progressPage;
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: { code: "NO_UPDATES", message: "Provide a shelf field to update." } });
  }

  const [item] = await getDb()
    .update(shelfItems)
    .set({ ...updates, lastOpenedAt: new Date() })
    .where(and(eq(shelfItems.childId, req.session!.activeChildId!), eq(shelfItems.bookId, bookId)))
    .returning();
  if (!item) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Book is not on this shelf." } });
  return res.json({ item });
}));

router.delete("/:bookId", asyncHandler(async (req, res) => {
  const deleted = await getDb()
    .delete(shelfItems)
    .where(and(eq(shelfItems.childId, req.session!.activeChildId!), eq(shelfItems.bookId, req.params.bookId)))
    .returning({ id: shelfItems.id });
  if (deleted.length === 0) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Book is not on this shelf." } });
  return res.json({ ok: true });
}));

export default router;
