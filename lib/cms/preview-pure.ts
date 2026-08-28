export const CMS_PREVIEW_PATH_PREFIX = "/admin/preview"

export function decodeCmsPreviewKey(raw: string) {
  const trimmed = raw.trim()
  if (!trimmed) return ""
  try {
    return decodeURIComponent(trimmed).trim()
  } catch {
    return trimmed
  }
}

export function cmsPreviewPath(idOrSlug: string) {
  const key = decodeCmsPreviewKey(idOrSlug) || idOrSlug.trim()
  return `${CMS_PREVIEW_PATH_PREFIX}/${encodeURIComponent(key)}`
}

export function isUnpublishedCmsStatus(status: string) {
  return status === "draft" || status === "in_review"
}

export type CmsPreviewPickable = {
  id: string
  slug: string
  routePath: string
  status: string
  updatedAt: Date
}

export function cmsPreviewKeyCandidates(key: string) {
  const decoded = decodeCmsPreviewKey(key)
  const slug = decoded.replace(/^\/+/, "")
  const routePaths = new Set<string>()
  if (decoded.startsWith("/")) {
    routePaths.add(decoded)
  } else if (decoded) {
    routePaths.add(`/${decoded}`)
    routePaths.add(`/articles/${decoded}`)
  }
  if (slug.startsWith("articles/")) {
    routePaths.add(`/${slug}`)
  }
  return { id: decoded, slug, routePaths: [...routePaths] }
}

export function matchesCmsPreviewKey(entry: CmsPreviewPickable, key: string) {
  const { id, slug, routePaths } = cmsPreviewKeyCandidates(key)
  return entry.id === id || entry.slug === slug || routePaths.includes(entry.routePath)
}

export function pickCmsPreviewEntry<T extends CmsPreviewPickable>(entries: T[], key: string): T | null {
  const { id } = cmsPreviewKeyCandidates(key)
  if (!id) return null
  const byId = entries.find((entry) => entry.id === id)
  if (byId) return byId
  const matches = entries.filter((entry) => matchesCmsPreviewKey(entry, key))
  if (!matches.length) return null
  const unpublished = matches.filter((entry) => isUnpublishedCmsStatus(entry.status))
  const pool = unpublished.length > 0 ? unpublished : matches
  return pool.slice().sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] ?? null
}
