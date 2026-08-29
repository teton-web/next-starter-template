process.env.DATABASE_URL ??= "postgresql://ci:ci@localhost:5432/ci"
process.env.AUTH_SECRET ??= "ci-placeholder-secret-minimum-32-characters"

import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { HttpError } from "@/lib/api/http-error"
import { assertGalleriesEnabled } from "@/lib/gallery/access-pure"
import { shouldPromoteGalleryAssetsOnPublish } from "@/lib/gallery/promote-pure"
import {
  emptyPublishedAlbumMessage,
  isPublishedGalleryStatus,
  presentGalleryAlbums,
  publishedGalleryAlbumOrNull,
  type GalleryAlbumSource,
} from "@/lib/gallery/presenters"
import {
  DUPLICATE_ALBUM_ASSET_MESSAGE,
  isUniqueViolation,
} from "@/lib/gallery/unique-pure"

const root = join(import.meta.dir, "..")

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8")
}

function album(partial: Partial<GalleryAlbumSource> & Pick<GalleryAlbumSource, "id" | "slug" | "title">): GalleryAlbumSource {
  return {
    description: null,
    status: "draft",
    coverMediaAssetId: null,
    sortOrder: 0,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    items: [],
    ...partial,
  }
}

describe("gallery unique helper", () => {
  test("detects postgres 23505", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true)
    expect(isUniqueViolation({ cause: { code: "23505" } })).toBe(true)
    expect(isUniqueViolation({ code: "23503" })).toBe(false)
    expect(isUniqueViolation(null)).toBe(false)
  })
})

describe("gallery presenters", () => {
  test("public fetch is published-only and draft is null", () => {
    expect(isPublishedGalleryStatus("published")).toBe(true)
    expect(isPublishedGalleryStatus("draft")).toBe(false)
    expect(publishedGalleryAlbumOrNull(album({ id: "1", slug: "drafty", title: "Draft", status: "draft" }))).toBeNull()
    expect(
      publishedGalleryAlbumOrNull(album({ id: "2", slug: "live", title: "Live", status: "published" }))?.slug,
    ).toBe("live")
  })

  test("empty published album still presents with no items", () => {
    const [view] = presentGalleryAlbums([
      album({ id: "empty", slug: "empty", title: "Empty", status: "published" }),
    ])
    expect(view.items).toEqual([])
    expect(view.coverSrc).toBeNull()
    expect(emptyPublishedAlbumMessage()).toContain("no media")
  })

  test("cover and sort order persist into the view", () => {
    const [view] = presentGalleryAlbums([
      album({
        id: "a",
        slug: "summer",
        title: "Summer",
        status: "published",
        coverMediaAssetId: "b",
        sortOrder: 4,
        items: [
          {
            id: "a",
            title: "First",
            description: null,
            src: "https://cdn.example/a.jpg",
            thumbnailUrl: null,
            alt: null,
            kind: "image",
            sortOrder: 2,
          },
          {
            id: "b",
            title: "Cover",
            description: null,
            src: "https://cdn.example/b.jpg",
            thumbnailUrl: "https://cdn.example/b-thumb.jpg",
            alt: "cover",
            kind: "image",
            sortOrder: 1,
          },
        ],
      }),
    ])
    expect(view.sortOrder).toBe(4)
    expect(view.coverMediaAssetId).toBe("b")
    expect(view.coverSrc).toBe("https://cdn.example/b-thumb.jpg")
    expect(view.items.map((item) => item.id)).toEqual(["b", "a"])
  })
})

describe("gallery publish promote", () => {
  test("starter public blobs skip promote", () => {
    expect(shouldPromoteGalleryAssetsOnPublish("vercel-blob")).toBe(false)
    expect(shouldPromoteGalleryAssetsOnPublish("local")).toBe(false)
    expect(shouldPromoteGalleryAssetsOnPublish(null)).toBe(false)
    expect(shouldPromoteGalleryAssetsOnPublish("private")).toBe(true)
  })
})

