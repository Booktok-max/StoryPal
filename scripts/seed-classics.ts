#!/usr/bin/env tsx
/**
 * StoryPals — Classic Public-Domain Seed Script
 *
 * Imports a curated set of classic children's texts from verified
 * Project Gutenberg mirror URLs.
 *
 * USAGE:
 *   npx tsx scripts/seed-classics.ts
 *
 * REQUIREMENTS:
 *   The import endpoint must be enabled and an admin key set:
 *     BOOK_IMPORT_ENABLED=true
 *     BOOK_IMPORT_ADMIN_KEY=your-secret-key
 *
 *   Run against a running local server:
 *     npm run dev &
 *     npx tsx scripts/seed-classics.ts
 *
 * RIGHTS NOTE:
 *   All texts below are listed as public domain in the United States
 *   on Project Gutenberg. Copyright status outside the US must be
 *   verified independently. See:
 *     https://www.gutenberg.org/policy/terms_of_use.html
 *     https://www.gutenberg.org/policy/license
 *
 *   Project Gutenberg directs automated/bulk access to its mirrors
 *   rather than the main site. Texts below are fetched from the
 *   officially listed mirror at aleph.gutenberg.org.
 */

import fs from "node:fs/promises";
import path from "node:path";

// ─── Curated seed list ────────────────────────────────────────────────────────
// Each entry has been individually verified as public domain (US) on
// Project Gutenberg. Mirror URLs use the official Gutenberg mirror list.
// gutenberg.org/ebooks/NNN → plain text at mirrors.xmission.com/gutenberg/NNN
const CLASSICS: Array<{
  title: string;
  author: string;
  gutenbergId: number;
  category: "fable" | "classic" | "adventure";
  summary: string;
  license: string;
}> = [
  {
    title: "The Tale of Peter Rabbit",
    author: "Beatrix Potter",
    gutenbergId: 14838,
    category: "classic",
    summary:
      "Peter Rabbit disobeys his mother and sneaks into Mr. McGregor's garden, leading to a memorable adventure.",
    license: "Public domain in the United States (Project Gutenberg #14838)",
  },
  {
    title: "Aesop's Fables",
    author: "Aesop",
    gutenbergId: 11339,
    category: "fable",
    summary:
      "A collection of timeless short fables featuring animals who teach lessons about honesty, kindness, and wisdom.",
    license: "Public domain in the United States (Project Gutenberg #11339)",
  },
  {
    title: "Alice's Adventures in Wonderland",
    author: "Lewis Carroll",
    gutenbergId: 11,
    category: "adventure",
    summary:
      "Alice falls down a rabbit hole into a magical world full of peculiar creatures and impossible puzzles.",
    license: "Public domain in the United States (Project Gutenberg #11)",
  },
  {
    title: "The Jungle Book",
    author: "Rudyard Kipling",
    gutenbergId: 236,
    category: "adventure",
    summary:
      "Mowgli, a boy raised by wolves in the Indian jungle, learns the law of the jungle with the help of Baloo and Bagheera.",
    license: "Public domain in the United States (Project Gutenberg #236)",
  },
  {
    title: "Just So Stories",
    author: "Rudyard Kipling",
    gutenbergId: 2781,
    category: "fable",
    summary:
      "Delightful origin stories explaining how the elephant got his trunk, how the camel got his hump, and more.",
    license: "Public domain in the United States (Project Gutenberg #2781)",
  },
  {
    title: "The Wind in the Willows",
    author: "Kenneth Grahame",
    gutenbergId: 289,
    category: "classic",
    summary:
      "The adventures of Mole, Rat, Badger, and the irrepressible Mr. Toad along the banks of the river.",
    license: "Public domain in the United States (Project Gutenberg #289)",
  },
  {
    title: "Grimm's Fairy Tales",
    author: "Jacob and Wilhelm Grimm",
    gutenbergId: 2591,
    category: "classic",
    summary:
      "A beloved collection of fairy tales including Cinderella, Snow White, Hansel and Gretel, and many more.",
    license: "Public domain in the United States (Project Gutenberg #2591)",
  },
  {
    title: "Hans Andersen's Fairy Tales",
    author: "Hans Christian Andersen",
    gutenbergId: 1597,
    category: "classic",
    summary:
      "Classic fairy tales including The Ugly Duckling, Thumbelina, The Little Mermaid, and The Snow Queen.",
    license: "Public domain in the United States (Project Gutenberg #1597)",
  },
  {
    title: "Black Beauty",
    author: "Anna Sewell",
    gutenbergId: 271,
    category: "classic",
    summary:
      "The life story of a horse named Black Beauty, told from his own perspective — a plea for kindness to animals.",
    license: "Public domain in the United States (Project Gutenberg #271)",
  },
  {
    title: "The Adventures of Tom Sawyer",
    author: "Mark Twain",
    gutenbergId: 74,
    category: "adventure",
    summary:
      "The mischievous Tom Sawyer and his friend Huckleberry Finn have adventures along the Mississippi River.",
    license: "Public domain in the United States (Project Gutenberg #74)",
  },
];

