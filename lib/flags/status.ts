import {
  FLAG_CATALOG,
  FLAG_KEYS,
  isFlagKey,
  isOptionalFlagKey,
  type FlagKey,
  type OptionalFlagKey,
} from "./catalog"
import { featureEnvName, isFeatureHardOff, missingRequiredEnv, type EnvMap } from "./env"
import { resolveEnabled } from "./resolve-pure"
import { hasStoredSiteGateHash } from "./site-gate-password"

export type FlagStatus = {
  key: FlagKey
  label: string
  platform: boolean
  defaultEnabled: boolean
  storedEnabled: boolean | null
  enabled: boolean
  toggleable: boolean
  lockedOff: boolean
  dependsOn: readonly FlagKey[]
  missingEnv: string[]
  hasPassword: boolean
  reasons: string[]
}

export type FlagRowInput = {
  key: string
  enabled: boolean
  config?: Record<string, unknown> | null
}

export function killSwitchReason(key: FlagKey): string {
  return `Locked off by Doppler kill switch (${featureEnvName(key)}=0).`
}

export function platformLockedReason(): string {
  return "Platform flags are always on and cannot be turned off."
}

export function siteGatePasswordReason(): string {
  return "Site gate requires a stored password hash"
}

export function dependsOnReason(deps: readonly FlagKey[]): string | null {
  if (deps.length === 0) return null
  return `Requires ${deps.join(", ")}`
}

export function missingEnvReason(key: FlagKey, missing: string[]): string | null {
  if (missing.length === 0) return null
  if (key === "stripe") return "Stripe keys missing in Doppler"
  if (key === "oauth") return "Google client id/secret missing in Doppler"
  if (key === "cron") return "CRON_SECRET missing in Doppler"
  if (key === "galleries") return "Blob token missing in Doppler"
  return `Missing Doppler keys: ${missing.join(", ")}`
}

export function optionalDbOverlay(
  key: FlagKey,
  row: { enabled: boolean; config?: Record<string, unknown> | null } | null | undefined,
): boolean | null {
  if (!row) return null
  if (key === "site_gate" && !hasStoredSiteGateHash(row.config)) return false
  return row.enabled
}

export function resolvedFlagEnabled(
  key: FlagKey,
  options: { env?: EnvMap; dbEnabled?: boolean | null; config?: Record<string, unknown> | null } = {},
): boolean {
  if (!resolveEnabled(key, { env: options.env, dbEnabled: options.dbEnabled })) return false
  if (key === "site_gate" && !hasStoredSiteGateHash(options.config)) return false
  return true
}

export function describeFlagStatus(
  key: FlagKey,
  row: { enabled: boolean; config?: Record<string, unknown> | null } | null,
  env: EnvMap = process.env,
): FlagStatus {
  const definition = FLAG_CATALOG[key]
  const storedEnabled = row?.enabled ?? null
  const config = row?.config ?? {}
  const lockedOff = isFeatureHardOff(key, env)
  const missingEnv = missingRequiredEnv(key, env)
  const hasPassword = key === "site_gate" && hasStoredSiteGateHash(config)
  const enabled = resolvedFlagEnabled(key, {
    env,
    dbEnabled: storedEnabled,
    config,
  })

  const reasons: string[] = []
  if (definition.platform) reasons.push(platformLockedReason())
  if (lockedOff) reasons.push(killSwitchReason(key))
  const envReason = missingEnvReason(key, missingEnv)
  if (envReason) reasons.push(envReason)
  if (key === "site_gate" && !hasPassword) reasons.push(siteGatePasswordReason())
  const depReason = dependsOnReason(definition.dependsOn)
  if (depReason) reasons.push(depReason)
  if (storedEnabled === true && !enabled && !lockedOff && !definition.platform) {
    reasons.push("Stored on; stays dark until the reasons above are resolved.")
  }

  return {
    key,
    label: definition.label,
    platform: definition.platform,
    defaultEnabled: definition.defaultEnabled,
    storedEnabled,
    enabled,
    toggleable: !definition.platform && !lockedOff,
    lockedOff,
    dependsOn: definition.dependsOn,
    missingEnv,
    hasPassword,
    reasons,
  }
}

export function listFlagStatuses(rows: FlagRowInput[], env: EnvMap = process.env): FlagStatus[] {
  const byKey = new Map<FlagKey, FlagRowInput>()
  for (const row of rows) {
    if (!isFlagKey(row.key)) continue
    byKey.set(row.key, row)
  }
  return FLAG_KEYS.map((key) => {
    const row = byKey.get(key)
    return describeFlagStatus(
      key,
      row ? { enabled: row.enabled, config: row.config ?? {} } : null,
      env,
    )
  })
}

/** DB overlay for every optional flag that has a row. Missing keys stay omitted (catalog default). */
export function optionalOverlaysFromRows(
  rows: FlagRowInput[],
): Partial<Record<OptionalFlagKey, boolean | null>> {
  const overrides: Partial<Record<OptionalFlagKey, boolean | null>> = {}
  for (const row of rows) {
    if (!isOptionalFlagKey(row.key)) continue
    overrides[row.key] = optionalDbOverlay(row.key, {
      enabled: row.enabled,
      config: row.config ?? {},
    })
  }
  return overrides
}
