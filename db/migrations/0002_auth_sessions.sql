-- Sprint B: Authentication & Identity
-- Adds: user_passwords, sessions, rate_limit_attempts, password_reset_tokens

CREATE TABLE "user_passwords" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_passwords_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
--> statement-breakpoint

CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" varchar(128) NOT NULL UNIQUE,
	"user_id" uuid NOT NULL,
	"active_child_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
--> statement-breakpoint

CREATE TABLE "rate_limit_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" varchar(320) NOT NULL,
	"action" varchar(50) NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(128) NOT NULL UNIQUE,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
--> statement-breakpoint

-- Indexes for common lookups
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");
CREATE INDEX "rate_limit_attempts_identifier_action_idx" ON "rate_limit_attempts"("identifier", "action", "attempted_at");
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- Cookie parser is required: npm install cookie-parser @types/cookie-parser
