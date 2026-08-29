process.env.DATABASE_URL ??= "postgresql://ci:ci@localhost:5432/ci"
process.env.AUTH_SECRET ??= "ci-placeholder-secret-minimum-32-characters"

import { beforeEach, describe, expect, mock, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { auditClientMeta } from "@/lib/admin/audit"
import { forbiddenUnlessAllowed } from "@/lib/api/helpers"
import { hasCapability } from "@/lib/auth/capabilities-pure"
import { authMockExports } from "./helpers/mock-auth"
import { capabilitiesMockExports } from "./helpers/mock-capabilities"

const root = join(import.meta.dir, "..")

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8")
}

describe("auditClientMeta", () => {
  test("prefers x-forwarded-for and user-agent", () => {
    const request = new Request("http://localhost/api/admin/audit", {
      headers: {
        "x-forwarded-for": "203.0.113.9, 10.0.0.1",
        "user-agent": "AuditTest/1.0",
      },
    })
    expect(auditClientMeta(request)).toEqual({
      ipAddress: "203.0.113.9",
      userAgent: "AuditTest/1.0",
    })
  })

  test("falls back to session ip/ua when headers are missing", () => {
    expect(
      auditClientMeta(undefined, { ipAddress: "198.51.100.2", userAgent: "session-ua" }),
    ).toEqual({
      ipAddress: "198.51.100.2",
      userAgent: "session-ua",
    })
  })
})

describe("audit capability gate", () => {
  test("moderate-only is 403 via the same helper the audit route uses", async () => {
    const denied = forbiddenUnlessAllowed(hasCapability(["moderate"], "admin"))
    expect(denied).toBeInstanceOf(Response)
    const response = denied as Response
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: "Forbidden" })
  })

  test("admin is allowed", () => {
    expect(forbiddenUnlessAllowed(hasCapability(["admin"], "admin"))).toBe(true)
  })
})

describe("audit source", () => {
  test("page and GET route exist, admin-only, and log login/logout/delete", () => {
    expect(existsSync(join(root, "app/admin/audit/page.tsx"))).toBe(true)
    expect(existsSync(join(root, "app/api/admin/audit/route.ts"))).toBe(true)

    const page = read("app/admin/audit/page.tsx")
    const api = read("app/api/admin/audit/route.ts")
    const writer = read("lib/admin/audit.ts")
    const auth = read("lib/auth.ts")
    const cms = read("app/api/admin/cms/[id]/route.ts")
    const media = read("app/api/admin/media/route.ts")
    const users = read("app/api/admin/users/route.ts")
    const usersPatch = read("app/api/admin/users/[id]/route.ts")

    expect(page).toContain('checkCapability(session.user.id, "admin")')
    expect(page).toContain("listAuditLogs")
    expect(page).not.toContain('method: "POST"')
    expect(page).not.toContain('method: "PATCH"')
    expect(api).toContain("listAuditLogs")
    expect(api).toContain('requireCapabilityResponse(userId, "admin")')
    expect(api).toContain("export async function GET")
    expect(api).not.toContain("export async function POST")
    expect(api).not.toContain("export async function PATCH")
    expect(api).not.toContain("export async function DELETE")
    expect(read("app/admin/admin-shell.tsx")).toContain('href="/admin/audit"')
    expect(writer).toContain("desc(auditLogs.createdAt)")
    expect(writer).toContain('"login"')
    expect(writer).toContain('"logout"')
    expect(writer).toContain('"invite"')
    expect(writer).toContain("ipAddress")
    expect(writer).toContain("userAgent")
    expect(writer).toContain("writeAuditLogSafe")
    expect(auth).toContain('action: "login"')
    expect(auth).toContain('action: "logout"')
    expect(auth).toContain("writeAuditLogSafe")
    expect(cms).toContain('action: "delete"')
    expect(cms).toContain("export async function DELETE")
    expect(cms).toContain("canHardDeleteCmsEntry")
    expect(media).toContain('action: "delete"')
    expect(users).toContain('action: "invite"')
    expect(usersPatch).toContain('action: "delete"')
    expect(read("lib/db/schema/enums.ts")).toContain('"login"')
    expect(read("docs/API_AUTH_MATRIX.md")).toContain("GET /api/admin/audit")
    expect(read("app/admin/content/[id]/page.tsx")).toContain('entry.status === "draft"')
  })
})

const getSession = mock(async (): Promise<{ user: { id: string } } | null> => null)
const checkCapability = mock(async () => false)

mock.module("@/lib/auth", () => authMockExports({ getSession }))
mock.module("@/lib/auth/capabilities", () => capabilitiesMockExports({ checkCapability }))

const { GET } = await import("@/app/api/admin/audit/route")

describe("GET /api/admin/audit", () => {
  beforeEach(() => {
    getSession.mockReset()
    checkCapability.mockReset()
    getSession.mockImplementation(async () => null)
    checkCapability.mockImplementation(async () => false)
  })

  test("returns 401 without a session", async () => {
    const response = await GET(new Request("http://localhost/api/admin/audit"))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "Unauthorized" })
    expect(checkCapability).not.toHaveBeenCalled()
  })

  test("returns 403 when the session lacks admin", async () => {
    getSession.mockImplementation(async () => ({ user: { id: "mod-1" } }))
    checkCapability.mockImplementation(async () => false)
    const response = await GET(new Request("http://localhost/api/admin/audit"))
    expect(checkCapability).toHaveBeenCalledWith("mod-1", "admin")
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: "Forbidden" })
  })
})