// ─── Gutenberg mirror fetch ───────────────────────────────────────────────────
// Uses aleph.gutenberg.org, one of the officially listed Gutenberg mirrors.
// We fetch the plain-text UTF-8 file which doesn't require parsing HTML.
function mirrorUrl(gutenbergId: number): string {
  const id = String(gutenbergId);
  // Gutenberg path convention: /1/2/3/4/1234/1234-0.txt (except single-digit IDs)
  if (id.length === 1) {
    return `https://www.gutenberg.org/cache/epub/${id}/${id}-0.txt`;
  }
  const dirs = id.slice(0, -1).split("").join("/");
  return `https://aleph.gutenberg.org/${dirs}/${id}/${id}-0.txt`;
}

async function fetchText(gutenbergId: number): Promise<string> {
  const url = mirrorUrl(gutenbergId);
  console.log(`  Fetching ${url}`);
  const response = await fetch(url, {
    headers: {
      "User-Agent": "StoryPals/seed-classics (children's reading app; contact via storypals.app)",
    },
  });
  if (!response.ok) {
    // Try the gutenberg.org cache as fallback
    const fallback = `https://www.gutenberg.org/cache/epub/${gutenbergId}/${gutenbergId}-0.txt`;
    console.log(`  Mirror failed (${response.status}), trying ${fallback}`);
    const r2 = await fetch(fallback, {
      headers: { "User-Agent": "StoryPals/seed-classics (children's reading app)" },
    });
    if (!r2.ok) throw new Error(`HTTP ${r2.status} for Gutenberg ID ${gutenbergId}`);
    return r2.text();
  }
  return response.text();
}

// Strip Gutenberg header/footer boilerplate from plain-text files
function stripGutenbergBoilerplate(raw: string): string {
  const startMarkers = [
    /^\*{3}\s*START OF (THE|THIS) PROJECT GUTENBERG/im,
    /^\*{3}\s*START OF THIS PROJECT GUTENBERG/im,
  ];
  const endMarkers = [
    /^\*{3}\s*END OF (THE|THIS) PROJECT GUTENBERG/im,
    /^\*{3}\s*END OF THIS PROJECT GUTENBERG/im,
  ];

  let text = raw;
  for (const marker of startMarkers) {
    const match = text.match(marker);
    if (match?.index !== undefined) {
      text = text.slice(match.index + match[0].length);
      break;
    }
  }
  for (const marker of endMarkers) {
    const match = text.match(marker);
    if (match?.index !== undefined) {
      text = text.slice(0, match.index);
      break;
    }
  }
  return text.trim();
}

// ─── Import via API ───────────────────────────────────────────────────────────
const SERVER_URL = process.env.SERVER_URL || "http://localhost:3000";
const ADMIN_KEY = process.env.BOOK_IMPORT_ADMIN_KEY || "";

async function importBook(
  entry: (typeof CLASSICS)[number],
  text: string
): Promise<void> {
  const response = await fetch(`${SERVER_URL}/api/books/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-storypals-admin-key": ADMIN_KEY,
    },
    body: JSON.stringify({
      title: entry.title,
      author: entry.author,
      text,
      sourceUrl: `https://www.gutenberg.org/ebooks/${entry.gutenbergId}`,
      license: entry.license,
      publicDomain: true,
      attributionRequired: false,
      language: "en",
      summary: entry.summary,
      category: entry.category,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Import failed (HTTP ${response.status})`);
  }

  const book = data.book;
  console.log(
    `  ✓ Imported "${book.title}" — ${book.levelShort}, ${book.wordCount} words, ` +
      `${book.pages.length} pages, status: ${book.status}`
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!ADMIN_KEY) {
    console.error(
      "Error: BOOK_IMPORT_ADMIN_KEY is not set.\n" +
        "Set it in .env and ensure BOOK_IMPORT_ENABLED=true."
    );
    process.exit(1);
  }

  // Check server is up
  try {
    const health = await fetch(`${SERVER_URL}/api/health`);
    if (!health.ok) throw new Error("Health check failed");
    console.log(`✓ Server is running at ${SERVER_URL}\n`);
  } catch {
    console.error(
      `Error: Could not reach ${SERVER_URL}. Is the dev server running?\n` +
        "Run: npm run dev"
    );
    process.exit(1);
  }

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of CLASSICS) {
    console.log(`\nProcessing: ${entry.title} (Gutenberg #${entry.gutenbergId})`);
    try {
      const raw = await fetchText(entry.gutenbergId);
      const text = stripGutenbergBoilerplate(raw);

      if (text.length < 500) {
        console.log(`  ⚠ Text too short after boilerplate stripping — skipping`);
        skipped++;
        continue;
      }

      await importBook(entry, text);
      imported++;

      // Polite delay between requests to respect the mirror server
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err: any) {
      console.error(`  ✗ Failed: ${err.message}`);
      failed++;
    }
  }

  console.log(
    `\n─── Seed complete ─── ${imported} imported, ${skipped} skipped, ${failed} failed`
  );

  if (failed > 0) {
    console.log(
      "\nFailed books can be imported individually with:\n" +
        "  npx tsx scripts/import-public-domain.ts --title 'Book Title' --file ./text.txt"
    );
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
