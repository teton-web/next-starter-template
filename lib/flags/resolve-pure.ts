import { FLAG_CATALOG, isFlagKey, type FlagKey } from "./catalog"
import { hasRequiredEnv, isFeatureHardOff, type EnvMap } from "./env"

/**
 * Resolve a catalog flag with no I/O.
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
