"use client"

import useSWR from "swr"
import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type GalleryAlbum = {
  id: string
  slug: string
  title: string
  description: string | null
  status: "draft" | "published"
  sortOrder: number
  items: unknown[]
}

type GalleryResponse = {
  albums: GalleryAlbum[]
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function GalleryAlbumList() {
  const { data, mutate } = useSWR<GalleryResponse>("/api/admin/gallery", fetcher)
  const albums = data?.albums ?? []
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [sortOrder, setSortOrder] = useState("0")
  const [message, setMessage] = useState("")

  async function createAlbum(event: React.FormEvent) {
    event.preventDefault()
    const response = await fetch("/api/admin/gallery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        slug: slug.trim() || null,
        description: description.trim() || null,
        status: "draft",
        sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
      }),
    })
    const body = await response.json().catch(() => ({}))
    setMessage(response.ok ? "Created draft album" : body.error || "Create failed")
    if (response.ok) {
      setTitle("")
      setSlug("")
      setDescription("")
      setSortOrder("0")
      await mutate()
    }
  }

  return (
    <div className="container mx-auto space-y-8 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Gallery albums</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/media">Back to media</Link>
        </Button>
      </div>
      <form onSubmit={createAlbum} className="grid gap-3 md:max-w-lg">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" required />
        <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="Slug (optional)" />
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
        />
        <Input
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          placeholder="Sort order"
          type="number"
        />
        <Button type="submit">Create draft</Button>
      </form>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {albums.length === 0 ? (
        <p className="text-sm text-muted-foreground">No albums yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {albums.map((album) => (
            <li key={album.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <p className="font-medium">{album.title}</p>
                <p className="text-xs text-muted-foreground">
                  {album.status} · /gallery/{album.slug} · {album.items.length} items · sort {album.sortOrder}
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/media/gallery/${album.id}`}>Manage</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
