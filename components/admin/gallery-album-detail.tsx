"use client"

import useSWR from "swr"
import Link from "next/link"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type GalleryItem = {
  id: string
  title: string
  thumbnailSrc: string
  kind: "image" | "video" | "document"
  sortOrder: number
}

type GalleryAlbum = {
  id: string
  slug: string
  title: string
  description: string | null
  status: "draft" | "published"
  coverMediaAssetId: string | null
  sortOrder: number
  items: GalleryItem[]
}

type GalleryResponse = {
  albums: GalleryAlbum[]
  assets: GalleryItem[]
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function GalleryAlbumDetail({ albumId }: { albumId: string }) {
  const router = useRouter()
  const { data, mutate } = useSWR<GalleryResponse>("/api/admin/gallery", fetcher)
  const album = useMemo(
    () => data?.albums.find((row) => row.id === albumId) ?? null,
    [data?.albums, albumId],
  )
  const assets = data?.assets ?? []
  const [title, setTitle] = useState<string | null>(null)
  const [slug, setSlug] = useState<string | null>(null)
  const [description, setDescription] = useState<string | null>(null)
  const [status, setStatus] = useState<"draft" | "published" | null>(null)
  const [coverMediaAssetId, setCoverMediaAssetId] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<string | null>(null)
  const [message, setMessage] = useState("")

  const draftTitle = title ?? album?.title ?? ""
  const draftSlug = slug ?? album?.slug ?? ""
  const draftDescription = description ?? album?.description ?? ""
  const draftStatus = status ?? album?.status ?? "draft"
  const draftCover = coverMediaAssetId ?? album?.coverMediaAssetId ?? ""
  const draftOrder = sortOrder ?? String(album?.sortOrder ?? 0)
  const inAlbum = new Set(album?.items.map((item) => item.id) ?? [])
  const attachable = assets.filter((asset) => !inAlbum.has(asset.id))

  async function save(nextStatus?: "draft" | "published") {
    if (!album) return
    const response = await fetch(`/api/admin/gallery/${album.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draftTitle.trim(),
        slug: draftSlug.trim() || album.slug,
        description: draftDescription.trim() || null,
        status: nextStatus ?? draftStatus,
        coverMediaAssetId: draftCover || null,
        sortOrder: Number.isFinite(Number(draftOrder)) ? Number(draftOrder) : 0,
      }),
    })
    const body = await response.json().catch(() => ({}))
    setMessage(response.ok ? "Saved" : body.error || "Save failed")
    if (response.ok) {
      setTitle(null)
      setSlug(null)
      setDescription(null)
      setStatus(null)
      setCoverMediaAssetId(null)
      setSortOrder(null)
      await mutate()
    }
  }

  async function addAsset(mediaAssetId: string) {
    if (!album) return
    const response = await fetch(`/api/admin/gallery/${album.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaAssetId }),
    })
    const body = await response.json().catch(() => ({}))
    setMessage(response.ok ? "Attached" : body.error || "Attach failed")
    await mutate()
  }

  async function onUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!album) return
    const form = new FormData(event.currentTarget)
    const upload = await fetch("/api/upload", { method: "POST", body: form })
    const uploaded = await upload.json().catch(() => ({}))
    if (!upload.ok || typeof uploaded.id !== "string") {
      setMessage(uploaded.error || "Upload failed")
      return
    }
    event.currentTarget.reset()
    await addAsset(uploaded.id)
  }

  async function moveItem(item: GalleryItem, direction: -1 | 1) {
    if (!album) return
    const ordered = [...album.items].sort((a, b) => a.sortOrder - b.sortOrder)
    const index = ordered.findIndex((row) => row.id === item.id)
    const swap = ordered[index + direction]
    if (!swap) return
    await Promise.all([
      fetch(`/api/admin/gallery/${album.id}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaAssetId: item.id, sortOrder: swap.sortOrder }),
      }),
      fetch(`/api/admin/gallery/${album.id}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaAssetId: swap.id, sortOrder: item.sortOrder }),
      }),
    ])
    await mutate()
  }

  async function removeItem(mediaAssetId: string) {
    if (!album) return
    await fetch(`/api/admin/gallery/${album.id}/items?mediaAssetId=${encodeURIComponent(mediaAssetId)}`, {
      method: "DELETE",
    })
    await mutate()
  }

  async function removeAlbum() {
    if (!album) return
    const response = await fetch(`/api/admin/gallery/${album.id}`, { method: "DELETE" })
    if (response.ok) router.push("/admin/media/gallery")
  }

  if (!data) return <div className="p-8">Loading…</div>
  if (!album) {
    return (
      <div className="container mx-auto space-y-4 px-4 py-8">
        <p>Album not found.</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/media/gallery">Back</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Album</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/media/gallery">All albums</Link>
        </Button>
      </div>

      <div className="grid gap-3">
        <Input value={draftTitle} onChange={(e) => setTitle(e.target.value)} />
        <Input value={draftSlug} onChange={(e) => setSlug(e.target.value)} />
        <Textarea value={draftDescription} onChange={(e) => setDescription(e.target.value)} />
        <Input value={draftOrder} onChange={(e) => setSortOrder(e.target.value)} type="number" />
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={draftCover}
          onChange={(e) => setCoverMediaAssetId(e.target.value)}
        >
          <option value="">Cover (first item if empty)</option>
          {album.items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void save()}>
            Save
          </Button>
          {draftStatus === "published" ? (
            <Button type="button" variant="outline" onClick={() => void save("draft")}>
              Unpublish
            </Button>
          ) : (
            <Button type="button" onClick={() => void save("published")}>
              Publish
            </Button>
          )}
          <Button type="button" variant="destructive" onClick={() => void removeAlbum()}>
            Delete
          </Button>
        </div>
      </div>

      <form onSubmit={onUpload} className="flex flex-wrap items-end gap-3">
        <Input name="file" type="file" required />
        <Input name="altText" placeholder="Alt text" />
        <Button type="submit">Upload into album</Button>
      </form>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Add from library</h2>
        {attachable.length === 0 ? (
          <p className="text-sm text-muted-foreground">No unused library assets.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {attachable.map((asset) => (
              <li key={asset.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="truncate text-sm">{asset.title}</span>
                <Button size="sm" variant="outline" onClick={() => void addAsset(asset.id)}>
                  Attach
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Album media</h2>
        {album.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No media in this album yet.</p>
        ) : (
          <ul className="space-y-3">
            {album.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 rounded-lg border p-3">
                {item.thumbnailSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.thumbnailSrc} alt="" className="h-16 w-16 rounded object-cover" />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.kind} · sort {item.sortOrder}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => void moveItem(item, -1)}>
                  Up
                </Button>
                <Button size="sm" variant="outline" onClick={() => void moveItem(item, 1)}>
                  Down
                </Button>
                <Button size="sm" variant="destructive" onClick={() => void removeItem(item.id)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  )
}
