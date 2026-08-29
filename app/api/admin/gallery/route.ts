import { z } from "zod"
import { jsonOk, parseJson } from "@/lib/api/helpers"
import { errorResponse } from "@/lib/api/http-error"
import { auditClientMeta, writeAuditLog } from "@/lib/admin/audit"
import { requireGalleryAdmin } from "@/lib/gallery/access"
import { createGalleryAlbum } from "@/lib/gallery/mutations"
import { listAdminGalleryAlbums, listGalleryLibraryAssets } from "@/lib/gallery/queries"

const createSchema = z.object({
  title: z.string().trim().min(1).max(180),
  slug: z.string().trim().max(220).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(["draft", "published"]).default("draft"),
  coverMediaAssetId: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
})

export async function GET() {
  try {
    const auth = await requireGalleryAdmin()
    if (auth instanceof Response) return auth

    const [albums, assets] = await Promise.all([
      listAdminGalleryAlbums(),
      listGalleryLibraryAssets(),
    ])
    return jsonOk({ albums, assets })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireGalleryAdmin()
    if (userId instanceof Response) return userId

    const body = await parseJson(request, createSchema)
    if (body instanceof Response) return body

    const album = await createGalleryAlbum(body)
    await writeAuditLog({
      actorUserId: userId,
      action: "create",
      entityType: "gallery_album",
      entityId: album.id,
      metadata: { slug: album.slug, status: album.status },
      ...auditClientMeta(request),
    })
    return jsonOk({ album }, 201)
  } catch (error) {
    return errorResponse(error)
  }
}
