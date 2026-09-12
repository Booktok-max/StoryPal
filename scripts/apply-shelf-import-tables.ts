/**
 * One-off: apply ONLY the shelf_items / import_jobs tables reviewed in
 * db/migrations/0003_sweet_slyde.sql — deliberately skipping the rest of
 * that file's drift-cleanup statements, which touch unrelated existing
 * tables and weren't reviewed as safe to run together.
 *
 * Runs in a single transaction: either everything below succeeds, or
 * nothing is changed.
 *
 * Usage:
 *   npx tsx scripts/apply-shelf-import-tables.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

async function main() {
  const { getSql, closeDb } = await import("../db/client");
  const sql = getSql();

  await sql.begin(async (tx) => {
    await tx`CREATE TYPE "public"."shelf_status" AS ENUM('want-to-read', 'reading', 'finished')`;
    await tx`CREATE TYPE "public"."import_format" AS ENUM('text', 'epub', 'pdf')`;
    await tx`CREATE TYPE "public"."import_status" AS ENUM('queued', 'processing', 'pending-review', 'approved', 'rejected', 'failed')`;

    await tx`
      CREATE TABLE "shelf_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "child_id" uuid NOT NULL,
        "book_id" varchar(500) NOT NULL,
        "status" "shelf_status" DEFAULT 'want-to-read' NOT NULL,
        "favorite" boolean DEFAULT false NOT NULL,
        "progress_page" integer DEFAULT 0 NOT NULL,
        "added_at" timestamp with time zone DEFAULT now() NOT NULL,
        "last_opened_at" timestamp with time zone
      )
    `;

    await tx`
      CREATE TABLE "import_jobs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid,
        "book_id" uuid,
        "filename" varchar(500),
        "format" "import_format" DEFAULT 'text' NOT NULL,
        "status" "import_status" DEFAULT 'queued' NOT NULL,
        "progress" integer DEFAULT 0 NOT NULL,
        "error" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      )
    `;

    await tx`
      ALTER TABLE "shelf_items"
      ADD CONSTRAINT "shelf_items_child_id_child_profiles_id_fk"
      FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade
    `;

    await tx`
      ALTER TABLE "import_jobs"
      ADD CONSTRAINT "import_jobs_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null
    `;

    await tx`
      CREATE UNIQUE INDEX "shelf_items_unique" ON "shelf_items" USING btree ("child_id","book_id")
    `;
  });

  console.log("shelf_items and import_jobs created successfully.");
  await closeDb();
}

main().catch((err) => {
  console.error("Failed — transaction rolled back, nothing was changed:", err);
  process.exit(1);
});