process.env.DATABASE_URL ??= "postgresql://ci:ci@localhost:5432/ci"
process.env.AUTH_SECRET ??= "ci-placeholder-secret-minimum-32-characters"

import { beforeEach, describe, expect, mock, test } from "bun:test"

const values = mock(async (_row: unknown) => undefined)
const insert = mock((_table: unknown) => ({ values }))

mock.module("@/lib/db", () => ({
  db: { insert },
}))

const { writeAuditLog, writeAuditLogSafe } = await import("@/lib/admin/audit")

describe("writeAuditLogSafe", () => {
  beforeEach(() => {
    values.mockReset()
    insert.mockReset()
    insert.mockImplementation((_table: unknown) => ({ values }))
    values.mockImplementation(async () => undefined)
  })

  test("inserts login rows with actor and action", async () => {
    await writeAuditLog({
      actorUserId: "user-1",
      action: "login",
      entityType: "user",
      entityId: "user-1",
      ipAddress: "203.0.113.9",
      userAgent: "AuditTest/1.0",
    })
    expect(insert).toHaveBeenCalled()
    expect(values).toHaveBeenCalled()
    const row = values.mock.calls[0]?.[0] as Record<string, unknown>
    expect(row.actorUserId).toBe("user-1")
    expect(row.action).toBe("login")
    expect(row.entityType).toBe("user")
    expect(row.entityId).toBe("user-1")
    expect(row.ipAddress).toBe("203.0.113.9")
    expect(row.userAgent).toBe("AuditTest/1.0")
  })

  test("swallows insert failures so login can continue", async () => {
    values.mockImplementation(async () => {
      throw new Error("audit_logs unavailable")
    })
    const error = mock(() => undefined)
    const original = console.error
    console.error = error
    try {
      await expect(
        writeAuditLogSafe({
          actorUserId: "user-1",
          action: "login",
          entityType: "user",
          entityId: "user-1",
        }),
      ).resolves.toBeUndefined()
    } finally {
      console.error = original
    }
    expect(error).toHaveBeenCalled()
  })

  test("writeAuditLog still surfaces insert failures to callers that await it", async () => {
    values.mockImplementation(async () => {
      throw new Error("audit_logs unavailable")
    })
    await expect(
      writeAuditLog({
        actorUserId: "user-1",
        action: "logout",
        entityType: "user",
        entityId: "user-1",
      }),
    ).rejects.toThrow("audit_logs unavailable")
  })
})
