import { useEffect, useRef } from "react";
import { Book, ImageSizeOption } from "../types";
import { isAiAvailable } from "../api/client";

// Server's imageRateLimiter allows 6 requests/min — space calls out so the
// background job never trips it (and still leaves headroom for the reader
// to manually paint a page while this is running).
const GENERATION_INTERVAL_MS = 12_000;

// Only auto-illustrate books that came from an import pipeline. Built-in
// books ship with curated art, and AI-created custom stories already get an
// illustration at creation time.
const AUTO_ILLUSTRATE_SOURCES = new Set(["public-domain", "openlibrary"]);

interface UseAutoIllustrateOptions {
  book: Book | null | undefined;
  isOnline: boolean;
  onIllustrationGenerated: (
    pageIndex: number,
    newImageUrl: string,
    size: ImageSizeOption
  ) => void;
}

/**
 * Quietly fills in missing illustrations for an imported book's pages, one
 * at a time, in the background — so reading isn't blocked and the server's
 * rate limit isn't hit. Safe to mount for any book; it no-ops for books that
 * don't need it (already illustrated, not an imported source, offline, or
 * no Gemini API key configured).
 */
export function useAutoIllustrate({
  book,
  isOnline,
  onIllustrationGenerated,
}: UseAutoIllustrateOptions) {
  // Kept up to date every render so the running loop can always see the
  // latest page state (e.g. a page the reader just painted manually)
  // without the effect itself needing to depend on `book` by value.
  const latestBookRef = useRef<Book | null | undefined>(book);
  latestBookRef.current = book;

  const onGeneratedRef = useRef(onIllustrationGenerated);
  onGeneratedRef.current = onIllustrationGenerated;

  useEffect(() => {
    if (!book || !isOnline) return;

    const sourceType = book.source?.type;
    if (!sourceType || !AUTO_ILLUSTRATE_SOURCES.has(sourceType)) return;

    if (isAiAvailable() === false) return;

    let cancelled = false;

    const nextPendingIndex = (): number => {
      const current = latestBookRef.current;
      if (!current || current.id !== book.id) return -1;
      return current.pages.findIndex((page) => !page.currentImageUrl);
    };

    const run = async () => {
      while (!cancelled) {
        const pageIndex = nextPendingIndex();
        if (pageIndex === -1) break;

        const current = latestBookRef.current;
        const page = current?.pages[pageIndex];
        if (!current || !page) break;

        try {
          const response = await fetch("/api/generate-illustration", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: page.illustrationPrompt || page.text,
              imageSize: "1K",
              aspectRatio: "4:3",
              style: "Whimsical Storybook Watercolor",
              pageNumber: page.pageNumber,
              bookTitle: current.title,
            }),
          });

          const data = await response.json();
          if (!cancelled && response.ok && data.imageUrl) {
            onGeneratedRef.current(pageIndex, data.imageUrl, "1K");
          } else if (!response.ok) {
            // Server error (rate limit, no API key, etc.) — stop for now
            // rather than hammering the endpoint on every remaining page.
            break;
          }
        } catch (err) {
          console.warn(
            `Background illustration generation failed for page ${pageIndex}:`,
            err
          );
          break;
        }

        if (cancelled) break;
        await new Promise((resolve) =>
          setTimeout(resolve, GENERATION_INTERVAL_MS)
        );
      }
    };

    run();

    return () => {
      cancelled = true;
    };
    // Re-run when the book changes or connectivity is restored. Page-level
    // updates are read live via latestBookRef, so they intentionally aren't
    // in this dependency list — that would restart (and cancel) the loop
    // every time a single page finishes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.id, isOnline]);
}
