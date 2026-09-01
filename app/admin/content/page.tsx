"use client"

import useSWR from "swr"
import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cmsPreviewPath } from "@/lib/cms/preview-pure"

type Entry = {
  id: string
  title: string
  slug: string
  entryType: "page" | "article"
  status: string
  routePath: string
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function AdminContentPage() {
  const [title, setTitle] = useState("")
  const [entryType, setEntryType] = useState<"page" | "article">("page")
  const { data, mutate } = useSWR("/api/admin/cms", fetcher)
  const entries: Entry[] = data?.entries ?? []

  async function createEntry(event: React.FormEvent) {
    event.preventDefault()
    await fetch("/api/admin/cms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, entryType }),
    })
    setTitle("")
    await mutate()
  }

  return (
    <div className="container mx-auto space-y-8 px-4 py-8">
      <h1 className="text-2xl font-bold">Content</h1>
      <form onSubmit={createEntry} className="flex flex-wrap gap-3">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" required />
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={entryType}
          onChange={(e) => setEntryType(e.target.value as "page" | "article")}
        >
          <option value="page">Page</option>
          <option value="article">Article</option>
        </select>
        <Button type="submit">Create draft</Button>
      </form>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No content yet. Create a draft with the form above.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium">{entry.title}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.entryType} · {entry.status} · {entry.routePath}
                </p>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={cmsPreviewPath(entry.id)}>Preview</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/content/${entry.id}`}>Edit</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
