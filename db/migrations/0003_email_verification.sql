-- Sprint B.1: Sign-Up Email Verification
-- Adds: users.email_verified_at, email_verification_tokens
--
-- Made idempotent after a production run showed users.email_verified_at
-- already existed (added by some earlier, unrecorded process) — that
-- collision failed this migration's ALTER TABLE statement and rolled back
-- the whole transaction, including the CREATE TABLE below, before it ever
-- registered as applied. Safe to rerun now regardless of which pieces
-- already exist.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp with time zone;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(128) NOT NULL UNIQUE,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_verification_tokens_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
--> statement-breakpoint