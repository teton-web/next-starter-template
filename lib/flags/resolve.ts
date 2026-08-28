import "server-only"

import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { featureFlags } from "@/lib/db/schema"
import { FLAG_CATALOG, isFlagKey, isOptionalFlagKey, type FlagKey } from "./catalog"
import { cacheEpoch, getCachedDbEnabled, setCachedDbEnabled } from "./cache"
import { hasRequiredEnv, isFeatureHardOff, type EnvMap } from "./env"
import { resolveEnabled } from "./resolve-pure"

export { resolveEnabled } from "./resolve-pure"

export type IsEnabledOptions = {
  env?: EnvMap
  /** DB `enabled` when a row exists; `null` when no row. Omit to read from the database. */
  dbEnabled?: boolean | null
}

export async function readDbEnabled(key: FlagKey): Promise<boolean | null> {
  const rows = await db
    .select({ enabled: featureFlags.enabled })
    .from(featureFlags)
    .where(eq(featureFlags.key, key))
    .limit(1)
  return rows[0]?.enabled ?? null
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
  if (options.dbEnabled !== undefined) {
    dbEnabled = options.dbEnabled
  } else if (isOptionalFlagKey(key)) {
    const cached = getCachedDbEnabled(key)
    if (cached !== undefined) {
      dbEnabled = cached
    } else {
      const readEpoch = cacheEpoch()
      try {
        dbEnabled = await readDbEnabled(key)
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
        setCachedDbEnabled(key, dbEnabled, { epoch: readEpoch })
      }
    }
  } else {
    dbEnabled = null
  }

  return resolveEnabled(key, { env, dbEnabled })
}
