process.env.DATABASE_URL ??= "postgresql://ci:ci@localhost:5432/ci"
process.env.AUTH_SECRET ??= "ci-placeholder-secret-minimum-32-characters"

import {
  dbInsert,
  dbInsertOnConflictDoUpdate,
  dbInsertValues,
  mockedDb,
  resetSharedDbInsert,
  resetSharedDbTransaction,
  setDbTransaction,
} from "./helpers/mock-db"
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
  decodeFeatureFlagCacheCookie,
  FEATURE_FLAG_CACHE_COOKIE,
  resetFeatureFlagCache,
} from "@/lib/flags/cache"
import { killSwitchReason, listFlagStatuses, siteGatePasswordReason } from "@/lib/flags/status"
import { hashSiteGatePassword } from "@/lib/flags/site-gate-password"

const root = join(import.meta.dir, "..")

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8")
}

type FlagRow = { key?: string; enabled: boolean; config: Record<string, unknown> }

let listRows: FlagRow[] = []
let lockedRows: FlagRow[] = []

const dbSelectForUpdate = mock((_mode?: unknown) => undefined)
const dbSelectLimit = mock(async (): Promise<FlagRow[]> => lockedRows)

function limitWithForUpdate(_n?: unknown) {
  const pending = Promise.resolve(dbSelectLimit())
  return Object.assign(pending, {
    for: (mode?: unknown) => {
      dbSelectForUpdate(mode)
      return pending
    },
  })
}

const dbSelect = mock((_fields?: unknown) => ({
  from: (_table?: unknown) => {
    const pending = Promise.resolve(listRows.slice())
    return Object.assign(pending, {
      where: () => ({
        limit: limitWithForUpdate,
      }),
    })
  },
}))

function installSelect() {
  dbSelectForUpdate.mockReset()
  dbSelectLimit.mockReset()
  dbSelectLimit.mockImplementation(async () => lockedRows)
  dbSelect.mockReset()
  dbSelect.mockImplementation((_fields?: unknown) => ({
    from: (_table?: unknown) => {
      const pending = Promise.resolve(listRows.slice())
      return Object.assign(pending, {
        where: () => ({
          limit: limitWithForUpdate,
        }),
      })
    },
  }))
  Object.assign(mockedDb, { select: dbSelect })
}

const getSession = mock(async (): Promise<{ user: { id: string } } | null> => null)
const checkCapability = mock(async () => false)

mock.module("@/lib/auth", () => ({
  getSession,
}))
mock.module("@/lib/auth/capabilities", () => ({
  checkCapability,
}))

installSelect()
setDbTransaction(async (fn) =>
  fn({
    select: dbSelect,
    insert: dbInsert,
  }),
)

const { GET, PATCH } = await import("@/app/api/admin/features/route")
const { isEnabled } = await import("@/lib/flags/resolve")

function patchRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/admin/features", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function cookieValue(response: Response) {
  const header = response.headers.get("set-cookie") ?? ""
  const match = header.match(new RegExp(`${FEATURE_FLAG_CACHE_COOKIE}=([^;]+)`))
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

