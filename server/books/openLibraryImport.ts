import type { TextBookInput } from "./normalization/normalizeBook";
import { importTextBook } from "./importer";
import type { Book } from "../../src/types";

const OPEN_LIBRARY_BASE_URL = "https://openlibrary.org";
const ARCHIVE_METADATA_URL = "https://archive.org/metadata";
const ARCHIVE_DOWNLOAD_URL = "https://archive.org/download";

// Guards against pulling in something unreasonably large (memory + the
// public-domain-books.json file both stay bounded). Generous enough for a
// full children's chapter book.
const MAX_IMPORT_CHARS = 200_000;
const MIN_IMPORT_CHARS = 200;

export class DiscoveryImportError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "not-available"
      | "fetch-failed"
      | "empty-text"
  ) {
    super(message);
    this.name = "DiscoveryImportError";
  }
}

function getUserAgent(): string {
  return (
    process.env.OPEN_LIBRARY_USER_AGENT ||
    "StoryPals/Phase4 (children's reading import)"
  );
}

type OpenLibraryEdition = {
  key?: string;
  title?: string;
  ocaid?: string;
};

type OpenLibraryEditionsResponse = {
  entries?: OpenLibraryEdition[];
};

type ArchiveMetadata = {
  metadata?: {
    "access-restricted-item"?: string | boolean;
    title?: string;
  };
  files?: { name?: string }[];
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": getUserAgent() },
  });
  if (!response.ok) {
    throw new Error(`Request to ${url} failed with HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

/**
 * Open Library's search-level `has_fulltext`/`ebook_access` flags (used to
 * gate the "Add to My Library" button in the UI) describe the *work*, but
 * actual readability can vary by *edition*. This re-verifies at the edition
 * level against Internet Archive directly before we commit to importing:
 * finds an edition with an Internet Archive identifier, confirms IA doesn't
 * mark it access-restricted (lending-only), and confirms an OCR'd text file
 * actually exists.
 */
async function findPublicFullTextEdition(
  workId: string
): Promise<{ ocaid: string; title: string } | null> {
  const editions = await fetchJson<OpenLibraryEditionsResponse>(
    `${OPEN_LIBRARY_BASE_URL}/works/${encodeURIComponent(workId)}/editions.json?limit=20`
  );

  for (const edition of editions.entries ?? []) {
    if (!edition.ocaid) continue;

    try {
      const metadata = await fetchJson<ArchiveMetadata>(
        `${ARCHIVE_METADATA_URL}/${encodeURIComponent(edition.ocaid)}`
      );

      const restricted = metadata.metadata?.["access-restricted-item"];
      const isRestricted = restricted === true || restricted === "true";
      if (isRestricted) continue;

      const hasDjvuText = (metadata.files ?? []).some((f) =>
        f.name?.endsWith("_djvu.txt")
      );
      if (!hasDjvuText) continue;

      return {
        ocaid: edition.ocaid,
        title: edition.title || metadata.metadata?.title || "",
      };
    } catch {
      // This particular edition's IA record didn't load — try the next one
      // rather than failing the whole import over one bad candidate.
      continue;
    }
  }

  return null;
}

async function fetchFullText(ocaid: string): Promise<string> {
  const response = await fetch(
    `${ARCHIVE_DOWNLOAD_URL}/${encodeURIComponent(ocaid)}/${encodeURIComponent(ocaid)}_djvu.txt`,
    { headers: { "User-Agent": getUserAgent() } }
  );

  if (!response.ok) {
    throw new DiscoveryImportError(
      "Could not download this book's text from Internet Archive.",
      "fetch-failed"
    );
  }

  const text = await response.text();
  if (!text.trim() || text.trim().length < MIN_IMPORT_CHARS) {
    throw new DiscoveryImportError(
      "Internet Archive did not return readable text for this book.",
      "empty-text"
    );
  }

  return text.length > MAX_IMPORT_CHARS ? text.slice(0, MAX_IMPORT_CHARS) : text;
}

export interface DiscoverImportParams {
  /** Open Library work id, with or without the "openlibrary:" prefix. */
  workId: string;
  title: string;
  author: string;
  summary?: string;
  subjects?: string[];
  coverImage?: string;
  sourceUrl?: string;
}

/**
 * Phase 4 item 3 — "Add to My Library". Takes a book the parent/teacher
 * picked from Open Library discovery search, re-verifies it's genuinely
 * readable in full, pulls the OCR'd text from Internet Archive, and runs it
 * through the same safety + reading-level pipeline every other import uses.
 *
 * The result always lands as "pending-review" (unless the safety scan flags
 * it as outright "rejected", which wins) — discovery imports are far less
 * curated than the built-in seed list, so a parent still has to approve one
 * before a child reads it.
 */
export async function discoverImportOpenLibraryWork(
  params: DiscoverImportParams
): Promise<Book> {
  const workId = params.workId.replace(/^openlibrary:/, "").replace(/^\/?works\//, "");

  const edition = await findPublicFullTextEdition(workId);
  if (!edition) {
    throw new DiscoveryImportError(
      "This book isn't available as full public-domain text yet — only its catalog listing.",
      "not-available"
    );
  }

  const text = await fetchFullText(edition.ocaid);

  const input: TextBookInput = {
    title: params.title,
    author: params.author,
    text,
    sourceUrl: params.sourceUrl || `${OPEN_LIBRARY_BASE_URL}/works/${workId}`,
    license: "Public domain text via Internet Archive / Open Library",
    publicDomain: true,
    attributionRequired: true,
    language: "en",
    summary: params.summary,
    category: "classic",
    coverImage: params.coverImage,
    subjects: params.subjects,
    externalId: workId,
    sourceType: "public-domain",
    providerId: "public-domain",
    tag: "Open Library",
    colorTheme: "sky",
    forceStatus: "pending-review",
  };

  return importTextBook(input);
}
