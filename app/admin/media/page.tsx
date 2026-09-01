"use client"

import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { MediaCropDialog, type MediaCropAsset } from "@/components/admin/media-crop-dialog"

type Asset = MediaCropAsset & {
  thumbnailUrl: string | null
  altText: string | null
  archivedAt: string | null
  canPurge: boolean
}

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json())

export default function AdminMediaPage() {
  const [q, setQ] = useState("")
  const [message, setMessage] = useState("")
  const [cropAsset, setCropAsset] = useState<Asset | null>(null)
  const { data, mutate } = useSWR(`/api/admin/media?q=${encodeURIComponent(q)}`, fetcher)
  const assets: Asset[] = data?.assets ?? []

  async function onUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const response = await fetch("/api/admin/media", { method: "POST", body: form })
    const body = await response.json()
    setMessage(response.ok ? "Uploaded" : body.error || "Upload failed")
    if (response.ok) {
      event.currentTarget.reset()
      const created = body.asset as Asset | undefined
      await mutate(
        (current: { assets?: Asset[] } | undefined) => {
          if (!created) return current
          const existing = current?.assets ?? []
          if (existing.some((asset) => asset.id === created.id)) return current
          return { ...current, assets: [created, ...existing] }
        },
        { revalidate: true },
      )
    }
  }

  async function archive(id: string, archived: boolean) {
    await fetch("/api/admin/media", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, archived }),
    })
    await mutate()
  }

  async function purge(id: string) {
    await fetch(`/api/admin/media?id=${id}`, { method: "DELETE" })
    await mutate()
  }

  return (
    <div className="container mx-auto space-y-8 px-4 py-8">
      <h1 className="text-2xl font-bold">Media library</h1>
      <form onSubmit={onUpload} className="flex flex-wrap items-end gap-3">
        <Input name="file" type="file" required />
        <Input name="altText" placeholder="Alt text" />
        <Button type="submit">Upload</Button>
      </form>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <div className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search filename" />
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {assets.map((asset) => (
          <li key={asset.id} className="rounded-lg border p-3">
            {asset.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={asset.thumbnailUrl} alt={asset.altText ?? ""} className="mb-2 h-32 w-full object-cover" />
            ) : null}
            <p className="truncate text-sm font-medium">{asset.filename}</p>
            <p className="text-xs text-muted-foreground">
              {asset.kind} · {asset.usageCount} uses {asset.archivedAt ? "· archived" : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {asset.kind === "image" ? (
                <Button size="sm" variant="outline" onClick={() => setCropAsset(asset)}>
                  Crop
                </Button>
              ) : null}
              <Button size="sm" variant="outline" onClick={() => void archive(asset.id, !asset.archivedAt)}>
                {asset.archivedAt ? "Restore" : "Archive"}
              </Button>
              {asset.canPurge ? (
                <Button size="sm" variant="destructive" onClick={() => void purge(asset.id)}>
                  Purge
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <MediaCropDialog
        asset={cropAsset}
        open={cropAsset !== null}
        onOpenChange={(open) => {
          if (!open) setCropAsset(null)
        }}
        onSaved={() => mutate()}
      />
    </div>
  )
}
