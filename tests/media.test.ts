import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { cropDerivativeFilename, cropSaveMode } from "@/lib/media/crop-save"
import { hasValidSignature, mediaObjectKey, validateUploadFile } from "@/lib/media/validate-upload"
import { mediaLifecycle } from "@/lib/media/lifecycle"

const root = join(import.meta.dir, "..")

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8")
}

function pngFile(extra = "") {
  const header = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const body = new TextEncoder().encode(extra)
  const bytes = new Uint8Array(header.length + body.length)
  bytes.set(header)
  bytes.set(body, header.length)
  return new File([bytes], "photo.png", { type: "image/png" })
}

describe("media upload validation", () => {
  test("accepts a PNG signature", async () => {
    const file = pngFile()
    expect(await hasValidSignature(file)).toBe(true)
    const result = await validateUploadFile(file)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.kind).toBe("image")
      expect(result.value.safeFilename).toBe("photo.png")
    }
  })

  test("rejects spoofed PNG bytes", async () => {
    const file = new File(["not a png"], "photo.png", { type: "image/png" })
    expect(await hasValidSignature(file)).toBe(false)
    const result = await validateUploadFile(file)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe("signature_mismatch")
  })

  test("object keys use dated media prefix and asset id", () => {
    const key = mediaObjectKey("image", "abc123", "photo.png", new Date("2026-06-15"))
    expect(key).toBe("media/image/2026/06/abc123-photo.png")
  })
})

describe("media lifecycle", () => {
  test("purge only when archived and unused", () => {
    expect(mediaLifecycle({ archivedAt: null, usageCount: 0, untrackedUrlRefs: 0 }).canPurge).toBe(false)
    expect(mediaLifecycle({ archivedAt: new Date(), usageCount: 1, untrackedUrlRefs: 0 }).canPurge).toBe(false)
    expect(mediaLifecycle({ archivedAt: new Date(), usageCount: 0, untrackedUrlRefs: 0 }).canPurge).toBe(true)
  })
})

describe("crop save mode", () => {
  test("replaces unused assets and creates a new asset when used", () => {
    expect(cropSaveMode(0)).toBe("replace")
    expect(cropSaveMode(1)).toBe("create")
    expect(cropDerivativeFilename("photo.jpg")).toBe("photo-crop.jpg")
    expect(cropDerivativeFilename("photo-crop.jpg")).toBe("photo-crop.jpg")
  })
})

describe("media crop source", () => {
  test("admin media crops images in-place via Route Handler and react-image-crop", () => {
    const page = read("app/admin/media/page.tsx")
    const dialog = read("components/admin/media-crop-dialog.tsx")
    const route = read("app/api/admin/media/[id]/crop/route.ts")
    const save = read("lib/media/crop.ts")
    const raster = read("components/admin/crop-image-to-canvas.ts")

    expect(page).toContain("MediaCropDialog")
    expect(page).toContain('asset.kind === "image"')
    expect(page).toContain("Crop")
    expect(page).not.toContain("use server")
    expect(dialog).toContain("ReactCrop")
    expect(dialog).toContain("cropImageToCanvas")
    expect(dialog).not.toContain("cropToCanvas")
    expect(dialog).not.toContain("object-contain")
    expect(dialog).toContain("max-h-[55vh] max-w-full")
    expect(dialog).toContain("/api/admin/media/${asset.id}/crop")
    expect(dialog).toContain('asset?.kind === "image"')
    expect(dialog).not.toContain("use server")
    expect(raster).not.toContain("window.devicePixelRatio")
    expect(existsSync(join(root, "app/api/admin/media/[id]/crop/route.ts"))).toBe(true)
    expect(route).toContain("export async function POST")
    expect(route).toContain("validateUploadFile")
    expect(route).toContain("getStorageDriver")
    expect(route).not.toContain("use server")
    expect(save).toContain("cropSaveMode")
    expect(save).toContain("db.transaction")
    expect(save).toContain('.for("update")')
    expect(save).toContain("asset.storageKey")
    expect(save).toContain("persisted.stored.url")
    expect(save).not.toContain("storageUrl: asset.storageUrl")
    expect(save).toContain("driver.delete")
    expect(save).toContain("Only image assets can be cropped")
    expect(read("docs/API_AUTH_MATRIX.md")).toContain("POST /api/admin/media/:id/crop")
  })
})
