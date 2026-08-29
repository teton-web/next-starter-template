import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { mediaAssets, mediaUsages } from "@/lib/db/schema"
import { auditClientMeta, writeAuditLog } from "@/lib/admin/audit"
import { HttpError } from "@/lib/api/http-error"
import { trackEvent } from "@/lib/analytics"
import { cropDerivativeFilename, cropSaveMode } from "@/lib/media/crop-save"
import { persistMediaObject } from "@/lib/media/persist"
import { mediaObjectKey, type ValidatedUpload } from "@/lib/media/validate-upload"
import type { StorageDriver } from "@/lib/storage"

async function deleteReplacedCropObjects(
  driver: StorageDriver,
  previousKeys: Array<string | null | undefined>,
  nextKeys: Array<string | null | undefined>,
) {
  const keep = new Set(nextKeys.filter((key): key is string => Boolean(key)))
  const seen = new Set<string>()
  for (const key of previousKeys) {
    if (!key || keep.has(key) || seen.has(key)) continue
    seen.add(key)
    try {
      await driver.delete(key)
    } catch {
      // leftover object is acceptable; the crop row already committed
    }
  }
}

export async function saveCroppedMedia(input: {
  assetId: string
  userId: string
  request: Request
  validated: ValidatedUpload
  bytes: Buffer
  driver: StorageDriver
}) {
  const result = await db.transaction(async (tx) => {
    const [asset] = await tx
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.id, input.assetId))
      .limit(1)
      .for("update")
    if (!asset) throw new HttpError(404, "Asset not found")
    if (asset.kind !== "image") throw new HttpError(400, "Only image assets can be cropped")

    const usageRows = await tx.select({ id: mediaUsages.id }).from(mediaUsages).where(eq(mediaUsages.assetId, asset.id))
    const mode = cropSaveMode(usageRows.length)

    if (mode === "replace") {
      const previousStorageKey = asset.storageKey
      const previousThumbnailKey = asset.thumbnailKey
      const key = mediaObjectKey("image", crypto.randomUUID(), input.validated.safeFilename)
      const persisted = await persistMediaObject(
        input.driver,
        key,
        input.bytes,
        input.validated.contentType,
        "image",
      )
      await tx
        .update(mediaAssets)
        .set({
          storageUrl: persisted.stored.url,
          storageKey: persisted.stored.key,
          thumbnailUrl: persisted.thumbnailUrl,
          thumbnailKey: persisted.thumbnailKey,
          contentType: input.validated.contentType,
          sizeBytes: input.validated.sizeBytes,
          width: persisted.width,
          height: persisted.height,
          updatedAt: new Date(),
        })
        .where(eq(mediaAssets.id, asset.id))

      await writeAuditLog(
        {
          actorUserId: input.userId,
          action: "update",
          entityType: "media_asset",
          entityId: asset.id,
          metadata: { crop: true, mode },
          ...auditClientMeta(input.request),
        },
        tx,
      )

      return {
        id: asset.id,
        url: persisted.stored.url,
        kind: "image" as const,
        mode: "replace" as const,
        width: persisted.width,
        height: persisted.height,
        previousStorageKey,
        previousThumbnailKey,
        nextStorageKey: persisted.stored.key,
        nextThumbnailKey: persisted.thumbnailKey,
      }
    }

    const newId = crypto.randomUUID()
    const filename = cropDerivativeFilename(input.validated.safeFilename)
    const key = mediaObjectKey("image", newId, filename)
    const persisted = await persistMediaObject(input.driver, key, input.bytes, input.validated.contentType, "image")

    await tx.insert(mediaAssets).values({
      id: newId,
      storageUrl: persisted.stored.url,
      storageKey: persisted.stored.key,
      thumbnailUrl: persisted.thumbnailUrl,
      thumbnailKey: persisted.thumbnailKey,
      filename,
      title: asset.title,
      description: asset.description,
      sourceCredit: asset.sourceCredit,
      tags: asset.tags,
      contentType: input.validated.contentType,
      sizeBytes: input.validated.sizeBytes,
      width: persisted.width,
      height: persisted.height,
      kind: "image",
      altText: asset.altText,
      localeId: asset.localeId,
      uploadedByUserId: input.userId,
    })

    await writeAuditLog(
      {
        actorUserId: input.userId,
        action: "create",
        entityType: "media_asset",
        entityId: newId,
        metadata: { crop: true, mode, sourceAssetId: asset.id },
        ...auditClientMeta(input.request),
      },
      tx,
    )

    return {
      id: newId,
      url: persisted.stored.url,
      kind: "image" as const,
      mode: "create" as const,
      width: persisted.width,
      height: persisted.height,
    }
  })

  if (result.mode === "replace") {
    await deleteReplacedCropObjects(
      input.driver,
      [result.previousStorageKey, result.previousThumbnailKey],
      [result.nextStorageKey, result.nextThumbnailKey],
    )
  }

  if (result.mode === "create") {
    trackEvent("media_upload", { kind: "image" })
  }

  return {
    id: result.id,
    url: result.url,
    kind: result.kind,
    mode: result.mode,
    width: result.width,
    height: result.height,
  }
}
