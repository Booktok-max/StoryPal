/**
 * server/imports/epubExtractor.ts — Sprint D
 *
 * Extracts plain text from an EPUB buffer (already validated by
 * validateUpload() — magic bytes checked, zip-bomb ruled out).
 *
 * Strategy:
 *   1. Parse the ZIP container in memory — no temp files, no disk I/O.
 *   2. Find META-INF/container.xml → locate the OPF package document.
 *   3. Parse the OPF manifest + spine to get the ordered list of content
 *      documents (XHTML/HTML chapters).
 *   4. Strip HTML tags from each content document, collapse whitespace,
 *      and join chapters with double newlines so normalizeBook's paragraph
 *      splitter sees chapter boundaries.
 *   5. Extract top-level metadata (title, author, language, cover image href)
 *      from the OPF <metadata> block.
 *
 * No third-party dependencies — only Node's built-in zlib + buffer APIs.
 * The ZIP parsing reuses the same local-file-header walk as validation.ts
 * but now actually inflates entries instead of just summing sizes.
 *
 * What this does NOT do (deliberately deferred):
 *   - CSS-aware layout (irrelevant — we want plain text for the reader)
 *   - Image extraction (cover is handled separately via the cover pipeline)
 *   - Right-to-left / non-Latin script shaping
 *   - Encrypted EPUBs (we reject them — encrypted = DRM = not user-owned)
 */

import zlib from "node:zlib";
import { promisify } from "node:util";

const inflate = promisify(zlib.inflateRaw);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EpubMetadata {
  title: string;
  author: string;
  language: string;
  /** href of the cover image entry inside the zip, if declared in the OPF */
  coverHref: string | null;
}

export interface EpubExtractResult {
  metadata: EpubMetadata;
  /** Full plain-text content, chapters joined with "\n\n" */
  text: string;
  /** Per-chapter plain text in spine order, for finer-grained processing */
  chapters: Array<{ title: string; text: string }>;
}

export class EpubExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EpubExtractionError";
  }
}

// ─── ZIP parsing ─────────────────────────────────────────────────────────────
// We only need two compression methods from ZIP:
//   0 = stored (no compression)
//   8 = deflated  (by far the most common in EPUBs)

interface ZipEntry {
  name: string;        // UTF-8 path inside the archive
  data: Buffer;        // decompressed content
}

async function parseZip(buffer: Buffer): Promise<Map<string, ZipEntry>> {
  const entries = new Map<string, ZipEntry>();
  let offset = 0;

  while (offset + 4 <= buffer.length) {
    const sig = buffer.readUInt32LE(offset);

    // Local file header
    if (sig === 0x04034b50) {
      if (offset + 30 > buffer.length) {
        throw new EpubExtractionError("Truncated ZIP local file header.");
      }

      const compression   = buffer.readUInt16LE(offset + 8);
      const compressedSz  = buffer.readUInt32LE(offset + 18);
      const uncompressedSz= buffer.readUInt32LE(offset + 22);
      const nameLength    = buffer.readUInt16LE(offset + 26);
      const extraLength   = buffer.readUInt16LE(offset + 28);

      const nameStart = offset + 30;
      const nameEnd   = nameStart + nameLength;
      const dataStart = nameEnd + extraLength;
      const dataEnd   = dataStart + compressedSz;

      if (dataEnd > buffer.length) {
        throw new EpubExtractionError("ZIP entry data extends beyond buffer.");
      }

      const name = buffer.subarray(nameStart, nameEnd).toString("utf8");
      const compressed = buffer.subarray(dataStart, dataEnd);

      let data: Buffer;
      if (compression === 0) {
        data = Buffer.from(compressed); // stored — copy to own buffer
      } else if (compression === 8) {
        try {
          data = await inflate(compressed) as Buffer;
        } catch {
          throw new EpubExtractionError(`Failed to decompress ZIP entry "${name}".`);
        }
      } else {
        // Unsupported compression method (e.g. bzip2, lzma) — skip the
        // entry; it's almost certainly a non-text asset we don't need.
        offset += 30 + nameLength + extraLength + compressedSz;
        continue;
      }

      if (data.length !== uncompressedSz && uncompressedSz !== 0) {
        // Mismatch between declared and actual size — could indicate a
        // corrupted file; allow it but note it. Downstream text extraction
        // will surface the corruption if it's in a content document.
      }

      entries.set(name, { name, data });
      offset = dataEnd;
      continue;
    }

    // Central directory, EOCD, or end of local entries — stop walking.
    if (sig === 0x02014b50 || sig === 0x06054b50 || sig === 0x08064b50) break;

    // Unknown signature — the zip is likely malformed past this point.
    throw new EpubExtractionError("Unexpected ZIP structure — cannot parse EPUB safely.");
  }

  return entries;
}

