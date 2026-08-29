import { z } from "zod"
import { jsonOk, parseJson } from "@/lib/api/helpers"
import { errorResponse, HttpError } from "@/lib/api/http-error"
import { auditClientMeta, writeAuditLog } from "@/lib/admin/audit"
import { requireGalleryAdmin } from "@/lib/gallery/access"
import {
  addGalleryAlbumItem,
  removeGalleryAlbumItem,
  updateGalleryAlbumItem,
} from "@/lib/gallery/mutations"

const createSchema = z.object({
  mediaAssetId: z.string().min(1),
  sortOrder: z.number().int().optional(),
})

const patchSchema = z.object({
  mediaAssetId: z.string().min(1),
  sortOrder: z.number().int(),
})

const deleteSchema = z.object({
  mediaAssetId: z.string().min(1),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ albumId: string }> },
) {
  try {
    const userId = await requireGalleryAdmin()
    if (userId instanceof Response) return userId

    const body = await parseJson(request, createSchema)
    if (body instanceof Response) return body

    const { albumId } = await params
    const item = await addGalleryAlbumItem(albumId, body.mediaAssetId, body.sortOrder)

    await writeAuditLog({
      actorUserId: userId,
      action: "create",
      entityType: "gallery_album_item",
      entityId: `${albumId}:${body.mediaAssetId}`,
      metadata: { albumId, mediaAssetId: body.mediaAssetId, sortOrder: item.sortOrder },
      ...auditClientMeta(request),
    })
    return jsonOk({ item }, 201)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ albumId: string }> },
) {
  try {
    const userId = await requireGalleryAdmin()
    if (userId instanceof Response) return userId

    const body = await parseJson(request, patchSchema)
    if (body instanceof Response) return body

    const { albumId } = await params
    const item = await updateGalleryAlbumItem(albumId, body.mediaAssetId, { sortOrder: body.sortOrder })
    if (!item) throw new HttpError(404, "Album item not found")

    await writeAuditLog({
      actorUserId: userId,
      action: "update",
      entityType: "gallery_album_item",
      entityId: `${albumId}:${body.mediaAssetId}`,
      metadata: { albumId, mediaAssetId: body.mediaAssetId, sortOrder: item.sortOrder },
      ...auditClientMeta(request),
    })
    return jsonOk({ item })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ albumId: string }> },
) {
  try {
    const userId = await requireGalleryAdmin()
    if (userId instanceof Response) return userId

    const { albumId } = await params
    const fromQuery = new URL(request.url).searchParams.get("mediaAssetId")
    let mediaAssetId = fromQuery
    if (!mediaAssetId) {
      const body = await parseJson(request, deleteSchema)
      if (body instanceof Response) return body
      mediaAssetId = body.mediaAssetId
    }

    const item = await removeGalleryAlbumItem(albumId, mediaAssetId)
    if (!item) throw new HttpError(404, "Album item not found")

    await writeAuditLog({
      actorUserId: userId,
      action: "delete",
      entityType: "gallery_album_item",
      entityId: `${albumId}:${mediaAssetId}`,
      metadata: { albumId, mediaAssetId },
      ...auditClientMeta(request),
    })
    return jsonOk({ success: true })
  } catch (error) {
    return errorResponse(error)
  }
}
