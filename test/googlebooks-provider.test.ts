import { describe, it, expect } from "vitest";
import { isChildRelevant, qualityScore } from "../server/books/providers/googlebooks";

// Minimal shape matching the fields these functions actually read —
// avoids importing Google's full (and unstable) response typings into a test.
function volume(overrides: Record<string, any> = {}) {
  return {
    volumeInfo: {
      title: "A Book",
      categories: [],
      imageLinks: undefined,
      maturityRating: "NOT_MATURE",
      description: undefined,
      ...overrides.volumeInfo,
    },
    accessInfo: overrides.accessInfo,
  } as any;
}

describe("googlebooks.isChildRelevant", () => {
  it("rejects a volume with no title", () => {
    expect(isChildRelevant(volume({ volumeInfo: { title: undefined } }))).toBe(false);
  });

  it("rejects anything flagged mature, regardless of category", () => {
    const vol = volume({
      volumeInfo: { categories: ["Juvenile Fiction"], maturityRating: "MATURE" },
    });
    expect(isChildRelevant(vol)).toBe(false);
  });

  it("rejects a blocked-term category even if it also mentions children", () => {
    const vol = volume({ volumeInfo: { categories: ["True Crime"] } });
    expect(isChildRelevant(vol)).toBe(false);
  });

  it("accepts a volume with a clear child-relevant category", () => {
    const vol = volume({ volumeInfo: { categories: ["Juvenile Fiction / Animals"] } });
    expect(isChildRelevant(vol)).toBe(true);
  });

  it("rejects a volume with categories present but none child-relevant", () => {
    const vol = volume({ volumeInfo: { categories: ["Business & Economics"] } });
    expect(isChildRelevant(vol)).toBe(false);
  });

  it("for sparse records (no categories), requires at least a cover", () => {
    const withCover = volume({
      volumeInfo: { categories: [], imageLinks: { thumbnail: "http://x/y.jpg" } },
    });
    const withoutCover = volume({ volumeInfo: { categories: [], imageLinks: undefined } });
    expect(isChildRelevant(withCover)).toBe(true);
    expect(isChildRelevant(withoutCover)).toBe(false);
  });
});

describe("googlebooks.qualityScore", () => {
  it("ranks a richer, public-domain, covered record above a bare one", () => {
    const rich = volume({
      volumeInfo: {
        categories: ["Juvenile Fiction", "Animals", "Family"],
        imageLinks: { thumbnail: "http://x/y.jpg" },
        description: "A story about a rabbit.",
      },
      accessInfo: { publicDomain: true },
    });
    const bare = volume({ volumeInfo: { categories: [] } });
    expect(qualityScore(rich)).toBeGreaterThan(qualityScore(bare));
  });
});
