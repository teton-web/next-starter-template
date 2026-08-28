process.env.DATABASE_URL ??= "postgresql://ci:ci@localhost:5432/ci"
process.env.AUTH_SECRET ??= "ci-placeholder-secret-minimum-32-characters"

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { mockedDb, resetSharedDbExecute, setDbTransaction } from "./helpers/mock-db"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { hasCapability, sanitizeCapabilities } from "@/lib/auth/capabilities-pure"
import {
  countActiveAdmins,
  GENERIC_INVITE_ERROR,
  inviteExistingDecision,
  isAdminUser,
  LAST_ADMIN_ERROR,
  lastAdminCapabilityChangeBlocked,
  restoreCompensateCredentialAction,
  restoreCompensateUserFields,
  WELCOME_EMAIL_ERROR,
  wouldRemoveLastAdmin,
} from "@/lib/auth/admin-users-pure"
import { forbiddenUnlessAllowed } from "@/lib/api/helpers"
import { setPasswordPageUrl } from "@/lib/auth/reset-password-url-pure"
import {
  deleteResetPasswordVerificationsForUser,
  RESET_PASSWORD_IDENTIFIER_LIKE,
  resetPasswordVerificationsForUser,
} from "@/lib/auth/reset-password-verifications"
import { auditClientMeta } from "@/lib/admin/audit"
import { sessions, users, verifications } from "@/lib/db/schema"
import { resetMemoryRateLimits } from "@/lib/services/rate-limit"

const root = join(import.meta.dir, "..")

describe("last-admin protection", () => {
  test("blocks removing the last remaining admin", () => {
    expect(wouldRemoveLastAdmin({ activeAdminCount: 1, targetIsAdmin: true })).toBe(true)
    expect(wouldRemoveLastAdmin({ activeAdminCount: 0, targetIsAdmin: true })).toBe(true)
    expect(wouldRemoveLastAdmin({ activeAdminCount: 2, targetIsAdmin: true })).toBe(false)
    expect(wouldRemoveLastAdmin({ activeAdminCount: 1, targetIsAdmin: false })).toBe(false)
  })

  test("countActiveAdmins and isAdminUser match the PATCH decision", () => {
    const users = [
      { id: "a", capabilities: ["admin"], deletedAt: null },
      { id: "b", capabilities: ["moderate"], deletedAt: null },
      { id: "c", capabilities: ["admin"], deletedAt: new Date() },
    ]
    expect(countActiveAdmins(users)).toBe(1)
    expect(isAdminUser(users[0]!.capabilities)).toBe(true)
    expect(isAdminUser(users[1]!.capabilities)).toBe(false)
    expect(
      wouldRemoveLastAdmin({
        activeAdminCount: countActiveAdmins(users),
        targetIsAdmin: isAdminUser(users[0]!.capabilities),
      }),
    ).toBe(true)
    expect(
      wouldRemoveLastAdmin({
        activeAdminCount: countActiveAdmins(users),
        targetIsAdmin: isAdminUser(users[1]!.capabilities),
      }),
    ).toBe(false)
  })

  test("last-admin strip is blocked and keeping admin is allowed", () => {
    expect(
      lastAdminCapabilityChangeBlocked({
        activeAdminCount: 1,
        targetIsAdmin: true,
        nextIsAdmin: false,
      }),
    ).toBe(true)
    expect(
      lastAdminCapabilityChangeBlocked({
        activeAdminCount: 1,
        targetIsAdmin: true,
        nextIsAdmin: true,
      }),
    ).toBe(false)
    expect(
      lastAdminCapabilityChangeBlocked({
        activeAdminCount: 2,
        targetIsAdmin: true,
        nextIsAdmin: false,
      }),
    ).toBe(false)
    expect(
      lastAdminCapabilityChangeBlocked({
        activeAdminCount: 1,
        targetIsAdmin: false,
        nextIsAdmin: false,
      }),
    ).toBe(false)
  })
})

