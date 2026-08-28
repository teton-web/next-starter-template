process.env.DATABASE_URL ??= "postgresql://ci:ci@localhost:5432/ci"
process.env.AUTH_SECRET ??= "ci-placeholder-secret-minimum-32-characters"

import { mockedDb } from "./helpers/mock-db"
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import {
  SITE_GATE_COOKIE,
  SITE_GATE_PASSWORD_MAX_LENGTH,
  verifySiteGateCookie,
} from "@/lib/site-gate"
import { hashSiteGatePassword } from "@/lib/flags/site-gate-password"
import { resetFeatureFlagCache } from "@/lib/flags/cache"

type FlagRow = { enabled: boolean; config: Record<string, unknown> }

const dbSelectLimit = mock(async (): Promise<FlagRow[]> => [])
const dbSelectImpl = mock(() => ({
  from: () => ({
    where: () => ({
      limit: (_n?: unknown) => Promise.resolve(dbSelectLimit()),
    }),
  }),
}))

function installFlagSelect(rows: FlagRow[] = []) {
  dbSelectLimit.mockReset()
  dbSelectLimit.mockImplementation(async () => rows)
  dbSelectImpl.mockReset()
  dbSelectImpl.mockImplementation(() => ({
    from: () => ({
      where: () => ({
        limit: (_n?: unknown) => Promise.resolve(dbSelectLimit()),
      }),
    }),
  }))
  Object.assign(mockedDb, { select: dbSelectImpl })
}

installFlagSelect()

const { POST } = await import("@/app/api/site-gate/route")
const { GET: GET_PUBLIC_STATE } = await import("@/app/api/site-gate/public-state/route")

const originalLeftover = process.env.SITE_GATE_PASSWORD
const originalVercel = process.env.VERCEL_ENV

function formRequest(
  body: Record<string, string>,
  headers: Record<string, string> = {},
) {
  const form = new FormData()
  for (const [key, value] of Object.entries(body)) {
    form.set(key, value)
  }
  return new Request("http://localhost/api/site-gate", {
    method: "POST",
    headers,
    body: form,
  })
}

describe("POST /api/site-gate", () => {
  beforeEach(() => {
    resetFeatureFlagCache()
    installFlagSelect([])
    delete process.env.SITE_GATE_PASSWORD
    delete process.env.VERCEL_ENV
  })

  afterEach(() => {
    resetFeatureFlagCache()
    delete (mockedDb as { select?: unknown }).select
    if (originalLeftover === undefined) delete process.env.SITE_GATE_PASSWORD
    else process.env.SITE_GATE_PASSWORD = originalLeftover
    if (originalVercel === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = originalVercel
  })

  test("wrong password returns 401 JSON", async () => {
    const hash = await hashSiteGatePassword("correct-gate")
    installFlagSelect([{ enabled: true, config: { passwordHash: hash } }])
    const response = await POST(formRequest({ password: "wrong", next: "/admin" }) as never)
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "Site gate access required." })
    expect(response.headers.get("set-cookie")).toBeNull()
  })

  test("HTML form wrong password redirects with error", async () => {
    const hash = await hashSiteGatePassword("correct-gate")
    installFlagSelect([{ enabled: true, config: { passwordHash: hash } }])
    const response = await POST(
      formRequest(
        { password: "wrong", next: "/admin" },
        { accept: "text/html" },
      ) as never,
    )
    expect(response.status).toBe(303)
    expect(response.headers.get("location")).toContain("/site-gate")
    expect(response.headers.get("location")).toContain("error=invalid")
  })

  test("matching hash sets HMAC cookie signed with AUTH_SECRET", async () => {
    const password = "correct-gate"
    const hash = await hashSiteGatePassword(password)
    installFlagSelect([{ enabled: true, config: { passwordHash: hash } }])
    const response = await POST(formRequest({ password, next: "/admin" }) as never)
    expect(response.status).toBe(303)
    expect(response.headers.get("location")).toBe("http://localhost/admin")
    const cookie = response.headers.get("set-cookie") ?? ""
    expect(cookie).toContain(`${SITE_GATE_COOKIE}=`)
    const raw = cookie.match(new RegExp(`${SITE_GATE_COOKIE}=([^;]+)`))?.[1]
    const value = decodeURIComponent(raw ?? "")
    expect(value).toBeTruthy()
    expect(await verifySiteGateCookie(value, process.env.AUTH_SECRET ?? "")).toBe(true)
    expect(await verifySiteGateCookie(value, password)).toBe(false)
  })

  test("leftover SITE_GATE_PASSWORD unlocks only when the row has no hash", async () => {
    process.env.SITE_GATE_PASSWORD = "clone-gate"
    installFlagSelect([])
    const leftoverOk = await POST(formRequest({ password: "clone-gate", next: "/" }) as never)
    expect(leftoverOk.status).toBe(303)

    const hash = await hashSiteGatePassword("admin-set-gate")
    installFlagSelect([{ enabled: true, config: { passwordHash: hash } }])
    const leftoverIgnored = await POST(formRequest({ password: "clone-gate", next: "/" }) as never)
    expect(leftoverIgnored.status).toBe(401)
    const hashedOk = await POST(formRequest({ password: "admin-set-gate", next: "/" }) as never)
    expect(hashedOk.status).toBe(303)
  })

  test("oversized password is rejected before scrypt", async () => {
    const hash = await hashSiteGatePassword("correct-gate")
    installFlagSelect([{ enabled: true, config: { passwordHash: hash } }])
    const started = Date.now()
    const response = await POST(
      formRequest({ password: "x".repeat(SITE_GATE_PASSWORD_MAX_LENGTH + 1), next: "/" }) as never,
    )
    expect(response.status).toBe(401)
    expect(Date.now() - started).toBeLessThan(200)
    expect(dbSelectLimit).not.toHaveBeenCalled()
  })

  test("DB errors do not leftover-unlock", async () => {
    process.env.SITE_GATE_PASSWORD = "clone-gate"
    dbSelectLimit.mockImplementation(async () => {
      throw new Error("neon unavailable")
    })
    const response = await POST(formRequest({ password: "clone-gate", next: "/" }) as never)
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: "Site gate unavailable." })
    expect(response.headers.get("set-cookie")).toBeNull()
  })
})

