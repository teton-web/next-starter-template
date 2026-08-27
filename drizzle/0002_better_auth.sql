-- Align identity tables with Better Auth (database sessions, credential accounts).
-- Data backfill: email_verified timestamp → boolean; users.password → accounts.password.

ALTER TABLE "users" ADD COLUMN "email_verified_bool" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "users" SET "email_verified_bool" = true WHERE "email_verified" IS NOT NULL OR "password" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "email_verified";--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "email_verified_bool" TO "email_verified";--> statement-breakpoint

DROP INDEX IF EXISTS "idx_sessions_session_token";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_sessions_expires";--> statement-breakpoint
DROP INDEX IF EXISTS "sessions_session_token_unique";--> statement-breakpoint
ALTER TABLE "sessions" RENAME COLUMN "session_token" TO "token";--> statement-breakpoint
ALTER TABLE "sessions" RENAME COLUMN "expires" TO "expires_at";--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_token_unique" UNIQUE ("token");--> statement-breakpoint
CREATE INDEX "idx_sessions_token" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires" ON "sessions" USING btree ("expires_at");--> statement-breakpoint

ALTER TABLE "accounts" ADD COLUMN "issuer" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "account_id" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "provider_id" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "access_token_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "refresh_token_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "password" text;--> statement-breakpoint

UPDATE "accounts" SET
	"provider_id" = CASE WHEN "provider" IN ('credentials', 'credential') THEN 'credential' ELSE "provider" END,
	"account_id" = "provider_account_id",
	"issuer" = CASE
		WHEN "provider" IN ('credentials', 'credential') THEN 'local:credential'
		ELSE concat('local:oauth:', replace("provider", ' ', '%20'))
	END,
	"access_token_expires_at" = CASE
		WHEN "expires_at" IS NULL THEN NULL
		ELSE to_timestamp("expires_at")
	END;--> statement-breakpoint

UPDATE "accounts" AS "a"
SET "password" = "u"."password"
FROM "users" AS "u"
WHERE "a"."user_id" = "u"."id"
	AND "a"."password" IS NULL
	AND "u"."password" IS NOT NULL
	AND COALESCE("a"."provider_id", "a"."provider") IN ('credential', 'credentials');--> statement-breakpoint

INSERT INTO "accounts" (
	"id",
	"user_id",
	"issuer",
	"account_id",
	"provider_id",
	"password",
	"created_at",
	"updated_at"
)
SELECT
	concat('cred_', "id"),
	"id",
	'local:credential',
	"id",
	'credential',
	"password",
	COALESCE("created_at", now()),
	now()
FROM "users"
WHERE "password" IS NOT NULL
	AND NOT EXISTS (
		SELECT 1 FROM "accounts" AS "a"
		WHERE "a"."user_id" = "users"."id"
			AND COALESCE("a"."provider_id", "a"."provider") IN ('credential', 'credentials')
	);--> statement-breakpoint

UPDATE "accounts" SET
	"issuer" = COALESCE("issuer", 'local:credential'),
	"account_id" = COALESCE("account_id", "user_id"),
	"provider_id" = COALESCE("provider_id", 'credential')
WHERE "issuer" IS NULL OR "account_id" IS NULL OR "provider_id" IS NULL;--> statement-breakpoint

ALTER TABLE "accounts" ALTER COLUMN "issuer" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "account_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "provider_id" SET NOT NULL;--> statement-breakpoint

DROP INDEX IF EXISTS "idx_accounts_provider_account";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "type";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "provider";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "provider_account_id";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "expires_at";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "token_type";--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "session_state";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_accounts_issuer_account" ON "accounts" USING btree ("issuer", "account_id");--> statement-breakpoint

ALTER TABLE "users" DROP COLUMN "password";--> statement-breakpoint
DROP INDEX IF EXISTS "users_email_unique";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE ("email");--> statement-breakpoint

DROP TABLE IF EXISTS "verification_tokens";--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "idx_verifications_identifier" ON "verifications" USING btree ("identifier");
