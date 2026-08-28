process.env.DATABASE_URL ??= "postgresql://ci:ci@localhost:5432/ci"
process.env.AUTH_SECRET ??= "ci-placeholder-secret-minimum-32-characters"

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { dbExecute, mockedDb, resetSharedDbExecute } from "./helpers/mock-db"
import { readFileSync } from "node:fs"
import { join } from "node:path"

mock.module("@/lib/db", () => ({
  db: mockedDb,
}))

const root = join(import.meta.dir, "..")

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8")
}

const { GET } = await import("@/app/api/health/route")

describe("GET /api/health", () => {
  beforeEach(() => {
    dbExecute.mockReset()
    dbExecute.mockImplementation(async () => ({ rows: [{ "?column?": 1 }] }))
  })

  afterEach(() => {
    resetSharedDbExecute()
  })

  test("proxy site-gate exempts /api/health like static assets", () => {
    const proxy = read("proxy.ts")
    const exempt = proxy.match(/function isSiteGateExempt\(pathname: string\) \{[\s\S]*?\n\}/)
    expect(exempt?.[0]).toContain("isStaticAsset(pathname)")
    expect(exempt?.[0]).toContain('pathname === "/api/health"')
    expect(exempt?.[0]).toContain("SITE_GATE_PUBLIC_STATE_PATH")
    expect(exempt?.[0]).toContain("isCronApiPath(pathname)")
    expect(proxy).toContain("enforceGate && !isSiteGateExempt(pathname)")
    expect(proxy).toContain("resolveSiteGateEnforce")
    expect(proxy).not.toContain("isSiteGateEnabled() && password && !isStaticAsset(pathname)")
    expect(proxy).not.toContain("siteGatePassword(")
    expect(proxy).toContain("function isHtmlNavigation")
    expect(proxy).toContain("pathname.startsWith(\"/api/\") && !isHtmlNavigation(request)")
  })

  test("health route pings the database and never includes secret values", () => {
    const health = read("app/api/health/route.ts")
    expect(health).toContain('from "@/lib/db"')
    expect(health).toContain("await db.execute(sql`select 1`)")
    expect(health).toContain("return jsonOk({ ok: true })")
    expect(health).toContain("return jsonOk({ ok: false }, 503)")
    expect(health).toContain("} catch {")
    expect(health).toContain("export async function GET")
    expect(health).not.toContain("export async function POST")
    expect(health).not.toContain("export async function PUT")
    expect(health).not.toContain("export async function PATCH")
    expect(health).not.toContain("export async function DELETE")
    expect(health).not.toContain("console.")
    expect(health).not.toContain("requireUserId")
    expect(health).not.toContain("getSession")
    expect(health).not.toContain("DATABASE_URL")
    expect(health).not.toContain("AUTH_SECRET")
    expect(health).not.toContain("connectionString")
    expect(health).not.toContain("process.env")
    expect(health).not.toContain("Sentry")
    expect(health).not.toContain("OTEL")
    expect(health).not.toContain("opentelemetry")
  })

  test("GET returns 200 { ok: true } when the ping works", async () => {
    const response = await GET()
    expect(dbExecute).toHaveBeenCalled()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ ok: true })
    expect(JSON.stringify(body)).not.toContain("DATABASE_URL")
    expect(JSON.stringify(body)).not.toContain("AUTH_SECRET")
  })

  test("GET returns 503 { ok: false } without leaking errors", async () => {
    dbExecute.mockImplementationOnce(async () => {
      throw new Error("postgresql://ci:secret@localhost:5432/ci DATABASE_URL AUTH_SECRET")
    })
    const response = await GET()
    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body).toEqual({ ok: false })
    const raw = JSON.stringify(body)
    expect(raw).not.toContain("DATABASE_URL")
    expect(raw).not.toContain("AUTH_SECRET")
    expect(raw).not.toContain("postgresql://")
    expect(raw).not.toContain("secret")
  })
})
