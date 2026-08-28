import { FLAG_CATALOG, GALLERIES_VERCEL_REQUIRED_ENV, type FlagDefinition, type FlagKey } from "./catalog"

export type EnvMap = Record<string, string | undefined>

export function featureEnvName(key: FlagKey | string): string {
  return `FEATURE_${String(key).toUpperCase()}`
}

/** Doppler kill switch. Exact `"0"` only; any other value is not hard-off. */
export function isFeatureHardOff(key: FlagKey | string, env: EnvMap = process.env): boolean {
  return env[featureEnvName(key)] === "0"
}

export function requiredEnvFor(definition: FlagDefinition, env: EnvMap = process.env): readonly string[] {
  if (definition.key === "galleries") {
    const vercelEnv = env.VERCEL_ENV
    if (vercelEnv === "preview" || vercelEnv === "production") {
      return GALLERIES_VERCEL_REQUIRED_ENV
    }
    return definition.requiresEnv
  }
  return definition.requiresEnv
}

export function missingRequiredEnv(key: FlagKey, env: EnvMap = process.env): string[] {
  const required = requiredEnvFor(FLAG_CATALOG[key], env)
  return required.filter((name) => !env[name]?.trim())
}

export function hasRequiredEnv(key: FlagKey, env: EnvMap = process.env): boolean {
  return missingRequiredEnv(key, env).length === 0
}
