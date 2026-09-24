-- Sprint D: private, user-owned imports.
--
-- A book created from a parent's EPUB/PDF upload must never appear in the
-- shared child catalog. Rather than overloading the existing book_status
-- enum (a moderation state, not an ownership one), add an explicit owner
-- column:
--   NULL      -> shared catalog book
--   non-NULL  -> private to that parent
-- providers/database.ts excludes owned rows from public search/getBook; the
-- owner reads them through the session-scoped GET /api/imports/:id/book.

ALTER TABLE "books" ADD COLUMN IF NOT EXISTS "owner_user_id" uuid;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'books_owner_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "books"
      ADD CONSTRAINT "books_owner_user_id_users_id_fk"
      FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "books_owner_user_id_idx" ON "books" ("owner_user_id");