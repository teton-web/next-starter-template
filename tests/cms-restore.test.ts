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
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { auditLogs, cmsEntries, cmsRevisions, mediaUsages } from "@/lib/db/schema"
import {
  cmsRevisionSnapshotFromDraft,
  nextCmsRevisionNumber,
  parseCmsRevisionSnapshot,
  workingDraftFromRevision,
} from "@/lib/cms/restore-pure"

const root = join(import.meta.dir, "..")

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8")
}

const publishedAt = new Date("2026-01-15T12:00:00.000Z")

const publishedEntry = {
  id: "entry-1",
  entryType: "page" as const,
  localeId: "en",
  slug: "current",
  routePath: "/current",
  title: "Current title",
  excerpt: "current excerpt",
  body: "<p>current</p>",
  heroMediaId: "hero-new",
  status: "published" as const,
  sourceEntryId: null,
  translationsStale: false,
  publishedAt,
  createdByUserId: "user-1",
  updatedByUserId: "user-1",
  createdAt: publishedAt,
  updatedAt: publishedAt,
}

const firstRevision = {
  id: "rev-1",
  entryId: "entry-1",
  revisionNumber: 1,
  snapshot: {
    title: "Original title",
    slug: "original",
    excerpt: "original excerpt",
    body: "<p>original</p>",
    heroMediaId: "hero-old",
    status: "published",
    publishedAt: "2026-01-01T00:00:00.000Z",
  },
  createdByUserId: "user-1",
  createdAt: publishedAt,
}

describe("cms restore pure", () => {
  test("copies title/slug/excerpt/body/hero and always drafts without using publishedAt", () => {
    const draft = workingDraftFromRevision(publishedEntry, parseCmsRevisionSnapshot(firstRevision.snapshot))
    expect(draft).toEqual({
      title: "Original title",
      slug: "original",
      excerpt: "original excerpt",
      body: "<p>original</p>",
      heroMediaId: "hero-old",
      status: "draft",
      publishedAt: null,
    })
    expect(nextCmsRevisionNumber(2)).toBe(3)
    expect(cmsRevisionSnapshotFromDraft(draft)).not.toHaveProperty("publishedAt")
    const parsed = parseCmsRevisionSnapshot({ publishedAt: "2026-01-01", title: "X" })
    expect(parsed.title).toBe("X")
    expect(parsed).not.toHaveProperty("publishedAt")
  })
})

describe("cms restore UI source", () => {
  test("edit page lists revisions, restores via POST, and has an empty state", () => {
    const page = read("app/admin/content/[id]/page.tsx")
    const list = read("components/admin/cms-revision-list.tsx")
    expect(page).toContain("CmsRevisionList")
    expect(page).not.toContain("use server")
    expect(list).toContain("No revisions yet.")
    expect(list).toContain('method: "POST"')
    expect(list).toContain("/restore")
    expect(list).toContain("revisionId")
    expect(existsSync(join(root, "app/api/admin/cms/[id]/restore/route.ts"))).toBe(true)
    expect(read("app/api/admin/cms/[id]/restore/route.ts")).toContain("export async function POST")
    expect(read("app/api/admin/cms/[id]/restore/route.ts")).not.toContain("use server")
    const restore = read("lib/cms/restore.ts")
    expect(restore).not.toContain(".delete(cmsRevisions)")
    expect(restore).toContain("db.transaction")
    expect(restore).toContain('.for("update")')
    expect(restore).toContain("409")
    expect(read("docs/API_AUTH_MATRIX.md")).toContain("POST /api/admin/cms/:id/restore")
  })
})

const getSession = mock(async (): Promise<{ user: { id: string } } | null> => null)
const checkCapability = mock(async () => false)
const revalidatePublic = mock((_scope?: unknown) => undefined)

mock.module("@/lib/auth", () => ({
  getSession,
}))
mock.module("@/lib/auth/capabilities", () => ({
  checkCapability,
}))
mock.module("@/lib/cache/public-cache", () => ({
  revalidatePublic,
}))

type UpdateCall = { table: unknown; values: Record<string, unknown> }

let entryRows: unknown[] = []
let occupancyRows: unknown[] = []
let restoreRevisionRows: unknown[] = []
let latestRevisionRows: Array<{ revisionNumber: number }> = []
let updates: UpdateCall[] = []
let deletes: unknown[] = []
const dbSelectForUpdate = mock((_mode?: unknown) => undefined)

function selectChain() {
  let table: unknown
  let ordered = false
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
      ordered = true
      return chain
    },
    limit(_n?: number) {
      const rows =
        table === cmsEntries
          ? occupancyRows
          : table === cmsRevisions
            ? ordered
              ? latestRevisionRows
              : restoreRevisionRows
            : []
      const pending = Promise.resolve(rows)
      return Object.assign(pending, {
        for(mode?: unknown) {
          dbSelectForUpdate(mode)
          return Promise.resolve(table === cmsEntries ? entryRows : rows)
        },
      })
    },
  }
  return chain
}

const dbSelect = mock((_fields?: unknown) => selectChain())
const dbUpdate = mock((table: unknown) => ({
  set(values: Record<string, unknown>) {
    updates.push({ table, values })
    return {
      where() {
        return undefined
      },
    }
  },
}))
const dbDelete = mock((table: unknown) => {
  deletes.push(table)
  return {
    where() {
      return undefined
    },
  }
})

function installDb() {
  Object.assign(mockedDb, {
    select: dbSelect,
    update: dbUpdate,
    delete: dbDelete,
  })
  setDbTransaction(async (fn) =>
    fn({
      select: dbSelect,
      insert: dbInsert,
      update: dbUpdate,
      delete: dbDelete,
    }),
  )
}

