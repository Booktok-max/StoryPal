import { eq, desc } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import { importJobs } from "../../db/schema/imports.js";

export type ImportJobFormat = "text" | "epub" | "pdf";
export type ImportJobStatus = "queued" | "processing" | "pending-review" | "approved" | "rejected" | "failed";

export type ImportJob = {
  id: string;
  userId: string | null;
  bookId: string | null;
  filename: string | null;
  format: ImportJobFormat;
  status: ImportJobStatus;
  progress: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

function toImportJob(row: typeof importJobs.$inferSelect): ImportJob {
  return {
    id: row.id,
    userId: row.userId,
    bookId: row.bookId,
    filename: row.filename,
    format: row.format,
    status: row.status,
    progress: row.progress,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createImportJob(input: {
  userId: string;
  filename: string;
  format: ImportJobFormat;
}): Promise<ImportJob> {
  const db = getDb();
  const [inserted] = await db
    .insert(importJobs)
    .values({ userId: input.userId, filename: input.filename, format: input.format, status: "queued" })
    .returning();
  return toImportJob(inserted);
}

export async function listImportJobs(userId: string): Promise<ImportJob[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(importJobs)
    .where(eq(importJobs.userId, userId))
    .orderBy(desc(importJobs.createdAt));
  return rows.map(toImportJob);
}

export async function getImportJob(userId: string, id: string): Promise<ImportJob | null> {
  const db = getDb();
  const [row] = await db.select().from(importJobs).where(eq(importJobs.id, id)).limit(1);
  if (!row || row.userId !== userId) return null;
  return toImportJob(row);
}

export async function updateImportJobStatus(
  id: string,
  patch: { status?: ImportJobStatus; progress?: number; error?: string | null; bookId?: string | null }
): Promise<ImportJob | null> {
  const db = getDb();
  const [updated] = await db.update(importJobs).set(patch).where(eq(importJobs.id, id)).returning();
  return updated ? toImportJob(updated) : null;
}
