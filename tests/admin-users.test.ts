process.env.DATABASE_URL ??= "postgresql://ci:ci@localhost:5432/ci"
process.env.AUTH_SECRET ??= "ci-placeholder-secret-minimum-32-characters"

import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { hasCapability } from "@/lib/auth/capabilities-pure"
import {
  countActiveAdmins,
  GENERIC_INVITE_ERROR,
  inviteExistingDecision,
  isAdminUser,
  LAST_ADMIN_ERROR,
  lastAdminCapabilityChangeBlocked,
  restoreCompensateCredentialAction,
  restoreCompensateUserFields,
  wouldRemoveLastAdmin,
} from "@/lib/auth/admin-users-pure"
import { forbiddenUnlessAllowed } from "@/lib/api/helpers"
import { setPasswordPageUrl } from "@/lib/auth/reset-password-url-pure"

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
  })

  test("no public /register route", () => {
    expect(existsSync(join(root, "app/register"))).toBe(false)
    expect(existsSync(join(root, "app/(auth)/register"))).toBe(false)
    expect(existsSync(join(root, "app/(public)/register"))).toBe(false)
  })
})
