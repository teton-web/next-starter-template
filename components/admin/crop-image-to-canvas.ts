import type { PixelCrop } from "react-image-crop"

/** Rasterize the framed crop at 1× natural pixels, not the display backing store. */
export function cropImageToCanvas(image: HTMLImageElement, crop: PixelCrop) {
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("No 2d context")

  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height
  const sourceWidth = crop.width * scaleX
  const sourceHeight = crop.height * scaleY
  canvas.width = Math.max(1, Math.round(sourceWidth))
  canvas.height = Math.max(1, Math.round(sourceHeight))
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  )
  return canvas
}
