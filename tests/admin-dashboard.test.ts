import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  formatAuditSummary,
  formatDashboardDate,
  truncateMessage,
} from "@/lib/admin/dashboard-pure"

const root = join(import.meta.dir, "..")

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8")
}

describe("dashboard formatters", () => {
  test("truncateMessage keeps short copy and ellipsizes long copy", () => {
    expect(truncateMessage("  hello   world  ")).toBe("hello world")
    expect(truncateMessage("a".repeat(120))).toHaveLength(120)
    expect(truncateMessage("a".repeat(121))).toBe(`${"a".repeat(119)}…`)
  })

  test("formatDashboardDate renders UTC timestamps", () => {
    expect(formatDashboardDate("2026-08-25T13:06:02.955Z")).toBe("2026-08-25 13:06:02 UTC")
    expect(formatDashboardDate("not-a-date")).toBe("")
  })

  test("formatAuditSummary includes actor and entity", () => {
    expect(
      formatAuditSummary({
        action: "create",
        entityType: "cms_entry",
        entityId: "abc",
        actorEmail: "admin@example.com",
      }),
    ).toBe("create cms_entry abc · admin@example.com")
    expect(
      formatAuditSummary({
        action: "login",
        entityType: null,
        entityId: null,
        actorEmail: null,
      }),
    ).toBe("login · system")
  })

  test("formatAuditSummary omits user UUIDs when actor email is present", () => {
    expect(
      formatAuditSummary({
        action: "login",
        entityType: "user",
        entityId: "3be0c8e6-033d-4e1f-be5f-0e918c2a0118",
        actorEmail: "admin@example.com",
      }),
    ).toBe("login · admin@example.com")
    expect(
      formatAuditSummary({
        action: "logout",
        entityType: "user",
        entityId: "3be0c8e6-033d-4e1f-be5f-0e918c2a0118",
        actorEmail: "admin@example.com",
      }),
    ).toBe("logout · admin@example.com")
    expect(
      formatAuditSummary({
        action: "login",
        entityType: "user",
        entityId: "3be0c8e6-033d-4e1f-be5f-0e918c2a0118",
        actorEmail: null,
      }),
    ).toBe("login user 3be0c8e6-033d-4e1f-be5f-0e918c2a0118 · system")
  })
})

describe("admin dashboard source", () => {
  test("admin home no longer contains stub copy", () => {
    const page = read("app/admin/page.tsx")
    expect(page).not.toContain("Add your admin functionality here")
    expect(page).toContain("listUnpublishedCmsEntries")
    expect(page).toContain("listContactInquiries")
    expect(page).toContain("listRecentAuditLogs")
    expect(page).toContain("/admin/content/")
    expect(page).toContain("getSession")
    expect(page).not.toContain("next-auth")
  })

  test("contact and audit widgets require admin capability", () => {
    const page = read("app/admin/page.tsx")
    expect(page).toContain('hasCapability(caps, "moderate")')
    expect(page).toContain('hasCapability(caps, "admin")')
    expect(page).toContain("canAdmin ? listContactInquiries")
    expect(page).toContain("canAdmin ? listRecentAuditLogs")
    expect(page).toContain("canModerate ? listUnpublishedCmsEntries")
  })

  test("dashboard queries list drafts, inquiries, and audit without failing empty audit", () => {
    const queries = read("lib/admin/dashboard.ts")
    expect(queries).toContain('inArray(cmsEntries.status, ["draft", "in_review"])')
    expect(queries).toContain("contactInquiries")
    expect(queries).toContain("waitlistEntries")
    expect(queries).toContain("auditLogs")
    expect(queries).toContain("catch")
    expect(queries).toContain("return []")
    expect(queries).not.toContain("ipAddress")
    expect(queries).not.toContain("readAt")
  })
})