describe("GET /api/site-gate/public-state", () => {
  const originalVercel = process.env.VERCEL_ENV
  const originalLeftover = process.env.SITE_GATE_PASSWORD

  beforeEach(() => {
    resetFeatureFlagCache()
    installFlagSelect([])
    delete process.env.SITE_GATE_PASSWORD
    process.env.VERCEL_ENV = "preview"
  })

  afterEach(() => {
    resetFeatureFlagCache()
    delete (mockedDb as { select?: unknown }).select
    if (originalLeftover === undefined) delete process.env.SITE_GATE_PASSWORD
    else process.env.SITE_GATE_PASSWORD = originalLeftover
    if (originalVercel === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = originalVercel
  })

  test("returns enforce true when flag on and hash present, with no secrets", async () => {
    const hash = await hashSiteGatePassword("preview-gate")
    installFlagSelect([{ enabled: true, config: { passwordHash: hash } }])
    const response = await GET_PUBLIC_STATE()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ enforce: true })
    expect(JSON.stringify(body)).not.toContain("passwordHash")
    expect(JSON.stringify(body)).not.toContain("preview-gate")
    expect(JSON.stringify(body)).not.toContain("scrypt")
    expect(response.headers.get("cache-control") ?? "").toContain("max-age=")
  })

  test("returns enforce false when flag is off even if a hash exists", async () => {
    const hash = await hashSiteGatePassword("preview-gate")
    installFlagSelect([{ enabled: false, config: { passwordHash: hash } }])
    const response = await GET_PUBLIC_STATE()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ enforce: false })
  })

  test("leftover SITE_GATE_PASSWORD with no hash row returns { enforce: true }", async () => {
    process.env.SITE_GATE_PASSWORD = "clone-gate"
    installFlagSelect([])
    const missing = await GET_PUBLIC_STATE()
    expect(missing.status).toBe(200)
    expect(await missing.json()).toEqual({ enforce: true })

    installFlagSelect([{ enabled: true, config: {} }])
    const emptyHash = await GET_PUBLIC_STATE()
    expect(emptyHash.status).toBe(200)
    expect(await emptyHash.json()).toEqual({ enforce: true })
  })

  test("returns 503 without leftover unlock when Neon throws", async () => {
    process.env.SITE_GATE_PASSWORD = "clone-gate"
    dbSelectLimit.mockImplementation(async () => {
      throw new Error("neon unavailable")
    })
    const response = await GET_PUBLIC_STATE()
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: "Site gate unavailable." })
  })
})
