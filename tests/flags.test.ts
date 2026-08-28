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
import {
  FLAG_CATALOG,
  FLAG_KEYS,
  OPTIONAL_FLAG_KEYS,
  PLATFORM_FLAG_KEYS,
} from "@/lib/flags/catalog"
import { featureEnvName, isFeatureHardOff, requiredEnvFor } from "@/lib/flags/env"

const { isEnabled, resolveEnabled } = await import("@/lib/flags/resolve")
const { setFeatureFlag } = await import("@/lib/flags/mutate")

const stripeKeys = {
  STRIPE_SECRET_KEY: "sk_test",
  STRIPE_WEBHOOK_SECRET: "whsec",
}
const oauthKeys = {
  GOOGLE_CLIENT_ID: "id",
  GOOGLE_CLIENT_SECRET: "secret",
}

type FlagRow = { enabled: boolean; config: Record<string, unknown> }

const dbSelectLimit = mock(async (): Promise<FlagRow[]> => [])
const dbSelectForUpdate = mock((_mode?: unknown) => undefined)
const dbSelect = mock(() => ({
  from: () => ({
    where: () => ({
      limit: limitWithForUpdate,
    }),
  }),
}))

function limitWithForUpdate(_n?: unknown) {
  const pending = Promise.resolve(dbSelectLimit())
  return Object.assign(pending, {
    for: (mode?: unknown) => {
      dbSelectForUpdate(mode)
      return pending
    },
  })
}

function installFlagSelect(rows: FlagRow[] = []) {
  dbSelectLimit.mockReset()
  dbSelectLimit.mockImplementation(async () => rows)
  dbSelectForUpdate.mockReset()
  dbSelectForUpdate.mockImplementation((_mode?: unknown) => undefined)
  dbSelect.mockReset()
  dbSelect.mockImplementation(() => ({
    from: () => ({
      where: () => ({
        limit: limitWithForUpdate,
      }),
    }),
  }))
  Object.assign(mockedDb, { select: dbSelect })
}