describe("invite existing decision", () => {
  test("restores soft-deleted users and rejects live duplicates", () => {
    expect(inviteExistingDecision(null)).toBe("create")
    expect(inviteExistingDecision({ deletedAt: null })).toBe("reject_live")
    expect(inviteExistingDecision({ deletedAt: new Date() })).toBe("restore")
  })
})

describe("restore invite mail-failure compensate", () => {
  const base = {
    name: "Prior Name",
    capabilities: ["moderate"],
    emailVerified: false,
    mustChangePassword: false,
  }

  test("restores the prior credential hash when one already existed", () => {
    expect(
      restoreCompensateCredentialAction({
        ...base,
        credentialId: "acct-1",
        priorPasswordHash: "$2a$10$priorhash",
        credentialWasInserted: false,
      }),
    ).toEqual({
      type: "restore_hash",
      id: "acct-1",
      password: "$2a$10$priorhash",
    })
  })

  test("restores a null prior password hash", () => {
    expect(
      restoreCompensateCredentialAction({
        ...base,
        credentialId: "acct-1",
        priorPasswordHash: null,
        credentialWasInserted: false,
      }),
    ).toEqual({ type: "restore_hash", id: "acct-1", password: null })
  })

  test("deletes a credential inserted by this restore", () => {
    expect(
      restoreCompensateCredentialAction({
        ...base,
        credentialId: "acct-new",
        priorPasswordHash: null,
        credentialWasInserted: true,
      }),
    ).toEqual({ type: "delete_inserted", id: "acct-new" })
  })

  test("is a no-op when there is no credential id", () => {
    expect(
      restoreCompensateCredentialAction({
        ...base,
        credentialId: null,
        priorPasswordHash: null,
        credentialWasInserted: false,
      }),
    ).toEqual({ type: "none" })
  })

  test("restores prior profile fields and re-sets deletedAt", () => {
    const now = new Date("2026-08-28T12:00:00.000Z")
    expect(
      restoreCompensateUserFields(
        {
          ...base,
          credentialId: "acct-1",
          priorPasswordHash: "$2a$10$priorhash",
          credentialWasInserted: false,
        },
        now,
      ),
    ).toEqual({
      name: "Prior Name",
      capabilities: ["moderate"],
      emailVerified: false,
      mustChangePassword: false,
      deletedAt: now,
      updatedAt: now,
    })
  })

  test("users POST compensate uses restore helpers", () => {
    const route = readFileSync(join(root, "app/api/admin/users/route.ts"), "utf8")
    expect(route).toContain("restoreCompensateUserFields")
    expect(route).toContain("restoreCompensateCredentialAction")
  })
})

describe("admin users capability gate", () => {
  test("non-admin caps are 403 Forbidden via the same helper routes use", async () => {
    const denied = forbiddenUnlessAllowed(hasCapability(["moderate"], "admin"))
    expect(denied).toBeInstanceOf(Response)
    const response = denied as Response
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe("Forbidden")
  })

  test("admin caps are allowed", () => {
    expect(forbiddenUnlessAllowed(hasCapability(["admin"], "admin"))).toBe(true)
    expect(forbiddenUnlessAllowed(hasCapability(["admin"], "moderate"))).toBe(true)
  })
})

describe("reset-password verification invalidation", () => {
  test("scopes deletes to that user and reset-password identifiers", () => {
    const condition = resetPasswordVerificationsForUser("user-42")
    expect(sqlMentions(condition, "user-42")).toBe(true)
    expect(sqlMentions(condition, RESET_PASSWORD_IDENTIFIER_LIKE)).toBe(true)
    expect(sqlMentions(condition, "value")).toBe(true)
    expect(sqlMentions(condition, "identifier")).toBe(true)
    expect(RESET_PASSWORD_IDENTIFIER_LIKE).toBe("reset-password:%")
  })

  test("delete helper issues delete().where() on verifications", async () => {
    const deleted: unknown[] = []
    const tx = {
      delete: (table: unknown) => {
        expect(table).toBe(verifications)
        return {
          where: (condition: unknown) => {
            deleted.push(condition)
            return undefined
          },
        }
      },
    }
    await deleteResetPasswordVerificationsForUser(tx, "user-42")
    expect(deleted).toHaveLength(1)
    expect(sqlMentions(deleted[0], "user-42")).toBe(true)
    expect(sqlMentions(deleted[0], RESET_PASSWORD_IDENTIFIER_LIKE)).toBe(true)
  })
})

