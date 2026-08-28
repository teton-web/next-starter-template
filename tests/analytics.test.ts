process.env.DATABASE_URL ??= "postgresql://ci:ci@localhost:5432/ci"
process.env.AUTH_SECRET ??= "ci-placeholder-secret-minimum-32-characters"
delete process.env.RESEND_API_KEY
delete process.env.EMAIL_FROM
delete process.env.CONTACT_TO_EMAIL

import {
  dbInsert,
  mockedDb,
  resetSharedDbInsert,
} from "./helpers/mock-db"
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import { NextRequest } from "next/server"
import { cmsEntries, cmsRevisions } from "@/lib/db/schema"
import { checkRateLimit, resetMemoryRateLimits } from "@/lib/services/rate-limit"

const track = mock(async (_name: string, _props?: Record<string, unknown>) => undefined)
const getSession = mock(async (): Promise<{ user: { id: string } } | null> => null)
const checkCapability = mock(async () => false)
const revalidatePublic = mock((_scope?: unknown) => undefined)
const storagePut = mock(async (key: string) => ({ key, url: `https://cdn.test/${key}` }))

mock.module("@vercel/analytics/server", () => ({
  track,
}))

mock.module("@/lib/auth", () => ({
  getSession,
}))
mock.module("@/lib/auth/capabilities", () => ({
  checkCapability,
}))
mock.module("@/lib/cache/public-cache", () => ({
  revalidatePublic,
}))
mock.module("@/lib/storage", () => ({
  getStorageDriver: () => ({
    name: "local" as const,
    put: storagePut,
    delete: async () => undefined,
  }),
  storageNotConfiguredMessage: () => "Object storage is not configured.",
}))

const analytics = await import("@/lib/analytics")
const { ANALYTICS_EVENTS, sanitizeAnalyticsProps, trackEvent } = analytics
const { POST: contactPost } = await import("@/app/api/contact/route")
const { PATCH: cmsPatch } = await import("@/app/api/admin/cms/[id]/route")
const { POST: mediaPost } = await import("@/app/api/admin/media/route")
const { POST: uploadPost } = await import("@/app/api/upload/route")

describe("trackEvent", () => {
  beforeEach(() => {
    track.mockReset()
    track.mockImplementation(async () => undefined)
  })

  test("sends allowlisted events through sanitizeAnalyticsProps", () => {
    trackEvent("cms_publish", {
      entry_type: "page",
      email: "a@b.c",
      name: "Ada",
      ipAddress: "203.0.113.9",
      body: "<p>nope</p>",
    })
    expect(track).toHaveBeenCalledTimes(1)
    expect(track.mock.calls[0]?.[0]).toBe("cms_publish")
    expect(track.mock.calls[0]?.[1]).toEqual({ entry_type: "page" })
    expect(JSON.stringify(track.mock.calls[0]?.[1])).not.toContain("a@b.c")
  })

  test("does not send unknown event names", () => {
    trackEvent("not_allowlisted" as (typeof ANALYTICS_EVENTS)[number], { kind: "image" })
    expect(track).not.toHaveBeenCalled()
  })

  test("fail-open when the analytics provider rejects", () => {
    track.mockImplementation(async () => {
      throw new Error("analytics down")
    })
    expect(() => trackEvent("media_upload", { kind: "image" })).not.toThrow()
  })
})

describe("sanitizeAnalyticsProps", () => {
  test("keeps only destination, status, entry_type, kind, and error_code", () => {
    expect(
      sanitizeAnalyticsProps({
        destination: "/contact",
        status: 422,
        entry_type: "article",
        kind: "document",
        error_code: "validation",
        email: "hidden@example.com",
        token: "secret",
      }),
    ).toEqual({
      destination: "/contact",
      status: 422,
      entry_type: "article",
      kind: "document",
      error_code: "validation",
    })
  })
})

function contactRequest(body: unknown) {
  return new NextRequest("http://localhost/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
    body: JSON.stringify(body),
  })
}

const validContact = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  message: "Please get in touch about a project.",
}

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
  createdByUserId: "user-1",
  updatedByUserId: "user-1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
}

let entryRows: unknown[] = []
let latestRevisionRows: Array<{ revisionNumber: number }> = []

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
    orderBy() {
      return chain
    },
    limit(_n?: number) {
      if (table === cmsEntries) return Promise.resolve(entryRows)
      if (table === cmsRevisions) return Promise.resolve(latestRevisionRows)
      return Promise.resolve([])
    },
  }
  return chain
}

const dbSelect = mock((_fields?: unknown) => cmsSelectChain())
const dbUpdate = mock((_table: unknown) => ({
  set(_values: Record<string, unknown>) {
    return {
      where() {
        return undefined
      },
    }
  },
}))
const dbDelete = mock((_table: unknown) => ({
  where() {
    return undefined
  },
}))

function installCmsDb() {
  Object.assign(mockedDb, {
    select: dbSelect,
    update: dbUpdate,
    delete: dbDelete,
    insert: dbInsert,
  })
}

function cmsRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/admin/cms/entry-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

const cmsContext = { params: Promise.resolve({ id: "entry-1" }) }

