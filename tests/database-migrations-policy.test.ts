import { describe, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dir, "..")

function read(path: string) {
  return readFileSync(join(root, path), "utf8")
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

  test("migration policy doc exists", () => {
    expect(existsSync(join(root, "docs/DATABASE_MIGRATIONS.md"))).toBe(true)
    expect(read("docs/DATABASE_MIGRATIONS.md")).toMatch(/never use.*push|Do not use.*push/i)
  })
})