describe("welcome set-password URL", () => {
  test("builds a page token URL from AUTH origin", () => {
    expect(setPasswordPageUrl("https://example.com", "abc123")).toBe(
      "https://example.com/reset-password?token=abc123",
    )
    expect(setPasswordPageUrl("https://example.com/api/auth", "tok")).toBe(
      "https://example.com/reset-password?token=tok",
    )
    expect(setPasswordPageUrl("", "tok")).toBeNull()
    expect(setPasswordPageUrl("not-a-url", "tok")).toBeNull()
  })
})

describe("users route handlers", () => {
  test("GET/POST/PATCH are the shipped Route Handlers", async () => {
    const list = await import("@/app/api/admin/users/route")
    const patch = await import("@/app/api/admin/users/[id]/route")
    expect(typeof list.GET).toBe("function")
    expect(typeof list.POST).toBe("function")
    expect(typeof patch.PATCH).toBe("function")
  })
})

describe("invite copy and public register", () => {
  test("duplicate invite stays generic", () => {
    expect(GENERIC_INVITE_ERROR).toBe("Unable to complete this invite.")
    expect(GENERIC_INVITE_ERROR.toLowerCase()).not.toContain("already exists")
    expect(LAST_ADMIN_ERROR).toContain("last remaining admin")
    const route = readFileSync(join(root, "app/api/admin/users/route.ts"), "utf8")
    expect(route).toContain("GENERIC_INVITE_ERROR")
    expect(route).toContain("jsonOk(")
    expect(route).toContain("201")
    expect(route).toContain("emailSent")
    expect(route).toContain("setPasswordUrl")
    expect(route).toContain("isResendConfigured")
    const page = readFileSync(join(root, "app/admin/users/page.tsx"), "utf8")
    expect(page).toContain("setPasswordUrl")
    expect(page).toContain('role="status"')
    expect(page).toContain("Set-password link (email was not sent)")
  })

  test("no public /register route", () => {
    expect(existsSync(join(root, "app/register"))).toBe(false)
    expect(existsSync(join(root, "app/(auth)/register"))).toBe(false)
    expect(existsSync(join(root, "app/(public)/register"))).toBe(false)
  })
})

const getSession = mock(async (): Promise<{ user: { id: string } } | null> => null)
const checkCapability = mock(async () => false)
const sendWelcomeEmail = mock(
  async (_input: { user: { email: string; name?: string | null }; url: string }) => undefined,
)
function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
}
const writeAuditLog = mock(async () => undefined)

let existingRows: Array<{
  id: string
  deletedAt: Date | null
  name?: string
  capabilities?: string[]
  emailVerified?: boolean
  mustChangePassword?: boolean
}> = []
let credentialRows: Array<{ id: string; password: string | null }> = []
let lockedRows: Array<{
  id: string
  capabilities: string[] | null
  deletedAt: Date | null
}> = []

type TxOp = { op: "delete" | "insert" | "update"; table?: unknown }
type TxTrace = { ops: TxOp[]; deleteConditions: unknown[]; insertValues: unknown[] }
let transactions: TxTrace[] = []

