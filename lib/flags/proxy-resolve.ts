import { FLAG_CATALOG, isFlagKey, isOptionalFlagKey } from "./catalog"
import {
  decodeFeatureFlagCacheCookie,
  overlayDbEnabled,
  overlaySiteGateHashPresent,
  setCachedOptionalOverrides,
  type OptionalFlagOverrides,
} from "./cache"
import { hasRequiredEnv, isFeatureHardOff, type EnvMap } from "./env"
import { resolveEnabled } from "./resolve-pure"

export {
  FEATURE_FLAG_CACHE_COOKIE,
  FEATURE_FLAG_CACHE_TTL_MS,
  decodeFeatureFlagCacheCookie,
  encodeFeatureFlagCacheCookie,
  encodeWarmFlagCacheCookie,
  featureFlagCacheCookieAttrs,
  getCachedSiteGateHashPresent,
  getWarmFlagCacheSnapshot,
  invalidateFeatureFlagCache,
  overlaySiteGateHashPresent,
} from "./cache"

export type ProxyFlagOptions = {
  env?: EnvMap
  dbEnabled?: boolean | null
  overrides?: OptionalFlagOverrides | null
  cookieIssuedAt?: number
  now?: number
}

/**
 * Edge/proxy-safe flag read. Catalog + Doppler `FEATURE_*=0` + memory/cookie overlay.
 * Never opens Neon. Cold overlay: optional flags fail closed; platform stays up.
 */
export function isEnabledForProxy(key: string, options: ProxyFlagOptions = {}): boolean {
  if (!isFlagKey(key)) return false

  const env = options.env ?? process.env
  if (isFeatureHardOff(key, env)) return false

  const definition = FLAG_CATALOG[key]
  if (definition.platform) {
    return hasRequiredEnv(key, env)
  }

  let dbEnabled: boolean | null | undefined
  if (options.dbEnabled !== undefined) {
    dbEnabled = options.dbEnabled
  } else if (isOptionalFlagKey(key)) {
    dbEnabled = overlayDbEnabled(key, options.overrides, options.cookieIssuedAt, options.now)
  }

  return resolveEnabled(key, {
    env,
    dbEnabled: dbEnabled ?? null,
    dependencyDbEnabled: options.overrides ?? undefined,
  })
}

export async function resolveProxyFlags(
  cookieValue?: string,
  options: { env?: EnvMap; now?: number } = {},
) {
  const decoded = await decodeFeatureFlagCacheCookie(cookieValue, { env: options.env, now: options.now })
  const overrides = decoded?.overrides ?? null
  const cookieIssuedAt = decoded?.iat
  if (decoded) {
    setCachedOptionalOverrides(decoded.overrides, {
      now: options.now,
      issuedAt: decoded.iat,
      expiresAt: decoded.exp,
      siteGateHashPresent: decoded.siteGateHashPresent,
    })
  }
  const siteGateHashPresent = overlaySiteGateHashPresent(
    decoded?.siteGateHashPresent,
    cookieIssuedAt,
    options.now,
  )
  return {
    overrides,
    cookieIssuedAt,
    cookieExpiresAt: decoded?.exp,
    siteGateHashPresent,
    isEnabled(key: string) {
      return isEnabledForProxy(key, {
        env: options.env,
        overrides,
        cookieIssuedAt,
        now: options.now,
      })
    },
  }
}
