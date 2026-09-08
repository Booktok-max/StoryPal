import type { Book } from "../../../src/types";

// ─── Syllable estimation ─────────────────────────────────────────────────────
// Rule-based English syllable counter. Good enough for reading-level
// classification; not a dictionary lookup.
function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w.length) return 0;
  if (w.length <= 3) return 1;

  // Strip trailing silent e
  const stripped = w.replace(/e$/, "");
  // Count vowel clusters as syllable nuclei
  const matches = stripped.match(/[aeiouy]+/g);
  return Math.max(1, matches ? matches.length : 1);
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-zA-ZÀ-ÿ']+/g) ?? [];
}

function countSentences(text: string): number {
  return text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean).length || 1;
}

// ─── Flesch-Kincaid Grade Level ──────────────────────────────────────────────
// FK = 0.39 × (words/sentences) + 11.8 × (syllables/words) − 15.59
// Returns a US grade level number; ≤2 → Level 1, ≤5 → Level 2, else Level 3
export function fleschKincaidGrade(text: string): number {
  const words = tokenize(text);
  if (!words.length) return 0;
  const sentences = countSentences(text);
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  return 0.39 * (words.length / sentences) + 11.8 * (syllables / words.length) - 15.59;
}

// ─── Vocabulary difficulty ────────────────────────────────────────────────────
// Long words (9+ chars) are a proxy for difficult vocabulary. We keep this
// alongside FK because short complex words (e.g. "wraith") fool word-length.
function longWordRatio(words: string[]): number {
  if (!words.length) return 0;
  return words.filter((w) => w.replace(/[^a-zA-ZÀ-ÿ]/g, "").length >= 9).length / words.length;
}

// ─── Main classifier ─────────────────────────────────────────────────────────
/**
 * Deterministic reading-level classifier.
 *
 * Uses three signals and takes the *most conservative* (highest) estimate:
 *   1. Flesch-Kincaid grade level (FK ≤ 2 → L1, FK ≤ 5 → L2, else L3)
 *   2. Total word count (short books are never Level 3)
 *   3. Long-word ratio (vocabulary difficulty guard)
 *
 * This intentionally errs toward a higher level so parents can trust
 * the Level 1 label — better to mislabel "easy" as Level 2 than vice versa.
 */
export function analyzeTextReadingLevel(text: string): Book["levelShort"] {
  const words = tokenize(text);
  const count = words.length;
  if (!count) return "Level 1";

  const fk = fleschKincaidGrade(text);
  const lwRatio = longWordRatio(words);

  // FK-based level
  const fkLevel: Book["levelShort"] =
    fk <= 2.0 ? "Level 1" : fk <= 5.0 ? "Level 2" : "Level 3";

  // Word-count guard: very short texts can't be Level 3
  const wordCountLevel: Book["levelShort"] =
    count <= 350 ? "Level 1" : count <= 1200 ? "Level 2" : "Level 3";

  // Vocabulary difficulty guard
  const vocabLevel: Book["levelShort"] =
    lwRatio <= 0.06 ? "Level 1" : lwRatio <= 0.14 ? "Level 2" : "Level 3";

  // Take the most conservative (highest level) of the three signals
  const levels: Book["levelShort"][] = [fkLevel, wordCountLevel, vocabLevel];
  if (levels.includes("Level 3")) return "Level 3";
  if (levels.includes("Level 2")) return "Level 2";
  return "Level 1";
}

export function analyzeReadingLevel(book: Book): Book["levelShort"] {
  return analyzeTextReadingLevel(book.pages.map((page) => page.text).join("\n"));
}
