import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import crypto from "node:crypto";

/**
 * Object storage abstraction (Sprint C.B). Targets any S3-compatible
 * endpoint — Cloudflare R2 and Railway's object storage both speak the S3
 * API, so this doesn't need a provider-specific branch. If you switch
 * providers later, only the env vars change, not this file.
 */

export type UploadResult = {
  storageKey: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
};

let client: S3Client | null = null;

function getClient(): S3Client {
  if (client) return client;
  const endpoint = process.env.STORAGE_ENDPOINT;
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Object storage not configured — set STORAGE_ENDPOINT, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY."
    );
  }
  client = new S3Client({
    endpoint,
    region: process.env.STORAGE_REGION || "auto", // R2 uses "auto"; Railway/other S3-compatible may want a real region
    credentials: { accessKeyId, secretAccessKey },
    // R2 (and some S3-compatible providers) need path-style addressing
    // rather than the AWS-default virtual-hosted-style bucket subdomain.
    forcePathStyle: true,
  });
  return client;
}

export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.STORAGE_ENDPOINT && process.env.STORAGE_ACCESS_KEY_ID && process.env.STORAGE_SECRET_ACCESS_KEY
  );
}

/** Builds the public URL for a stored object, given STORAGE_PUBLIC_URL
 * (a CDN domain or R2 public bucket URL) as the base. */
export function getPublicUrl(storageKey: string): string {
  const base = process.env.STORAGE_PUBLIC_URL;
  if (!base) {
    throw new Error("STORAGE_PUBLIC_URL not set — cannot build a public URL for stored objects.");
  }
  return `${base.replace(/\/$/, "")}/${storageKey}`;
}

const DATA_URL_RE = /^data:([\w/+.-]+);base64,(.+)$/s;

/**
 * Decodes a `data:image/...;base64,...` URL (the shape Gemini image
 * generation returns — see /api/generate-illustration) and uploads it.
 * Rejects anything that isn't actually a base64 data URL, since this is a
 * public-facing input path.
 */
export async function uploadBase64Image(key: string, dataUrl: string): Promise<UploadResult> {
  const match = DATA_URL_RE.exec(dataUrl);
  if (!match) {
    throw new Error("Expected a data:<mime>;base64,<data> URL.");
  }
  const [, mimeType, base64Data] = match;
  if (!mimeType.startsWith("image/")) {
    throw new Error(`Expected an image MIME type, got "${mimeType}".`);
  }

  const buffer = Buffer.from(base64Data, "base64");
  const bucket = requireBucket();

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      // Content-addressed cache-busting isn't needed — keys already embed a
      // random suffix (see illustrations/repository.ts) — so this is safe
      // to cache aggressively at the CDN layer.
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return {
    storageKey: key,
    url: getPublicUrl(key),
    mimeType,
    sizeBytes: buffer.byteLength,
  };
}

export async function deleteObject(key: string): Promise<void> {
  const bucket = requireBucket();
  await getClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

function requireBucket(): string {
  const bucket = process.env.STORAGE_BUCKET;
  if (!bucket) throw new Error("STORAGE_BUCKET not set.");
  return bucket;
}

/** Random, collision-resistant key suffix — avoids overwriting a
 * concurrently-uploaded illustration for the same page. */
export function randomKeySuffix(): string {
  return crypto.randomBytes(8).toString("hex");
}