function createTx() {
  let selects = 0
  const ops: TxOp[] = []
  const deleteConditions: unknown[] = []
  const insertValues: unknown[] = []
  transactions.push({ ops, deleteConditions, insertValues })
  const tx = {
    select: mock(() => {
      selects += 1
      return tx
    }),
    from: mock(() => tx),
    where: mock((condition?: unknown) => {
      if (ops.at(-1)?.op === "delete") deleteConditions.push(condition)
      return tx
    }),
    limit: mock(async () => (selects <= 1 ? existingRows : credentialRows)),
    insert: mock((table?: unknown) => {
      ops.push({ op: "insert", table })
      return tx
    }),
    values: mock(async (vals?: unknown) => {
      insertValues.push(vals)
      return undefined
    }),
    update: mock((table?: unknown) => {
      ops.push({ op: "update", table })
      return tx
    }),
    set: mock(() => tx),
    delete: mock((table?: unknown) => {
      ops.push({ op: "delete", table })
      return tx
    }),
    orderBy: mock(() => tx),
    for: mock(async () => lockedRows),
  }
  return tx
}

function tableOps(table: unknown, trace = transactions[0]) {
  return (trace?.ops ?? [])
    .filter((op) => op.table === table)
    .map((op) => op.op)
}

function verificationOps(trace = transactions[0]) {
  return tableOps(verifications, trace)
}

function deleteConditionForTable(table: unknown, trace = transactions[0]) {
  const deletes = (trace?.ops ?? []).filter((op) => op.op === "delete")
  const idx = deletes.findIndex((op) => op.table === table)
  if (idx < 0) return undefined
  return trace?.deleteConditions[idx]
}

function sqlMentions(value: unknown, needle: string): boolean {
  const seen = new Set<unknown>()
  const stack: unknown[] = [value]
  while (stack.length) {
    const current = stack.pop()
    if (typeof current === "string") {
      if (current.includes(needle)) return true
      continue
    }
    if (!current || typeof current !== "object" || seen.has(current)) continue
    seen.add(current)
    if (Array.isArray(current)) {
      stack.push(...current)
      continue
    }
    stack.push(...Object.values(current))
  }
  return false
}

mock.module("@/lib/auth", () => ({
  getSession,
  sendWelcomeEmail,
  isResendConfigured,
}))
mock.module("@/lib/auth/capabilities", () => ({
  checkCapability,
  sanitizeCapabilities,
}))
mock.module("@/lib/admin/audit", () => ({
  writeAuditLog,
  auditClientMeta,
}))
mock.module("@/lib/db", () => ({
  db: mockedDb,
}))

function useAdminUsersDb() {
  setDbTransaction((fn) => fn(createTx()))
  resetSharedDbExecute()
}

useAdminUsersDb()

const { POST } = await import("@/app/api/admin/users/route")
const { PATCH } = await import("@/app/api/admin/users/[id]/route")

function inviteRequest() {
  return new Request("http://localhost/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "invitee@example.com",
      name: "Invitee",
      capabilities: ["moderate"],
    }),
  })
}

