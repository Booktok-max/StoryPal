-- Sprint D prep: import_jobs table.
--
-- db/schema/imports.ts has defined this table since Sprint C planning, but
-- it was never added through a tracked Drizzle migration -- it only ever
-- existed as a one-off script (scripts/apply-shelf-import-tables.ts) that
-- nothing in package.json, CI, or the README calls. Written defensively
-- (IF NOT EXISTS / DO-block guards) in case that script was in fact run by
-- hand against some environment already.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'import_format') THEN
    CREATE TYPE "public"."import_format" AS ENUM('text', 'epub', 'pdf');
  END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'import_status') THEN
    CREATE TYPE "public"."import_status" AS ENUM('queued', 'processing', 'pending-review', 'approved', 'rejected', 'failed');
  END IF;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "import_jobs" (
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
);
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'import_jobs_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "import_jobs"
      ADD CONSTRAINT "import_jobs_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "import_jobs_user_id_idx" ON "import_jobs" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "import_jobs_status_idx" ON "import_jobs" ("status");