describe("gallery source", () => {
  test("does not invent Bill Lax galleries/gallery_photos tables", () => {
    const schemaDir = join(root, "lib/db/schema")
    const files = readdirSync(schemaDir)
    expect(files).toContain("gallery-albums.ts")
    expect(files).not.toContain("galleries.ts")
    expect(files).not.toContain("gallery-photos.ts")
    const schema = read("lib/db/schema/gallery-albums.ts")
    expect(schema).toContain('pgTable(\n  "gallery_albums"')
    expect(schema).toContain('pgTable(\n  "gallery_album_items"')
    expect(schema).toContain("mediaAssetId")
    expect(schema).toContain("coverMediaAssetId")
    expect(schema).toContain('onDelete: "cascade"')
    expect(schema).not.toContain("gallery_photos")
    expect(schema).not.toContain("sourceKey")
    expect(read("lib/db/schema/index.ts")).toContain('from "./gallery-albums"')
  })

  test("public routes 404 when the flag is off and drafts stay off the public slug", () => {
    const index = read("app/(public)/gallery/page.tsx")
    const detail = read("app/(public)/gallery/[slug]/page.tsx")
    expect(index).toContain("notFound")
    expect(index).toContain('isEnabled("galleries")')
    expect(index).toContain("listPublishedGalleryAlbums")
    expect(detail).toContain("notFound")
    expect(detail).toContain('isEnabled("galleries")')
    expect(detail).toContain("getPublishedGalleryAlbumBySlug")
    expect(detail).toContain("emptyPublishedAlbumMessage")
    expect(read("lib/gallery/queries.ts")).toContain('status: "published"')
    expect(read("lib/gallery/queries.ts")).toContain("eq(galleryAlbums.status, \"published\")")
  })

  test("proxy does not 404 galleries (anonymous overlay is cold)", () => {
    const proxy = read("proxy.ts")
    expect(proxy).not.toContain("/gallery")
    expect(proxy).not.toContain("/api/admin/gallery")
    expect(proxy).not.toContain('isEnabled("galleries")')
  })

  test("sitemap lists published gallery slugs only when the flag is on", () => {
    const sitemap = read("app/sitemap.ts")
    expect(sitemap).toContain('isEnabled("galleries")')
    expect(sitemap).toContain("staticPublicSitemapPaths")
    expect(sitemap).toContain("listPublishedGallerySitemapEntries")
    expect(sitemap).toContain("/gallery/${album.slug}")
    expect(read("lib/sitemap/static-paths.ts")).toContain('"/gallery"')
    expect(sitemap).not.toContain("status: \"draft\"")
    const queries = read("lib/gallery/queries.ts")
    expect(queries).toContain("listPublishedGallerySitemapEntries")
    expect(queries).toContain('eq(galleryAlbums.status, "published")')
  })

  test("cache tag is gallery-scoped and invalidates sitemap", () => {
    const cache = read("lib/cache/public-cache.ts")
    expect(cache).toContain('gallery: "public:gallery"')
    expect(cache).toContain("PUBLIC_CACHE_TAGS.gallery")
    expect(cache).toContain("PUBLIC_CACHE_TAGS.sitemap")
    expect(read("lib/gallery/mutations.ts")).toContain('revalidatePublic("gallery")')
    expect(read("lib/gallery/mutations.ts")).toContain("shouldPromoteGalleryAssetsOnPublish")
    expect(read("lib/gallery/mutations.ts")).not.toContain("onConflictDoUpdate")
    expect(read("lib/gallery/mutations.ts")).toContain("DUPLICATE_ALBUM_ASSET_MESSAGE")
    expect(DUPLICATE_ALBUM_ASSET_MESSAGE).toContain("already")
  })

  test("admin lives under media and upload reuses /api/upload", () => {
    expect(existsSync(join(root, "app/admin/media/gallery/page.tsx"))).toBe(true)
    expect(existsSync(join(root, "app/admin/media/gallery/[albumId]/page.tsx"))).toBe(true)
    expect(read("app/admin/media/gallery/page.tsx")).toContain('isEnabled("galleries")')
    expect(read("app/admin/media/gallery/page.tsx")).toContain("notFound")
    expect(read("app/admin/media/gallery/[albumId]/page.tsx")).toContain('isEnabled("galleries")')
    expect(read("components/admin/gallery-album-detail.tsx")).toContain('fetch("/api/upload"')
    expect(read("components/admin/gallery-album-detail.tsx")).toContain("/api/admin/gallery/")
    expect(read("app/admin/admin-shell.tsx")).toContain('href="/admin/media/gallery"')
    expect(read("app/admin/admin-shell.tsx")).toContain("galleriesEnabled")
    expect(read("components/site-header.tsx")).toContain('href: "/gallery"')
    expect(read("components/site-header.tsx")).toContain("galleriesEnabled")
  })

  test("APIs 404 when the flag is off and audit create/update/delete", () => {
    expect(read("lib/gallery/access.ts")).toContain('isEnabled("galleries")')
    expect(read("lib/gallery/access-pure.ts")).toContain('throw new HttpError(404, "Not found")')
    const create = read("app/api/admin/gallery/route.ts")
    const album = read("app/api/admin/gallery/[albumId]/route.ts")
    const items = read("app/api/admin/gallery/[albumId]/items/route.ts")
    expect(create).toContain("requireGalleryAdmin")
    expect(create).toContain('action: "create"')
    expect(album).toContain('action: "update"')
    expect(album).toContain("published: true")
    expect(album).toContain('action: "delete"')
    expect(items).toContain("addGalleryAlbumItem")
    expect(items).toContain("mediaAssetId")
    expect(create).toContain('entityType: "gallery_album"')
  })
})

describe("gallery flag gate", () => {
  test("HttpError 404 matches waitlist copy", () => {
    const error = new HttpError(404, "Not found")
    expect(error.status).toBe(404)
    expect(error.message).toBe("Not found")
  })

  test("assertGalleriesEnabled 404s when the flag is off and allows when on", () => {
    expect(() => assertGalleriesEnabled(false)).toThrow(HttpError)
    try {
      assertGalleriesEnabled(false)
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError)
      expect((error as HttpError).status).toBe(404)
      expect((error as HttpError).message).toBe("Not found")
    }
    expect(() => assertGalleriesEnabled(true)).not.toThrow()
  })
})
