process.env.DATABASE_URL ??= "postgresql://ci:ci@localhost:5432/ci"
process.env.AUTH_SECRET ??= "ci-placeholder-secret-minimum-32-characters"

import {
  dbInsert,
  dbInsertValues,
  mockedDb,
  resetSharedDbInsert,
  resetSharedDbTransaction,
} from "./helpers/mock-db"
import { authMockExports } from "./helpers/mock-auth"
import { capabilitiesMockExports } from "./helpers/mock-capabilities"
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { HttpError } from "@/lib/api/http-error"
import { resetFeatureFlagCache, setCachedDbEnabled } from "@/lib/flags/cache"
import { galleryAlbumItems, galleryAlbums, mediaAssets } from "@/lib/db/schema"
import { DUPLICATE_ALBUM_ASSET_MESSAGE } from "@/lib/gallery/unique-pure"

const getSession = mock(async (): Promise<{ user: { id: string } } | null> => null)
const checkCapability = mock(async () => false)
const revalidatePublic = mock((_scope?: unknown) => undefined)

mock.module("@/lib/auth", () => authMockExports({ getSession }))
mock.module("@/lib/auth/capabilities", () => capabilitiesMockExports({ checkCapability }))
mock.module("@/lib/cache/public-cache", () => ({
  revalidatePublic,
}))
mock.module("@/lib/storage", () => ({
  getStorageDriver: () => ({
    name: "local" as const,
    put: async (key: string) => ({ key, url: `https://cdn.test/${key}` }),
    delete: async () => undefined,
  }),
  storageNotConfiguredMessage: () => "Object storage is not configured.",
}))

const now = new Date("2026-01-01T00:00:00.000Z")