describe("POST /api/admin/users", () => {
  const envKeys = [
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "AUTH_URL",
    "NEXT_PUBLIC_BASE_URL",
    "NEXT_PUBLIC_SITE_URL",
  ] as const
  const priorEnv: Record<(typeof envKeys)[number], string | undefined> = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    AUTH_URL: process.env.AUTH_URL,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  }

  beforeEach(() => {
    getSession.mockReset()
    checkCapability.mockReset()
    sendWelcomeEmail.mockReset()
    writeAuditLog.mockReset()
    getSession.mockImplementation(async () => ({ user: { id: "admin-1" } }))
    checkCapability.mockImplementation(async () => true)
    sendWelcomeEmail.mockImplementation(async () => undefined)
    writeAuditLog.mockImplementation(async () => undefined)
    existingRows = []
    credentialRows = []
    lockedRows = []
    transactions = []
    resetMemoryRateLimits()
    useAdminUsersDb()
    delete process.env.RESEND_API_KEY
    delete process.env.EMAIL_FROM
    delete process.env.NEXT_PUBLIC_BASE_URL
    delete process.env.NEXT_PUBLIC_SITE_URL
    process.env.AUTH_URL = "https://example.com"
  })

  afterEach(() => {
    for (const key of envKeys) {
      const value = priorEnv[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  test("returns 401 without a session", async () => {
    getSession.mockImplementation(async () => null)
    const response = await POST(inviteRequest())
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "Unauthorized" })
    expect(checkCapability).not.toHaveBeenCalled()
    expect(sendWelcomeEmail).not.toHaveBeenCalled()
  })

  test("returns 403 when the session lacks admin", async () => {
    getSession.mockImplementation(async () => ({ user: { id: "mod-1" } }))
    checkCapability.mockImplementation(async () => false)
    const response = await POST(inviteRequest())
    expect(checkCapability).toHaveBeenCalledWith("mod-1", "admin")
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: "Forbidden" })
    expect(sendWelcomeEmail).not.toHaveBeenCalled()
  })

  test("201 with delivery omits setPasswordUrl after send succeeds", async () => {
    process.env.RESEND_API_KEY = "re_test_key"
    process.env.EMAIL_FROM = "noreply@example.com"
    const response = await POST(inviteRequest())
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.email).toBe("invitee@example.com")
    expect(body.name).toBe("Invitee")
    expect(body.capabilities).toEqual(["moderate"])
    expect(body.emailSent).toBe(true)
    expect(body.setPasswordUrl).toBeUndefined()
    expect(typeof body.id).toBe("string")
    expect(sendWelcomeEmail).toHaveBeenCalledTimes(1)
    const sent = sendWelcomeEmail.mock.calls[0]?.[0] as {
      user: { email: string }
      url: string
    }
    expect(sent.user.email).toBe("invitee@example.com")
    expect(sent.url).toContain("https://example.com/reset-password?token=")
    expect(writeAuditLog).toHaveBeenCalled()
  })

  test("live duplicate email is a generic 400", async () => {
    process.env.RESEND_API_KEY = "re_test_key"
    existingRows = [{ id: "u1", deletedAt: null }]
    const response = await POST(inviteRequest())
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe(GENERIC_INVITE_ERROR)
    expect(String(body.error).toLowerCase()).not.toContain("already exists")
    expect(sendWelcomeEmail).not.toHaveBeenCalled()
  })

  test("no Resend returns 201 with a copyable set-password URL", async () => {
    delete process.env.RESEND_API_KEY
    delete process.env.EMAIL_FROM
    const response = await POST(inviteRequest())
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.emailSent).toBe(false)
    expect(typeof body.setPasswordUrl).toBe("string")
    expect(body.setPasswordUrl).toContain("https://example.com/reset-password?token=")
    expect(sendWelcomeEmail).not.toHaveBeenCalled()
  })

  test("Resend key without EMAIL_FROM returns 201 with a copyable set-password URL", async () => {
    process.env.RESEND_API_KEY = "re_test_key"
    delete process.env.EMAIL_FROM
    const response = await POST(inviteRequest())
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.emailSent).toBe(false)
    expect(typeof body.setPasswordUrl).toBe("string")
    expect(body.setPasswordUrl).toContain("https://example.com/reset-password?token=")
    expect(sendWelcomeEmail).not.toHaveBeenCalled()
  })

  test("missing origin is 500 even without Resend", async () => {
    delete process.env.RESEND_API_KEY
    delete process.env.EMAIL_FROM
    delete process.env.AUTH_URL
    delete process.env.NEXT_PUBLIC_BASE_URL
    delete process.env.NEXT_PUBLIC_SITE_URL
    const response = await POST(inviteRequest())
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: WELCOME_EMAIL_ERROR })
    expect(sendWelcomeEmail).not.toHaveBeenCalled()
  })

  test("Resend send failure rolls back and returns 500", async () => {
    process.env.RESEND_API_KEY = "re_test_key"
    process.env.EMAIL_FROM = "noreply@example.com"
    sendWelcomeEmail.mockImplementation(async () => {
      throw new Error("resend down")
    })
    const response = await POST(inviteRequest())
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: WELCOME_EMAIL_ERROR })
    expect(sendWelcomeEmail).toHaveBeenCalledTimes(1)
  })

  test("create invite deletes prior reset-password tokens before insert", async () => {
    const response = await POST(inviteRequest())
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(verificationOps()).toEqual(["delete", "insert"])
    expect(sqlMentions(transactions[0]?.deleteConditions[0], body.id)).toBe(true)
    expect(sqlMentions(transactions[0]?.deleteConditions[0], RESET_PASSWORD_IDENTIFIER_LIKE)).toBe(
      true,
    )
    const inserted = transactions[0]?.insertValues.find(
      (row) =>
        row &&
        typeof row === "object" &&
        "identifier" in row &&
        String((row as { identifier: string }).identifier).startsWith("reset-password:"),
    ) as { value: string } | undefined
    expect(inserted?.value).toBe(body.id)
  })

  test("restore re-invite deletes prior tokens then inserts the new one", async () => {
    existingRows = [
      {
        id: "restored-1",
        deletedAt: new Date("2026-01-01T00:00:00.000Z"),
        name: "Old Name",
        capabilities: ["moderate"],
        emailVerified: false,
        mustChangePassword: false,
      },
    ]
    credentialRows = [{ id: "acct-1", password: "$2a$10$priorhash" }]
    const response = await POST(inviteRequest())
    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.id).toBe("restored-1")
    expect(verificationOps()).toEqual(["delete", "insert"])
    expect(sqlMentions(deleteConditionForTable(verifications), "restored-1")).toBe(true)
    expect(sqlMentions(deleteConditionForTable(verifications), RESET_PASSWORD_IDENTIFIER_LIKE)).toBe(
      true,
    )
    expect(tableOps(sessions)).toEqual(["delete"])
    expect(sqlMentions(deleteConditionForTable(sessions), "restored-1")).toBe(true)
    const ops = transactions[0]?.ops ?? []
    const sessionDeleteIdx = ops.findIndex((op) => op.op === "delete" && op.table === sessions)
    const userUpdateIdx = ops.findIndex((op) => op.op === "update" && op.table === users)
    expect(sessionDeleteIdx).toBeGreaterThanOrEqual(0)
    expect(userUpdateIdx).toBeGreaterThan(sessionDeleteIdx)
  })
})