describe("feature flag status copy", () => {
  test("kill switch, missing keys, site-gate hash, and dependsOn are explicit", () => {
    const flags = listFlagStatuses(
      [
        { key: "waitlist", enabled: true, config: {} },
        { key: "stripe", enabled: true, config: {} },
        { key: "site_gate", enabled: true, config: {} },
        { key: "scheduled_publish", enabled: true, config: {} },
      ],
      { FEATURE_WAITLIST: "0" },
    )
    const waitlist = flags.find((flag) => flag.key === "waitlist")
    expect(waitlist?.lockedOff).toBe(true)
    expect(waitlist?.toggleable).toBe(false)
    expect(waitlist?.enabled).toBe(false)
    expect(waitlist?.storedEnabled).toBe(true)
    expect(waitlist?.reasons).toContain(killSwitchReason("waitlist"))

    const stripe = flags.find((flag) => flag.key === "stripe")
    expect(stripe?.enabled).toBe(false)
    expect(stripe?.storedEnabled).toBe(true)
    expect(stripe?.reasons).toContain("Stripe keys missing in Doppler")
    expect(stripe?.reasons).toContain("Stored on; stays dark until the reasons above are resolved.")

    const siteGate = flags.find((flag) => flag.key === "site_gate")
    expect(siteGate?.enabled).toBe(false)
    expect(siteGate?.hasPassword).toBe(false)
    expect(siteGate?.reasons).toContain(siteGatePasswordReason())

    const scheduled = flags.find((flag) => flag.key === "scheduled_publish")
    expect(scheduled?.reasons).toContain("Requires cron")
    expect(scheduled?.reasons).toContain("CRON_SECRET missing in Doppler")
    expect(scheduled?.reasons).toContain("Stored on; stays dark until the reasons above are resolved.")
    expect(scheduled?.enabled).toBe(false)
    expect(scheduled?.storedEnabled).toBe(true)

    const ready = listFlagStatuses(
      [
        { key: "cron", enabled: true, config: {} },
        { key: "scheduled_publish", enabled: true, config: {} },
      ],
      { CRON_SECRET: "cron" },
    ).find((flag) => flag.key === "scheduled_publish")
    expect(ready?.enabled).toBe(true)
    expect(ready?.reasons).not.toContain("Requires cron")
    expect(ready?.reasons).not.toContain("Stored on; stays dark until the reasons above are resolved.")

    const auth = flags.find((flag) => flag.key === "auth")
    expect(auth?.platform).toBe(true)
    expect(auth?.toggleable).toBe(false)
    expect(auth?.enabled).toBe(true)
    expect(auth?.reasons[0]).toBe("Platform flags are always on and cannot be turned off.")
  })
})

describe("site-gate password hashing", () => {
  test("scrypt hash does not contain the plaintext", async () => {
    const plaintext = "gate-pass-unique-value"
    const hashed = await hashSiteGatePassword(plaintext)
    expect(hashed.startsWith("scrypt$")).toBe(true)
    expect(hashed).not.toContain(plaintext)
  })
})

describe("admin features source", () => {
  test("page, API, and nav exist with admin capability and no Server Actions", () => {
    expect(existsSync(join(root, "app/admin/features/page.tsx"))).toBe(true)
    expect(existsSync(join(root, "app/admin/features/features-form.tsx"))).toBe(true)
    expect(existsSync(join(root, "app/api/admin/features/route.ts"))).toBe(true)

    const page = read("app/admin/features/page.tsx")
    const form = read("app/admin/features/features-form.tsx")
    const api = read("app/api/admin/features/route.ts")
    const shell = read("app/admin/admin-shell.tsx")

    expect(page).toContain('checkCapability(session.user.id, "admin")')
    expect(page).toContain("loadFlagStatuses")
    expect(page).not.toContain('"use server"')
    expect(form).toContain("from \"@/components/ui/switch\"")
    expect(form).toContain('method: "PATCH"')
    expect(form).toContain("/api/admin/features")
    expect(form).toContain('key: "site_gate"')
    expect(form).toContain("password: siteGatePassword")
    expect(form).not.toContain("enabled: flag.storedEnabled === true")
    expect(form).not.toContain('"use server"')
    expect(api).toContain('requireCapabilityResponse(userId, "admin")')
    expect(api).toContain("export async function GET")
    expect(api).toContain("export async function PATCH")
    expect(api).toContain("parseJson")
    expect(api).toContain("setFeatureFlag")
    expect(api).toContain("hashSiteGatePassword")
    expect(api).toContain("encodeFeatureFlagCacheCookie")
    expect(api).toContain("FEATURE_FLAG_CACHE_COOKIE")
    expect(api).not.toContain("export async function POST")
    expect(api).not.toContain('"use server"')
    expect(shell).toContain('href="/admin/features"')
    expect(shell).toContain("canAdmin")
    expect(read("docs/API_AUTH_MATRIX.md")).toContain("GET/PATCH /api/admin/features")
  })
})

