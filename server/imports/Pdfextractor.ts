/**
 * server/imports/pdfExtractor.ts — Sprint D
 *
 * Extracts plain text from a PDF buffer (already validated by
 * validateUpload() — %PDF- magic bytes confirmed, size within limit).
 *
 * Uses pdfjs-dist (pure JavaScript, no native binaries, no system
 * dependencies). This is the same engine that powers Firefox's built-in
 * PDF viewer — battle-tested on real-world PDFs.
 *
 * Strategy:
 *   1. Load the PDF from the in-memory buffer — no temp files, no disk I/O.
 *   2. For each page, extract text items and reconstruct reading order by
 *      grouping items into lines via y-position proximity, then sorting
 *      lines top-to-bottom and items left-to-right within each line.
 *   3. Detect paragraph boundaries by measuring vertical gaps between lines
 *      (a gap larger than ~1.5× the typical line height signals a new
 *      paragraph). This gives normalizeBook's splitter real paragraph
 *      breaks to work with instead of one giant run-on string.
 *   4. Detect chapter headings heuristically (large font size or ALL-CAPS
 *      short line at the start of a gap) so normalizeBook's chapter
 *      detection fires on the same patterns it was built for.
 *   5. Pull document metadata (title, author, language) from the PDF
 *      Info dictionary; fall back to filename-derived values when absent.
 *
 * OCR is explicitly out of scope here — that's an async background step
 * (Sprint I / background workers). If the PDF has no extractable text layer,
 * we return { hasTextLayer: false } so the processor can mark the job
 * pending-review with an appropriate message rather than storing blank text.
 *
 * What this does NOT do:
 *   - OCR (no text layer → caller handles it)
 *   - Image extraction / cover detection (deferred to Sprint D cover work)
 *   - Table / column layout reconstruction (column text is linearised;
 *     children's books are almost always single-column so this is fine)
 *   - Encrypted / password-protected PDFs (rejected early)
 */

// pdfjs-dist legacy build works in Node without a web worker or canvas.
// The non-legacy build requires a DOM environment.
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

