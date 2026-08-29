export type CmsRevisionSnapshot = {
  title?: string
  slug?: string
  excerpt?: string | null
  body?: string
  heroMediaId?: string | null
  status?: "draft" | "in_review" | "published"
}

export type CmsEntryRestoreSource = {
  title: string
  slug: string
  excerpt: string | null
  body: string
  heroMediaId: string | null
  status: "draft" | "in_review" | "published"
  publishedAt: Date | null
  publishAt?: Date | null
}

export type CmsWorkingDraft = {
  title: string
  slug: string
  excerpt: string | null
  body: string
  heroMediaId: string | null
  status: "draft"
  publishedAt: null
  publishAt: null
}

export function parseCmsRevisionSnapshot(raw: unknown): CmsRevisionSnapshot {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const value = raw as Record<string, unknown>
  return {
    title: typeof value.title === "string" ? value.title : undefined,
    slug: typeof value.slug === "string" ? value.slug : undefined,
    excerpt:
      value.excerpt === null || typeof value.excerpt === "string" ? value.excerpt : undefined,
    body: typeof value.body === "string" ? value.body : undefined,
    heroMediaId:
      value.heroMediaId === null || typeof value.heroMediaId === "string"
        ? value.heroMediaId
        : undefined,
    status:
      value.status === "draft" || value.status === "in_review" || value.status === "published"
        ? value.status
        : undefined,
  }
}

/** Live-at is not a restore target; restored working copy is always unpublished. */
export function workingDraftFromRevision(
  entry: CmsEntryRestoreSource,
  snapshot: CmsRevisionSnapshot,
): CmsWorkingDraft {
  return {
    title: snapshot.title ?? entry.title,
    slug: snapshot.slug ?? entry.slug,
    excerpt: snapshot.excerpt === undefined ? entry.excerpt : snapshot.excerpt,
    body: snapshot.body ?? entry.body,
    heroMediaId: snapshot.heroMediaId === undefined ? entry.heroMediaId : snapshot.heroMediaId,
    status: "draft",
    publishedAt: null,
    publishAt: null,
  }
}

export function nextCmsRevisionNumber(latest: number | null | undefined) {
  return (latest ?? 0) + 1
}

export function cmsRevisionSnapshotFromDraft(draft: {
  title: string
  slug: string
  excerpt: string | null
  body: string
  heroMediaId: string | null
  status: "draft" | "in_review" | "published"
}) {
  return {
    title: draft.title,
    slug: draft.slug,
    excerpt: draft.excerpt,
    body: draft.body,
    heroMediaId: draft.heroMediaId,
    status: draft.status,
  }
}
