/**
 * Sprint D: upload validation for personal EPUB/PDF imports.
 *
 * Three layers, in order, matching the checklist in the master spec:
 *   1. Size cap (enforced by multer before we even get here, but re-checked).
 *   2. Magic-byte check — the file must actually be what its extension claims,
 *      not just named "book.epub".
 *   3. Archive-bomb check for EPUB (a zip container) — walk the local file
 *      headers and reject absurd compression ratios or entry counts before
 *      anything downstream ever inflates the archive.
 *
 * No zip library dependency: EPUB's outer container is the plain ZIP format,
 * and everything we need (compressed/uncompressed size per entry) lives in
 * fixed-offset fields in each local file header, which we can walk by hand.
 */

export type ImportFormat = "epub" | "pdf";

export type ValidationResult = { ok: true } | { ok: false; error: string };

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB — generous for a single book

// Zip-bomb guard thresholds. A legitimate EPUB (mostly already-compressed
// XHTML/CSS/images) rarely exceeds ~10:1 overall, and rarely has more than a
// few hundred entries (chapters + images + metadata).
const MAX_ZIP_ENTRIES = 5_000;
const MAX_UNCOMPRESSED_RATIO = 100; // uncompressed:compressed
const MAX_UNCOMPRESSED_TOTAL_BYTES = 500 * 1024 * 1024; // hard cap regardless of ratio

const PDF_MAGIC = Buffer.from("%PDF-", "utf8");
// EPUB is a zip; a well-formed EPUB's very first bytes are the local file
// header for the mandatory, uncompressed "mimetype" entry.
const ZIP_LOCAL_FILE_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const ZIP_EOCD_SIGNATURE = Buffer.from([0x50, 0x4b, 0x05, 0x06]);

function checkMagicBytes(buffer: Buffer, format: ImportFormat): ValidationResult {
  if (format === "pdf") {
    if (!buffer.subarray(0, 5).equals(PDF_MAGIC)) {
      return { ok: false, error: "File does not look like a valid PDF (missing %PDF- header)." };
    }
    return { ok: true };
  }

  // format === "epub"
  if (!buffer.subarray(0, 4).equals(ZIP_LOCAL_FILE_HEADER)) {
    return { ok: false, error: "File does not look like a valid EPUB (not a zip archive)." };
  }
  return { ok: true };
}

/**
 * Walks ZIP local file headers starting at offset 0, summing compressed and
 * uncompressed sizes. Stops and returns what it has if it hits a header that
 * doesn't parse cleanly — malformed structure is itself grounds for
 * rejection, not something to push further into the pipeline.
 */
function scanZipEntries(buffer: Buffer): { entries: number; compressed: number; uncompressed: number; malformed: boolean } {
  let offset = 0;
  let entries = 0;
  let compressed = 0;
  let uncompressed = 0;

  while (offset + 4 <= buffer.length) {
    const signature = buffer.readUInt32LE(offset);

    if (signature === 0x04034b50) {
      // Local file header. Fixed part is 30 bytes before name/extra fields.
      if (offset + 30 > buffer.length) return { entries, compressed, uncompressed, malformed: true };

      const generalFlag = buffer.readUInt16LE(offset + 6);
      const compressedSize = buffer.readUInt32LE(offset + 18);
      const uncompressedSize = buffer.readUInt32LE(offset + 22);
      const nameLength = buffer.readUInt16LE(offset + 26);
      const extraLength = buffer.readUInt16LE(offset + 28);

      entries += 1;

      // Bit 3 set means sizes are unreliable here (streamed to a trailing
      // data descriptor instead). Treat as malformed rather than trust a
      // possibly-zero size field — a bomb could hide behind this.
      if (generalFlag & 0x0008) {
        return { entries, compressed, uncompressed, malformed: true };
      }

      compressed += compressedSize;
      uncompressed += uncompressedSize;

      offset += 30 + nameLength + extraLength + compressedSize;

      if (entries > MAX_ZIP_ENTRIES) {
        return { entries, compressed, uncompressed, malformed: false };
      }
      continue;
    }

    if (signature === 0x08064b50 /* archive extra data */ || signature === 0x02014b50 /* central directory */) {
      // Reached the central directory / trailer — done walking real entries.
      break;
    }

    if (buffer.subarray(offset, offset + 4).equals(ZIP_EOCD_SIGNATURE)) {
      break;
    }

    // Unrecognized signature where one was expected — malformed.
    return { entries, compressed, uncompressed, malformed: true };
  }

  return { entries, compressed, uncompressed, malformed: false };
}

function checkZipBomb(buffer: Buffer): ValidationResult {
  const { entries, compressed, uncompressed, malformed } = scanZipEntries(buffer);

  if (malformed) {
    return { ok: false, error: "EPUB archive structure could not be safely parsed." };
  }
  if (entries > MAX_ZIP_ENTRIES) {
    return { ok: false, error: `EPUB contains too many archive entries (limit ${MAX_ZIP_ENTRIES}).` };
  }
  if (uncompressed > MAX_UNCOMPRESSED_TOTAL_BYTES) {
    return { ok: false, error: "EPUB would expand to an unreasonably large size when unpacked." };
  }
  if (compressed > 0 && uncompressed / compressed > MAX_UNCOMPRESSED_RATIO) {
    return { ok: false, error: "EPUB has a suspicious compression ratio (possible archive bomb)." };
  }
  return { ok: true };
}

export function validateUpload(buffer: Buffer, format: ImportFormat, declaredSize: number): ValidationResult {
  if (declaredSize > MAX_UPLOAD_BYTES || buffer.length > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `File exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB upload limit.` };
  }

  const magicCheck = checkMagicBytes(buffer, format);
  if (!magicCheck.ok) return magicCheck;

  if (format === "epub") {
    const bombCheck = checkZipBomb(buffer);
    if (!bombCheck.ok) return bombCheck;
  }

  return { ok: true };
}