// Suppress the "Indexing all PDF objects" warning that pdfjs emits on
// PDFs without a cross-reference table — it's informational, not an error.
// @ts-ignore — GlobalWorkerOptions exists at runtime but types may lag
if (pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "";
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PdfMetadata {
  title: string;
  author: string;
  language: string;
}

export interface PdfExtractResult {
  metadata: PdfMetadata;
  /** Full plain text, paragraphs separated by "\n\n" */
  text: string;
  pageCount: number;
  /** False when the PDF is a scan / image-only — caller should flag for OCR */
  hasTextLayer: boolean;
}

export class PdfExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfExtractionError";
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum fraction of pages that must have extractable text for us to
 *  consider this a text-layer PDF. Below this threshold we call it a scan. */
const MIN_TEXT_PAGE_FRACTION = 0.25;

/** Items within this many PDF points vertically are on the same line.
 *  Body text at 12pt has a baseline-to-baseline of ~14pt, so 3pt is safe. */
const LINE_Y_TOLERANCE = 3;

/** A vertical gap larger than this multiple of the median line height
 *  is treated as a paragraph boundary. */
const PARAGRAPH_GAP_MULTIPLIER = 1.4;

/** A line is a chapter heading candidate when:
 *  - its font size is >= this multiple of the median body font size, OR
 *  - it is short, all-caps, and follows a paragraph gap */
const HEADING_FONT_RATIO = 1.3;

/** Lines shorter than this word count are candidates for heading detection */
const HEADING_MAX_WORDS = 8;

// ─── Text item types (pdfjs runtime shape) ───────────────────────────────────

interface PdfjsTextItem {
  str: string;
  transform: number[]; // [scaleX, skewX, skewY, scaleY, tx, ty]
  height: number;      // font size in PDF user units
  width: number;
  fontName?: string;
}

// ─── Per-page extraction ──────────────────────────────────────────────────────

interface TextLine {
  y: number;        // top of line (PDF y — higher = higher on page)
  x: number;        // leftmost x of first item
  text: string;
  fontSize: number; // median font size across items in this line
}

async function extractPageLines(page: any): Promise<TextLine[]> {
  const content = await page.getTextContent({ includeMarkedContent: false });
  const items = (content.items as PdfjsTextItem[]).filter(
    (i) => i.str !== undefined && i.str.trim().length > 0
  );

  if (items.length === 0) return [];

  // ── Group items into lines by y-position ──────────────────────────────────
  // PDF y=0 is the bottom of the page; items are not guaranteed to arrive
  // in visual order, so we sort first.
  const sorted = [...items].sort((a, b) => {
    const ay = a.transform[5];
    const by = b.transform[5];
    const yDiff = by - ay; // descending y = top-to-bottom
    if (Math.abs(yDiff) > LINE_Y_TOLERANCE) return yDiff;
    return a.transform[4] - b.transform[4]; // left-to-right within a line
  });

  const rawLines: Array<{ y: number; items: PdfjsTextItem[] }> = [];

  for (const item of sorted) {
    const y = item.transform[5];
    const last = rawLines[rawLines.length - 1];
    if (last && Math.abs(y - last.y) <= LINE_Y_TOLERANCE) {
      last.items.push(item);
    } else {
      rawLines.push({ y, items: [item] });
    }
  }

  // ── Convert raw lines to TextLine ─────────────────────────────────────────
  return rawLines.map((raw) => {
    const text = raw.items.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim();
    const sizes = raw.items.map((i) => i.height).filter((h) => h > 0);
    const fontSize = sizes.length
      ? sizes.sort((a, b) => a - b)[Math.floor(sizes.length / 2)] // median
      : 0;
    return {
      y: raw.y,
      x: Math.min(...raw.items.map((i) => i.transform[4])),
      text,
      fontSize,
    };
  });
}

// ─── Paragraph reconstruction ─────────────────────────────────────────────────

/**
 * Given an ordered list of TextLines from one page, reconstruct paragraphs
 * by detecting vertical gaps larger than PARAGRAPH_GAP_MULTIPLIER × median
 * line height, and mark likely chapter headings.
 */
function reconstructParagraphs(lines: TextLine[]): string {
  if (lines.length === 0) return "";

  // Compute median line height (gap between consecutive line y-values)
  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const gap = lines[i - 1].y - lines[i].y; // positive = downward
    if (gap > 0 && gap < 200) gaps.push(gap); // filter outliers
  }
  gaps.sort((a, b) => a - b);
  const medianGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 14;

  // Compute median font size across all lines (for heading detection)
  const fontSizes = lines.map((l) => l.fontSize).filter((s) => s > 0);
  fontSizes.sort((a, b) => a - b);
  const medianFontSize = fontSizes.length
    ? fontSizes[Math.floor(fontSizes.length / 2)]
    : 12;

  const paragraphs: string[] = [];
  let currentLines: string[] = [];

  const flush = () => {
    if (currentLines.length) {
      paragraphs.push(currentLines.join(" "));
      currentLines = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1];

    // Heading detection: large font OR short all-caps line
    const isLargeFont =
      line.fontSize > 0 && line.fontSize >= medianFontSize * HEADING_FONT_RATIO;
    const words = line.text.split(/\s+/).filter(Boolean);
    const isShortAllCaps =
      words.length <= HEADING_MAX_WORDS &&
      line.text === line.text.toUpperCase() &&
      /[A-Z]/.test(line.text);

    if (isLargeFont || isShortAllCaps) {
      flush();
      paragraphs.push(line.text); // heading becomes its own paragraph
      continue;
    }

    currentLines.push(line.text);

    // Paragraph break: gap to next line is larger than threshold
    if (nextLine) {
      const gapToNext = line.y - nextLine.y;
      if (gapToNext > medianGap * PARAGRAPH_GAP_MULTIPLIER) {
        flush();
      }
    }
  }
  flush();

  return paragraphs.join("\n\n");
}