type AlbumRow = {
  id: string
  slug: string
  title: string
  description: string | null
  status: "draft" | "published"
  coverMediaAssetId: string | null
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

type ItemRow = {
  albumId: string
  mediaAssetId: string
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

const asset = {
  id: "asset-1",
  storageUrl: "https://cdn.example/a.jpg",
  storageKey: "media/image/a.jpg",
  thumbnailUrl: "https://cdn.example/a-thumb.jpg",
  thumbnailKey: "media/image/a-thumb.jpg",
  filename: "a.jpg",
  title: "Cover shot",
  description: null,
  sourceCredit: null,
  tags: [] as string[],
  contentType: "image/jpeg",
  sizeBytes: 1200,
  width: 800,
  height: 600,
  focalX: null,
  focalY: null,
  kind: "image" as const,
  altText: "cover",
  localeId: null,
  uploadedByUserId: null,
  archivedAt: null,
  createdAt: now,
  updatedAt: now,
}

let album: AlbumRow
let items: ItemRow[] = []

function seedAlbum(): AlbumRow {
  return {
    id: "album-1",
    slug: "summer",
    title: "Summer",
    description: null,
    status: "draft",
    coverMediaAssetId: null,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  }
}

function thenableQuery(rows: unknown[]) {
  const pending = Promise.resolve(rows)
  const chain = Object.assign(pending, {
    where: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    returning: () => chain,
  })
  return chain
}

function rowsFor(table: unknown, fields?: unknown) {
  if (table === galleryAlbums) return [{ ...album }]
  if (table === mediaAssets) {
    if (fields && typeof fields === "object" && fields !== null && "id" in fields && !("asset" in fields)) {
      return [{ id: asset.id }]
    }
    return [{ ...asset }]
  }
  if (table === galleryAlbumItems) {
    if (fields && typeof fields === "object" && fields !== null && "maxSort" in fields) {
      const maxSort = items.reduce((max, item) => Math.max(max, item.sortOrder), -1)
      return [{ maxSort: items.length === 0 ? -1 : maxSort }]
    }
    if (fields && typeof fields === "object" && fields !== null && "asset" in fields) {
      return items.map((item) => ({
        albumId: item.albumId,
        sortOrder: item.sortOrder,
        asset: { ...asset, id: item.mediaAssetId },
      }))
    }
    return items.map((item) => ({ ...item }))
  }
  return []
}

const dbSelect = mock((_fields?: unknown) => ({
  from(table: unknown) {
    return thenableQuery(rowsFor(table, _fields))
  },
}))

const dbUpdate = mock((table: unknown) => ({
  set(values: Record<string, unknown>) {
    if (table === galleryAlbums) {
      Object.assign(album, values)
    }
    return {
      where() {
        return {
          returning: async () => (table === galleryAlbums ? [{ ...album }] : []),
        }
      },
    }
  },
}))

const dbDelete = mock((_table: unknown) => ({
  where() {
    return Promise.resolve([])
  },
}))

function insertAlbumItem(row: ItemRow) {
  const duplicate = items.some(
    (item) => item.albumId === row.albumId && item.mediaAssetId === row.mediaAssetId,
  )
  if (duplicate) {
    throw Object.assign(new Error("duplicate key"), { code: "23505" })
  }
  items.push({ ...row })
  return [row]
}

function installDb() {
  dbSelect.mockReset()
  dbSelect.mockImplementation((_fields?: unknown) => ({
    from(table: unknown) {
      return thenableQuery(rowsFor(table, _fields))
    },
  }))
  dbUpdate.mockReset()
  dbUpdate.mockImplementation((table: unknown) => ({
    set(values: Record<string, unknown>) {
      if (table === galleryAlbums) {
        Object.assign(album, values)
      }
      return {
        where() {
          return {
            returning: async () => (table === galleryAlbums ? [{ ...album }] : []),
          }
        },
      }
    },
  }))
  dbDelete.mockReset()
  dbDelete.mockImplementation((_table: unknown) => ({
    where() {
      return Promise.resolve([])
    },
  }))
  Object.assign(mockedDb, {
    select: dbSelect,
    update: dbUpdate,
    delete: dbDelete,
    insert: dbInsert,
  })
}

installDb()

const { GET, POST } = await import("@/app/api/admin/gallery/route")
const albumRoute = await import("@/app/api/admin/gallery/[albumId]/route")
const itemsRoute = await import("@/app/api/admin/gallery/[albumId]/items/route")
const { addGalleryAlbumItem } = await import("@/lib/gallery/mutations")

const albumContext = { params: Promise.resolve({ albumId: "album-1" }) }

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

describe("gallery admin APIs", () => {
  beforeEach(() => {
    album = seedAlbum()
    items = []
    resetFeatureFlagCache()
    setCachedDbEnabled("galleries", true)
    getSession.mockReset()
    checkCapability.mockReset()
    revalidatePublic.mockReset()
    resetSharedDbInsert()
    dbInsertValues.mockImplementation(async (row: unknown) => {
      if (
        row &&
        typeof row === "object" &&
        "albumId" in row &&
        "mediaAssetId" in row &&
        !("entityType" in row)
      ) {
        return insertAlbumItem(row as ItemRow)
      }
      return [row]
    })
    getSession.mockImplementation(async () => ({ user: { id: "editor-1" } }))
    checkCapability.mockImplementation(async () => true)
    installDb()
  })

  afterEach(() => {
    resetFeatureFlagCache()
    resetSharedDbTransaction()
    delete (mockedDb as { select?: unknown; update?: unknown; delete?: unknown }).select
    delete (mockedDb as { select?: unknown; update?: unknown; delete?: unknown }).update
    delete (mockedDb as { select?: unknown; update?: unknown; delete?: unknown }).delete
  })

  test("GET/POST/PATCH return 404 when galleries is off", async () => {
    setCachedDbEnabled("galleries", false)

    const getList = await GET()
    expect(getList.status).toBe(404)
    expect(await getList.json()).toEqual({ error: "Not found" })

    const created = await POST(
      jsonRequest("http://localhost/api/admin/gallery", "POST", { title: "New album" }),
    )
    expect(created.status).toBe(404)
    expect(await created.json()).toEqual({ error: "Not found" })

    const patched = await albumRoute.PATCH(
      jsonRequest("http://localhost/api/admin/gallery/album-1", "PATCH", { sortOrder: 3 }),
      albumContext,
    )
    expect(patched.status).toBe(404)
    expect(await patched.json()).toEqual({ error: "Not found" })
    expect(dbUpdate).not.toHaveBeenCalled()
    expect(dbInsertValues).not.toHaveBeenCalled()
  })

  test("addGalleryAlbumItem and items POST reject a duplicate asset with 409", async () => {
    const first = await addGalleryAlbumItem("album-1", "asset-1")
    expect(first.mediaAssetId).toBe("asset-1")

    try {
      await addGalleryAlbumItem("album-1", "asset-1")
      throw new Error("expected duplicate reject")
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError)
      expect((error as HttpError).status).toBe(409)
      expect((error as HttpError).message).toBe(DUPLICATE_ALBUM_ASSET_MESSAGE)
    }

    const response = await itemsRoute.POST(
      jsonRequest("http://localhost/api/admin/gallery/album-1/items", "POST", {
        mediaAssetId: "asset-1",
      }),
      albumContext,
    )
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: DUPLICATE_ALBUM_ASSET_MESSAGE })
  })

  test("PATCH cover and sort order persist on the next GET", async () => {
    items = [
      {
        albumId: "album-1",
        mediaAssetId: "asset-1",
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      },
    ]

    const patched = await albumRoute.PATCH(
      jsonRequest("http://localhost/api/admin/gallery/album-1", "PATCH", {
        coverMediaAssetId: "asset-1",
        sortOrder: 7,
      }),
      albumContext,
    )
    expect(patched.status).toBe(200)
    const patchedBody = (await patched.json()) as {
      album: { coverMediaAssetId: string | null; sortOrder: number }
    }
    expect(patchedBody.album.coverMediaAssetId).toBe("asset-1")
    expect(patchedBody.album.sortOrder).toBe(7)

    const loaded = await albumRoute.GET(
      jsonRequest("http://localhost/api/admin/gallery/album-1", "GET"),
      albumContext,
    )
    expect(loaded.status).toBe(200)
    const body = (await loaded.json()) as {
      album: { coverMediaAssetId: string | null; sortOrder: number; coverSrc: string | null }
    }
    expect(body.album.coverMediaAssetId).toBe("asset-1")
    expect(body.album.sortOrder).toBe(7)
    expect(body.album.coverSrc).toBe(asset.thumbnailUrl)
  })
})
