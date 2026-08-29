process.env.DATABASE_URL ??= "postgresql://ci:ci@localhost:5432/ci"
process.env.AUTH_SECRET ??= "ci-placeholder-secret-minimum-32-characters"

import {
  dbInsert,
  dbInsertValues,
  mockedDb,
  resetSharedDbInsert,
  resetSharedDbTransaction,
  setDbTransaction,
} from "./helpers/mock-db"
import { authMockExports } from "./helpers/mock-auth"
import { capabilitiesMockExports } from "./helpers/mock-capabilities"
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { auditLogs, cmsEntries } from "@/lib/db/schema"
import { isLivePublishedEntry } from "@/lib/cms/live-pure"
import {
  INVALID_PUBLISH_AT_MESSAGE,
  SCHEDULED_PUBLISH_DISABLED_MESSAGE,
  assertPublishAtAllowed,
  datetimeLocalToUtcIso,
  isDueScheduledPublish,
  nextCmsStatusForSave,
  nextPublishAtForSave,
  nextPublishedAtForSave,
  parsePublishAtInput,
  publishedEntriesForPublic,
  scheduledPublishFlipValues,
  utcToDatetimeLocalValue,
} from "@/lib/cms/scheduled-publish-pure"

const root = join(import.meta.dir, "..")

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8")
}

const now = new Date("2026-08-28T12:00:00.000Z")
const minuteAhead = new Date(now.getTime() + 60_000)
const plus61s = new Date(now.getTime() + 61_000)
const past = new Date("2026-08-28T11:00:00.000Z")
const future = new Date("2026-08-28T13:00:00.000Z")

const revalidatePublic = mock((_scope?: unknown) => undefined)
mock.module("@/lib/cache/public-cache", () => ({
  revalidatePublic,
}))

type CmsRow = {
  id: string
  entryType: "page" | "article"
  status: "draft" | "in_review" | "published"
  publishAt: Date | null
  publishedAt: Date | null
}

function row(partial: Partial<CmsRow> & Pick<CmsRow, "id">): CmsRow {
  return {
    entryType: "article",
    status: "draft",
    publishAt: past,
    publishedAt: null,
    ...partial,
  }
}

let dueRows: CmsRow[] = []
let updates: Array<{ table: unknown; values: Record<string, unknown> }> = []
let committedUpdates: Array<{ table: unknown; values: Record<string, unknown> }> = []
const dbSelectForUpdate = mock((_mode?: unknown, _config?: unknown) => undefined)
const rootUpdate = mock(() => {
  throw new Error("update outside transaction")
})

function dueSelectChain() {
  let rows = dueRows.slice()
  const chain = {
    from() {
      return chain
    },
    where() {
      return chain
    },
    orderBy() {
      rows = rows.slice().sort((left, right) => left.id.localeCompare(right.id))
      return chain
    },
    for(mode?: unknown, config?: unknown) {
      dbSelectForUpdate(mode, config)
      return Promise.resolve(rows)
    },
  }
  return chain
}

const dbSelect = mock((_fields?: unknown) => dueSelectChain())
const txUpdate = mock((table: unknown) => ({
  set(values: Record<string, unknown>) {
    const call = { table, values }
    updates.push(call)
    return {
      where() {
        return undefined
      },
    }
  },
}))

function installWorkerDb() {
  Object.assign(mockedDb, {
    select: dbSelect,
    update: rootUpdate,
    insert: dbInsert,
  })
  setDbTransaction(async (fn) => {
    const pending: typeof updates = []
    updates = pending
    const result = await fn({
      select: dbSelect,
      update: txUpdate,
      insert: dbInsert,
    })
    committedUpdates.push(...pending)
    return result
  })
}

const { runScheduledPublishWorker } = await import("@/lib/cms/scheduled-publish")
const { cronPublishResponse } = await import("@/app/api/cron/publish/route")
const { listPublishedEntries } = await import("@/lib/cms/queries")

const getSession = mock(async (): Promise<{ user: { id: string } } | null> => ({
  user: { id: "editor-1" },
}))
const checkCapability = mock(async () => true)

mock.module("@/lib/auth", () => authMockExports({ getSession }))
mock.module("@/lib/auth/capabilities", () => capabilitiesMockExports({ checkCapability }))

let entryRows: Array<Record<string, unknown>> = []
let latestRevisionRows: Array<{ revisionNumber: number }> = []
let listRows: CmsRow[] = []

