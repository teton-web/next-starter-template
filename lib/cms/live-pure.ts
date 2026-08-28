/** Public/sitemap “live” check. Future `publishAt` (POR-392) is never treated as live. */

export function scheduledPublishAt(entry: object | null | undefined): Date | string | null {
  if (!entry || typeof entry !== "object") return null
  const rec = entry as Record<string, unknown>
  const value = rec.publishAt ?? rec.publish_at
  if (value instanceof Date || typeof value === "string") return value
  return null
}

export function isLivePublishedEntry(
  entry: { status: string } | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!entry || entry.status !== "published") return false
  const scheduled = scheduledPublishAt(entry)
  if (scheduled == null || scheduled === "") return true
  const at = scheduled instanceof Date ? scheduled : new Date(scheduled)
  if (Number.isNaN(at.getTime())) return false
  return at.getTime() <= now.getTime()
}