// ─── XML helpers ─────────────────────────────────────────────────────────────
// We parse just enough XML to follow the EPUB container/OPF/spine chain.
// A full DOM parser would be cleaner but adds a dependency. These helpers
// are deliberately narrow — they handle well-formed EPUB output from real
// authoring tools; they are not a general XML parser.

/** Extract the text content of the first matching element */
function xmlText(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : "";
}

/** Extract a named attribute value from the first matching element */
function xmlAttr(xml: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`, "i");
  const m = xml.match(re);
  return m ? m[1] : "";
}

/** Extract all occurrences of a tag as raw strings */
function xmlAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*(?:\\/>|>[\\s\\S]*?<\\/${tag}>)`, "gi");
  return xml.match(re) ?? [];
}

/** Resolve a path relative to a base path (both POSIX-style) */
function resolvePath(base: string, relative: string): string {
  if (relative.startsWith("/")) return relative.slice(1);
  const baseParts = base.split("/");
  baseParts.pop(); // remove filename, keep directory
  const parts = [...baseParts, ...relative.split("/")];
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === "..") resolved.pop();
    else if (part !== ".") resolved.push(part);
  }
  return resolved.join("/");
}

// ─── HTML → plain text ───────────────────────────────────────────────────────

/**
 * Strip HTML tags and decode common entities, preserving paragraph breaks.
 * Block-level elements (p, div, h1-h6, br, li) become newlines so
 * normalizeBook's paragraph splitter has boundaries to work with.
 */
