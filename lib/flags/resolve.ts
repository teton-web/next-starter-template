import "server-only"

import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { featureFlags } from "@/lib/db/schema"
import { FLAG_CATALOG, isFlagKey, isOptionalFlagKey, type FlagKey } from "./catalog"
import { cacheEpoch, getCachedDbEnabled, setCachedDbEnabled } from "./cache"
import { hasRequiredEnv, isFeatureHardOff, type EnvMap } from "./env"
import { resolveEnabled } from "./resolve-pure"
import { hasStoredSiteGateHash } from "./site-gate-password"
import { optionalDbOverlay, resolvedFlagEnabled } from "./status"

export { resolveEnabled } from "./resolve-pure"

export type FlagOverlayRow = {
  enabled: boolean
  config: Record<string, unknown>
}

export type IsEnabledOptions = {
  env?: EnvMap
  /** DB `enabled` when a row exists; `null` when no row. Omit to read from the database. */
  dbEnabled?: boolean | null
  /** Row config; required for `site_gate` when `dbEnabled` is injected. */
  config?: Record<string, unknown> | null
}

export async function readFlagRow(key: FlagKey): Promise<FlagOverlayRow | null> {
  const rows = await db
    .select({
      enabled: featureFlags.enabled,
      config: featureFlags.config,
    })
    .from(featureFlags)
    .where(eq(featureFlags.key, key))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  return { enabled: row.enabled, config: row.config ?? {} }
}

export async function readDbEnabled(key: FlagKey): Promise<boolean | null> {
  const row = await readFlagRow(key)
  return row?.enabled ?? null
}

export async function isEnabled(key: FlagKey, options?: IsEnabledOptions): Promise<boolean>
export async function isEnabled(key: string, options?: IsEnabledOptions): Promise<boolean>
export async function isEnabled(key: string, options: IsEnabledOptions = {}): Promise<boolean> {
  if (!isFlagKey(key)) return false

  const env = options.env ?? process.env
  if (isFeatureHardOff(key, env)) return false

  const definition = FLAG_CATALOG[key]
  if (definition.platform) {
    return hasRequiredEnv(key, env)
  }

  let dbEnabled: boolean | null
  let config = options.config
  if (options.dbEnabled !== undefined) {
    dbEnabled = options.dbEnabled
    return resolvedFlagEnabled(key, { env, dbEnabled, config })
  } else if (isOptionalFlagKey(key)) {
    const cached = getCachedDbEnabled(key)
    if (cached !== undefined) {
      dbEnabled = cached
    } else {
      const readEpoch = cacheEpoch()
      try {
        const row = await readFlagRow(key)
        dbEnabled = optionalDbOverlay(key, row)
        config = row?.config ?? {}
      } catch {
        if (cacheEpoch() === readEpoch) {
          setCachedDbEnabled(key, null, { epoch: readEpoch })
        }
        const afterError = getCachedDbEnabled(key)
        if (afterError !== undefined) {
          return resolveEnabled(key, { env, dbEnabled: afterError })
        }
        return false
      }
      if (cacheEpoch() !== readEpoch) {
        const afterInvalidate = getCachedDbEnabled(key)
        if (afterInvalidate !== undefined) {
          dbEnabled = afterInvalidate
        }
      } else {
        setCachedDbEnabled(key, dbEnabled, {
          epoch: readEpoch,
          siteGateHashPresent: key === "site_gate" ? hasStoredSiteGateHash(config) : undefined,
        })
      }
    }
  } else {
    dbEnabled = null
  }

  return resolveEnabled(key, { env, dbEnabled })
}