installDb()

const { POST } = await import("@/app/api/admin/cms/[id]/restore/route")

function restoreRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/admin/cms/entry-1/restore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const context = { params: Promise.resolve({ id: "entry-1" }) }

describe("POST /api/admin/cms/:id/restore", () => {
  beforeEach(() => {
    getSession.mockReset()
    checkCapability.mockReset()
    revalidatePublic.mockReset()
    dbSelect.mockReset()
    dbUpdate.mockReset()
    dbDelete.mockReset()
    dbSelectForUpdate.mockReset()
    resetSharedDbInsert()
    updates = []
    deletes = []
    occupancyRows = []
    entryRows = [{ ...publishedEntry }]
    restoreRevisionRows = [{ ...firstRevision, snapshot: { ...firstRevision.snapshot } }]
    latestRevisionRows = [{ revisionNumber: 2 }]
    getSession.mockImplementation(async () => ({ user: { id: "editor-1" } }))
    checkCapability.mockImplementation(async () => true)
    dbSelect.mockImplementation((_fields?: unknown) => selectChain())
    dbUpdate.mockImplementation((table: unknown) => ({
      set(values: Record<string, unknown>) {
        updates.push({ table, values })
        return {
          where() {
            return undefined
          },
        }
      },
    }))
    dbDelete.mockImplementation((table: unknown) => {
      deletes.push(table)
      return {
        where() {
          return undefined
        },
      }
    })
    installDb()
  })

  afterEach(() => {
    resetSharedDbTransaction()
    delete (mockedDb as { select?: unknown; update?: unknown; delete?: unknown }).select
    delete (mockedDb as { select?: unknown; update?: unknown; delete?: unknown }).update
    delete (mockedDb as { select?: unknown; update?: unknown; delete?: unknown }).delete
  })

  test("returns 401 without a session", async () => {
    getSession.mockImplementation(async () => null)
    const response = await POST(restoreRequest({ revisionId: "rev-1" }), context)
    expect(response.status).toBe(401)
    expect(dbUpdate).not.toHaveBeenCalled()
  })

  test("returns 403 without moderate", async () => {
    checkCapability.mockImplementation(async () => false)
    const response = await POST(restoreRequest({ revisionId: "rev-1" }), context)
    expect(checkCapability).toHaveBeenCalledWith("editor-1", "moderate")
    expect(response.status).toBe(403)
  })

  test("returns 404 when the revision is missing", async () => {
    restoreRevisionRows = []
    const response = await POST(restoreRequest({ revisionId: "missing" }), context)
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: "Revision not found" })
  })

  test("copies snapshot fields, writes a new revision, keeps old ones, and unpublishes", async () => {
    const response = await POST(restoreRequest({ revisionId: "rev-1" }), context)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      status: "draft",
      routePath: "/original",
    })

    const entryUpdate = updates.find((call) => call.table === cmsEntries)
    expect(entryUpdate?.values).toMatchObject({
      title: "Original title",
      slug: "original",
      excerpt: "original excerpt",
      body: "<p>original</p>",
      heroMediaId: "hero-old",
      status: "draft",
      publishedAt: null,
      updatedByUserId: "editor-1",
    })
    expect(entryUpdate?.values).not.toHaveProperty("publishedAt", publishedAt)

    expect(deletes).toContain(mediaUsages)
    expect(deletes).not.toContain(cmsRevisions)

    const insertTables = dbInsert.mock.calls.map((call) => call[0])
    expect(insertTables).toContain(cmsRevisions)
    expect(insertTables).toContain(auditLogs)
    expect(insertTables).not.toContain(cmsEntries)

    const revisionInsert = dbInsertValues.mock.calls
      .map((call) => call[0] as Record<string, unknown>)
      .find((row) => row.entryId === "entry-1" && row.revisionNumber === 3)
    expect(revisionInsert).toMatchObject({
      entryId: "entry-1",
      revisionNumber: 3,
      createdByUserId: "editor-1",
      snapshot: {
        title: "Original title",
        slug: "original",
        excerpt: "original excerpt",
        body: "<p>original</p>",
        heroMediaId: "hero-old",
        status: "draft",
      },
    })
    expect(revisionInsert?.snapshot).not.toHaveProperty("publishedAt")

    const auditInsert = dbInsertValues.mock.calls
      .map((call) => call[0] as Record<string, unknown>)
      .find((row) => row.action === "update")
    expect(auditInsert).toMatchObject({
      actorUserId: "editor-1",
      action: "update",
      entityType: "cms_entry",
      entityId: "entry-1",
      metadata: {
        restoreRevisionId: "rev-1",
        fromRevisionNumber: 1,
      },
    })

    expect(revalidatePublic).toHaveBeenCalledWith("pages")
    expect(dbSelectForUpdate).toHaveBeenCalledWith("update")
  })

  test("returns 409 when another entry already owns the restored slug or route", async () => {
    occupancyRows = [{ id: "other-entry" }]
    const response = await POST(restoreRequest({ revisionId: "rev-1" }), context)
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: "Slug or route is already in use" })
    expect(updates).toHaveLength(0)
    expect(dbInsertValues).not.toHaveBeenCalled()
  })

  test("forces draft when the working entry is in_review", async () => {
    entryRows = [{ ...publishedEntry, status: "in_review", publishedAt: null }]
    restoreRevisionRows = [
      {
        ...firstRevision,
        snapshot: { ...firstRevision.snapshot, status: "in_review" },
      },
    ]
    const response = await POST(restoreRequest({ revisionId: "rev-1" }), context)
    expect(response.status).toBe(200)
    expect(updates[0]?.values.status).toBe("draft")
    expect(updates[0]?.values.publishedAt).toBeNull()
  })
})
