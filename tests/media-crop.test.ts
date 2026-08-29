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
import { NextRequest } from "next/server"
import sharp from "sharp"
import { auditLogs, mediaAssets, mediaUsages } from "@/lib/db/schema"

const getSession = mock(async (): Promise<{ user: { id: string } } | null> => null)
const checkCapability = mock(async () => false)
const storagePut = mock(async (key: string) => ({ key, url: `https://cdn.test/${key}` }))
const storageDelete = mock(async (_key: string) => undefined)

mock.module("@/lib/auth", () => ({
  getSession,
}))
mock.module("@/lib/auth/capabilities", () => ({
  checkCapability,
}))
mock.module("@/lib/storage", () => ({
  getStorageDriver: () => ({
    name: "local" as const,
    put: storagePut,
    delete: storageDelete,
  }),
  storageNotConfiguredMessage: () => "Object storage is not configured.",
}))

type UpdateCall = { table: unknown; values: Record<string, unknown> }

let assetRows: unknown[] = []
let usageRows: unknown[] = []
let updates: UpdateCall[] = []

const dbSelectForUpdate = mock((_mode?: unknown) => undefined)

function selectChain() {
  let table: unknown
  const rows = () => (table === mediaAssets ? assetRows : table === mediaUsages ? usageRows : [])
  const chain = {
    from(nextTable: unknown) {
      table = nextTable
      return chain
    },
    where() {
      const pending = Promise.resolve(rows())
      return Object.assign(pending, {
        limit: limitWithForUpdate,
        for(mode?: unknown) {
          dbSelectForUpdate(mode)
          return pending
        },
      })
    },
    limit: limitWithForUpdate,
  }
  function limitWithForUpdate(_n?: number) {
    const pending = Promise.resolve(rows())
    return Object.assign(pending, {
      for(mode?: unknown) {
        dbSelectForUpdate(mode)
        return pending
      },
    })
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

function installDb() {
  Object.assign(mockedDb, {
    select: dbSelect,
    update: dbUpdate,
    insert: dbInsert,
  })
  setDbTransaction(async (fn) =>
    fn({
      select: dbSelect,
      insert: dbInsert,
      update: dbUpdate,
    }),
  )
}

installDb()

const { POST } = await import("@/app/api/admin/media/[id]/crop/route")

const sourceAsset = {
  id: "asset-1",
  storageUrl: "https://cdn.test/photo.jpg",
  storageKey: "media/image/2026/01/asset-1-photo.jpg",
  thumbnailUrl: "https://cdn.test/photo-thumb.jpg",
  thumbnailKey: "media/image/2026/01/asset-1-photo-thumb.jpg",
  filename: "photo.jpg",
  title: "Hero",
  description: null,
  sourceCredit: null,
  tags: ["hero"],
  contentType: "image/jpeg",
  sizeBytes: 1200,
  width: 800,
  height: 600,
  kind: "image" as const,
  altText: "A photo",
  localeId: null,
  uploadedByUserId: "user-1",
  archivedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
}

async function jpegFile(width = 40, height = 24, name = "photo-crop.jpg") {
  const bytes = await sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 40, b: 40 } },
  })
    .jpeg()
    .toBuffer()
  return new File([bytes], name, { type: "image/jpeg" })
}

function cropRequest(file?: File, id = "asset-1") {
  const form = new FormData()
  if (file) form.set("file", file)
  return new NextRequest(`http://localhost/api/admin/media/${id}/crop`, {
    method: "POST",
    body: form,
  })
}

const context = { params: Promise.resolve({ id: "asset-1" }) }

