import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("objectStorage.isStorageConfigured / getPublicUrl", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.STORAGE_ENDPOINT;
    delete process.env.STORAGE_ACCESS_KEY_ID;
    delete process.env.STORAGE_SECRET_ACCESS_KEY;
    delete process.env.STORAGE_PUBLIC_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("reports unconfigured when any required var is missing", async () => {
    const { isStorageConfigured } = await import("../server/storage/objectStorage");
    expect(isStorageConfigured()).toBe(false);

    process.env.STORAGE_ENDPOINT = "https://example.r2.cloudflarestorage.com";
    process.env.STORAGE_ACCESS_KEY_ID = "key";
    // secret still missing
    expect(isStorageConfigured()).toBe(false);
  });

  it("reports configured once all three are set", async () => {
    process.env.STORAGE_ENDPOINT = "https://example.r2.cloudflarestorage.com";
    process.env.STORAGE_ACCESS_KEY_ID = "key";
    process.env.STORAGE_SECRET_ACCESS_KEY = "secret";
    const { isStorageConfigured } = await import("../server/storage/objectStorage");
    expect(isStorageConfigured()).toBe(true);
  });

  it("builds a public URL by joining STORAGE_PUBLIC_URL and the key, trimming a trailing slash", async () => {
    process.env.STORAGE_PUBLIC_URL = "https://cdn.storypals.app/";
    const { getPublicUrl } = await import("../server/storage/objectStorage");
    expect(getPublicUrl("illustrations/abc/1-2K-deadbeef.png")).toBe(
      "https://cdn.storypals.app/illustrations/abc/1-2K-deadbeef.png"
    );
  });

  it("throws a clear error if STORAGE_PUBLIC_URL is unset", async () => {
    const { getPublicUrl } = await import("../server/storage/objectStorage");
    expect(() => getPublicUrl("some/key.png")).toThrow(/STORAGE_PUBLIC_URL/);
  });
});

describe("objectStorage.uploadBase64Image validation", () => {
  beforeEach(() => {
    process.env.STORAGE_ENDPOINT = "https://example.r2.cloudflarestorage.com";
    process.env.STORAGE_ACCESS_KEY_ID = "key";
    process.env.STORAGE_SECRET_ACCESS_KEY = "secret";
    process.env.STORAGE_BUCKET = "storypals-assets";
  });

  it("rejects a non-data-URL string before attempting any network call", async () => {
    const { uploadBase64Image } = await import("../server/storage/objectStorage");
    await expect(uploadBase64Image("key.png", "https://example.com/not-a-data-url.png")).rejects.toThrow(
      /data:.*base64/
    );
  });

  it("rejects a data URL with a non-image MIME type", async () => {
    const { uploadBase64Image } = await import("../server/storage/objectStorage");
    await expect(uploadBase64Image("key.png", "data:text/plain;base64,aGVsbG8=")).rejects.toThrow(
      /image MIME type/
    );
  });
});