const draftEntry = {
  id: "entry-1",
  entryType: "article" as const,
  localeId: "en",
  slug: "hello",
  routePath: "/articles/hello",
  title: "Hello",
  excerpt: null,
  body: "<p>Hi</p>",
  heroMediaId: null,
  status: "draft" as const,
  sourceEntryId: null,
  translationsStale: false,
  publishedAt: null,
  publishAt: null,
  createdByUserId: "user-1",
  updatedByUserId: "user-1",
  createdAt: now,
  updatedAt: now,
}

function cmsSelectChain() {
  let table: unknown
  const chain = {
    from(nextTable: unknown) {
      table = nextTable
      return chain
    },
    where() {
      return chain
    },
    leftJoin() {
      return chain
    },
    orderBy() {
      const rows =
        table === cmsEntries && listRows.length > 0
          ? listRows
          : table === cmsEntries
            ? entryRows
            : latestRevisionRows
      return Object.assign(Promise.resolve(rows), chain)
    },
    limit(_n?: number) {
      if (table === cmsEntries) return Promise.resolve(entryRows)
      return Promise.resolve(latestRevisionRows)
    },
  }
  return chain
}

const cmsSelect = mock((_fields?: unknown) => cmsSelectChain())
const cmsUpdate = mock((table: unknown) => ({
  set(values: Record<string, unknown>) {
    updates.push({ table, values })
    return {
      where() {
        return undefined
      },
    }
  },
}))
const cmsDelete = mock((_table: unknown) => ({
  where() {
    return undefined
  },
}))

function installCmsDb() {
  Object.assign(mockedDb, {
    select: cmsSelect,
    update: cmsUpdate,
    delete: cmsDelete,
    insert: dbInsert,
  })
}

const { patchCmsEntryResponse, getCmsEntryResponse } = await import("@/app/api/admin/cms/[id]/route")

function cmsRequest(body: Record<string, unknown>, method = "PATCH") {
  return new Request("http://localhost/api/admin/cms/entry-1", {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body),
  })
}

const cmsContext = { params: Promise.resolve({ id: "entry-1" }) }

const secret = "cron-test-secret"

function cronRequest(headers: HeadersInit = {}) {
  return new Request("http://localhost/api/cron/publish", { headers })
}

