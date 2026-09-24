-- Sprint C.A: shelf_items table, books.cover_url, book_cover_cache table
--
-- Written defensively (IF NOT EXISTS / DO-block guards) rather than assuming
-- a clean slate: db/migrations/meta/_journal.json was missing an entry for
-- 0003_email_verification.sql (fixed alongside this migration — see the
-- updated _journal.json), and a stray db/migrations/meta/0003_snapshot.json
-- was found already describing a shelf_items/import_jobs table shape,
-- suggesting scripts/apply-shelf-import-tables.ts may have already been run
-- by hand against this database. This migration is safe to run whether or
-- not that happened.

-- shelf_status enum — created before the table that references it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shelf_status') THEN
    CREATE TYPE "public"."shelf_status" AS ENUM('want-to-read', 'reading', 'finished');
  END IF;
END $$;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "shelf_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid NOT NULL,
  "book_id" varchar(500) NOT NULL,
  "status" "shelf_status" DEFAULT 'want-to-read' NOT NULL,
  "favorite" boolean DEFAULT false NOT NULL,
  "progress_page" integer DEFAULT 0 NOT NULL,
  "added_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_opened_at" timestamp with time zone
);
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'shelf_items_child_id_fk'
  ) THEN
    ALTER TABLE "shelf_items"
      ADD CONSTRAINT "shelf_items_child_id_fk"
      FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "shelf_items_unique" ON "shelf_items" ("child_id", "book_id");
--> statement-breakpoint

-- books.cover_url — for DB-backed books only (uuid-keyed rows in `books`).
-- Closes a real existing gap: server/books/providers/database.ts's
-- loadBook() has always returned coverImage: "" with a TODO pointing here.
ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "cover_url" varchar(1000);
--> statement-breakpoint

-- book_cover_cache — separate from books.cover_url on purpose. `books.id`
-- is a uuid with no relationship to external catalog ids like
-- "openlibrary:OL123W" or "google-books:xyz" (see providers/openlibrary.ts,
-- providers/googlebooks.ts), so there's nothing in `books` to upsert
-- against for those. This small table is keyed directly on the provider's
-- own book id string instead.
CREATE TABLE IF NOT EXISTS "book_cover_cache" (
  "book_id" varchar(500) PRIMARY KEY NOT NULL,
  "cover_url" varchar(1000) NOT NULL,
  "cached_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
