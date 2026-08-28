"use client"

import { useRef, useState } from "react"
import ReactCrop, { type Crop, type PixelCrop } from "react-image-crop"
import "react-image-crop/dist/ReactCrop.css"
import { Button } from "@/components/ui/button"
import { cropImageToCanvas } from "@/components/admin/crop-image-to-canvas"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type MediaCropAsset = {
  id: string
  filename: string
  storageUrl: string
  kind: string
  contentType?: string | null
  width?: number | null
  height?: number | null
  usageCount: number
}

function outputType(contentType: string | null | undefined) {
  if (contentType === "image/png" || contentType === "image/jpeg" || contentType === "image/webp") {
    return contentType
  }
  return "image/jpeg"
}

function outputFilename(filename: string, type: string) {
  const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg"
  const base = filename.replace(/\.[^.]+$/, "") || "crop"
  return `${base}-crop.${ext}`
}

function canvasToFile(canvas: HTMLCanvasElement, filename: string, type: string) {
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not encode crop"))
          return
        }
        resolve(new File([blob], filename, { type }))
      },
      type,
      0.92,
    )
  })
}

export function MediaCropDialog({
  asset,
  open,
  onOpenChange,
  onSaved,
}: {
  asset: MediaCropAsset | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => Promise<void>
}) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState("")

  const isImage = asset?.kind === "image"

  async function saveCrop() {
    if (!asset || !isImage || !imgRef.current || !completedCrop?.width || !completedCrop.height) return
    setPending(true)
    setMessage("")
    try {
      const canvas = cropImageToCanvas(imgRef.current, completedCrop)
      const type = outputType(asset.contentType)
      const file = await canvasToFile(canvas, outputFilename(asset.filename, type), type)
      const form = new FormData()
      form.set("file", file)
      const response = await fetch(`/api/admin/media/${asset.id}/crop`, { method: "POST", body: form })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(typeof body.error === "string" ? body.error : "Crop failed")
        return
      }
      const dims =
        typeof body.width === "number" && typeof body.height === "number"
          ? ` (${body.width}×${body.height})`
          : ""
      setMessage(body.mode === "create" ? `Saved as new asset${dims}` : `Replaced image${dims}`)
      await onSaved()
      onOpenChange(false)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Crop failed")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return
        onOpenChange(next)
        if (!next) {
          setCrop(undefined)
          setCompletedCrop(undefined)
          setMessage("")
        }
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{asset ? asset.filename : "Crop image"}</DialogTitle>
          <DialogDescription>
            {asset?.usageCount
              ? "This image is in use. Saving a crop creates a new asset and leaves the original unchanged."
              : "This image is unused. Saving a crop replaces it in place."}
          </DialogDescription>
        </DialogHeader>
        {asset && isImage ? (
          <div className="max-h-[60vh] overflow-auto">
            <ReactCrop
              crop={crop}
              onChange={(next) => setCrop(next)}
              onComplete={(next) => setCompletedCrop(next)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={asset.storageUrl}
                alt={asset.filename}
                crossOrigin="anonymous"
                className="block h-auto w-auto max-h-[55vh] max-w-full"
                onLoad={() => {
                  setCrop({ unit: "%", x: 10, y: 10, width: 80, height: 80 })
                }}
              />
            </ReactCrop>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Crop is only available for images.</p>
        )}
        {asset?.width && asset.height ? (
          <p className="text-xs text-muted-foreground">
            Current size {asset.width}×{asset.height}
          </p>
        ) : null}
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {isImage ? (
            <Button
              type="button"
              disabled={pending || !completedCrop?.width || !completedCrop.height}
              onClick={() => void saveCrop()}
            >
              {pending ? "Saving…" : "Save crop"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
