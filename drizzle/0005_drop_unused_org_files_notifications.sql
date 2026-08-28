-- Drop unused org/files/notification tables that 0000 created and no app code uses.
-- Better Auth identity is users/sessions/accounts/verifications (not organizations/files).
-- Child tables first so organizations can drop without dropping dependents.

DROP TABLE "memberships";--> statement-breakpoint
DROP TABLE "files";--> statement-breakpoint
DROP TABLE "notifications";--> statement-breakpoint
DROP TABLE "notification_preferences";--> statement-breakpoint
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_org_id_organizations_id_fk";
--> statement-breakpoint
DROP INDEX "idx_audit_logs_org_id";--> statement-breakpoint
ALTER TABLE "audit_logs" DROP COLUMN "org_id";--> statement-breakpoint
DROP TABLE "organizations";--> statement-breakpoint
DROP TYPE "public"."membership_role";--> statement-breakpoint
DROP TYPE "public"."notification_channel";
