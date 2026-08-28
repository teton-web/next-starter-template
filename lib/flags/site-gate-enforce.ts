import {
  isSiteGateEnabled,
  shouldEnforceSiteGate,
  SITE_GATE_PUBLIC_STATE_PATH,
} from "@/lib/site-gate"
import {
  getCachedSiteGatePublicEnforce,
  isSiteGateOverlayCold,
  setCachedSiteGatePublicEnforce,
} from "./cache"
import { isFeatureHardOff, type EnvMap } from "./env"

export { isSiteGateOverlayCold, SITE_GATE_PUBLIC_STATE_TTL_MS } from "./cache"

type SiteGateFlagSnapshot = {
  isEnabled: (key: string) => boolean
  siteGateHashPresent?: boolean
}

export async function fetchSiteGatePublicEnforce(
  originUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean | null> {
  try {
    const url = new URL(SITE_GATE_PUBLIC_STATE_PATH, originUrl)
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(2500),
    })
    if (!response.ok) return null
    const body = (await response.json()) as { enforce?: unknown }
    return typeof body.enforce === "boolean" ? body.enforce : null
  } catch {
    return null
  }
}

/**
 * Warm overlay uses catalog + cookie/memory. Cold preview/prod fetches
 * Node `{ enforce }` (no Neon in this module). Fetch failure fail-closes.
 */
export async function resolveSiteGateEnforce(
  request: { url: string; nextUrl: { pathname: string } },
  flags: SiteGateFlagSnapshot,
  options: { env?: EnvMap; now?: number; fetchImpl?: typeof fetch } = {},
): Promise<boolean> {
  const env = options.env ?? process.env
  if (!isSiteGateEnabled(env) || isFeatureHardOff("site_gate", env)) return false
  if (request.nextUrl.pathname === SITE_GATE_PUBLIC_STATE_PATH) return false

  if (!isSiteGateOverlayCold(options.now)) {
    return shouldEnforceSiteGate({
      flagEnabled: flags.isEnabled("site_gate"),
      hashPresent: flags.siteGateHashPresent,
      env,
    })
  }

  const cached = getCachedSiteGatePublicEnforce(options.now)
  if (cached !== undefined) return cached

  const fetched = await fetchSiteGatePublicEnforce(request.url, options.fetchImpl)
  if (fetched === null) return true
  setCachedSiteGatePublicEnforce(fetched, { now: options.now })
  return fetched
}