describe("scheduled publish pure", () => {
  test("public listing ignores future publish_at even when status is published", () => {
    const live = { status: "published" as const, publishAt: past }
    const scheduled = { status: "published" as const, publishAt: future }
    const draft = { status: "draft" as const, publishAt: past }
    expect(isLivePublishedEntry(live, now)).toBe(true)
    expect(isLivePublishedEntry(scheduled, now)).toBe(false)
    expect(isLivePublishedEntry({ status: "published" }, now)).toBe(true)
    expect(publishedEntriesForPublic([live, scheduled, draft], now)).toEqual([live])
  })

  test("1-minute-ahead schedule is not live until 61s later", () => {
    const scheduled = { status: "published" as const, publishAt: minuteAhead, publishedAt: null }
    const waiting = { status: "draft" as const, publishAt: minuteAhead, publishedAt: null }
    expect(isLivePublishedEntry(scheduled, now)).toBe(false)
    expect(publishedEntriesForPublic([scheduled], now)).toEqual([])
    expect(isDueScheduledPublish(waiting, now)).toBe(false)

    expect(isLivePublishedEntry(scheduled, plus61s)).toBe(true)
    expect(publishedEntriesForPublic([scheduled], plus61s)).toEqual([scheduled])
    expect(isDueScheduledPublish(waiting, plus61s)).toBe(true)
  })

  test("worker due rows need publish_at due and publishedAt null", () => {
    expect(isDueScheduledPublish(row({ id: "a", status: "draft", publishAt: past }), now)).toBe(true)
    expect(isDueScheduledPublish(row({ id: "b", status: "in_review", publishAt: past }), now)).toBe(true)
    expect(
      isDueScheduledPublish(row({ id: "c", status: "published", publishAt: past, publishedAt: null }), now),
    ).toBe(true)
    expect(
      isDueScheduledPublish(
        row({ id: "d", status: "published", publishAt: past, publishedAt: past }),
        now,
      ),
    ).toBe(false)
    expect(
      isDueScheduledPublish(row({ id: "review", status: "in_review", publishAt: past, publishedAt: past }), now),
    ).toBe(false)
    expect(isDueScheduledPublish(row({ id: "e", status: "draft", publishAt: future }), now)).toBe(false)
    expect(isDueScheduledPublish(row({ id: "f", status: "draft", publishAt: null }), now)).toBe(false)
  })

  test("unpublish from published drops a due leftover; scheduled draft keeps it", () => {
    expect(
      nextPublishAtForSave({
        status: "draft",
        previousStatus: "published",
        previousPublishAt: past,
        parsedPublishAt: past,
        now,
      }),
    ).toBeNull()
    expect(
      nextPublishAtForSave({
        status: "draft",
        previousStatus: "published",
        previousPublishAt: future,
        parsedPublishAt: undefined,
        now,
      }),
    ).toEqual(future)
    expect(
      nextPublishAtForSave({
        status: "draft",
        previousStatus: "in_review",
        previousPublishAt: past,
        previousPublishedAt: now,
        parsedPublishAt: past,
        now,
      }),
    ).toBeNull()
    expect(
      nextPublishAtForSave({
        status: "draft",
        previousStatus: "in_review",
        previousPublishAt: past,
        previousPublishedAt: null,
        parsedPublishAt: past,
        now,
      }),
    ).toEqual(past)
    expect(
      nextPublishAtForSave({
        status: "draft",
        previousStatus: "draft",
        previousPublishAt: past,
        previousPublishedAt: null,
        parsedPublishAt: past,
        now,
      }),
    ).toEqual(past)
    expect(
      isDueScheduledPublish({ status: "draft", publishAt: past, publishedAt: null }, now),
    ).toBe(true)
    expect(
      isDueScheduledPublish({ status: "draft", publishAt: null, publishedAt: null }, now),
    ).toBe(false)
  })

  test("future Publish click stays draft or in_review until the worker", () => {
    expect(
      nextCmsStatusForSave({
        requestedStatus: "published",
        previousStatus: "draft",
        publishAt: future,
        now,
      }),
    ).toBe("draft")
    expect(
      nextCmsStatusForSave({
        requestedStatus: "published",
        previousStatus: "in_review",
        publishAt: future,
        now,
      }),
    ).toBe("in_review")
    expect(
      nextCmsStatusForSave({
        requestedStatus: "published",
        previousStatus: "draft",
        publishAt: null,
        now,
      }),
    ).toBe("published")
  })

  test("flip sets published + publishedAt now without renaming publishedAt", () => {
    expect(scheduledPublishFlipValues(now)).toEqual({ status: "published", publishedAt: now })
    expect(nextPublishedAtForSave({ status: "draft", previousPublishedAt: past, publishAt: future, now })).toBeNull()
    expect(
      nextPublishedAtForSave({
        status: "published",
        previousPublishedAt: null,
        publishAt: future,
        now,
      }),
    ).toBeNull()
    expect(
      nextPublishedAtForSave({
        status: "published",
        previousPublishedAt: null,
        publishAt: null,
        now,
      }),
    ).toEqual(now)
  })

  test("datetime-local round-trips; empty clears; invalid does not", () => {
    const iso = "2026-08-29T15:30:00.000Z"
    const local = utcToDatetimeLocalValue(iso)
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    expect(datetimeLocalToUtcIso(local)).toBe(new Date(local).toISOString())
    expect(datetimeLocalToUtcIso("")).toBeNull()
    expect(datetimeLocalToUtcIso("   ")).toBeNull()
    expect(datetimeLocalToUtcIso("nope")).toBeUndefined()
    expect(datetimeLocalToUtcIso("2026-08-28T13:00:00")).toBeUndefined()
    expect(parsePublishAtInput(iso)?.toISOString()).toBe(iso)
    expect(parsePublishAtInput(null)).toBeNull()
    expect(parsePublishAtInput("")).toBeNull()
    expect(parsePublishAtInput(undefined)).toBeUndefined()
    expect(() => parsePublishAtInput("nope")).toThrow(INVALID_PUBLISH_AT_MESSAGE)
    expect(() => parsePublishAtInput("2026-08-28T13:00")).toThrow(INVALID_PUBLISH_AT_MESSAGE)
  })

  test("setting a schedule is rejected when the flag is off", () => {
    expect(() => assertPublishAtAllowed(future, false)).toThrow(SCHEDULED_PUBLISH_DISABLED_MESSAGE)
    expect(() => assertPublishAtAllowed(future, true)).not.toThrow()
    expect(() => assertPublishAtAllowed(null, false)).not.toThrow()
  })
})

