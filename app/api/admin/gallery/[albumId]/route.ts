import { z } from "zod"
import { jsonOk, parseJson } from "@/lib/api/helpers"
import { errorResponse, HttpError } from "@/lib/api/http-error"
import { auditClientMeta, writeAuditLog } from "@/lib/admin/audit"
import { requireGalleryAdmin } from "@/lib/gallery/access"
import { deleteGalleryAlbum, updateGalleryAlbum } from "@/lib/gallery/mutations"
import { getAdminGalleryAlbum } from "@/lib/gallery/queries"

const patchSchema = z.object({
  title: z.string().trim().min(1).max(180).optional(),
  slug: z.string().trim().max(220).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(["draft", "published"]).optional(),
  coverMediaAssetId: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ albumId: string }> },
) {
  try {
    const auth = await requireGalleryAdmin()
    if (auth instanceof Response) return auth
    const { albumId } = await params
    const album = await getAdminGalleryAlbum(albumId)
    if (!album) throw new HttpError(404, "Gallery album not found")
    return jsonOk({ album })
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
    const result = await updateGalleryAlbum(albumId, body)
    if (!result) throw new HttpError(404, "Gallery album not found")

    const published = body.status === "published" && result.previousStatus !== "published"
    await writeAuditLog({
      actorUserId: userId,
      action: "update",
      entityType: "gallery_album",
      entityId: result.album.id,
      metadata: {
        slug: result.album.slug,
        status: result.album.status,
        ...(published ? { published: true } : {}),
        ...(body.status === "draft" && result.previousStatus === "published" ? { unpublished: true } : {}),
      },
      ...auditClientMeta(request),
    })
    return jsonOk({ album: result.album })
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
    const album = await deleteGalleryAlbum(albumId)
    if (!album) throw new HttpError(404, "Gallery album not found")

    await writeAuditLog({
      actorUserId: userId,
      action: "delete",
      entityType: "gallery_album",
      entityId: album.id,
      metadata: { slug: album.slug },
      ...auditClientMeta(request),
    })
    return jsonOk({ success: true })
  } catch (error) {
    return errorResponse(error)
  }
}
