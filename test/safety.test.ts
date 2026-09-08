import { describe, it, expect } from "vitest";
import { reviewText, reviewBook } from "../server/books/normalization/safety";
import type { Book } from "../src/types";

describe("safety.reviewText", () => {
  it("approves clean children's text", () => {
    const result = reviewText("The little rabbit hopped through the meadow.");
    expect(result.status).toBe("approved");
    expect(result.flags).toEqual([]);
  });

  it("approves classic fairy tale language with 'kill' in benign context", () => {
    const result = reviewText("The giant said he would kill the golden goose if it didn't lay eggs.");
    expect(result.status).toBe("approved");
  });

  it("hard-blocks pornography", () => {
    const result = reviewText("This book contains pornography and explicit content.");
    expect(result.status).toBe("rejected");
    expect(result.flags).toContain("pornography");
  });

  it("hard-blocks erotica", () => {
    const result = reviewText("The story involves erotica.");
    expect(result.status).toBe("rejected");
  });

  it("hard-blocks self-harm instructions", () => {
    const result = reviewText("self-harm instructions are included here.");
    expect(result.status).toBe("rejected");
  });

  it("hard-blocks child abuse", () => {
    const result = reviewText("References to child abuse appear.");
    expect(result.status).toBe("rejected");
  });

  it("context-flags 'murder' with amplifiers", () => {
    const result = reviewText("Here is a step by step method for how to murder someone.");
    expect(result.status).toBe("pending-review");
    expect(result.flags.length).toBeGreaterThan(0);
  });

  it("does NOT flag 'murder' in benign fairy tale context", () => {
    const result = reviewText("The king was murdered in his sleep by the evil wizard.");
    expect(result.status).toBe("approved");
  });

  it("context-flags 'drug' with how-to amplifier", () => {
    const result = reviewText("Let me tell you how to make a drug at home.");
    expect(result.status).toBe("pending-review");
  });

  it("does NOT flag 'drug' in medical context", () => {
    const result = reviewText("The doctor prescribed a drug for the illness.");
    expect(result.status).toBe("approved");
  });

  it("flags witchcraft for review but doesn't block", () => {
    const result = reviewText("The story involves witchcraft and spells.");
    expect(result.status).toBe("pending-review");
    expect(result.flags).toContain("witchcraft");
  });

  it("flags occult ritual for review", () => {
    const result = reviewText("An occult ritual takes place in the forest.");
    expect(result.status).toBe("pending-review");
  });

  it("approves long benign children's story", () => {
    const longText = Array(100).fill("The little fox jumped over the stream happily.").join(" ");
    const result = reviewText(longText);
    expect(result.status).toBe("approved");
  });
});

describe("safety.reviewBook", () => {
  const makeBook = (texts: string[]): Book => ({
    id: "test-book",
    title: "Test Book",
    author: "Author",
    coverImage: "",
    level: "Level 1 (Early Reader)",
    levelShort: "Level 1",
    colorTheme: "amber",
    summary: "A test book",
    pages: texts.map((text, i) => ({
      pageNumber: i + 1,
      text,
      illustrationPrompt: "",
      keyWords: [],
    })),
  });

  it("approves a book with clean pages", () => {
    const book = makeBook(["The cat sat on the mat.", "The dog ran in the park."]);
    expect(reviewBook(book)).toBe("approved");
  });

  it("rejects a book with harmful content on any page", () => {
    const book = makeBook(["Nice story.", "Contains pornography.", "Happy ending."]);
    expect(reviewBook(book)).toBe("rejected");
  });

  it("flags a book for review with borderline content", () => {
    const book = makeBook(["Witchcraft is mentioned in this tale."]);
    expect(reviewBook(book)).toBe("pending-review");
  });
});
