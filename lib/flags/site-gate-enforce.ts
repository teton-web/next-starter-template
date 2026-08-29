import {
  isSiteGateEnabled,
  leftoverSiteGatePassword,
  shouldEnforceSiteGate,
  SITE_GATE_PUBLIC_STATE_PATH,
  siteGateUnlockBinding,
} from "@/lib/site-gate"
import {
  getCachedSiteGatePublicEnforce,
  getCachedSiteGateUnlockBinding,
  isSiteGateOverlayCold,
  setCachedSiteGatePublicEnforce,
} from "./cache"
import { isFeatureHardOff, type EnvMap } from "./env"

export { isSiteGateOverlayCold, SITE_GATE_PUBLIC_STATE_TTL_MS } from "./cache"

type SiteGateFlagSnapshot = {
  isEnabled: (key: string) => boolean
  siteGateHashPresent?: boolean
}

export type SiteGatePublicState = {
  enforce: boolean
  hv?: string
}

export async function fetchSiteGatePublicEnforce(
  originUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SiteGatePublicState | null> {
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
    const body = (await response.json()) as { enforce?: unknown; hv?: unknown }
    if (typeof body.enforce !== "boolean") return null
    const hv = typeof body.hv === "string" && body.hv.trim() ? body.hv.trim() : undefined
    return hv ? { enforce: body.enforce, hv } : { enforce: body.enforce }
  } catch {
    return null
  }
}

/**
 * Warm overlay uses catalog + cookie/memory. Cold preview/prod fetches
 * Node `{ enforce, hv? }` (no Neon in this module). Fetch failure fail-closes.
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
  setCachedSiteGatePublicEnforce(fetched.enforce, { now: options.now, hv: fetched.hv })
  return fetched.enforce
}

/**
 * Current unlock-cookie binding without Neon. Stored-hash `hv` comes from
 * public-state; leftover env password is hashed locally only when no hash is
 * known. Fetch failure does not leftover-bind.
 */
export async function resolveSiteGateUnlockBinding(
  request: { url: string },
  flags: SiteGateFlagSnapshot,
  options: { env?: EnvMap; now?: number; fetchImpl?: typeof fetch } = {},
): Promise<string> {
  const env = options.env ?? process.env
  const cached = getCachedSiteGateUnlockBinding(options.now)
  if (cached) return cached

  if (flags.siteGateHashPresent === false) {
    const leftover = leftoverSiteGatePassword(env)
    return leftover ? siteGateUnlockBinding(leftover) : ""
  }

  const fetched = await fetchSiteGatePublicEnforce(request.url, options.fetchImpl)
  if (fetched === null) return ""
  setCachedSiteGatePublicEnforce(fetched.enforce, { now: options.now, hv: fetched.hv })
  if (fetched.hv) return fetched.hv
  if (flags.siteGateHashPresent === true) return ""

  const leftover = leftoverSiteGatePassword(env)
  return leftover ? siteGateUnlockBinding(leftover) : ""
}
