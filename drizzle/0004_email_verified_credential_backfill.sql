-- Idempotent: credential users migrated from Auth.js timestamps stayed unverified.
UPDATE "users" AS "u"
SET "email_verified" = true
WHERE "u"."email_verified" = false
	AND EXISTS (
		SELECT 1 FROM "accounts" AS "a"
		WHERE "a"."user_id" = "u"."id"
			AND "a"."provider_id" = 'credential'
			AND "a"."password" IS NOT NULL
	);