describe("PATCH /api/admin/users/[id]", () => {
  beforeEach(() => {
    getSession.mockReset()
    checkCapability.mockReset()
    writeAuditLog.mockReset()
    getSession.mockImplementation(async () => ({ user: { id: "admin-1" } }))
    checkCapability.mockImplementation(async () => true)
    writeAuditLog.mockImplementation(async () => undefined)
    existingRows = []
    credentialRows = []
    lockedRows = [
      { id: "admin-1", capabilities: ["admin"], deletedAt: null },
      { id: "u1", capabilities: ["moderate"], deletedAt: null },
    ]
    transactions = []
    resetMemoryRateLimits()
    useAdminUsersDb()
  })

  test("deletedAt=true deletes outstanding reset-password tokens", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/admin/users/u1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deletedAt: true }),
      }),
      { params: Promise.resolve({ id: "u1" }) },
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: "u1", deletedAt: true })
    expect(verificationOps()).toEqual(["delete"])
    expect(sqlMentions(deleteConditionForTable(verifications), "u1")).toBe(true)
    expect(sqlMentions(deleteConditionForTable(verifications), RESET_PASSWORD_IDENTIFIER_LIKE)).toBe(
      true,
    )
    expect(tableOps(sessions)).toEqual(["delete"])
    expect(sqlMentions(deleteConditionForTable(sessions), "u1")).toBe(true)
  })

  test("capability-only PATCH does not delete reset-password tokens or sessions", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/admin/users/u1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capabilities: ["moderate"] }),
      }),
      { params: Promise.resolve({ id: "u1" }) },
    )
    expect(response.status).toBe(200)
    expect(verificationOps()).toEqual([])
    expect(tableOps(sessions)).toEqual([])
  })
})

