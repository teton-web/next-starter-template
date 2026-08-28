import { NextRequest } from "next/server"
import { and, desc, eq, ilike, isNotNull, isNull, sql } from "drizzle-orm"
import { z } from "zod"
import sharp from "sharp"
import { db } from "@/lib/db"
import { mediaAssets, mediaUsages } from "@/lib/db/schema"
import { jsonOk, requireCapabilityResponse, requireUserId } from "@/lib/api/helpers"
import { errorResponse, HttpError } from "@/lib/api/http-error"
import { auditClientMeta, writeAuditLog } from "@/lib/admin/audit"
import { getStorageDriver, storageNotConfiguredMessage } from "@/lib/storage"
import { mediaObjectKey, validateUploadFile } from "@/lib/media/validate-upload"
import { mediaLifecycle } from "@/lib/media/lifecycle"

const patchSchema = z.object({
  id: z.string().min(1),
  title: z.string().max(200).optional(),
  altText: z.string().max(180).optional(),
  description: z.string().max(2000).optional(),
  sourceCredit: z.string().max(200).optional(),
  tags: z.array(z.string()).optional(),
  archived: z.boolean().optional(),
})

async function requireAdmin() {
  const userId = await requireUserId()
  if (userId instanceof Response) return userId
  const allowed = await requireCapabilityResponse(userId, "admin")
  if (allowed instanceof Response) {
    const moderate = await requireCapabilityResponse(userId, "moderate")
    if (moderate instanceof Response) return moderate
  }
  return userId
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin()
    if (auth instanceof Response) return auth

    const { searchParams } = request.nextUrl
    const q = searchParams.get("q")
    const kind = searchParams.get("kind")
    const archiveFilter = searchParams.get("archive") || "active"
    const usageFilter = searchParams.get("usage") || "all"

    const filters = []
    if (q) filters.push(ilike(mediaAssets.filename, `%${q}%`))
    if (kind === "image" || kind === "video" || kind === "document") {
      filters.push(eq(mediaAssets.kind, kind))
    }
    if (archiveFilter === "active") filters.push(isNull(mediaAssets.archivedAt))
    if (archiveFilter === "archived") filters.push(isNotNull(mediaAssets.archivedAt))

    const rows = await db
      .select({
        asset: mediaAssets,
        usageCount: sql<number>`(select count(*)::int from media_usages where media_usages.asset_id = ${mediaAssets.id})`,
      })
      .from(mediaAssets)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(mediaAssets.createdAt))
      .limit(100)

    const assets = rows
      .map(({ asset, usageCount }) => {
        const life = mediaLifecycle({
          archivedAt: asset.archivedAt,
          usageCount: Number(usageCount) || 0,
          untrackedUrlRefs: 0,
        })
        return { ...asset, ...life }
      })
      .filter((asset) => {
        if (usageFilter === "used") return asset.usageCount > 0
        if (usageFilter === "unused") return asset.usageCount === 0
        if (usageFilter === "purgeable") return asset.canPurge
        return true
      })

    const statsRows = await db.select().from(mediaAssets)
    const stats = {
      totalAssets: statsRows.length,
      totalBytes: statsRows.reduce((sum, row) => sum + (row.sizeBytes ?? 0), 0),
      unusedAssetCount: assets.filter((a) => a.usageCount === 0).length,
      missingAltCount: statsRows.filter((row) => row.kind === "image" && !row.altText).length,
    }

    return jsonOk({ assets, stats })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAdmin()
    if (userId instanceof Response) return userId

    const driver = getStorageDriver()
    if (!driver) {
      throw new HttpError(503, storageNotConfiguredMessage())
    }

    const form = await request.formData()
    const file = form.get("file")
    const validated = await validateUploadFile(file)
    if (!validated.ok) {
      throw new HttpError(400, `Upload rejected: ${validated.error}`)
    }

    const id = crypto.randomUUID()
    const key = mediaObjectKey(validated.value.kind, id, validated.value.safeFilename)
    const bytes = Buffer.from(await (file as File).arrayBuffer())
    const stored = await driver.put(key, bytes, validated.value.contentType)

    let width: number | null = null
    let height: number | null = null
    let thumbnailUrl: string | null = stored.url
    let thumbnailKey: string | null = key

    if (validated.value.kind === "image") {
      try {
        const meta = await sharp(bytes).metadata()
        width = meta.width ?? null
        height = meta.height ?? null
        const thumb = await sharp(bytes).resize(400, 400, { fit: "inside" }).jpeg({ quality: 75 }).toBuffer()
        const thumbKey = key.replace(/\.[^.]+$/, "-thumb.jpg")
        const thumbStored = await driver.put(thumbKey, thumb, "image/jpeg")
        thumbnailKey = thumbStored.key
        thumbnailUrl = thumbStored.url
      } catch {
        // keep original as thumbnail
      }
    }

    const altText = String(form.get("altText") ?? "") || null

    await db.insert(mediaAssets).values({
      id,
      storageUrl: stored.url,
      storageKey: stored.key,
      thumbnailUrl,
      thumbnailKey,
      filename: validated.value.safeFilename,
      contentType: validated.value.contentType,
      sizeBytes: validated.value.sizeBytes,
      width,
      height,
      kind: validated.value.kind,
      altText,
      uploadedByUserId: userId,
    })

    await writeAuditLog({
      actorUserId: userId,
      action: "create",
      entityType: "media_asset",
      entityId: id,
      ...auditClientMeta(request),
    })

    return jsonOk({ id, url: stored.url, kind: validated.value.kind })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await requireAdmin()
    if (userId instanceof Response) return userId
    const body = await request.json()
    const parsed = patchSchema.parse(body)

    await db
      .update(mediaAssets)
      .set({
        title: parsed.title,
        altText: parsed.altText,
        description: parsed.description,
        sourceCredit: parsed.sourceCredit,
        tags: parsed.tags,
        archivedAt: parsed.archived === true ? new Date() : parsed.archived === false ? null : undefined,
        updatedAt: new Date(),
      })
      .where(eq(mediaAssets.id, parsed.id))

    await writeAuditLog({
      actorUserId: userId,
      action: "update",
      entityType: "media_asset",
      entityId: parsed.id,
      ...auditClientMeta(request),
    })
    return jsonOk({ success: true })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireAdmin()
    if (userId instanceof Response) return userId
    const id = request.nextUrl.searchParams.get("id")
    if (!id) throw new HttpError(400, "id is required")

    const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1)
    if (!asset) throw new HttpError(404, "Asset not found")

    const usageRows = await db.select().from(mediaUsages).where(eq(mediaUsages.assetId, id))
    const life = mediaLifecycle({
      archivedAt: asset.archivedAt,
      usageCount: usageRows.length,
      untrackedUrlRefs: 0,
    })
    if (!life.canPurge) {
      throw new HttpError(409, "Asset must be archived and unused before purge")
    }

    const driver = getStorageDriver()
    if (driver) {
      await driver.delete(asset.storageKey)
      if (asset.thumbnailKey && asset.thumbnailKey !== asset.storageKey) {
        await driver.delete(asset.thumbnailKey)
      }
    }
    await db.delete(mediaAssets).where(eq(mediaAssets.id, id))
    await writeAuditLog({
      actorUserId: userId,
      action: "delete",
      entityType: "media_asset",
      entityId: id,
      ...auditClientMeta(request),
    })
    return jsonOk({ success: true })
  } catch (error) {
    return errorResponse(error)
  }
}
