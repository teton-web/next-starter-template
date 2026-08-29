export const RESERVED_PATH_SEGMENTS = new Set([
  "admin",
  "api",
  "articles",
  "contact",
  "forgot-password",
  "login",
  "privacy",
  "reset-password",
  "site-gate",
  "terms",
  "waitlist",
  "gallery",
  "pay",
  "llms.txt",
])

const validSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function slugFromTitle(value: unknown, maxLength = 96) {
  if (typeof value !== "string") return ""
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")

  if (normalized.length <= maxLength) return normalized
  return normalized.slice(0, maxLength).replace(/-+$/g, "")
}

export function isValidSlug(value: unknown) {
  return typeof value === "string" && value.length > 0 && value.length <= 96 && validSlugPattern.test(value)
}

export function routeForEntry(entryType: "page" | "article", slug: string) {
  return entryType === "article" ? `/articles/${slug}` : `/${slug}`
}

export function isReservedSlug(slug: string) {
  return RESERVED_PATH_SEGMENTS.has(slug)
}
