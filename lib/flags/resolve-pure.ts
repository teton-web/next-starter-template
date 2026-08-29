import { FLAG_CATALOG, isFlagKey, type FlagKey } from "./catalog"
import { hasRequiredEnv, isFeatureHardOff, type EnvMap } from "./env"

export type ResolveEnabledOptions = {
  env?: EnvMap
  dbEnabled?: boolean | null
  /** DB overlays for `dependsOn` keys. Missing keys use catalog default. */
  dependencyDbEnabled?: Partial<Record<FlagKey, boolean | null>>
}

/**
 * Resolve a catalog flag with no I/O.
 * Order: Doppler `FEATURE_<KEY>=0` hard-off → DB row (non-platform) → catalog default.
 * Then key-presence: missing required env keeps the flag dark.
 * Unknown keys are off. Platform keys ignore admin/DB off; Doppler still kill-switches them.
 * Catalog `dependsOn` is a hard gate (e.g. scheduled_publish stays dark unless cron resolves on).
 */
export function resolveEnabled(key: FlagKey, options?: ResolveEnabledOptions): boolean
export function resolveEnabled(key: string, options?: ResolveEnabledOptions): boolean
export function resolveEnabled(key: string, options: ResolveEnabledOptions = {}): boolean {
  return resolveEnabledWalk(key, options, new Set())
}

function resolveEnabledWalk(
  key: string,
  options: ResolveEnabledOptions,
  visiting: Set<string>,
): boolean {
  if (!isFlagKey(key)) return false
  if (visiting.has(key)) return false
  visiting.add(key)

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
  if (!hasRequiredEnv(key, env)) return false

  for (const dep of definition.dependsOn) {
    const depDb = options.dependencyDbEnabled?.[dep]
    if (
      !resolveEnabledWalk(
        dep,
        { env, dbEnabled: depDb === undefined ? null : depDb, dependencyDbEnabled: options.dependencyDbEnabled },
        visiting,
      )
    ) {
      return false
    }
  }
  return true
}
