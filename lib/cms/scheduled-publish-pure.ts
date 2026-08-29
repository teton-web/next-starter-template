import { isLivePublishedEntry, scheduledPublishAt } from "@/lib/cms/live-pure"

export const SCHEDULED_PUBLISH_DISABLED_MESSAGE = "Scheduled publish is disabled"
export const INVALID_PUBLISH_AT_MESSAGE = "Invalid publishAt"

const ISO_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/
const DATETIME_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

function asDate(value: Date | string | null | undefined): Date | null {
  if (value == null || value === "") return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

/** `undefined` = omit; `null` = clear; Date = UTC instant. Throws on invalid non-empty strings. */
export function parsePublishAtInput(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === "") return null
  if (!ISO_WITH_OFFSET.test(value) || Number.isNaN(new Date(value).getTime())) {
    throw new Error(INVALID_PUBLISH_AT_MESSAGE)
  }
  return new Date(value)
}

export function assertPublishAtAllowed(
  publishAt: Date | null | undefined,
  scheduledPublishEnabled: boolean,
): void {
  if (publishAt == null) return
  if (!scheduledPublishEnabled) {
    throw new Error(SCHEDULED_PUBLISH_DISABLED_MESSAGE)
  }
}

/** Rows the public site and sitemap may list. */
export function publishedEntriesForPublic<T extends { status: string }>(
  rows: T[],
  now: Date = new Date(),
): T[] {
  return rows.filter((row) => isLivePublishedEntry(row, now))
}

/**
 * Waiting for first go-live: `publish_at` is set, due, and `publishedAt` is still null.
 */
export function isDueScheduledPublish(
  entry: { publishedAt?: Date | string | null } | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!entry) return false
  if (asDate(entry.publishedAt) != null) return false
  const scheduled = asDate(scheduledPublishAt(entry))
  if (!scheduled || scheduled.getTime() > now.getTime()) return false
  return true
}

export function scheduledPublishFlipValues(now: Date = new Date()) {
  return {
    status: "published" as const,
    publishedAt: now,
  }
}

export function nextCmsStatusForSave(input: {
  requestedStatus: "draft" | "in_review" | "published"
  previousStatus: "draft" | "in_review" | "published"
  publishAt: Date | string | null | undefined
  now?: Date
}): "draft" | "in_review" | "published" {
  if (input.requestedStatus !== "published") return input.requestedStatus
  const scheduled = asDate(input.publishAt)
  const now = input.now ?? new Date()
  if (scheduled && scheduled.getTime() > now.getTime()) {
    return input.previousStatus === "in_review" ? "in_review" : "draft"
  }
  return "published"
}

export function nextPublishedAtForSave(input: {
  status: "draft" | "in_review" | "published"
  previousPublishedAt: Date | null
  publishAt: Date | string | null | undefined
  now?: Date
}): Date | null {
  if (input.status === "draft") return null
  if (input.status !== "published") return input.previousPublishedAt
  const now = input.now ?? new Date()
  const scheduled = asDate(input.publishAt)
  if (scheduled && scheduled.getTime() > now.getTime()) return null
  return input.previousPublishedAt ?? now
}

/**
 * Keep a due schedule on never-live draft/in_review so the worker can still flip.
 * Clear a past leftover when pulling down after go-live: draft and
 * (`previousStatus === "published"` or `previousPublishedAt` is set).
 */
export function nextPublishAtForSave(input: {
  status: "draft" | "in_review" | "published"
  previousStatus: "draft" | "in_review" | "published"
  previousPublishAt: Date | string | null | undefined
  previousPublishedAt?: Date | string | null
  parsedPublishAt: Date | null | undefined
  now?: Date
}): Date | null {
  const now = input.now ?? new Date()
  const unpublishedFromLive =
    input.status === "draft" &&
    (input.previousStatus === "published" || asDate(input.previousPublishedAt) != null)
  if (input.parsedPublishAt !== undefined) {
    const explicit = asDate(input.parsedPublishAt)
    if (unpublishedFromLive && explicit && explicit.getTime() <= now.getTime()) return null
    return explicit
  }
  const previous = asDate(input.previousPublishAt)
  if (unpublishedFromLive) {
    if (previous && previous.getTime() > now.getTime()) return previous
    return null
  }
  return previous
}

function pad2(value: number) {
  return String(value).padStart(2, "0")
}

/** Display UTC instants as `datetime-local` in the viewer's local timezone. */
export function utcToDatetimeLocalValue(value: Date | string | null | undefined): string {
  const date = asDate(value)
  if (!date) return ""
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/**
 * Browser `datetime-local` is local; persist UTC ISO.
 * Empty → `null` (clear). Invalid non-empty → `undefined` (no state change).
 */
export function datetimeLocalToUtcIso(value: string): string | null | undefined {
  const trimmed = value.trim()
  if (!trimmed) return null
  const match = DATETIME_LOCAL.exec(trimmed)
  if (!match) return undefined
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  )
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString()
}