describe("runScheduledPublishWorker", () => {
  beforeEach(() => {
    dueRows = [
      row({ id: "b-entry", status: "in_review", publishAt: past }),
      row({ id: "a-entry", status: "draft", publishAt: past }),
      row({ id: "z-future", status: "draft", publishAt: future }),
    ]
    updates = []
    committedUpdates = []
    revalidatePublic.mockReset()
    dbSelectForUpdate.mockReset()
    rootUpdate.mockReset()
    rootUpdate.mockImplementation(() => {
      throw new Error("update outside transaction")
    })
    resetSharedDbInsert()
    dbSelect.mockReset()
    dbSelect.mockImplementation((_fields?: unknown) => dueSelectChain())
    txUpdate.mockReset()
    txUpdate.mockImplementation((table: unknown) => ({
      set(values: Record<string, unknown>) {
        updates.push({ table, values })
        return {
          where() {
            return undefined
          },
        }
      },
    }))
    installWorkerDb()
  })

  afterEach(() => {
    resetSharedDbTransaction()
  })

  test("flips due rows, audits, skips future, and is idempotent on flipped rows", async () => {
    const first = await runScheduledPublishWorker({ now, db: mockedDb })
    expect(first.published).toBe(2)
    expect(first.ids).toEqual(["a-entry", "b-entry"])
    expect(dbSelectForUpdate).toHaveBeenCalledWith("update", { skipLocked: true })
    expect(rootUpdate).not.toHaveBeenCalled()
    expect(updates.every((call) => call.table === cmsEntries)).toBe(true)
    expect(updates.map((call) => call.values)).toEqual([
      { status: "published", publishedAt: now, updatedAt: now },
      { status: "published", publishedAt: now, updatedAt: now },
    ])

    const audits = dbInsertValues.mock.calls
      .map((call) => call[0] as Record<string, unknown>)
      .filter((payload) => payload.entityType === "cms_entry")
    expect(audits).toHaveLength(2)
    expect(dbInsert.mock.calls.some((call) => call[0] === auditLogs)).toBe(true)
    expect(audits[0]).toMatchObject({
      actorUserId: null,
      action: "update",
      entityType: "cms_entry",
      entityId: "a-entry",
      metadata: {
        from: "draft",
        to: "published",
        source: "scheduled_publish",
      },
    })
    expect(revalidatePublic).toHaveBeenCalledWith("pages")
    expect(revalidatePublic).toHaveBeenCalledWith("articles")

    dueRows = [
      row({ id: "a-entry", status: "published", publishAt: past, publishedAt: now }),
      row({ id: "b-entry", status: "published", publishAt: past, publishedAt: now }),
      row({ id: "z-future", status: "draft", publishAt: future }),
    ]
    updates = []
    committedUpdates = []
    resetSharedDbInsert()
    revalidatePublic.mockClear()
    const second = await runScheduledPublishWorker({ now, db: mockedDb })
    expect(second).toEqual({ published: 0, ids: [] })
    expect(updates).toHaveLength(0)
    expect(committedUpdates).toHaveLength(0)
    expect(dbInsertValues).not.toHaveBeenCalled()
    expect(revalidatePublic).not.toHaveBeenCalled()
  })

  test("unpublish of an already-live row is not selected on the next run", async () => {
    dueRows = [
      row({
        id: "was-live",
        status: "draft",
        publishAt: null,
        publishedAt: null,
      }),
    ]
    const result = await runScheduledPublishWorker({ now, db: mockedDb })
    expect(result).toEqual({ published: 0, ids: [] })
    expect(updates).toHaveLength(0)
  })

  test("failed audit does not commit a published row from this run", async () => {
    dbInsertValues.mockImplementation(async () => {
      throw new Error("audit down")
    })
    committedUpdates = []
    setDbTransaction(async (fn) => {
      const pending: typeof updates = []
      updates = pending
      try {
        const result = await fn({
          select: dbSelect,
          update: txUpdate,
          insert: dbInsert,
        })
        committedUpdates.push(...pending)
        return result
      } catch (error) {
        throw error
      }
    })
    await expect(runScheduledPublishWorker({ now, db: mockedDb })).rejects.toThrow("audit down")
    expect(committedUpdates).toHaveLength(0)
    expect(rootUpdate).not.toHaveBeenCalled()
  })

  test("revalidate failure still returns published ids", async () => {
    const logged = spyOn(console, "error").mockImplementation(() => undefined)
    revalidatePublic.mockImplementation(() => {
      throw new Error("tag failed")
    })
    const result = await runScheduledPublishWorker({ now, db: mockedDb })
    expect(result.published).toBe(2)
    logged.mockRestore()
  })
})