// ─── Metadata extraction ──────────────────────────────────────────────────────

async function extractMetadata(pdf: any): Promise<PdfMetadata> {
  let title = "";
  let author = "";
  let language = "en";

  try {
    const meta = await pdf.getMetadata();

    if (meta?.info) {
      title  = (meta.info.Title  ?? "").trim();
      author = (meta.info.Author ?? "").trim();
    }

    if (meta?.metadata) {
      // XMP metadata — richer than the Info dict, present in newer PDFs
      const xmp = meta.metadata;
      if (!title  && xmp.get("dc:title"))   title  = String(xmp.get("dc:title")).trim();
      if (!author && xmp.get("dc:creator")) author = String(xmp.get("dc:creator")).trim();
      if (xmp.get("dc:language")) {
        language = String(xmp.get("dc:language")).split("-")[0].toLowerCase().trim() || "en";
      }
    }
  } catch {
    // Metadata extraction failing is non-fatal — we'll use empty strings
    // and the processor will fill in reasonable defaults.
  }

  return { title, author, language };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract plain text and metadata from a validated PDF buffer.
 *
 * @throws PdfExtractionError for structural problems (encrypted PDF, corrupt
 *   file, pdfjs load failure).
 * @returns PdfExtractResult — check `hasTextLayer` before storing text.
 *   When false, the caller should mark the import job as pending-review
 *   with a message that OCR is required.
 */
export async function extractPdf(buffer: Buffer): Promise<PdfExtractResult> {
  // pdfjs wants a Uint8Array; share the underlying ArrayBuffer — no copy.
  const data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  let pdf: any;
  try {
    const loadingTask = pdfjsLib.getDocument({
      data,
      useWorkerFetch: false,    // Node — no fetch API
      isEvalSupported: false,   // security: no eval()
      useSystemFonts: true,     // avoid canvas dependency for font metrics
      verbosity: 0,             // suppress pdfjs console warnings
    });
    pdf = await loadingTask.promise;
  } catch (err: any) {
    // pdfjs throws PasswordException for encrypted/locked PDFs
    if (err?.name === "PasswordException" || err?.message?.toLowerCase().includes("password")) {
      throw new PdfExtractionError(
        "This PDF is password-protected and cannot be imported. " +
        "Please provide an unlocked copy."
      );
    }
    throw new PdfExtractionError(`Failed to open PDF: ${err?.message ?? "unknown error"}`);
  }

  const pageCount: number = pdf.numPages;
  const metadata = await extractMetadata(pdf);

  // ── Extract text from each page ───────────────────────────────────────────
  const pageTexts: string[] = [];
  let pagesWithText = 0;

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    let page: any;
    try {
      page = await pdf.getPage(pageNum);
    } catch {
      // Corrupt page — skip rather than abort the whole import
      console.warn(`[pdfExtractor] Failed to load page ${pageNum}/${pageCount} — skipping.`);
      continue;
    }

    try {
      const lines = await extractPageLines(page);
      if (lines.length > 0) {
        pagesWithText++;
        const pageText = reconstructParagraphs(lines);
        if (pageText.trim().length > 0) {
          pageTexts.push(pageText);
        }
      }
    } catch {
      console.warn(`[pdfExtractor] Text extraction failed on page ${pageNum} — skipping.`);
    } finally {
      // Release page resources — important for large PDFs
      page.cleanup();
    }
  }

  // ── Determine whether this PDF has a usable text layer ────────────────────
  const hasTextLayer =
    pageCount > 0 &&
    pagesWithText / pageCount >= MIN_TEXT_PAGE_FRACTION &&
    pageTexts.join("").replace(/\s/g, "").length > 50; // at least some real content

  const text = pageTexts.join("\n\n");

  return { metadata, text, pageCount, hasTextLayer };
}