describe("feature flag catalog", () => {
  test("platform keys default on and optional keys default off", () => {
    expect([...PLATFORM_FLAG_KEYS]).toEqual([
      "auth",
      "admin",
      "cms",
      "media",
      "contact",
      "seo",
      "analytics",
      "theme",
    ])
    expect([...OPTIONAL_FLAG_KEYS]).toEqual([
      "site_gate",
      "waitlist",
      "stripe",
      "galleries",
      "scheduled_publish",
      "oauth",
      "cron",
    ])
    expect(FLAG_KEYS).not.toContain("rbac")
    expect(Object.hasOwn(FLAG_CATALOG, "rbac")).toBe(false)

    for (const key of PLATFORM_FLAG_KEYS) {
      expect(FLAG_CATALOG[key].platform).toBe(true)
      expect(FLAG_CATALOG[key].defaultEnabled).toBe(true)
      expect(FLAG_CATALOG[key].key).toBe(key)
    }
    for (const key of OPTIONAL_FLAG_KEYS) {
      expect(FLAG_CATALOG[key].platform).toBe(false)
      expect(FLAG_CATALOG[key].defaultEnabled).toBe(false)
      expect(FLAG_CATALOG[key].key).toBe(key)
    }

    expect(FLAG_CATALOG.stripe.requiresEnv).toEqual(["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"])
    expect(FLAG_CATALOG.oauth.requiresEnv).toEqual(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"])
    expect(FLAG_CATALOG.cron.requiresEnv).toEqual(["CRON_SECRET"])
    expect(FLAG_CATALOG.scheduled_publish.dependsOn).toEqual(["cron"])
    expect(FLAG_CATALOG.galleries.requiresEnv).toEqual([])
  })
})

describe("isEnabled resolution", () => {
  afterEach(() => {
    resetSharedDbInsert()
    resetSharedDbTransaction()
    delete (mockedDb as { select?: unknown }).select
    dbSelectLimit.mockReset()
    dbSelectForUpdate.mockReset()
    dbSelect.mockReset()
  })

  test("unknown key is off", async () => {
    expect(await isEnabled("rbac", { env: {}, dbEnabled: true })).toBe(false)
    expect(await isEnabled("not_a_flag", { env: {}, dbEnabled: true })).toBe(false)
    expect(resolveEnabled("rbac", { env: {}, dbEnabled: true })).toBe(false)
  })

  test("optional flags default off when no DB row", async () => {
    expect(await isEnabled("waitlist", { env: {}, dbEnabled: null })).toBe(false)
    expect(await isEnabled("site_gate", { env: {}, dbEnabled: null })).toBe(false)
    expect(await isEnabled("stripe", { env: {}, dbEnabled: null })).toBe(false)
    expect(await isEnabled("galleries", { env: {}, dbEnabled: null })).toBe(false)
    expect(await isEnabled("scheduled_publish", { env: {}, dbEnabled: null })).toBe(false)
    expect(await isEnabled("oauth", { env: {}, dbEnabled: null })).toBe(false)
    expect(await isEnabled("cron", { env: {}, dbEnabled: null })).toBe(false)
  })

  test("key-backed flags stay default-off when required env is present and no DB row", async () => {
    expect(await isEnabled("stripe", { env: stripeKeys, dbEnabled: null })).toBe(false)
    expect(await isEnabled("oauth", { env: oauthKeys, dbEnabled: null })).toBe(false)
    expect(await isEnabled("cron", { env: { CRON_SECRET: "cron" }, dbEnabled: null })).toBe(false)
  })

  test("DB on enables an optional flag without extra keys", async () => {
    expect(await isEnabled("waitlist", { env: {}, dbEnabled: true })).toBe(true)
    expect(await isEnabled("waitlist", { env: {}, dbEnabled: false })).toBe(false)
  })

  test("dependsOn is metadata only: scheduled_publish DB-on does not require cron", async () => {
    expect(await isEnabled("scheduled_publish", { env: {}, dbEnabled: true })).toBe(true)
    expect(await isEnabled("cron", { env: {}, dbEnabled: true })).toBe(false)
  })

  test("Doppler FEATURE_<KEY>=0 hard-off beats a DB on row", async () => {
    expect(
      await isEnabled("waitlist", {
        env: { FEATURE_WAITLIST: "0" },
        dbEnabled: true,
      }),
    ).toBe(false)
    expect(featureEnvName("scheduled_publish")).toBe("FEATURE_SCHEDULED_PUBLISH")
    expect(isFeatureHardOff("waitlist", { FEATURE_WAITLIST: "0" })).toBe(true)
    expect(isFeatureHardOff("waitlist", { FEATURE_WAITLIST: "1" })).toBe(false)
  })

  test("non-exact-0 FEATURE_ values are not a kill switch and do not enable", async () => {
    for (const value of ["1", "false", " 0", "", "00"]) {
      expect(
        await isEnabled("waitlist", { env: { FEATURE_WAITLIST: value }, dbEnabled: true }),
      ).toBe(true)
      expect(
        await isEnabled("waitlist", { env: { FEATURE_WAITLIST: value }, dbEnabled: null }),
      ).toBe(false)
      expect(await isEnabled("auth", { env: { FEATURE_AUTH: value } })).toBe(true)
    }
    expect(await isEnabled("auth", { env: { FEATURE_AUTH: "1" } })).toBe(true)
  })

  test("sibling FEATURE_* names do not kill the wrong flag", async () => {
    expect(
      await isEnabled("waitlist", {
        env: { FEATURE_WAIT: "0", FEATURE_SITE_GATE: "0" },
        dbEnabled: true,
      }),
    ).toBe(true)
    expect(
      await isEnabled("site_gate", {
        env: { FEATURE_SITE_GATE: "0" },
        dbEnabled: true,
      }),
    ).toBe(false)
    expect(
      await isEnabled("waitlist", {
        env: { FEATURE_WAITLIST: "0" },
        dbEnabled: true,
      }),
    ).toBe(false)
  })

  test("missing keys keep stripe, oauth, and cron dark even if DB is on", async () => {
    expect(await isEnabled("stripe", { env: {}, dbEnabled: true })).toBe(false)
    expect(
      await isEnabled("stripe", {
        env: { STRIPE_SECRET_KEY: "sk_test" },
        dbEnabled: true,
      }),
    ).toBe(false)
    expect(await isEnabled("stripe", { env: stripeKeys, dbEnabled: true })).toBe(true)
    expect(await isEnabled("oauth", { env: {}, dbEnabled: true })).toBe(false)
    expect(await isEnabled("oauth", { env: oauthKeys, dbEnabled: true })).toBe(true)
    expect(await isEnabled("cron", { env: {}, dbEnabled: true })).toBe(false)
    expect(await isEnabled("cron", { env: { CRON_SECRET: "cron" }, dbEnabled: true })).toBe(true)
    expect(
      await isEnabled("stripe", {
        env: { FEATURE_STRIPE: "0", ...stripeKeys },
        dbEnabled: true,
      }),
    ).toBe(false)
  })

  test("empty or whitespace required env stays missing", async () => {
    expect(
      await isEnabled("stripe", {
        env: { STRIPE_SECRET_KEY: "  ", STRIPE_WEBHOOK_SECRET: "whsec" },
        dbEnabled: true,
      }),
    ).toBe(false)
    expect(
      await isEnabled("oauth", {
        env: { GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "" },
        dbEnabled: true,
      }),
    ).toBe(false)
    expect(
      await isEnabled("galleries", {
        env: { VERCEL_ENV: "preview", BLOB_READ_WRITE_TOKEN: "   " },
        dbEnabled: true,
      }),
    ).toBe(false)
  })

  test("galleries stay dark on Vercel preview/production without blob token", async () => {
    expect(await isEnabled("galleries", { env: {}, dbEnabled: true })).toBe(true)
    expect(
      await isEnabled("galleries", {
        env: { VERCEL_ENV: "development" },
        dbEnabled: true,
      }),
    ).toBe(true)
    expect(
      await isEnabled("galleries", {
        env: { VERCEL_ENV: "preview" },
        dbEnabled: true,
      }),
    ).toBe(false)
    expect(
      await isEnabled("galleries", {
        env: { VERCEL_ENV: "production" },
        dbEnabled: true,
      }),
    ).toBe(false)
    expect(
      await isEnabled("galleries", {
        env: { VERCEL_ENV: "preview", BLOB_READ_WRITE_TOKEN: "blob" },
        dbEnabled: true,
      }),
    ).toBe(true)
    expect(requiredEnvFor(FLAG_CATALOG.galleries, { VERCEL_ENV: "preview" })).toEqual([
      "BLOB_READ_WRITE_TOKEN",
    ])
    expect(requiredEnvFor(FLAG_CATALOG.galleries, {})).toEqual([])
  })

  test("platform keys stay on even if DB says off; Doppler 0 still kills them", async () => {
    expect(await isEnabled("auth", { env: {}, dbEnabled: false })).toBe(true)
    expect(await isEnabled("admin", { env: {}, dbEnabled: null })).toBe(true)
    expect(await isEnabled("theme", { env: {}, dbEnabled: false })).toBe(true)
    expect(await isEnabled("analytics", { env: {}, dbEnabled: false })).toBe(true)
    expect(await isEnabled("auth", { env: { FEATURE_AUTH: "0" }, dbEnabled: true })).toBe(false)
  })

  test("omitting dbEnabled reads select: empty is off, row on is on", async () => {
    installFlagSelect([])
    expect(await isEnabled("waitlist", { env: {} })).toBe(false)
    expect(dbSelect).toHaveBeenCalled()

    installFlagSelect([{ enabled: true, config: {} }])
    expect(await isEnabled("waitlist", { env: {} })).toBe(true)
  })

  test("Doppler hard-off skips DB and stays false if select would throw", async () => {
    installFlagSelect()
    dbSelectLimit.mockImplementation(async () => {
      throw new Error("neon unavailable")
    })
    expect(
      await isEnabled("waitlist", { env: { FEATURE_WAITLIST: "0" } }),
    ).toBe(false)
    expect(dbSelect).not.toHaveBeenCalled()
  })

  test("platform keys skip DB select", async () => {
    installFlagSelect()
    dbSelectLimit.mockImplementation(async () => {
      throw new Error("neon unavailable")
    })
    expect(await isEnabled("auth", { env: {} })).toBe(true)
    expect(dbSelect).not.toHaveBeenCalled()
  })
})

describe("setFeatureFlag", () => {
  let selectRows: FlagRow[] = []
  const persisted: unknown[] = []

  beforeEach(() => {
    resetSharedDbInsert()
    persisted.length = 0
    selectRows = []
    installFlagSelect()
    dbSelectLimit.mockImplementation(async () => selectRows)
    dbInsertValues.mockImplementation(async (row: unknown) => {
      persisted.push(row)
    })
    setDbTransaction(async (fn) => {
      const start = persisted.length
      try {
        return await fn({
          select: dbSelect,
          insert: dbInsert,
        })
      } catch (error) {
        persisted.length = start
        throw error
      }
    })
  })

  afterEach(() => {
    resetSharedDbInsert()
    resetSharedDbTransaction()
    delete (mockedDb as { select?: unknown }).select
  })

  test("inserts a new optional flag and writes a create audit", async () => {
    const result = await setFeatureFlag({
      key: "waitlist",
      enabled: true,
      actorUserId: "user-1",
    })
    expect(result).toEqual({ key: "waitlist", enabled: true, config: {} })
    expect(dbSelectForUpdate).toHaveBeenCalledWith("update")
    expect(dbInsertOnConflictDoUpdate).toHaveBeenCalled()
    expect(dbInsertValues).toHaveBeenCalledTimes(2)
    const flagRow = dbInsertValues.mock.calls[0]?.[0] as Record<string, unknown>
    const auditRow = dbInsertValues.mock.calls[1]?.[0] as Record<string, unknown>
    expect(flagRow.key).toBe("waitlist")
    expect(flagRow.enabled).toBe(true)
    expect(auditRow.action).toBe("create")
    expect(auditRow.entityType).toBe("feature_flag")
    expect(auditRow.entityId).toBe("waitlist")
    expect(auditRow.metadata).toEqual({
      key: "waitlist",
      old: false,
      new: true,
      config: { old: {}, new: {} },
    })
    expect(auditRow.actorUserId).toBe("user-1")
  })

  test("updates an existing row and audits old versus new including config", async () => {
    selectRows = [{ enabled: false, config: { note: "kept" } }]
    await setFeatureFlag({
      key: "waitlist",
      enabled: true,
      actorUserId: "user-2",
    })
    expect(dbInsertOnConflictDoUpdate).toHaveBeenCalled()
    const auditRow = dbInsertValues.mock.calls[1]?.[0] as Record<string, unknown>
    expect(auditRow.action).toBe("update")
    expect(auditRow.metadata).toEqual({
      key: "waitlist",
      old: false,
      new: true,
      config: { old: { note: "kept" }, new: { note: "kept" } },
    })
  })

  test("off-toggle audits old true to new false", async () => {
    selectRows = [{ enabled: true, config: {} }]
    await setFeatureFlag({
      key: "waitlist",
      enabled: false,
      actorUserId: "user-3",
    })
    const auditRow = dbInsertValues.mock.calls[1]?.[0] as Record<string, unknown>
    expect(auditRow.action).toBe("update")
    expect(auditRow.metadata).toEqual({
      key: "waitlist",
      old: true,
      new: false,
      config: { old: {}, new: {} },
    })
  })

  test("skips write and audit when enabled and config are unchanged", async () => {
    selectRows = [{ enabled: true, config: { note: "same", extra: 1 } }]
    const result = await setFeatureFlag({
      key: "waitlist",
      enabled: true,
      config: { extra: 1, note: "same" },
    })
    expect(result).toEqual({
      key: "waitlist",
      enabled: true,
      config: { note: "same", extra: 1 },
    })
    expect(dbSelectForUpdate).toHaveBeenCalledWith("update")
    expect(dbInsertValues).not.toHaveBeenCalled()
    expect(dbInsertOnConflictDoUpdate).not.toHaveBeenCalled()
  })

  test("persists under Doppler hard-off; isEnabled stays false", async () => {
    await setFeatureFlag({ key: "waitlist", enabled: true })
    expect(dbInsertOnConflictDoUpdate).toHaveBeenCalled()
    expect(
      await isEnabled("waitlist", { env: { FEATURE_WAITLIST: "0" }, dbEnabled: true }),
    ).toBe(false)
  })

  test("audit insert reject rolls back the flag write", async () => {
    dbInsertValues.mockImplementation(async (row: unknown) => {
      persisted.push(row)
      if (row && typeof row === "object" && "action" in row) {
        throw new Error("audit_logs unavailable")
      }
    })
    await expect(setFeatureFlag({ key: "waitlist", enabled: true })).rejects.toThrow(
      "audit_logs unavailable",
    )
    expect(persisted).toEqual([])
  })

  test("rejects unknown keys without touching the database", async () => {
    await expect(setFeatureFlag({ key: "rbac", enabled: true })).rejects.toThrow("Unknown feature flag")
    expect(dbSelect).not.toHaveBeenCalled()
    expect(dbInsertValues).not.toHaveBeenCalled()
    expect(dbInsert).not.toHaveBeenCalled()
  })

  test("rejects turning platform flags off", async () => {
    await expect(setFeatureFlag({ key: "auth", enabled: false })).rejects.toThrow(
      "Platform feature auth cannot be turned off",
    )
    expect(dbInsertValues).not.toHaveBeenCalled()
  })
})
