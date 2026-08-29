import { and, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { galleryAlbumItems, galleryAlbums, mediaAssets, mediaUsages } from "@/lib/db/schema"
import { newId, slugify } from "@/lib/api/helpers"
import { HttpError } from "@/lib/api/http-error"
import { revalidatePublic } from "@/lib/cache/public-cache"
import { getStorageDriver } from "@/lib/storage"
import { shouldPromoteGalleryAssetsOnPublish } from "@/lib/gallery/promote-pure"
import {
  DUPLICATE_ALBUM_ASSET_MESSAGE,
  DUPLICATE_ALBUM_SLUG_MESSAGE,
  isUniqueViolation,
} from "@/lib/gallery/unique-pure"
import type { GalleryAlbumStatus } from "@/lib/gallery/presenters"

export const GALLERY_USAGE_ENTITY = "gallery_album"
export const GALLERY_USAGE_ITEM_FIELD = "item"
export const GALLERY_USAGE_COVER_FIELD = "cover"

export type GalleryAlbumInput = {
  title: string
  slug?: string | null
  description?: string | null
  status?: GalleryAlbumStatus
  coverMediaAssetId?: string | null
  sortOrder?: number
}

function revalidateGalleryPublic() {
  revalidatePublic("gallery")
}

async function replaceAlbumUsage(input: {
  albumId: string
  assetId: string
  fieldKey: string
  sortOrder?: number
}) {
  await db
    .delete(mediaUsages)
    .where(
      and(
        eq(mediaUsages.entityType, GALLERY_USAGE_ENTITY),
        eq(mediaUsages.entityId, input.albumId),
        eq(mediaUsages.fieldKey, input.fieldKey),
        eq(mediaUsages.assetId, input.assetId),
      ),
    )
  await db.insert(mediaUsages).values({
    id: newId(),
    assetId: input.assetId,
    entityType: GALLERY_USAGE_ENTITY,
    entityId: input.albumId,
    fieldKey: input.fieldKey,
    sortOrder: input.sortOrder ?? 0,
  })
}

async function deleteAlbumUsages(albumId: string, fieldKey?: string, assetId?: string) {
  const conditions = [
    eq(mediaUsages.entityType, GALLERY_USAGE_ENTITY),
    eq(mediaUsages.entityId, albumId),
  ]
  if (fieldKey) conditions.push(eq(mediaUsages.fieldKey, fieldKey))
  if (assetId) conditions.push(eq(mediaUsages.assetId, assetId))
  await db.delete(mediaUsages).where(and(...conditions))
}

export async function createGalleryAlbum(input: GalleryAlbumInput) {
  const now = new Date()
  const id = newId()
  const slug = input.slug ? slugify(input.slug) : `${slugify(input.title)}-${id.slice(0, 8)}`

  try {
    const [album] = await db
      .insert(galleryAlbums)
      .values({
        id,
        slug,
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? "draft",
        coverMediaAssetId: input.coverMediaAssetId ?? null,
        sortOrder: input.sortOrder ?? 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    if (album.coverMediaAssetId) {
      await replaceAlbumUsage({
        albumId: album.id,
        assetId: album.coverMediaAssetId,
        fieldKey: GALLERY_USAGE_COVER_FIELD,
      })
    }

    revalidateGalleryPublic()
    return album
  } catch (error) {
    if (isUniqueViolation(error)) throw new HttpError(409, DUPLICATE_ALBUM_SLUG_MESSAGE)
    throw error
  }
}

export async function updateGalleryAlbum(id: string, input: Partial<GalleryAlbumInput>) {
  const [existing] = await db.select().from(galleryAlbums).where(eq(galleryAlbums.id, id)).limit(1)
  if (!existing) return null

  try {
    const [album] = await db
      .update(galleryAlbums)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.slug !== undefined && input.slug ? { slug: slugify(input.slug) } : {}),
        ...(input.description !== undefined ? { description: input.description ?? null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.coverMediaAssetId !== undefined ? { coverMediaAssetId: input.coverMediaAssetId ?? null } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        updatedAt: new Date(),
      })
      .where(eq(galleryAlbums.id, id))
      .returning()

    if (album && input.coverMediaAssetId !== undefined) {
      await deleteAlbumUsages(album.id, GALLERY_USAGE_COVER_FIELD)
      if (album.coverMediaAssetId) {
        await replaceAlbumUsage({
          albumId: album.id,
          assetId: album.coverMediaAssetId,
          fieldKey: GALLERY_USAGE_COVER_FIELD,
        })
      }
    }

    if (album && input.status === "published") {
      const driver = getStorageDriver()
      if (shouldPromoteGalleryAssetsOnPublish(driver?.name)) {
        // No private driver in the starter; status gate still applies.
      }
    }

    if (album) revalidateGalleryPublic()
    return album ? { album, previousStatus: existing.status } : null
  } catch (error) {
    if (isUniqueViolation(error)) throw new HttpError(409, DUPLICATE_ALBUM_SLUG_MESSAGE)
    throw error
  }
}

export async function deleteGalleryAlbum(id: string) {
  await deleteAlbumUsages(id)
  const [album] = await db.delete(galleryAlbums).where(eq(galleryAlbums.id, id)).returning()
  if (album) revalidateGalleryPublic()
  return album ?? null
}

export async function nextGalleryAlbumItemSortOrder(albumId: string): Promise<number> {
  const [row] = await db
    .select({
      maxSort: sql<number>`coalesce(max(${galleryAlbumItems.sortOrder}), -1)`,
    })
    .from(galleryAlbumItems)
    .where(eq(galleryAlbumItems.albumId, albumId))

  return Number(row?.maxSort ?? -1) + 1
}

async function requireGalleryAlbum(albumId: string) {
  const [album] = await db
    .select()
    .from(galleryAlbums)
    .where(eq(galleryAlbums.id, albumId))
    .limit(1)
  if (!album) throw new HttpError(404, "Gallery album not found")
  return album
}

async function requireMediaAsset(mediaAssetId: string) {
  const [asset] = await db
    .select({ id: mediaAssets.id })
    .from(mediaAssets)
    .where(eq(mediaAssets.id, mediaAssetId))
    .limit(1)
  if (!asset) throw new HttpError(404, "Media asset not found")
  return asset
}

export async function addGalleryAlbumItem(albumId: string, mediaAssetId: string, sortOrder?: number) {
  await requireGalleryAlbum(albumId)
  await requireMediaAsset(mediaAssetId)
  const order = sortOrder ?? (await nextGalleryAlbumItemSortOrder(albumId))
  const now = new Date()

  try {
    const [item] = await db
      .insert(galleryAlbumItems)
      .values({ albumId, mediaAssetId, sortOrder: order, createdAt: now, updatedAt: now })
      .returning()

    await replaceAlbumUsage({
      albumId,
      assetId: mediaAssetId,
      fieldKey: GALLERY_USAGE_ITEM_FIELD,
      sortOrder: order,
    })

    revalidateGalleryPublic()
    return item
  } catch (error) {
    if (isUniqueViolation(error)) throw new HttpError(409, DUPLICATE_ALBUM_ASSET_MESSAGE)
    throw error
  }
}

export async function updateGalleryAlbumItem(
  albumId: string,
  mediaAssetId: string,
  input: { sortOrder?: number },
) {
  const [item] = await db
    .update(galleryAlbumItems)
    .set({
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(galleryAlbumItems.albumId, albumId),
        eq(galleryAlbumItems.mediaAssetId, mediaAssetId),
      ),
    )
    .returning()

  if (item && input.sortOrder !== undefined) {
    await replaceAlbumUsage({
      albumId,
      assetId: mediaAssetId,
      fieldKey: GALLERY_USAGE_ITEM_FIELD,
      sortOrder: input.sortOrder,
    })
  }

  if (item) revalidateGalleryPublic()
  return item ?? null
}

export async function removeGalleryAlbumItem(albumId: string, mediaAssetId: string) {
  const [item] = await db
    .delete(galleryAlbumItems)
    .where(
      and(
        eq(galleryAlbumItems.albumId, albumId),
        eq(galleryAlbumItems.mediaAssetId, mediaAssetId),
      ),
    )
    .returning()

  if (!item) return null

  await deleteAlbumUsages(albumId, GALLERY_USAGE_ITEM_FIELD, mediaAssetId)

  const [album] = await db.select().from(galleryAlbums).where(eq(galleryAlbums.id, albumId)).limit(1)
  if (album?.coverMediaAssetId === mediaAssetId) {
    await db
      .update(galleryAlbums)
      .set({ coverMediaAssetId: null, updatedAt: new Date() })
      .where(eq(galleryAlbums.id, albumId))
    await deleteAlbumUsages(albumId, GALLERY_USAGE_COVER_FIELD, mediaAssetId)
  }

  revalidateGalleryPublic()
  return item
}
