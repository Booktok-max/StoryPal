-- Sprint C (Option A): durable cover URLs and child shelves.

ALTER TABLE "books" ADD COLUMN "cover_url" varchar(2000);
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."shelf_status" AS ENUM('want-to-read', 'reading', 'finished');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE TABLE "shelf_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "child_id" uuid NOT NULL,
  "book_id" varchar(500) NOT NULL,
  "status" "shelf_status" DEFAULT 'want-to-read' NOT NULL,
  "favorite" boolean DEFAULT false NOT NULL,
  "progress_page" integer DEFAULT 0 NOT NULL,
  "added_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_opened_at" timestamp with time zone,
  CONSTRAINT "shelf_items_child_id_child_profiles_id_fk"
    FOREIGN KEY ("child_id") REFERENCES "public"."child_profiles"("id") ON DELETE cascade
);
--> statement-breakpoint

CREATE UNIQUE INDEX "shelf_items_unique" ON "shelf_items" USING btree ("child_id","book_id");
