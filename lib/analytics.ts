import { track } from "@vercel/analytics/server"

export const ANALYTICS_EVENTS = [
  "contact_submit",
  "contact_submit_failed",
  "waitlist_submit",
  "waitlist_submit_failed",
  "cms_publish",
  "media_upload",
] as const

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number]

const ALLOWED_KEYS = new Set([
  "destination",
  "status",
  "entry_type",
  "kind",
  "error_code",
])

export function sanitizeAnalyticsProps(props: Record<string, unknown> | undefined) {
  if (!props) return {}
  const next: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(props)) {
    if (!ALLOWED_KEYS.has(key)) continue
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      next[key] = typeof value === "string" ? value.slice(0, 120) : value
    }
  }
  return next
}

export function trackEvent(name: AnalyticsEvent, props?: Record<string, unknown>) {
  if (!(ANALYTICS_EVENTS as readonly string[]).includes(name)) return
  try {
    void Promise.resolve(track(name, sanitizeAnalyticsProps(props))).catch(() => {})
  } catch {
    // fail-open: mutations must succeed even if analytics is down
  }
}
