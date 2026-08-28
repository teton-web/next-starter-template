import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { isLivePublishedEntry } from "@/lib/cms/live-pure"
import {
  cmsPreviewPath,
  decodeCmsPreviewKey,
  pickCmsPreviewEntry,
} from "@/lib/cms/preview-pure"

const root = join(import.meta.dir, "..")

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8")
}

const now = new Date("2026-08-28T12:00:00.000Z")

function entry(partial: {
  id: string
  slug: string
  routePath: string
  status: string
  updatedAt?: Date
}) {
  return {
    ...partial,
    updatedAt: partial.updatedAt ?? now,
  }
}

describe("unpublished CMS preview (pure)", () => {
  test("id match wins over a colliding slug", () => {
    const picked = pickCmsPreviewEntry(
      [
        entry({ id: "page-1", slug: "hello", routePath: "/hello", status: "draft" }),
        entry({ id: "hello", slug: "other", routePath: "/other", status: "in_review" }),
      ],
      "hello",
    )
    expect(picked?.id).toBe("hello")
  })

  test("slug prefers unpublished over published", () => {
    const picked = pickCmsPreviewEntry(
      [
        entry({
          id: "pub",
          slug: "about",
          routePath: "/about",
          status: "published",
          updatedAt: new Date("2026-08-28T13:00:00.000Z"),
        }),
        entry({
          id: "draft",
          slug: "about",
          routePath: "/articles/about",
          status: "draft",
          updatedAt: new Date("2026-08-28T10:00:00.000Z"),
        }),
      ],
      "about",
    )
    expect(picked?.id).toBe("draft")
  })

  test("article routePath and encoded keys resolve", () => {
    const article = entry({
      id: "a1",
      slug: "launch",
      routePath: "/articles/launch",
      status: "in_review",
    })
    expect(pickCmsPreviewEntry([article], "launch")?.id).toBe("a1")
    expect(pickCmsPreviewEntry([article], "/articles/launch")?.id).toBe("a1")
    expect(pickCmsPreviewEntry([article], encodeURIComponent("/articles/launch"))?.id).toBe("a1")
    expect(decodeCmsPreviewKey("%2Farticles%2Flaunch")).toBe("/articles/launch")
    expect(cmsPreviewPath("a1")).toBe("/admin/preview/a1")
  })

  test("future publishAt is not live even if status is published", () => {
    expect(isLivePublishedEntry({ status: "draft" }, now)).toBe(false)
    expect(isLivePublishedEntry({ status: "in_review" }, now)).toBe(false)
    expect(isLivePublishedEntry({ status: "published" }, now)).toBe(true)
    expect(
      isLivePublishedEntry({ status: "published", publishAt: new Date("2026-08-29T00:00:00.000Z") }, now),
    ).toBe(false)
    expect(
      isLivePublishedEntry({ status: "published", publish_at: "2026-08-27T00:00:00.000Z" }, now),
    ).toBe(true)
  })
})

describe("unpublished CMS preview (source)", () => {
  test("preview is session-only under /admin/preview and requires moderate", () => {
    expect(existsSync(join(root, "app/admin/preview/[idOrSlug]/page.tsx"))).toBe(true)
    const page = read("app/admin/preview/[idOrSlug]/page.tsx")
    expect(page).toContain("getCmsEntryForPreview")
    expect(page).toContain('checkCapability(session.user.id, "moderate")')
    expect(page).toContain("getSession")
    expect(page).toContain("noindexMetadata")
    expect(page).toContain('export const dynamic = "force-dynamic"')
    expect(page).toContain("notFound()")
    expect(page).not.toContain("AUTH_SECRET")
    expect(page).not.toContain("token")
    expect(page).not.toContain("use server")
    expect(page).not.toContain("BlockNote")
  })

  test("public routes stay published-only and do not load preview queries", () => {
    const queries = read("lib/cms/queries.ts")
    expect(queries).toContain('eq(cmsEntries.status, "published")')
    expect(queries).toContain("isLivePublishedEntry")
    expect(queries).toContain("getCmsEntryForPreview")

    const publicPage = read("app/(public)/[slug]/page.tsx")
    const article = read("app/(public)/articles/[slug]/page.tsx")
    const articlesIndex = read("app/(public)/articles/page.tsx")
    expect(publicPage).toContain("getPublishedEntryByPath")
    expect(publicPage).not.toContain("getCmsEntryForPreview")
    expect(article).toContain("getPublishedEntryByPath")
    expect(article).not.toContain("getCmsEntryForPreview")
    expect(articlesIndex).toContain("listPublishedEntries")
    expect(articlesIndex).not.toContain("getCmsEntryForPreview")
  })

  test("preview URLs are absent from sitemap and robots disallow /admin/", () => {
    const sitemap = read("app/sitemap.ts")
    expect(sitemap).toContain("listPublishedEntries")
    expect(sitemap).not.toContain("/admin")
    expect(sitemap).not.toContain("/admin/preview")
    expect(sitemap).not.toContain("cmsPreviewPath")
    expect(sitemap).not.toContain("getCmsEntryForPreview")
    expect(sitemap).not.toContain("token")

    const robots = read("app/robots.ts")
    expect(robots).toContain('disallow: ["/admin/", "/api/", "/login", "/forgot-password", "/reset-password"]')
  })

  test("preview responses inherit X-Robots-Tag from /admin and set metadata noindex", () => {
    const config = read("next.config.mjs")
    expect(config).toContain('"/admin/:path*"')
    expect(config).toContain('key: "X-Robots-Tag"')
    expect(config).toContain("noindex, nofollow")

    const seo = read("lib/seo.ts")
    expect(seo).toContain("export function noindexMetadata")
    expect(seo).toContain("index: false")
    expect(read("app/admin/preview/[idOrSlug]/page.tsx")).toContain("noindexMetadata")
  })

  test("admin content surfaces a session preview link by id", () => {
    const edit = read("app/admin/content/[id]/page.tsx")
    const list = read("app/admin/content/page.tsx")
    expect(edit).toContain("cmsPreviewPath(entry.id)")
    expect(list).toContain("cmsPreviewPath(entry.id)")
    expect(edit).not.toContain("use server")
  })
})
