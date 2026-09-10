import { getDb } from "../client.js";
import { schema } from "../client.js";
import { users, childProfiles, books, bookPages, achievements, providerRegistry } from "../schema/index.js";
import { eq } from "drizzle-orm";

// ── Seed: Development Test Data ────────────────────────────────────────────────

async function seed() {
  const db = getDb();

  console.log("[seed] Seeding StoryPals database...");

  // ── Test Parent User ──────────────────────────────────────────────────────
  const [parent] = await db.insert(users).values({
    email: "parent@test.storypals.app",
    displayName: "Test Parent",
    role: "parent",
    authProviderId: "test-parent-001",
  }).onConflictDoNothing().returning();

  const parentId = parent?.id;
  if (!parentId) {
    // User already exists — look it up
    const existing = await db.select().from(users).where(eq(users.email, "parent@test.storypals.app")).limit(1);
    if (!existing.length) throw new Error("Failed to create or find test parent");
    console.log("[seed] Test parent already exists:", existing[0].id);
  } else {
    console.log("[seed] Created test parent:", parentId);
  }

  const resolvedParentId = parentId || (await db.select().from(users).where(eq(users.email, "parent@test.storypals.app")).limit(1))[0].id;

  // ── Test Child Profiles ───────────────────────────────────────────────────
  const [child1] = await db.insert(childProfiles).values({
    parentUserId: resolvedParentId,
    displayName: "Emma",
    ageBand: "6-7",
    readingLevel: "Level 1",
    buddyRole: "owl",
    dailyGoalPages: 10,
  }).onConflictDoNothing().returning();

  const [child2] = await db.insert(childProfiles).values({
    parentUserId: resolvedParentId,
    displayName: "Leo",
    ageBand: "8-9",
    readingLevel: "Level 2",
    buddyRole: "dragon",
    dailyGoalPages: 15,
  }).onConflictDoNothing().returning();

  console.log("[seed] Children:", child1?.displayName || "existing", child2?.displayName || "existing");

  // ── Sample Achievements ───────────────────────────────────────────────────
  const achievementDefs = [
    { name: "first-page", description: "Read your very first page", icon: "📖", requirementType: "pages_read", requirementValue: 1 },
    { name: "bookworm", description: "Read 50 pages total", icon: "📚", requirementType: "pages_read", requirementValue: 50 },
    { name: "story-finisher", description: "Complete your first book", icon: "🏆", requirementType: "books_completed", requirementValue: 1 },
    { name: "explorer", description: "Explore 20 words", icon: "🔍", requirementType: "words_explored", requirementValue: 20 },
    { name: "streak-3", description: "Read 3 days in a row", icon: "🔥", requirementType: "streak_days", requirementValue: 3 },
    { name: "streak-7", description: "Read 7 days in a row", icon: "⭐", requirementType: "streak_days", requirementValue: 7 },
    { name: "five-books", description: "Complete 5 books", icon: "🌟", requirementType: "books_completed", requirementValue: 5 },
    { name: "hundred-pages", description: "Read 100 pages total", icon: "💯", requirementType: "pages_read", requirementValue: 100 },
  ];

  for (const a of achievementDefs) {
    await db.insert(achievements).values(a).onConflictDoNothing();
  }
  console.log("[seed] Achievements seeded:", achievementDefs.length);

  // ── Provider Registry ─────────────────────────────────────────────────────
  const providerDefs = [
    { name: "openlibrary", type: "metadata" as const, priority: 10, baseUrl: "https://openlibrary.org" },
    { name: "google-books", type: "metadata" as const, priority: 20, baseUrl: "https://www.googleapis.com/books/v1" },
    { name: "gutenberg", type: "full-text" as const, priority: 30, baseUrl: "https://www.gutenberg.org" },
    { name: "childrenbooks", type: "ai" as const, priority: 40 },
    { name: "gemini", type: "ai" as const, priority: 0 },
  ];

  for (const p of providerDefs) {
    await db.insert(providerRegistry).values(p).onConflictDoNothing();
  }
  console.log("[seed] Providers seeded:", providerDefs.length);

  // ── Sample Books ──────────────────────────────────────────────────────────
  const sampleBooks = [
    {
      title: "The Tortoise and the Hare",
      author: "Aesop",
      summary: "A slow tortoise races a fast hare and proves that steady effort wins the day.",
      level: "Level 1" as const,
      category: "fable" as const,
      moral: "Slow and steady wins the race.",
      language: "en",
      ageMin: 4,
      ageMax: 7,
      colorTheme: "emerald",
    },
    {
      title: "The Boy Who Cried Wolf",
      author: "Aesop",
      summary: "A boy who falsely cries wolf loses the trust of his village when a real wolf appears.",
      level: "Level 1" as const,
      category: "fable" as const,
      moral: "Nobody believes a liar, even when they tell the truth.",
      language: "en",
      ageMin: 5,
      ageMax: 8,
      colorTheme: "amber",
    },
    {
      title: "The Lion and the Mouse",
      author: "Aesop",
      summary: "A tiny mouse helps a mighty lion, proving that even the smallest friend can be valuable.",
      level: "Level 1" as const,
      category: "fable" as const,
      moral: "Little friends may prove great friends.",
      language: "en",
      ageMin: 4,
      ageMax: 7,
      colorTheme: "rose",
    },
  ];

  for (const bookData of sampleBooks) {
    const [book] = await db.insert(books).values(bookData).returning();

    // Add sample pages for each book
    const pages = [
      { bookId: book.id, pageNumber: 1, text: `Once upon a time, there was a story about ${bookData.title.toLowerCase()}. This is the beginning of a wonderful adventure.` },
      { bookId: book.id, pageNumber: 2, text: "The journey continued with excitement and wonder. Every step brought new discoveries and important lessons." },
      { bookId: book.id, pageNumber: 3, text: "Our hero faced a challenge. But with courage and kindness, they found a way forward." },
      { bookId: book.id, pageNumber: 4, text: `And so the story of ${bookData.title.toLowerCase()} comes to an end. The moral is: ${bookData.moral}` },
    ];

    await db.insert(bookPages).values(pages);
  }
  console.log("[seed] Sample books seeded:", sampleBooks.length);

  console.log("[seed] ✅ Seed complete!");
}

seed().catch((err) => {
  console.error("[seed] ❌ Seed failed:", err);
  process.exit(1);
});