describe("GET/PATCH /api/admin/features", () => {
  const priorWaitlist = process.env.FEATURE_WAITLIST
  const priorSiteGate = process.env.FEATURE_SITE_GATE

  beforeEach(() => {
    getSession.mockReset()
    checkCapability.mockReset()
    getSession.mockImplementation(async () => ({ user: { id: "admin-1" } }))
    checkCapability.mockImplementation(async () => true)
    listRows = []
    lockedRows = []
    resetSharedDbInsert()
    resetFeatureFlagCache()
    installSelect()
    setDbTransaction(async (fn) => {
      const start = listRows.length
      try {
        return await fn({
          select: dbSelect,
          insert: dbInsert,
        })
      } catch (error) {
        listRows.length = start
        throw error
      }
    })
    dbInsertValues.mockImplementation(async (row: unknown) => {
      if (row && typeof row === "object" && "key" in row && "enabled" in row && !("action" in row)) {
        const flag = row as { key: string; enabled: boolean; config?: Record<string, unknown> }
        listRows = listRows.filter((item) => item.key !== flag.key)
        listRows.push({
          key: flag.key,
          enabled: flag.enabled,
          config: flag.config ?? {},
        })
        lockedRows = [{ enabled: flag.enabled, config: flag.config ?? {} }]
      }
    })
    delete process.env.FEATURE_WAITLIST
    delete process.env.FEATURE_SITE_GATE
  })

  afterEach(() => {
    resetFeatureFlagCache()
    resetSharedDbInsert()
    resetSharedDbTransaction()
    if (priorWaitlist === undefined) delete process.env.FEATURE_WAITLIST
    else process.env.FEATURE_WAITLIST = priorWaitlist
    if (priorSiteGate === undefined) delete process.env.FEATURE_SITE_GATE
    else process.env.FEATURE_SITE_GATE = priorSiteGate
  })

  test("GET returns 401 without a session", async () => {
    getSession.mockImplementation(async () => null)
    const response = await GET()
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "Unauthorized" })
    expect(checkCapability).not.toHaveBeenCalled()
  })

  test("GET returns 403 when the session lacks admin", async () => {
    getSession.mockImplementation(async () => ({ user: { id: "mod-1" } }))
    checkCapability.mockImplementation(async () => false)
    const response = await GET()
    expect(checkCapability).toHaveBeenCalledWith("mod-1", "admin")
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: "Forbidden" })
  })

  test("PATCH returns 401 without a session", async () => {
    getSession.mockImplementation(async () => null)
    const response = await PATCH(patchRequest({ key: "waitlist", enabled: true }))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "Unauthorized" })
    expect(dbInsertValues).not.toHaveBeenCalled()
  })

  test("PATCH returns 403 when the session lacks admin", async () => {
    getSession.mockImplementation(async () => ({ user: { id: "mod-1" } }))
    checkCapability.mockImplementation(async () => false)
    const response = await PATCH(patchRequest({ key: "waitlist", enabled: true }))
    expect(checkCapability).toHaveBeenCalledWith("mod-1", "admin")
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: "Forbidden" })
    expect(dbInsertValues).not.toHaveBeenCalled()
  })

  test("GET never returns site-gate password or hash", async () => {
    listRows = [
      {
        key: "site_gate",
        enabled: true,
        config: {
          password: "plain-site-gate-secret",
          passwordHash: "scrypt$stored-hash-value",
          note: "visible",
        },
      },
    ]
    const response = await GET()
    expect(response.status).toBe(200)
    const body = await response.json()
    const serialized = JSON.stringify(body)
    expect(serialized).not.toContain("plain-site-gate-secret")
    expect(serialized).not.toContain("scrypt$stored-hash-value")
    expect(serialized).not.toContain("passwordHash")
    const siteGate = body.flags.find((flag: { key: string }) => flag.key === "site_gate")
    expect(siteGate.hasPassword).toBe(true)
    expect(siteGate.enabled).toBe(true)
    expect(siteGate.storedEnabled).toBe(true)
    expect(siteGate.config).toBeUndefined()
  })

  test("GET shows Doppler kill switch as locked off", async () => {
    process.env.FEATURE_WAITLIST = "0"
    listRows = [{ key: "waitlist", enabled: true, config: {} }]
    const response = await GET()
    expect(response.status).toBe(200)
    const body = await response.json()
    const waitlist = body.flags.find((flag: { key: string }) => flag.key === "waitlist")
    expect(waitlist.lockedOff).toBe(true)
    expect(waitlist.enabled).toBe(false)
    expect(waitlist.toggleable).toBe(false)
    expect(waitlist.reasons).toContain(killSwitchReason("waitlist"))
  })

  test("admin can PATCH waitlist on and isEnabled follows on the next read", async () => {
    const response = await PATCH(patchRequest({ key: "waitlist", enabled: true }))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.flag.key).toBe("waitlist")
    expect(body.flag.storedEnabled).toBe(true)
    expect(body.flag.enabled).toBe(true)
    expect(body.flag.lockedOff).toBe(false)
    expect(dbSelectForUpdate).toHaveBeenCalledWith("update")
    expect(dbInsertOnConflictDoUpdate).toHaveBeenCalled()
    expect(dbInsertValues).toHaveBeenCalledTimes(2)
    const flagRow = dbInsertValues.mock.calls[0]?.[0] as Record<string, unknown>
    const auditRow = dbInsertValues.mock.calls[1]?.[0] as Record<string, unknown>
    expect(flagRow).toMatchObject({ key: "waitlist", enabled: true, config: {} })
    expect(auditRow).toMatchObject({
      action: "create",
      entityType: "feature_flag",
      entityId: "waitlist",
      actorUserId: "admin-1",
      metadata: {
        key: "waitlist",
        old: false,
        new: true,
        config: { old: {}, new: {} },
      },
    })
    expect(await isEnabled("waitlist", { env: {} })).toBe(true)

    const encoded = cookieValue(response)
    expect(encoded).toBeTruthy()
    const decoded = await decodeFeatureFlagCacheCookie(encoded ?? undefined)
    expect(decoded?.overrides.waitlist).toBe(true)
  })

  test("platform off is rejected without a write", async () => {
    const response = await PATCH(patchRequest({ key: "auth", enabled: false }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: "Platform feature auth cannot be turned off in the database",
    })
    expect(dbInsertValues).not.toHaveBeenCalled()
  })

  test("kill switch rejects enabled=true and does not write", async () => {
    process.env.FEATURE_WAITLIST = "0"
    const response = await PATCH(patchRequest({ key: "waitlist", enabled: true }))
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: killSwitchReason("waitlist"),
    })
    expect(dbInsertValues).not.toHaveBeenCalled()
    expect(await isEnabled("waitlist", { env: { FEATURE_WAITLIST: "0" } })).toBe(false)
  })

  test("stripe PATCH stores on but stays dark without keys", async () => {
    const response = await PATCH(patchRequest({ key: "stripe", enabled: true }))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.flag.key).toBe("stripe")
    expect(body.flag.storedEnabled).toBe(true)
    expect(body.flag.enabled).toBe(false)
    expect(body.flag.missingEnv).toEqual(["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"])
    expect(body.flag.reasons).toContain("Stripe keys missing in Doppler")
    expect(await isEnabled("stripe", { env: {} })).toBe(false)
  })

  test("site_gate on without a password stays dark and omits secrets", async () => {
    const response = await PATCH(patchRequest({ key: "site_gate", enabled: true }))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.flag.key).toBe("site_gate")
    expect(body.flag.storedEnabled).toBe(true)
    expect(body.flag.enabled).toBe(false)
    expect(body.flag.hasPassword).toBe(false)
    expect(JSON.stringify(body)).not.toContain("passwordHash")
    expect(await isEnabled("site_gate", { env: {} })).toBe(false)
    const encoded = cookieValue(response)
    const decoded = await decodeFeatureFlagCacheCookie(encoded ?? undefined)
    expect(decoded?.overrides.site_gate).toBe(false)
    expect(decoded?.siteGateHashPresent).toBe(false)
  })

  test("site_gate password is hashed at rest and enables the flag", async () => {
    const plaintext = "unique-gate-password-value"
    const response = await PATCH(
      patchRequest({ key: "site_gate", enabled: true, password: plaintext }),
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.flag.enabled).toBe(true)
    expect(body.flag.hasPassword).toBe(true)
    expect(JSON.stringify(body)).not.toContain(plaintext)
    const flagRow = dbInsertValues.mock.calls[0]?.[0] as {
      config?: Record<string, unknown>
    }
    const hash = flagRow.config?.passwordHash
    expect(typeof hash).toBe("string")
    expect(String(hash).startsWith("scrypt$")).toBe(true)
    expect(String(hash)).not.toContain(plaintext)
    expect(flagRow.config?.password).toBeUndefined()
    expect(await isEnabled("site_gate", { env: {} })).toBe(true)
    const decoded = await decodeFeatureFlagCacheCookie(cookieValue(response) ?? undefined)
    expect(decoded?.overrides.site_gate).toBe(true)
    expect(decoded?.siteGateHashPresent).toBe(true)
    const auditRow = dbInsertValues.mock.calls[1]?.[0] as Record<string, unknown>
    const auditJson = JSON.stringify(auditRow)
    expect(auditJson).not.toContain(plaintext)
    expect(auditJson).not.toContain("passwordHash")
    expect(auditRow.metadata).toMatchObject({
      key: "site_gate",
      old: false,
      new: true,
      config: { old: {}, new: { hasPassword: true } },
    })
  })

  test("admin can PATCH waitlist off and isEnabled follows", async () => {
    const on = await PATCH(patchRequest({ key: "waitlist", enabled: true }))
    expect(on.status).toBe(200)
    expect((await on.json()).flag.enabled).toBe(true)
    expect(await isEnabled("waitlist", { env: {} })).toBe(true)

    const off = await PATCH(patchRequest({ key: "waitlist", enabled: false }))
    expect(off.status).toBe(200)
    const body = await off.json()
    expect(body.flag.key).toBe("waitlist")
    expect(body.flag.storedEnabled).toBe(false)
    expect(body.flag.enabled).toBe(false)
    expect(await isEnabled("waitlist", { env: {} })).toBe(false)
    const decoded = await decodeFeatureFlagCacheCookie(cookieValue(off) ?? undefined)
    expect(decoded?.overrides.waitlist).toBe(false)
  })

  test("sequential PATCH waitlist then galleries snapshots both in ff_overrides", async () => {
    const waitlist = await PATCH(patchRequest({ key: "waitlist", enabled: true }))
    expect(waitlist.status).toBe(200)
    const first = await decodeFeatureFlagCacheCookie(cookieValue(waitlist) ?? undefined)
    expect(first?.overrides.waitlist).toBe(true)

    lockedRows = []
    const galleries = await PATCH(patchRequest({ key: "galleries", enabled: true }))
    expect(galleries.status).toBe(200)
    const body = await galleries.json()
    expect(body.flag.key).toBe("galleries")
    expect(body.flag.storedEnabled).toBe(true)
    const second = await decodeFeatureFlagCacheCookie(cookieValue(galleries) ?? undefined)
    expect(second?.overrides).toEqual({
      waitlist: true,
      galleries: true,
    })
  })

  test("password-only site_gate PATCH persists hash while kill-switched", async () => {
    process.env.FEATURE_SITE_GATE = "0"
    listRows = [{ key: "site_gate", enabled: true, config: {} }]
    lockedRows = [{ enabled: true, config: {} }]
    const plaintext = "kill-switch-gate-password"
    const blocked = await PATCH(
      patchRequest({ key: "site_gate", enabled: true, password: plaintext }),
    )
    expect(blocked.status).toBe(409)
    expect(await blocked.json()).toEqual({ error: killSwitchReason("site_gate") })
    expect(dbInsertValues).not.toHaveBeenCalled()

    const response = await PATCH(patchRequest({ key: "site_gate", password: plaintext }))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.flag.storedEnabled).toBe(true)
    expect(body.flag.enabled).toBe(false)
    expect(body.flag.lockedOff).toBe(true)
    expect(body.flag.hasPassword).toBe(true)
    expect(JSON.stringify(body)).not.toContain(plaintext)
    const flagRow = dbInsertValues.mock.calls[0]?.[0] as { config?: Record<string, unknown> }
    expect(String(flagRow.config?.passwordHash).startsWith("scrypt$")).toBe(true)
    expect(String(flagRow.config?.passwordHash)).not.toContain(plaintext)
    const auditRow = dbInsertValues.mock.calls[1]?.[0] as Record<string, unknown>
    expect(JSON.stringify(auditRow)).not.toContain(plaintext)
    expect(JSON.stringify(auditRow)).not.toContain("passwordHash")
  })
})
