import { useState, useEffect, useCallback } from "react";
import {
  listShelf,
  addToShelf,
  updateShelfItem,
  removeFromShelf,
  type ShelfUpdateInput,
} from "../api/client";
import type { ShelfItem, ShelfStatus } from "../types";

/**
 * Manages the child's reading shelf with optimistic updates.
 *
 * Pass `active=true` when a child session is established — the hook loads
 * once then stays in sync via the local optimistic state. Pass `active=false`
 * (e.g. parent context, loading) and the shelf stays empty + no network calls
 * are made.
 */
export function useShelf(active: boolean) {
  const [items, setItems] = useState<ShelfItem[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!active) return;
    setLoading(true);
    try {
      const data = await listShelf();
      setItems(data.items ?? []);
    } catch {
      // DB unavailable or not yet configured — degrade gracefully
    } finally {
      setLoading(false);
    }
  }, [active]);

  useEffect(() => {
    if (active) reload();
    else setItems([]);
  }, [active, reload]);

  /** Look up the shelf entry for one book. */
  const getItem = useCallback(
    (bookId: string) => items.find((i) => i.bookId === bookId),
    [items]
  );

  /** Add a book to the shelf as "want-to-read". No-op if already present. */
  const add = useCallback(
    async (bookId: string) => {
      if (items.find((i) => i.bookId === bookId)) return;

      const optimistic: ShelfItem = {
        id: `temp-${bookId}`,
        bookId,
        status: "want-to-read",
        favorite: false,
        progressPage: 0,
        addedAt: new Date().toISOString(),
        lastOpenedAt: null,
      };
      setItems((prev) => [...prev, optimistic]);

      try {
        const { item } = await addToShelf({ bookId });
        setItems((prev) => prev.map((i) => (i.bookId === bookId ? item : i)));
      } catch {
        setItems((prev) => prev.filter((i) => i.bookId !== bookId));
      }
    },
    [items]
  );

  /** Remove a book from the shelf entirely. */
  const remove = useCallback(
    async (bookId: string) => {
      const snapshot = items;
      setItems((prev) => prev.filter((i) => i.bookId !== bookId));
      try {
        await removeFromShelf(bookId);
      } catch {
        setItems(snapshot);
      }
    },
    [items]
  );

  /** Toggle saved/unsaved. Adds as want-to-read; removes if already there. */
  const toggle = useCallback(
    async (bookId: string) => {
      if (items.find((i) => i.bookId === bookId)) {
        await remove(bookId);
      } else {
        await add(bookId);
      }
    },
    [items, add, remove]
  );

  /** Update status, favorite, or progress page for an existing shelf item. */
  const update = useCallback(
    async (bookId: string, input: ShelfUpdateInput) => {
      setItems((prev) =>
        prev.map((i) => (i.bookId === bookId ? { ...i, ...input } : i))
      );
      try {
        await updateShelfItem(bookId, input);
      } catch {
        // Reload to restore server truth
        reload();
      }
    },
    [reload]
  );

  /**
   * Mark a book as "reading". Adds it first if it isn't on the shelf yet.
   * Safe to call every time a book is opened — it no-ops if already "reading".
   */
  const markReading = useCallback(
    async (bookId: string) => {
      const existing = items.find((i) => i.bookId === bookId);
      if (existing) {
        if (existing.status !== "reading") {
          await update(bookId, { status: "reading" });
        }
      } else {
        // Add then set to reading in two calls (POST always defaults to want-to-read)
        const optimistic: ShelfItem = {
          id: `temp-${bookId}`,
          bookId,
          status: "reading",
          favorite: false,
          progressPage: 0,
          addedAt: new Date().toISOString(),
          lastOpenedAt: new Date().toISOString(),
        };
        setItems((prev) => [...prev, optimistic]);
        try {
          await addToShelf({ bookId });
          await updateShelfItem(bookId, { status: "reading" });
          reload(); // Sync with server's real IDs
        } catch {
          setItems((prev) => prev.filter((i) => i.bookId !== bookId));
        }
      }
    },
    [items, update, reload]
  );

  /**
   * Mark a book as "finished". Adds it if missing, then sets status.
   * Safe to call on last-page completion.
   */
  const markFinished = useCallback(
    async (bookId: string) => {
      const existing = items.find((i) => i.bookId === bookId);
      if (existing) {
        if (existing.status !== "finished") {
          await update(bookId, { status: "finished" });
        }
      } else {
        const optimistic: ShelfItem = {
          id: `temp-${bookId}`,
          bookId,
          status: "finished",
          favorite: false,
          progressPage: 0,
          addedAt: new Date().toISOString(),
          lastOpenedAt: new Date().toISOString(),
        };
        setItems((prev) => [...prev, optimistic]);
        try {
          await addToShelf({ bookId });
          await updateShelfItem(bookId, { status: "finished" });
          reload();
        } catch {
          setItems((prev) => prev.filter((i) => i.bookId !== bookId));
        }
      }
    },
    [items, update, reload]
  );

  return {
    items,
    loading,
    getItem,
    add,
    remove,
    toggle,
    update,
    markReading,
    markFinished,
    reload,
  };
}

export type UseShelfResult = ReturnType<typeof useShelf>;

export const SHELF_STATUS_LABELS: Record<ShelfStatus, string> = {
  "want-to-read": "Saved",
  reading: "Reading",
  finished: "Finished",
};

export const SHELF_STATUS_EMOJI: Record<ShelfStatus, string> = {
  "want-to-read": "🔖",
  reading: "📖",
  finished: "✓",
};
