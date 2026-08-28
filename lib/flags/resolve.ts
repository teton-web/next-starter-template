import "server-only"

import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { featureFlags } from "@/lib/db/schema"
import { FLAG_CATALOG, isFlagKey, type FlagKey } from "./catalog"
import { hasRequiredEnv, isFeatureHardOff, type EnvMap } from "./env"

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

/**
 * Resolve a catalog flag.
 * Order: Doppler `FEATURE_<KEY>=0` hard-off → DB row (non-platform) → catalog default.
 * Then key-presence: missing required env keeps the flag dark.
 * Unknown keys are off. Platform keys ignore admin/DB off; Doppler still kill-switches them.
 * Catalog `dependsOn` is metadata only and is not walked (e.g. scheduled_publish
 * can resolve on while cron is off).
 */
export function resolveEnabled(key: FlagKey, options?: { env?: EnvMap; dbEnabled?: boolean | null }): boolean
export function resolveEnabled(key: string, options?: { env?: EnvMap; dbEnabled?: boolean | null }): boolean
export function resolveEnabled(key: string, options: { env?: EnvMap; dbEnabled?: boolean | null } = {}): boolean {
  if (!isFlagKey(key)) return false

  const env = options.env ?? process.env
  if (isFeatureHardOff(key, env)) return false

  const definition = FLAG_CATALOG[key]
  let enabled: boolean
  if (definition.platform) {
    enabled = true
  } else if (options.dbEnabled !== undefined && options.dbEnabled !== null) {
    enabled = options.dbEnabled
  } else {
    enabled = definition.defaultEnabled
  }

  if (!enabled) return false
  return hasRequiredEnv(key, env)
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

  const dbEnabled =
    options.dbEnabled !== undefined ? options.dbEnabled : await readDbEnabled(key)

  return resolveEnabled(key, { env, dbEnabled })
}