describe("POST /api/admin/media/:id/crop", () => {
  beforeEach(() => {
    getSession.mockReset()
    checkCapability.mockReset()
    storagePut.mockReset()
    storageDelete.mockReset()
    dbSelect.mockReset()
    dbSelectForUpdate.mockReset()
    dbUpdate.mockReset()
    resetSharedDbInsert()
    updates = []
    assetRows = [{ ...sourceAsset }]
    usageRows = []
    getSession.mockImplementation(async () => ({ user: { id: "editor-1" } }))
    checkCapability.mockImplementation(async () => true)
    storagePut.mockImplementation(async (key: string) => ({ key, url: `https://cdn.test/${key}` }))
    storageDelete.mockImplementation(async () => undefined)
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
    installDb()
  })

  afterEach(() => {
    resetSharedDbTransaction()
    delete (mockedDb as { select?: unknown; update?: unknown }).select
    delete (mockedDb as { select?: unknown; update?: unknown }).update
  })

  test("returns 401 without a session", async () => {
    getSession.mockImplementation(async () => null)
    const response = await POST(cropRequest(await jpegFile()), context)
    expect(response.status).toBe(401)
    expect(dbUpdate).not.toHaveBeenCalled()
    expect(dbInsertValues).not.toHaveBeenCalled()
  })

  test("returns 403 without admin or moderate", async () => {
    checkCapability.mockImplementation(async () => false)
    const response = await POST(cropRequest(await jpegFile()), context)
    expect(checkCapability).toHaveBeenCalledWith("editor-1", "admin")
    expect(checkCapability).toHaveBeenCalledWith("editor-1", "moderate")
    expect(response.status).toBe(403)
    expect(dbUpdate).not.toHaveBeenCalled()
  })

  test("rejects non-image MIME through upload validation", async () => {
    const file = new File(["not-an-image"], "notes.txt", { type: "text/plain" })
    const response = await POST(cropRequest(file), context)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "Upload rejected: type_not_allowed" })
    expect(storagePut).not.toHaveBeenCalled()
  })

  test("does not crop video assets", async () => {
    assetRows = [{ ...sourceAsset, kind: "video", filename: "clip.mp4", contentType: "video/mp4" }]
    const response = await POST(cropRequest(await jpegFile()), context)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "Only image assets can be cropped" })
    expect(storagePut).not.toHaveBeenCalled()
  })

  test("replaces an unused image in place and records new dimensions", async () => {
    const response = await POST(cropRequest(await jpegFile(40, 24)), context)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({
      id: "asset-1",
      kind: "image",
      mode: "replace",
      width: 40,
      height: 24,
    })

    expect(dbSelectForUpdate).toHaveBeenCalledWith("update")
    expect(updates).toHaveLength(1)
    expect(updates[0]?.table).toBe(mediaAssets)
    const stored = updates[0]?.values ?? {}
    expect(stored).toMatchObject({
      width: 40,
      height: 24,
      contentType: "image/jpeg",
    })
    expect(stored.storageKey).not.toBe(sourceAsset.storageKey)
    expect(stored.storageUrl).not.toBe(sourceAsset.storageUrl)
    expect(stored.thumbnailKey).not.toBe(sourceAsset.thumbnailKey)
    expect(stored.thumbnailUrl).not.toBe(sourceAsset.thumbnailUrl)
    expect(stored.storageUrl).toBe(`https://cdn.test/${stored.storageKey}`)
    expect(stored.thumbnailUrl).toBe(`https://cdn.test/${stored.thumbnailKey}`)
    expect(body.url).toBe(stored.storageUrl)
    expect(stored).not.toHaveProperty("filename", "photo-crop.jpg")
    expect(typeof stored.storageKey).toBe("string")
    expect(stored.storageKey).toMatch(/^media\/image\/\d{4}\/\d{2}\/[0-9a-f-]{36}-photo-crop\.jpg$/)

    const putKeys = storagePut.mock.calls.map((call) => call[0] as string)
    expect(putKeys).not.toContain(sourceAsset.storageKey)
    expect(putKeys).not.toContain(sourceAsset.thumbnailKey)
    expect(putKeys).toContain(stored.storageKey)
    expect(putKeys).toContain(stored.thumbnailKey)

    const deletedKeys = storageDelete.mock.calls.map((call) => call[0] as string)
    expect(deletedKeys).toContain(sourceAsset.storageKey)
    expect(deletedKeys).toContain(sourceAsset.thumbnailKey)
    expect(deletedKeys).not.toContain(stored.storageKey)
    expect(deletedKeys).not.toContain(stored.thumbnailKey)

    const insertTables = dbInsert.mock.calls.map((call) => call[0])
    expect(insertTables).toContain(auditLogs)
    expect(insertTables).not.toContain(mediaAssets)
    const auditInsert = dbInsertValues.mock.calls
      .map((call) => call[0] as Record<string, unknown>)
      .find((row) => row.action === "update")
    expect(auditInsert).toMatchObject({
      actorUserId: "editor-1",
      entityType: "media_asset",
      entityId: "asset-1",
      metadata: { crop: true, mode: "replace" },
    })
  })

  test("saves a new asset when media_usages references the source", async () => {
    usageRows = [{ id: "usage-1", assetId: "asset-1" }]
    const response = await POST(cropRequest(await jpegFile(16, 12)), context)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.mode).toBe("create")
    expect(body.id).not.toBe("asset-1")
    expect(body.width).toBe(16)
    expect(body.height).toBe(12)

    expect(updates).toHaveLength(0)
    const insertTables = dbInsert.mock.calls.map((call) => call[0])
    expect(insertTables).toContain(mediaAssets)
    expect(insertTables).toContain(auditLogs)

    const assetInsert = dbInsertValues.mock.calls
      .map((call) => call[0] as Record<string, unknown>)
      .find((row) => row.kind === "image")
    expect(assetInsert).toMatchObject({
      kind: "image",
      filename: "photo-crop.jpg",
      altText: "A photo",
      title: "Hero",
      width: 16,
      height: 12,
      uploadedByUserId: "editor-1",
    })
    expect(assetInsert?.id).toBe(body.id)
    expect(storageDelete).not.toHaveBeenCalled()
  })

  test("replace still succeeds when deleting previous objects fails", async () => {
    storageDelete.mockImplementation(async () => {
      throw new Error("blob delete failed")
    })
    const response = await POST(cropRequest(await jpegFile(40, 24)), context)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({ id: "asset-1", mode: "replace" })
    expect(body.url).not.toBe(sourceAsset.storageUrl)
    expect(storageDelete).toHaveBeenCalled()
  })
})