function pngFile() {
  const header = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return new File([header], "photo.png", { type: "image/png" })
}

function mediaRequest(file?: File) {
  const form = new FormData()
  if (file) form.set("file", file)
  return new NextRequest("http://localhost/api/admin/media", {
    method: "POST",
    body: form,
  })
}

describe("route handlers call trackEvent", () => {
  let trackEventSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    trackEventSpy = spyOn(analytics, "trackEvent").mockImplementation(() => undefined)
    getSession.mockReset()
    checkCapability.mockReset()
    revalidatePublic.mockReset()
    storagePut.mockReset()
    storagePut.mockImplementation(async (key: string) => ({ key, url: `https://cdn.test/${key}` }))
    dbSelect.mockReset()
    dbUpdate.mockReset()
    dbDelete.mockReset()
    resetSharedDbInsert()
    resetMemoryRateLimits()
    entryRows = [{ ...draftEntry }]
    latestRevisionRows = [{ revisionNumber: 1 }]
    getSession.mockImplementation(async () => ({ user: { id: "editor-1" } }))
    checkCapability.mockImplementation(async () => true)
    dbSelect.mockImplementation((_fields?: unknown) => cmsSelectChain())
    dbUpdate.mockImplementation((_table: unknown) => ({
      set(_values: Record<string, unknown>) {
        return {
          where() {
            return undefined
          },
        }
      },
    }))
    dbDelete.mockImplementation((_table: unknown) => ({
      where() {
        return undefined
      },
    }))
    installCmsDb()
  })

  afterEach(() => {
    trackEventSpy.mockRestore()
    delete (mockedDb as { select?: unknown; update?: unknown; delete?: unknown }).select
    delete (mockedDb as { select?: unknown; update?: unknown; delete?: unknown }).update
    delete (mockedDb as { select?: unknown; update?: unknown; delete?: unknown }).delete
  })

  test("contact success fires contact_submit with no extra props", async () => {
    const response = await contactPost(contactRequest(validContact))
    expect(response.status).toBe(200)
    expect(trackEventSpy).toHaveBeenCalledTimes(1)
    expect(trackEventSpy).toHaveBeenCalledWith("contact_submit")
    expect(trackEventSpy.mock.calls[0]?.[1]).toBeUndefined()
    const payload = JSON.stringify(trackEventSpy.mock.calls)
    expect(payload).not.toContain("ada@example.com")
    expect(payload).not.toContain("Ada")
    expect(payload).not.toContain("203.0.113.9")
  })

  test("contact validation failure fires contact_submit_failed with error_code and status", async () => {
    const response = await contactPost(contactRequest({ email: "not-an-email" }))
    expect(response.status).toBe(422)
    expect(trackEventSpy).toHaveBeenCalledTimes(1)
    expect(trackEventSpy).toHaveBeenCalledWith("contact_submit_failed", {
      error_code: "validation",
      status: 422,
    })
  })

  test("contact rate limit failure fires contact_submit_failed", async () => {
    for (let i = 0; i < 5; i++) {
      await checkRateLimit({ key: "contact:ip:203.0.113.9", max: 5, windowMs: 60_000 })
    }
    const response = await contactPost(contactRequest(validContact))
    expect(response.status).toBe(429)
    expect(trackEventSpy).toHaveBeenCalledWith("contact_submit_failed", {
      error_code: "rate_limited",
      status: 429,
    })
  })

  test("CMS draft to published fires cms_publish with entry_type", async () => {
    const response = await cmsPatch(cmsRequest({ status: "published" }), cmsContext)
    expect(response.status).toBe(200)
    expect(trackEventSpy).toHaveBeenCalledTimes(1)
    expect(trackEventSpy).toHaveBeenCalledWith("cms_publish", { entry_type: "article" })
  })

  test("CMS already published does not fire cms_publish", async () => {
    entryRows = [{ ...draftEntry, status: "published" as const }]
    const response = await cmsPatch(cmsRequest({ status: "published" }), cmsContext)
    expect(response.status).toBe(200)
    expect(trackEventSpy).not.toHaveBeenCalled()
  })

  test("successful media upload fires media_upload with kind", async () => {
    const response = await mediaPost(mediaRequest(pngFile()))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.kind).toBe("image")
    expect(trackEventSpy).toHaveBeenCalledTimes(1)
    expect(trackEventSpy).toHaveBeenCalledWith("media_upload", { kind: "image" })
  })

  test("/api/upload uses the same media POST tracker", async () => {
    const response = await uploadPost(mediaRequest(pngFile()))
    expect(response.status).toBe(200)
    expect(trackEventSpy).toHaveBeenCalledWith("media_upload", { kind: "image" })
  })

  test("media upload does not fire on 401", async () => {
    getSession.mockImplementation(async () => null)
    const response = await mediaPost(mediaRequest(pngFile()))
    expect(response.status).toBe(401)
    expect(trackEventSpy).not.toHaveBeenCalled()
  })

  test("media upload does not fire on 400", async () => {
    const response = await mediaPost(mediaRequest())
    expect(response.status).toBe(400)
    expect(trackEventSpy).not.toHaveBeenCalled()
  })
})

