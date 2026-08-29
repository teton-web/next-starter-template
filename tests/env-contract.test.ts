import { describe, expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { verifyEnvContract } from "../scripts/verify-env-contract.mjs"

const root = join(import.meta.dir, "..")

describe("env contract", () => {
  test("fails when DATABASE_URL or AUTH_SECRET is missing", () => {
    const missingUrl = verifyEnvContract({ AUTH_SECRET: "x".repeat(32) })
    expect(missingUrl.missing).toContain("DATABASE_URL")

    const missingSecret = verifyEnvContract({ DATABASE_URL: "postgresql://ci:ci@localhost:5432/ci" })
    expect(missingSecret.missing).toContain("AUTH_SECRET")
  })

  test("passes with stub required keys", () => {
    const result = verifyEnvContract({
      DATABASE_URL: "postgresql://ci:ci@localhost:5432/ci",
      AUTH_SECRET: "ci-placeholder-secret-minimum-32-characters",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      NEXT_PUBLIC_SITE_NAME: "CI",
      RESEND_API_KEY: "re_test",
      EMAIL_FROM: "noreply@example.com",
    })
    expect(result.missing).toEqual([])
    expect(result.missingRecommended).toEqual([])
  })

  test("script exits non-zero without required env", () => {
    const env = { ...process.env }
    delete env.DATABASE_URL
    delete env.AUTH_SECRET
    delete env.NEON_DATABASE_URL
    const spawned = spawnSync("bun", ["scripts/verify-env-contract.mjs"], {
      cwd: root,
      env,
      encoding: "utf8",
    })
    expect(spawned.status).not.toBe(0)
    expect(spawned.stderr).toContain("DATABASE_URL")
  })

  test("script exits zero with stub required env", () => {
    const spawned = spawnSync("bun", ["scripts/verify-env-contract.mjs"], {
      cwd: root,
      env: {
        ...process.env,
        DATABASE_URL: "postgresql://ci:ci@localhost:5432/ci",
        AUTH_SECRET: "ci-placeholder-secret-minimum-32-characters",
      },
      encoding: "utf8",
    })
    expect(spawned.status).toBe(0)
    expect(spawned.stdout).toContain("Required application environment variables are present")
  })

  test("FEATURE_ kill switches are documented as comments and are not required", () => {
    const example = readFileSync(join(root, ".env.example"), "utf8")
    expect(example).toContain("# FEATURE_WAITLIST=0")
    expect(example).toContain("# FEATURE_STRIPE=0")
    expect(example).toContain("# FEATURE_OAUTH=0")
    expect(example).toContain("# GOOGLE_CLIENT_ID=")
    expect(example).toContain("# GOOGLE_CLIENT_SECRET=")
    expect(example).toContain("# STRIPE_SECRET_KEY=")
    expect(example).toContain("# STRIPE_WEBHOOK_SECRET=")
    expect(example).toContain("# STRIPE_CURRENCY=")
    expect(example).not.toContain("# STRIPE_CURRENCY=usd")
    expect(example).toContain("# FEATURE_GALLERIES=0")
    expect(example).toContain("# FEATURE_AUTH=0")
    expect(example).toContain("# FEATURE_CMS=0")
    expect(example).toContain("FEATURE_<KEY>")
    const uncommented = example.split("\n").filter((line) => /^FEATURE_/.test(line.trim()))
    expect(uncommented).toEqual([])
    expect(example).toContain("# SITE_GATE_SIGNING_SECRET=")
    expect(example).toContain("# SITE_GATE_PASSWORD=")
    expect(example.split("\n").some((line) => /^SITE_GATE_PASSWORD=/.test(line))).toBe(false)
    const contract = verifyEnvContract({
      DATABASE_URL: "postgresql://ci:ci@localhost:5432/ci",
      AUTH_SECRET: "ci-placeholder-secret-minimum-32-characters",
    })
    expect(contract.missing).not.toContain("FEATURE_WAITLIST")
    expect(contract.missingRecommended).not.toContain("FEATURE_WAITLIST")
  })
})
