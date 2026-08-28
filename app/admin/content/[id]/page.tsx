"use client"

import useSWR from "swr"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CmsRevisionList, type CmsRevisionListItem } from "@/components/admin/cms-revision-list"

type Entry = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  body: string
  status: "draft" | "in_review" | "published"
  heroMediaId: string | null
  routePath: string
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function EditCmsEntryPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { data, mutate } = useSWR(params.id ? `/api/admin/cms/${params.id}` : null, fetcher)
  const remote: Entry | null = data?.entry ?? null
  const revisions: CmsRevisionListItem[] = data?.revisions ?? []
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
      <Input value={entry.title} onChange={(e) => setDraft({ ...entry, title: e.target.value })} />
      <Input value={entry.slug} onChange={(e) => setDraft({ ...entry, slug: e.target.value })} />
      <Input
        value={entry.excerpt ?? ""}
        onChange={(e) => setDraft({ ...entry, excerpt: e.target.value })}
        placeholder="Excerpt"
      />
      <Input
        value={entry.heroMediaId ?? ""}
        onChange={(e) => setDraft({ ...entry, heroMediaId: e.target.value || null })}
        placeholder="Hero media asset id"
      />
      <Textarea rows={16} value={entry.body} onChange={(e) => setDraft({ ...entry, body: e.target.value })} />
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <div className="flex flex-wrap gap-2">
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
