import sharp from "sharp"
import type { StorageDriver } from "@/lib/storage"

export async function persistMediaObject(
  driver: StorageDriver,
  key: string,
  bytes: Buffer,
  contentType: string,
  kind: "image" | "video" | "document",
  options?: { thumbnailKey?: string | null },
) {
  const stored = await driver.put(key, bytes, contentType)
  let width: number | null = null
  let height: number | null = null
  let thumbnailUrl: string | null = stored.url
  let thumbnailKey: string | null = key

  if (kind === "image") {
    try {
      const meta = await sharp(bytes).metadata()
      width = meta.width ?? null
      height = meta.height ?? null
      const thumb = await sharp(bytes).resize(400, 400, { fit: "inside" }).jpeg({ quality: 75 }).toBuffer()
      const existingThumb = options?.thumbnailKey
      const thumbKey =
        existingThumb && existingThumb !== key ? existingThumb : key.replace(/\.[^.]+$/, "-thumb.jpg")
      const thumbStored = await driver.put(thumbKey, thumb, "image/jpeg")
      thumbnailKey = thumbStored.key
      thumbnailUrl = thumbStored.url
    } catch {
      // keep original as thumbnail
    }
  }

  return { stored, width, height, thumbnailUrl, thumbnailKey }
}
