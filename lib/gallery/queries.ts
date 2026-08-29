import { and, asc, eq, inArray, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { galleryAlbumItems, galleryAlbums, mediaAssets } from "@/lib/db/schema"
import {
  presentGalleryAlbums,
  presentGalleryItem,
  type GalleryAlbumSource,
  type GalleryAlbumStatus,
  type GalleryAlbumView,
  type GalleryItemSource,
} from "@/lib/gallery/presenters"

function assetToGallerySource(
  asset: typeof mediaAssets.$inferSelect,
  sortOrder: number,
): GalleryItemSource {
  return {
    id: asset.id,
    title: asset.title || asset.filename,
    description: asset.description,
    src: asset.storageUrl,
    thumbnailUrl: asset.thumbnailUrl,
    alt: asset.altText,
    kind: asset.kind,
    sortOrder,
  }
}

async function listAlbumSources(options: {
  status?: GalleryAlbumStatus
  slug?: string
  id?: string
} = {}): Promise<GalleryAlbumSource[]> {
  const conditions = []
  if (options.status) conditions.push(eq(galleryAlbums.status, options.status))
  if (options.slug) conditions.push(eq(galleryAlbums.slug, options.slug))
  if (options.id) conditions.push(eq(galleryAlbums.id, options.id))

  const albumRows = await db
    .select()
    .from(galleryAlbums)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(galleryAlbums.sortOrder), asc(galleryAlbums.title))

  if (albumRows.length === 0) return []

  const rows = await db
    .select({
      albumId: galleryAlbumItems.albumId,
      sortOrder: galleryAlbumItems.sortOrder,
      asset: mediaAssets,
    })
    .from(galleryAlbumItems)
    .innerJoin(mediaAssets, eq(galleryAlbumItems.mediaAssetId, mediaAssets.id))
    .where(inArray(galleryAlbumItems.albumId, albumRows.map((album) => album.id)))
    .orderBy(asc(galleryAlbumItems.albumId), asc(galleryAlbumItems.sortOrder), asc(mediaAssets.filename))

  const itemsByAlbum = new Map<string, GalleryItemSource[]>()
  for (const row of rows) {
    const items = itemsByAlbum.get(row.albumId) ?? []
    items.push(assetToGallerySource(row.asset, row.sortOrder))
    itemsByAlbum.set(row.albumId, items)
  }

  return albumRows.map((album) => ({
    id: album.id,
    slug: album.slug,
    title: album.title,
    description: album.description,
    status: album.status,
    coverMediaAssetId: album.coverMediaAssetId,
    sortOrder: album.sortOrder,
    createdAt: album.createdAt,
    updatedAt: album.updatedAt,
    items: itemsByAlbum.get(album.id) ?? [],
  }))
}

export async function listPublishedGalleryAlbums(): Promise<GalleryAlbumView[]> {
  return presentGalleryAlbums(await listAlbumSources({ status: "published" }))
}

export async function getPublishedGalleryAlbumBySlug(slug: string): Promise<GalleryAlbumView | null> {
  const albums = presentGalleryAlbums(await listAlbumSources({ status: "published", slug }))
  return albums[0] ?? null
}

export async function listPublishedGallerySitemapEntries() {
  return db
    .select({
      slug: galleryAlbums.slug,
      updatedAt: galleryAlbums.updatedAt,
    })
    .from(galleryAlbums)
    .where(eq(galleryAlbums.status, "published"))
    .orderBy(asc(galleryAlbums.sortOrder), asc(galleryAlbums.slug))
}

export async function listAdminGalleryAlbums(): Promise<GalleryAlbumView[]> {
  return presentGalleryAlbums(await listAlbumSources())
}

export async function getAdminGalleryAlbum(id: string): Promise<GalleryAlbumView | null> {
  const albums = presentGalleryAlbums(await listAlbumSources({ id }))
  return albums[0] ?? null
}

export async function listGalleryLibraryAssets() {
  const rows = await db
    .select()
    .from(mediaAssets)
    .where(isNull(mediaAssets.archivedAt))
    .orderBy(asc(mediaAssets.filename))
    .limit(500)

  return rows.map((asset, index) => presentGalleryItem(assetToGallerySource(asset, index)))
}