describe("GET /api/cron/publish", () => {
  const previousSecret = process.env.CRON_SECRET

  afterEach(() => {
    if (previousSecret === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = previousSecret
  })

  test("flag off returns 404 even with no secret or a wrong secret", async () => {
    process.env.CRON_SECRET = secret
    const run = mock(async () => ({ published: 1, ids: ["x"] }))
    const missing = await cronPublishResponse(cronRequest(), false, run)
    expect(missing.status).toBe(404)
    expect(await missing.json()).toEqual({ error: "Not found" })
    expect(run).not.toHaveBeenCalled()

    const wrong = await cronPublishResponse(
      cronRequest({ authorization: "Bearer other-secret" }),
      false,
      run,
    )
    expect(wrong.status).toBe(404)
    expect(await wrong.json()).toEqual({ error: "Not found" })
    expect(run).not.toHaveBeenCalled()
  })

  test("flag off with a valid secret is still 404 and does not run", async () => {
    process.env.CRON_SECRET = secret
    const run = mock(async () => ({ published: 1, ids: ["x"] }))
    const response = await cronPublishResponse(
      cronRequest({ authorization: `Bearer ${secret}` }),
      false,
      run,
    )
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: "Not found" })
    expect(run).not.toHaveBeenCalled()
  })

  test("missing secret returns 401 when the flag is on", async () => {
    process.env.CRON_SECRET = secret
    const run = mock(async () => ({ published: 1, ids: ["x"] }))
    const response = await cronPublishResponse(cronRequest(), true, run)
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "Unauthorized" })
    expect(run).not.toHaveBeenCalled()
  })

  test("authorized run publishes due rows", async () => {
    process.env.CRON_SECRET = secret
    const run = mock(async () => ({ published: 1, ids: ["entry-1"] }))
    const response = await cronPublishResponse(
      cronRequest({ authorization: `Bearer ${secret}` }),
      true,
      run,
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, published: 1 })
    expect(run).toHaveBeenCalledTimes(1)
  })
})

