"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

export type CmsRevisionListItem = {
  id: string
  revisionNumber: number
  createdAt: string | Date
  actorEmail: string | null
  snapshot: { status?: string } | null
}

function formatWhen(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? "Unknown time" : date.toLocaleString()
}

function snapshotStatus(snapshot: CmsRevisionListItem["snapshot"]) {
  const status = snapshot?.status
  return status === "draft" || status === "in_review" || status === "published" ? status : "unknown"
}

export function CmsRevisionList({
  entryId,
  revisions,
  onRestored,
}: {
  entryId: string
  revisions: CmsRevisionListItem[]
  onRestored: () => Promise<void>
}) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [message, setMessage] = useState("")

  async function restore(revisionId: string) {
    setPendingId(revisionId)
    setMessage("")
    try {
      const response = await fetch(`/api/admin/cms/${entryId}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revisionId }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(typeof body.error === "string" ? body.error : "Restore failed")
        return
      }
      await onRestored()
    } finally {
      setPendingId(null)
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Revisions</h2>
      {revisions.length === 0 ? (
        <p role="status" className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
          No revisions yet.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {revisions.map((revision) => (
            <li key={revision.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Revision {revision.revisionNumber}</p>
                <p className="text-xs text-muted-foreground">
                  {formatWhen(revision.createdAt)} · {revision.actorEmail ?? "Unknown"} ·{" "}
                  {snapshotStatus(revision.snapshot)}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pendingId !== null}
                aria-label={`Restore revision ${revision.revisionNumber}`}
                onClick={() => void restore(revision.id)}
              >
                {pendingId === revision.id ? "Restoring…" : "Restore"}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </section>
  )
}