function htmlToText(html: string): string {
  return html
    // Remove <script> and <style> blocks entirely
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    // Block elements → double newline (paragraph boundary)
    .replace(/<\/?(p|div|h[1-6]|li|blockquote|section|article|header|footer|nav|aside|figure|figcaption|tr|td|th)\b[^>]*>/gi, "\n\n")
    // Line breaks → single newline
    .replace(/<br\s*\/?>/gi, "\n")
    // Strip all remaining tags
    .replace(/<[^>]+>/g, "")
    // Decode common XML/HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&nbsp;/g, " ")
    // Collapse runs of spaces/tabs (but not newlines)
    .replace(/[^\S\n]+/g, " ")
    // Collapse 3+ consecutive newlines into 2 (paragraph break)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Best-effort: guess a chapter title from its HTML content */
function guessChapterTitle(html: string, fallback: string): string {
  const m = html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
  if (m) {
    const t = m[1].replace(/<[^>]+>/g, "").trim();
    if (t.length > 0 && t.length < 120) return t;
  }
  return fallback;
}

// ─── OPF parsing ─────────────────────────────────────────────────────────────

interface OpfManifestItem {
  id: string;
  href: string;       // path relative to OPF file location
  mediaType: string;
}

interface OpfData {
  opfPath: string;
  metadata: EpubMetadata;
  spineHrefs: string[];  // absolute zip paths, in reading order
}

function parseOpf(opfContent: string, opfPath: string): OpfData {
  // ── Metadata ──────────────────────────────────────────────────────────────
  const metaBlock = opfContent.match(/<metadata[\s\S]*?<\/metadata>/i)?.[0] ?? "";

  const rawTitle  = xmlText(metaBlock, "dc:title")  || xmlText(metaBlock, "title")  || "Untitled";
  const rawAuthor = xmlText(metaBlock, "dc:creator") || xmlText(metaBlock, "creator")|| "Unknown";
  const rawLang   = xmlText(metaBlock, "dc:language")|| xmlText(metaBlock, "language")|| "en";

  // Strip any nested tags (e.g. <dc:title xml:lang="en">Foo</dc:title>)
  const title  = rawTitle .replace(/<[^>]+>/g, "").trim();
  const author = rawAuthor.replace(/<[^>]+>/g, "").trim();
  const language = rawLang.replace(/<[^>]+>/g, "").split("-")[0].toLowerCase().trim() || "en";

  // Cover: look for <meta name="cover" content="cover-id" /> then resolve
  // through manifest
  let coverHref: string | null = null;
  const coverMeta = opfContent.match(/<meta[^>]+name="cover"[^>]+content="([^"]+)"/i)
    ?? opfContent.match(/<meta[^>]+content="([^"]+)"[^>]+name="cover"/i);
  const coverId = coverMeta?.[1] ?? null;

  // ── Manifest ──────────────────────────────────────────────────────────────
  const manifestBlock = opfContent.match(/<manifest[\s\S]*?<\/manifest>/i)?.[0] ?? "";
  const itemTags = xmlAll(manifestBlock, "item");

  const manifest = new Map<string, OpfManifestItem>();
  for (const tag of itemTags) {
    const id        = xmlAttr(tag, "item", "id");
    const href      = xmlAttr(tag, "item", "href");
    const mediaType = xmlAttr(tag, "item", "media-type");
    if (id && href) manifest.set(id, { id, href, mediaType });
  }

  // Resolve cover href from cover id
  if (coverId && manifest.has(coverId)) {
    const coverItem = manifest.get(coverId)!;
    coverHref = resolvePath(opfPath, coverItem.href);
  }

  // ── Spine ─────────────────────────────────────────────────────────────────
  const spineBlock = opfContent.match(/<spine[\s\S]*?<\/spine>/i)?.[0] ?? "";
  const itemrefTags = xmlAll(spineBlock, "itemref");

  const spineHrefs: string[] = [];
  for (const tag of itemrefTags) {
    const idref = xmlAttr(tag, "itemref", "idref");
    const linear = xmlAttr(tag, "itemref", "linear");
    // linear="no" items are supplementary (cover pages, TOC HTML, etc.) —
    // include them only if linear is not explicitly "no"
    if (linear === "no") continue;
    const item = manifest.get(idref);
    if (item && (item.mediaType.includes("html") || item.mediaType.includes("xhtml"))) {
      spineHrefs.push(resolvePath(opfPath, item.href));
    }
  }

  return {
    opfPath,
    metadata: { title, author, language, coverHref },
    spineHrefs,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Extract plain text and metadata from a validated EPUB buffer.
 *
 * @throws EpubExtractionError for structural problems (missing container,
 *   missing OPF, encrypted content, empty spine, etc.)
 */
export async function extractEpub(buffer: Buffer): Promise<EpubExtractResult> {
  // 1. Parse the ZIP container
  const zip = await parseZip(buffer);

  // 2. Reject encrypted EPUBs (DRM) — encryption.xml in META-INF is the
  //    standard indicator. We check before doing any further work.
  if (zip.has("META-INF/encryption.xml")) {
    const enc = zip.get("META-INF/encryption.xml")!.data.toString("utf8");
    // encryption.xml may exist but be empty / list only font obfuscation;
    // font obfuscation uses idpf.org/2008/embedding, not actual content DRM.
    if (enc.includes("EncryptedData") && !enc.includes("idpf.org/2008/embedding")) {
      throw new EpubExtractionError(
        "This EPUB is DRM-protected and cannot be imported. " +
        "Please use a DRM-free copy of the book."
      );
    }
  }

  // 3. Locate the OPF package document via META-INF/container.xml
  const containerEntry = zip.get("META-INF/container.xml");
  if (!containerEntry) {
    throw new EpubExtractionError("EPUB is missing META-INF/container.xml.");
  }
  const containerXml = containerEntry.data.toString("utf8");

  // <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  const opfPath = xmlAttr(containerXml, "rootfile", "full-path");
  if (!opfPath) {
    throw new EpubExtractionError("Cannot locate OPF package document in container.xml.");
  }

  const opfEntry = zip.get(opfPath);
  if (!opfEntry) {
    throw new EpubExtractionError(`OPF file "${opfPath}" listed in container.xml is missing from the archive.`);
  }

  // 4. Parse OPF to get metadata + ordered spine hrefs
  const opfContent = opfEntry.data.toString("utf8");
  const { metadata, spineHrefs } = parseOpf(opfContent, opfPath);

  if (spineHrefs.length === 0) {
    throw new EpubExtractionError("EPUB spine is empty — no readable content documents found.");
  }

  // 5. Extract text from each spine document in order
  const chapters: Array<{ title: string; text: string }> = [];
  let chapterIndex = 0;

  for (const href of spineHrefs) {
    const entry = zip.get(href);
    if (!entry) {
      // Missing spine item — skip with a warning rather than aborting; a
      // single missing chapter shouldn't kill the whole import.
      console.warn(`[epubExtractor] Spine item "${href}" not found in ZIP — skipping.`);
      continue;
    }

    const html  = entry.data.toString("utf8");
    const text  = htmlToText(html);
    const title = guessChapterTitle(html, `Chapter ${chapterIndex + 1}`);

    // Skip entirely empty documents (nav pages, blank cover XHTML, etc.)
    if (text.replace(/\s/g, "").length === 0) continue;

    chapters.push({ title, text });
    chapterIndex++;
  }

  if (chapters.length === 0) {
    throw new EpubExtractionError("No readable text found in the EPUB content documents.");
  }

  // 6. Join all chapters into one text string, with chapter headings as
  //    paragraph boundaries so normalizeBook's chapter detector fires.
  const text = chapters
    .map((ch) => `${ch.title}\n\n${ch.text}`)
    .join("\n\n");

  return { metadata, text, chapters };
}