"use client"

import useSWR from "swr"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { cmsPreviewPath } from "@/lib/cms/preview-pure"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CmsRevisionList, type CmsRevisionListItem } from "@/components/admin/cms-revision-list"
import {
  datetimeLocalToUtcIso,
  utcToDatetimeLocalValue,
} from "@/lib/cms/scheduled-publish-pure"

type Entry = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  body: string
  status: "draft" | "in_review" | "published"
  heroMediaId: string | null
  routePath: string
  publishAt: string | Date | null
}

type MediaAsset = {
  id: string
  filename: string
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function EditCmsEntryPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { data, mutate } = useSWR(params.id ? `/api/admin/cms/${params.id}` : null, fetcher)
  const { data: mediaData } = useSWR("/api/admin/media?q=", fetcher)
  const mediaAssets: MediaAsset[] = mediaData?.assets ?? []
  const remote: Entry | null = data?.entry ?? null
  const revisions: CmsRevisionListItem[] = data?.revisions ?? []
  const scheduledPublishEnabled = data?.scheduledPublishEnabled === true
  const [draft, setDraft] = useState<Entry | null>(null)
  const [message, setMessage] = useState("")
  const entry = draft ?? remote

  async function remove() {
    if (!entry) return
    const response = await fetch(`/api/admin/cms/${entry.id}`, { method: "DELETE" })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      setMessage(typeof body.error === "string" ? body.error : "Delete failed")
      return
    }
    router.push("/admin/content")
  }

  async function save(status?: Entry["status"]) {
    if (!entry) return
    const response = await fetch(`/api/admin/cms/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: entry.title,
        slug: entry.slug,
        excerpt: entry.excerpt,
        body: entry.body,
        heroMediaId: entry.heroMediaId,
        status: status ?? entry.status,
        ...(scheduledPublishEnabled
          ? { publishAt: entry.publishAt ? new Date(entry.publishAt).toISOString() : null }
          : {}),
      }),
    })
    const body = await response.json()
    setMessage(response.ok ? `Saved (${body.status})` : body.error || "Save failed")
    setDraft(null)
    await mutate()
  }

  if (!entry) return <div className="p-8">Loading…</div>

  return (
    <div className="container mx-auto max-w-3xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-bold">Edit {entry.routePath}</h1>
      <div className="space-y-2">
        <Label htmlFor="cms-title">Title</Label>
        <Input
          id="cms-title"
          value={entry.title}
          onChange={(e) => setDraft({ ...entry, title: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cms-slug">Slug</Label>
        <Input
          id="cms-slug"
          value={entry.slug}
          onChange={(e) => setDraft({ ...entry, slug: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cms-excerpt">Excerpt</Label>
        <Input
          id="cms-excerpt"
          value={entry.excerpt ?? ""}
          onChange={(e) => setDraft({ ...entry, excerpt: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cms-hero">Hero</Label>
        <select
          id="cms-hero"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={entry.heroMediaId ?? ""}
          onChange={(e) => setDraft({ ...entry, heroMediaId: e.target.value || null })}
        >
          <option value="">No hero</option>
          {mediaAssets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.filename}
            </option>
          ))}
        </select>
        {mediaData && mediaAssets.length === 0 ? (
          <p className="text-sm text-muted-foreground">Upload a file in Media first.</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="cms-body">Body</Label>
        <Textarea
          id="cms-body"
          rows={16}
          value={entry.body}
          onChange={(e) => setDraft({ ...entry, body: e.target.value })}
        />
      </div>
      {scheduledPublishEnabled ? (
        <div className="space-y-2">
          <Label htmlFor="cms-publish-at">Publish at</Label>
          <Input
            id="cms-publish-at"
            type="datetime-local"
            value={utcToDatetimeLocalValue(entry.publishAt)}
            onChange={(e) => {
              const next = datetimeLocalToUtcIso(e.target.value)
              if (next === undefined) return
              setDraft({
                ...entry,
                publishAt: next,
              })
            }}
          />
          <p className="text-xs text-muted-foreground">Stored as UTC. Shown in your local timezone.</p>
        </div>
      ) : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href={cmsPreviewPath(entry.id)}>Preview</Link>
        </Button>
        <Button onClick={() => void save()}>Save draft</Button>
        <Button variant="outline" onClick={() => void save("in_review")}>Submit review</Button>
        <Button onClick={() => void save("published")}>Publish</Button>
        <Button variant="outline" onClick={() => void save("draft")}>Unpublish</Button>
        {entry.status === "draft" ? (
          <Button variant="destructive" onClick={() => void remove()}>Delete</Button>
        ) : null}
      </div>
      <CmsRevisionList
        entryId={entry.id}
        revisions={revisions}
        onRestored={async () => {
          setDraft(null)
          setMessage("Restored as draft")
          await mutate()
        }}
      />
    </div>
  )
}
