process.env.DATABASE_URL ??= "postgresql://ci:ci@localhost:5432/ci"
process.env.AUTH_SECRET ??= "ci-placeholder-secret-minimum-32-characters"

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
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
const writeAuditLog = mock(async () => undefined)
const auditClientMeta = mock(() => ({}))

let existingRows: Array<{ id: string; deletedAt: Date | null }> = []
let credentialRows: Array<{ id: string; password: string | null }> = []

function createTx() {
  let selects = 0
  const tx = {
    select: mock(() => {
      selects += 1
      return tx
    }),
    from: mock(() => tx),
    where: mock(() => tx),
    limit: mock(async () => (selects <= 1 ? existingRows : credentialRows)),
    insert: mock(() => tx),
    values: mock(async () => undefined),
    update: mock(() => tx),
    set: mock(() => tx),
    delete: mock(() => tx),
  }
  return tx
}

mock.module("@/lib/auth", () => ({
  getSession,
  sendWelcomeEmail,
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
  db: {
    transaction: async (fn: (tx: ReturnType<typeof createTx>) => unknown) => fn(createTx()),
    execute: async () => {
      throw new Error("use memory rate limit")
    },
  },
}))

const { POST } = await import("@/app/api/admin/users/route")

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
    "AUTH_URL",
    "NEXT_PUBLIC_BASE_URL",
    "NEXT_PUBLIC_SITE_URL",
  ] as const
  const priorEnv: Record<(typeof envKeys)[number], string | undefined> = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    AUTH_URL: process.env.AUTH_URL,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  }

  beforeEach(() => {
    getSession.mockReset()
    checkCapability.mockReset()
    sendWelcomeEmail.mockReset()
    writeAuditLog.mockReset()
    auditClientMeta.mockReset()
    getSession.mockImplementation(async () => ({ user: { id: "admin-1" } }))
    checkCapability.mockImplementation(async () => true)
    sendWelcomeEmail.mockImplementation(async () => undefined)
    writeAuditLog.mockImplementation(async () => undefined)
    auditClientMeta.mockImplementation(() => ({}))
    existingRows = []
    credentialRows = []
    resetMemoryRateLimits()
    delete process.env.RESEND_API_KEY
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
    sendWelcomeEmail.mockImplementation(async () => {
      throw new Error("resend down")
    })
    const response = await POST(inviteRequest())
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: WELCOME_EMAIL_ERROR })
    expect(sendWelcomeEmail).toHaveBeenCalledTimes(1)
  })
})