describe("PATCH /api/admin/cms/:id publishAt", () => {
  beforeEach(() => {
    updates = []
    entryRows = [{ ...draftEntry }]
    latestRevisionRows = [{ revisionNumber: 1 }]
    getSession.mockReset()
    checkCapability.mockReset()
    revalidatePublic.mockReset()
    revalidatePublic.mockImplementation(() => undefined)
    getSession.mockImplementation(async () => ({ user: { id: "editor-1" } }))
    checkCapability.mockImplementation(async () => true)
    resetSharedDbInsert()
    cmsSelect.mockReset()
    cmsSelect.mockImplementation((_fields?: unknown) => cmsSelectChain())
    cmsUpdate.mockReset()
    cmsUpdate.mockImplementation((table: unknown) => ({
      set(values: Record<string, unknown>) {
        updates.push({ table, values })
        return { where() { return undefined } }
      },
    }))
    installCmsDb()
  })

  test("rejects setting publishAt when scheduled_publish is off", async () => {
    const response = await patchCmsEntryResponse(
      cmsRequest({ publishAt: future.toISOString() }),
      cmsContext,
      false,
      now,
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: SCHEDULED_PUBLISH_DISABLED_MESSAGE })
    expect(updates).toHaveLength(0)
  })

  test("stores UTC publishAt when the flag is on and leaves status unpublished", async () => {
    const response = await patchCmsEntryResponse(
      cmsRequest({ publishAt: future.toISOString(), status: "draft" }),
      cmsContext,
      true,
      now,
    )
    expect(response.status).toBe(200)
    const entryUpdate = updates.find((call) => call.table === cmsEntries)
    expect(entryUpdate?.values.publishAt).toEqual(future)
    expect(entryUpdate?.values.status).toBe("draft")
    expect(entryUpdate?.values.publishedAt).toBeNull()
  })

  test("Publish with a future publishAt stays draft until the worker", async () => {
    const response = await patchCmsEntryResponse(
      cmsRequest({ publishAt: future.toISOString(), status: "published" }),
      cmsContext,
      true,
      now,
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.status).toBe("draft")
    const entryUpdate = updates.find((call) => call.table === cmsEntries)
    expect(entryUpdate?.values.status).toBe("draft")
    expect(entryUpdate?.values.publishedAt).toBeNull()
    expect(entryUpdate?.values.publishAt).toEqual(future)
  })

  test("null and empty publishAt persist null; invalid strings are 422", async () => {
    const cleared = await patchCmsEntryResponse(
      cmsRequest({ publishAt: null }),
      cmsContext,
      true,
      now,
    )
    expect(cleared.status).toBe(200)
    expect(updates[0]?.values.publishAt).toBeNull()

    updates = []
    const empty = await patchCmsEntryResponse(cmsRequest({ publishAt: "" }), cmsContext, true, now)
    expect(empty.status).toBe(200)
    expect(updates[0]?.values.publishAt).toBeNull()

    updates = []
    const invalid = await patchCmsEntryResponse(cmsRequest({ publishAt: "nope" }), cmsContext, true, now)
    expect(invalid.status).toBe(422)
    expect(await invalid.json()).toEqual({ error: INVALID_PUBLISH_AT_MESSAGE })
    expect(updates).toHaveLength(0)

    const naive = await patchCmsEntryResponse(
      cmsRequest({ publishAt: "2026-08-28T13:00" }),
      cmsContext,
      true,
      now,
    )
    expect(naive.status).toBe(422)
  })

  test("unpublish of a live row with leftover due ISO clears publishAt", async () => {
    entryRows = [
      {
        ...draftEntry,
        status: "published",
        publishedAt: now,
        publishAt: past,
      },
    ]
    const response = await patchCmsEntryResponse(
      cmsRequest({ status: "draft", publishAt: past.toISOString() }),
      cmsContext,
      true,
      now,
    )
    expect(response.status).toBe(200)
    const entryUpdate = updates.find((call) => call.table === cmsEntries)
    expect(entryUpdate?.values.status).toBe("draft")
    expect(entryUpdate?.values.publishAt).toBeNull()
    expect(entryUpdate?.values.publishedAt).toBeNull()

    dueRows = [
      row({
        id: "entry-1",
        status: "draft",
        publishAt: null,
        publishedAt: null,
      }),
    ]
    updates = []
    committedUpdates = []
    installWorkerDb()
    const worker = await runScheduledPublishWorker({ now, db: mockedDb })
    expect(worker).toEqual({ published: 0, ids: [] })
  })

  test("live then in_review then draft with leftover due ISO clears publishAt", async () => {
    entryRows = [
      {
        ...draftEntry,
        status: "published",
        publishedAt: now,
        publishAt: past,
      },
    ]
    const toReview = await patchCmsEntryResponse(
      cmsRequest({ status: "in_review", publishAt: past.toISOString() }),
      cmsContext,
      true,
      now,
    )
    expect(toReview.status).toBe(200)
    const reviewUpdate = updates.find((call) => call.table === cmsEntries)
    expect(reviewUpdate?.values.status).toBe("in_review")
    expect(reviewUpdate?.values.publishAt).toEqual(past)
    expect(reviewUpdate?.values.publishedAt).toEqual(now)

    entryRows = [
      {
        ...draftEntry,
        status: "in_review",
        publishedAt: now,
        publishAt: past,
      },
    ]
    updates = []
    const toDraft = await patchCmsEntryResponse(
      cmsRequest({ status: "draft", publishAt: past.toISOString() }),
      cmsContext,
      true,
      now,
    )
    expect(toDraft.status).toBe(200)
    const draftUpdate = updates.find((call) => call.table === cmsEntries)
    expect(draftUpdate?.values.status).toBe("draft")
    expect(draftUpdate?.values.publishAt).toBeNull()
    expect(draftUpdate?.values.publishedAt).toBeNull()

    dueRows = [
      row({
        id: "entry-1",
        status: "draft",
        publishAt: null,
        publishedAt: null,
      }),
    ]
    updates = []
    committedUpdates = []
    installWorkerDb()
    const worker = await runScheduledPublishWorker({ now, db: mockedDb })
    expect(worker).toEqual({ published: 0, ids: [] })
  })

  test("saving a scheduled draft with the same due ISO keeps publishAt due", async () => {
    entryRows = [
      {
        ...draftEntry,
        status: "draft",
        publishedAt: null,
        publishAt: past,
      },
    ]
    const response = await patchCmsEntryResponse(
      cmsRequest({ status: "draft", publishAt: past.toISOString() }),
      cmsContext,
      true,
      now,
    )
    expect(response.status).toBe(200)
    const entryUpdate = updates.find((call) => call.table === cmsEntries)
    expect(entryUpdate?.values.status).toBe("draft")
    expect(entryUpdate?.values.publishAt).toEqual(past)
    expect(entryUpdate?.values.publishedAt).toBeNull()
    expect(
      isDueScheduledPublish(
        {
          status: "draft",
          publishAt: entryUpdate?.values.publishAt as Date,
          publishedAt: entryUpdate?.values.publishedAt as Date | null,
        },
        now,
      ),
    ).toBe(true)
  })

  test("GET includes scheduledPublishEnabled true and false", async () => {
    const on = await getCmsEntryResponse(cmsRequest({}, "GET"), cmsContext, true)
    expect(on.status).toBe(200)
    expect(await on.json()).toMatchObject({ scheduledPublishEnabled: true })
    const off = await getCmsEntryResponse(cmsRequest({}, "GET"), cmsContext, false)
    expect(off.status).toBe(200)
    expect(await off.json()).toMatchObject({ scheduledPublishEnabled: false })
  })
})

