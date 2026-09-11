ALTER TABLE "reading_progress" DROP CONSTRAINT "reading_progress_book_id_books_id_fk";
--> statement-breakpoint
ALTER TABLE "reading_sessions" DROP CONSTRAINT "reading_sessions_book_id_books_id_fk";
--> statement-breakpoint
ALTER TABLE "words_explored" DROP CONSTRAINT "words_explored_book_id_books_id_fk";
--> statement-breakpoint
ALTER TABLE "child_settings" ALTER COLUMN "show_syllables" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "child_settings" ALTER COLUMN "autoplay_narration" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "child_settings" ALTER COLUMN "sound_enabled" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "reading_progress" ALTER COLUMN "book_id" SET DATA TYPE varchar(500);--> statement-breakpoint
ALTER TABLE "reading_sessions" ALTER COLUMN "book_id" SET DATA TYPE varchar(500);--> statement-breakpoint
ALTER TABLE "words_explored" ALTER COLUMN "book_id" SET DATA TYPE varchar(500);