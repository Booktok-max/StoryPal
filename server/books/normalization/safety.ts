import type { Book } from "../../../src/types";

// ─── Term lists ───────────────────────────────────────────────────────────────

// Hard blocks — these patterns are never acceptable in a child-facing catalog.
// Matched against the full text; no context window applied.
const HARD_BLOCK_TERMS = [
  "pornography",
  "pornographic",
  "erotica",
  "explicit sexual content",
  "sexual exploitation",
  "graphic sexual",
  "suicide instructions",
  "self-harm instructions",
  "how to make a bomb",
  "terrorist recruitment",
  "child abuse",
  "sexual assault",
];

// Soft flags — these words appear in classic children's literature all the time
// ("the fox was murdered", "a great battle", "the dragon was slain").
// We match them only when a surrounding context window also contains an
// amplifying phrase that makes the usage genuinely problematic.
const CONTEXT_FLAGGED_TERMS: Array<{
  term: string;
  amplifiers: string[];
}> = [
  {
    term: "murder",
    amplifiers: ["step by step", "how to", "instructions", "method", "graphically"],
  },
  {
    term: "kill",
    amplifiers: ["instructions", "how to kill a person", "step by step", "method"],
  },
  {
    term: "gore",
    amplifiers: ["graphic", "detailed", "bloody", "explicit"],
  },
  {
    term: "torture",
    amplifiers: ["graphic", "detailed", "explicit", "instructions"],
  },
  {
    term: "drug",
    amplifiers: ["how to", "make", "cook", "trafficking", "dealing", "sell drugs"],
  },
  {
    term: "sex",
    amplifiers: ["explicit", "graphic", "pornographic", "adult content"],
  },
  {
    term: "hate",
    amplifiers: ["white supremac", "racial superiority", "ethnic cleansing", "hate group"],
  },
];

// Age-appropriate concern terms — flag for human review but never auto-block.
// Classic children's stories routinely contain these in benign contexts.
const REVIEW_TERMS = [
  "witchcraft",
  "satanic",
  "occult ritual",
  "blood sacrifice",
  "graphic violence",
];

// Context window size (words either side of a flagged term)
const CONTEXT_WINDOW = 20;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractContextWindow(
  words: string[],
  index: number,
  windowSize: number
): string {
  const start = Math.max(0, index - windowSize);
  const end = Math.min(words.length, index + windowSize + 1);
  return words.slice(start, end).join(" ");
}

function findTermIndex(words: string[], term: string): number {
  const termWords = term.split(/\s+/);
  if (termWords.length === 1) {
    return words.findIndex((w) => w === termWords[0]);
  }
  // Multi-word term: sliding window match
  for (let i = 0; i <= words.length - termWords.length; i++) {
    if (termWords.every((tw, offset) => words[i + offset] === tw)) return i;
  }
  return -1;
}

// ─── Main review function ─────────────────────────────────────────────────────

export type SafetyReview = {
  status: Book["status"];
  flags: string[];
};

export function reviewText(text: string): SafetyReview {
  const lower = text.toLowerCase();
  const words = lower.match(/\b\w+\b/g) ?? [];
  const flags: string[] = [];

  // 1. Hard block — full-text match, no context needed
  for (const term of HARD_BLOCK_TERMS) {
    if (lower.includes(term)) {
      return { status: "rejected", flags: [term] };
    }
  }

  // 2. Context-window soft flags
  for (const { term, amplifiers } of CONTEXT_FLAGGED_TERMS) {
    const idx = findTermIndex(words, term);
    if (idx === -1) continue;

    const context = extractContextWindow(words, idx, CONTEXT_WINDOW);
    const amplified = amplifiers.some((amp) => context.includes(amp));

    if (amplified) {
      flags.push(`${term} (contextual match)`);
    }
    // Term exists but no amplifier → fine for children's literature
  }

  if (flags.length) return { status: "pending-review", flags };

  // 3. Age-appropriateness review terms — flag but don't hard-block
  const reviewFlags = REVIEW_TERMS.filter((term) => lower.includes(term));
  if (reviewFlags.length) {
    return { status: "pending-review", flags: reviewFlags };
  }

  return { status: "approved", flags: [] };
}

/** Apply safety review to a fully assembled book. */
export function reviewBook(book: Book): Book["status"] {
  return reviewText(book.pages.map((page) => page.text).join("\n")).status;
}