describe("listPublishedEntries live filter", () => {
  test("returns only published rows that are live now", async () => {
    listRows = [
      row({ id: "live", status: "published", publishAt: past, publishedAt: past }),
      row({
        id: "future",
        status: "published",
        publishAt: new Date("2099-01-01T00:00:00.000Z"),
        publishedAt: null,
      }),
      row({ id: "draft", status: "draft", publishAt: past, publishedAt: null }),
    ]
    Object.assign(mockedDb, {
      select: mock((_fields?: unknown) => cmsSelectChain()),
    })
    const listed = await listPublishedEntries("article")
    expect(listed.map((entry) => entry.id)).toEqual(["live"])
  })
})

describe("scheduled publish source contracts", () => {
  test("sitemap uses listPublishedEntries for CMS URLs", () => {
    const sitemap = read("app/sitemap.ts")
    expect(sitemap).toContain('from "@/lib/cms/queries"')
    expect(sitemap).toContain("listPublishedEntries")
    expect(sitemap).not.toContain("getCmsEntryForPreview")
    expect(sitemap).not.toContain("/admin/preview")
  })

  test("admin picker is hidden unless scheduledPublishEnabled", () => {
    const edit = read("app/admin/content/[id]/page.tsx")
    expect(edit).toContain("scheduledPublishEnabled")
    expect(edit).toContain('type="datetime-local"')
    expect(edit).toContain("utcToDatetimeLocalValue")
    expect(edit).toContain("datetimeLocalToUtcIso")
    expect(edit).toContain("Stored as UTC")
    expect(edit).not.toContain('"use server"')
  })

  test("proxy does not 404 CMS or scheduled_publish", () => {
    const proxy = read("proxy.ts")
    expect(proxy).not.toContain("scheduled_publish")
    expect(proxy).not.toContain("/api/admin/cms")
    expect(proxy).not.toContain('isEnabled("scheduled_publish")')
    expect(proxy).toContain("isCronApiPath")
  })

  test("vercel.json is Hobby-safe daily cron on /api/cron/publish", () => {
    const parsed = JSON.parse(read("vercel.json")) as {
      crons: Array<{ path: string; schedule: string }>
    }
    expect(parsed.crons).toEqual([{ path: "/api/cron/publish", schedule: "0 0 * * *" }])
    expect(existsSync(join(root, "app/api/cron/publish/route.ts"))).toBe(true)
    expect(existsSync(join(root, "app/api/cron/publish-scheduled/route.ts"))).toBe(false)
  })

  test("migration adds publish_at and an index without renaming published_at", () => {
    const sql = read("drizzle/0009_cms_publish_at.sql")
    expect(sql).toContain('ALTER TABLE "cms_entries" ADD COLUMN "publish_at" timestamp with time zone')
    expect(sql).toContain('CREATE INDEX "idx_cms_entries_publish_at"')
    expect(sql).not.toContain("published_at")
    expect(sql).not.toContain("RENAME")
    expect(read("lib/db/schema/cms-entries.ts")).toContain('publishedAt: timestamp("published_at")')
  })
})
