import { useEffect, useRef } from "react";
import { Book, ImageSizeOption } from "../types";
import { isAiAvailable, saveIllustration } from "../api/client";

const GENERATION_INTERVAL_MS = 12_000;

const AUTO_ILLUSTRATE_SOURCES = new Set(["public-domain", "openlibrary", "standardebooks"]);

interface UseAutoIllustrateOptions {
  book: Book | null | undefined;
  isOnline: boolean;
  onIllustrationGenerated: (
    pageIndex: number,
    newImageUrl: string,
    size: ImageSizeOption
  ) => void;
}

export function useAutoIllustrate({
  book,
  isOnline,
  onIllustrationGenerated,
}: UseAutoIllustrateOptions) {
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
            // Update the UI immediately
            onGeneratedRef.current(pageIndex, data.imageUrl, "1K");

            // Persist so the illustration survives a page refresh
            try {
              await saveIllustration(current.id, {
                pageIndex,
                imageUrl: data.imageUrl,
                imageSize: "1K",
              });
            } catch (saveErr) {
              // Non-fatal — illustration is visible in UI even if save fails
              console.warn("Could not persist illustration:", saveErr);
            }
          } else if (!response.ok) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book?.id, isOnline]);
}
