import { describe, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dir, "..")

function read(path: string) {
  return readFileSync(join(root, path), "utf8")
}

/** Drizzle SQL statements, comments stripped, no trailing semicolon. */
function sqlStatements(sql: string): string[] {
  return sql
    .split("--> statement-breakpoint")
    .map((chunk) =>
      chunk
        .split("\n")
        .map((line) => {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith("--")) return ""
          const commentAt = trimmed.indexOf("--")
          return (commentAt === -1 ? trimmed : trimmed.slice(0, commentAt)).trim()
        })
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .replace(/;+\s*$/, "")
        .trim(),
    )
    .filter(Boolean)
}

function statementIndex(statements: string[], exact: string): number {
  const index = statements.indexOf(exact)
  expect(index).toBeGreaterThan(-1)
  return index
}

describe("database migrations policy", () => {
  test("db:push scripts are disabled (migrations only)", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> }
    expect(pkg.scripts["db:push"]).toMatch(/disabled|process\.exit\(1\)/)
    expect(pkg.scripts["db:push:force"]).toMatch(/disabled|process\.exit\(1\)/)
    expect(pkg.scripts["db:migrate"]).toContain("drizzle-kit migrate")
    expect(pkg.scripts["db:generate"]).toContain("drizzle-kit generate")
  })

  test("db:push script exits non-zero", () => {
    const spawned = spawnSync("bun", ["run", "db:push"], { cwd: root, encoding: "utf8" })
    expect(spawned.status).not.toBe(0)
    expect(`${spawned.stdout}\n${spawned.stderr}`).toMatch(/disabled/i)
  })

  test("core auth migration is committed", () => {
    expect(existsSync(join(root, "drizzle/0000_core_identity.sql"))).toBe(true)
    const sql = read("drizzle/0000_core_identity.sql")
    expect(sql).toContain('CREATE TABLE "users"')
    expect(sql).toContain("email_verified")
    expect(sql).toContain("deleted_at")
    expect(sql).toContain('CREATE TABLE "sessions"')
    expect(sql).toContain('CREATE TABLE "accounts"')
    expect(sql).toContain('CREATE TABLE "verification_tokens"')
    expect(read("drizzle/meta/_journal.json")).toContain("0000_core_identity")
  })

  test("mustChangePassword migration is committed", () => {
    expect(existsSync(join(root, "drizzle/0003_must_change_password.sql"))).toBe(true)
    expect(read("drizzle/0003_must_change_password.sql")).toContain(
      'ALTER TABLE "users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL',
    )
    expect(read("drizzle/meta/_journal.json")).toContain("0003_must_change_password")
  })

  test("better auth migration is committed with password backfill", () => {
    expect(existsSync(join(root, "drizzle/0002_better_auth.sql"))).toBe(true)
    const sql = read("drizzle/0002_better_auth.sql")
    expect(sql).toContain('CREATE TABLE "verifications"')
    expect(sql).toContain("local:credential")
    expect(sql).toContain('SET "password" = "u"."password"')
    expect(sql).toContain('ALTER TABLE "users" DROP COLUMN "password"')
    expect(sql).toContain('WHERE "email_verified" IS NOT NULL OR "password" IS NOT NULL')
    expect(read("drizzle/meta/_journal.json")).toContain("0002_better_auth")
  })

  test("credential emailVerified backfill is committed", () => {
    expect(existsSync(join(root, "drizzle/0004_email_verified_credential_backfill.sql"))).toBe(true)
    const sql = read("drizzle/0004_email_verified_credential_backfill.sql")
    expect(sql).toContain('SET "email_verified" = true')
    expect(sql).toContain('provider_id" = \'credential\'')
    expect(read("drizzle/meta/_journal.json")).toContain("0004_email_verified_credential_backfill")
  })

  test("unused org/files/notification tables are dropped in a new migration, not by rewriting 0000", () => {
    const core = read("drizzle/0000_core_identity.sql")
    expect(core).toContain('CREATE TYPE "membership_role"')
    expect(core).toContain('CREATE TYPE "notification_channel"')
    expect(core).toContain('CREATE TABLE "organizations"')
    expect(core).toContain('CREATE TABLE "memberships"')
    expect(core).toContain('CREATE TABLE "files"')
    expect(core).toContain('CREATE TABLE "notifications"')
    expect(core).toContain('CREATE TABLE "notification_preferences"')
    const coreStatements = sqlStatements(core)
    const createAuditLogs = coreStatements.find((statement) =>
      statement.startsWith('CREATE TABLE "audit_logs"'),
    )
    expect(createAuditLogs).toBeDefined()
    expect(createAuditLogs).toContain('"org_id"')

    expect(existsSync(join(root, "drizzle/0005_drop_unused_org_files_notifications.sql"))).toBe(true)
    const dropSql = read("drizzle/0005_drop_unused_org_files_notifications.sql")
    const statements = sqlStatements(dropSql)
    expect(statements.every((statement) => !/\bCASCADE\b/i.test(statement))).toBe(true)

    const dropTable = (name: string) => statementIndex(statements, `DROP TABLE "${name}"`)
    const membershipsAt = dropTable("memberships")
    const filesAt = dropTable("files")
    const notificationsAt = dropTable("notifications")
    const prefsAt = dropTable("notification_preferences")
    const dropOrgFkAt = statementIndex(
      statements,
      'ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_org_id_organizations_id_fk"',
    )
    const dropOrgIndexAt = statementIndex(statements, 'DROP INDEX "idx_audit_logs_org_id"')
    const dropOrgColumnAt = statementIndex(statements, 'ALTER TABLE "audit_logs" DROP COLUMN "org_id"')
    const orgsAt = dropTable("organizations")
    const dropMembershipRoleAt = statementIndex(statements, 'DROP TYPE "public"."membership_role"')
    const dropNotificationChannelAt = statementIndex(statements, 'DROP TYPE "public"."notification_channel"')

    expect(Math.max(membershipsAt, filesAt, notificationsAt, prefsAt)).toBeLessThan(orgsAt)
    expect(Math.max(dropOrgFkAt, dropOrgIndexAt, dropOrgColumnAt)).toBeLessThan(orgsAt)
    expect(membershipsAt).toBeLessThan(dropMembershipRoleAt)
    expect(Math.max(notificationsAt, prefsAt)).toBeLessThan(dropNotificationChannelAt)

    const keptTables = [
      "users",
      "sessions",
      "accounts",
      "verifications",
      "locales",
      "cms_entries",
      "cms_revisions",
      "media_assets",
      "media_usages",
      "contact_inquiries",
      "audit_logs",
      "rate_limit_buckets",
    ]
    for (const name of keptTables) {
      expect(statements).not.toContain(`DROP TABLE "${name}"`)
    }

    expect(read("drizzle/meta/_journal.json")).toContain("0005_drop_unused_org_files_notifications")

    const schemaDir = join(root, "lib/db/schema")
    const schemaFiles = readdirSync(schemaDir)
    expect(schemaFiles).not.toContain("organizations.ts")
    expect(schemaFiles).not.toContain("memberships.ts")
    expect(schemaFiles).not.toContain("files.ts")
    expect(schemaFiles).not.toContain("notifications.ts")
    expect(schemaFiles).not.toContain("notification-preferences.ts")

    const enums = read("lib/db/schema/enums.ts")
    expect(enums).not.toContain("membership_role")
    expect(enums).not.toContain("notification_channel")

    const users = read("lib/db/schema/users.ts")
    expect(users).not.toContain('from "./organizations"')
    expect(users).not.toContain('from "./memberships"')
    expect(users).not.toContain('from "./files"')
    expect(users).not.toContain('from "./notifications"')
    expect(users).not.toContain('from "./notification-preferences"')
    expect(users).not.toContain("many(memberships)")
    expect(users).not.toContain("many(files)")
    expect(users).not.toContain("many(notifications)")
    expect(users).not.toContain("many(notificationPreferences)")

    const index = read("lib/db/schema/index.ts")
    expect(index).not.toContain('from "./organizations"')
    expect(index).not.toContain('from "./memberships"')
    expect(index).not.toContain('from "./files"')
    expect(index).not.toContain('from "./notifications"')
    expect(index).not.toContain('from "./notification-preferences"')

    const auditLogs = read("lib/db/schema/audit-logs.ts")
    expect(auditLogs).not.toContain("orgId")
    expect(auditLogs).not.toContain("org_id")
    expect(auditLogs).not.toContain("organizations")
  })

  test("feature_flags migration is committed without org_id", () => {
    expect(existsSync(join(root, "drizzle/0006_feature_flags.sql"))).toBe(true)
    const sql = read("drizzle/0006_feature_flags.sql")
    expect(sql).toContain('CREATE TABLE "feature_flags"')
    expect(sql).toContain('"key" text PRIMARY KEY NOT NULL')
    expect(sql).toContain('"enabled" boolean NOT NULL')
    expect(sql).toContain('"config" jsonb')
    expect(sql).toContain('"updated_at" timestamp')
    expect(sql).toContain('"updated_by_user_id" text')
    expect(sql).not.toContain("org_id")
    expect(sql).not.toContain("organizations")
    expect(read("drizzle/meta/_journal.json")).toContain("0006_feature_flags")
    const index = read("lib/db/schema/index.ts")
    expect(index).toContain('from "./feature-flags"')
  })

  test("waitlist_entries migration is committed with unique email", () => {
    expect(existsSync(join(root, "drizzle/0007_waitlist_entries.sql"))).toBe(true)
    const sql = read("drizzle/0007_waitlist_entries.sql")
    expect(sql).toContain('CREATE TABLE "waitlist_entries"')
    expect(sql).toContain('"email" text NOT NULL')
    expect(sql).toContain('"name" text')
    expect(sql).toContain('"source" text')
    expect(sql).toContain('"created_at" timestamp')
    expect(sql).toMatch(/waitlist_entries_email_unique|UNIQUE \("email"\)/)
    expect(sql).not.toContain("org_id")
    expect(read("drizzle/meta/_journal.json")).toContain("0007_waitlist_entries")
    const index = read("lib/db/schema/index.ts")
    expect(index).toContain('from "./waitlist-entries"')
  })

  test("migration policy doc exists", () => {
    expect(existsSync(join(root, "docs/DATABASE_MIGRATIONS.md"))).toBe(true)
    expect(read("docs/DATABASE_MIGRATIONS.md")).toMatch(/never use.*push|Do not use.*push/i)
  })
})
