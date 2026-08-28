// Catalog/env only. Node `isEnabled`: ./resolve (Neon + ≤60s cache).
// Proxy: ./proxy-resolve (no db). Mutations: ./mutate.
export {
  FLAG_CATALOG,
  FLAG_KEYS,
  GALLERIES_VERCEL_REQUIRED_ENV,
  OPTIONAL_FLAG_KEYS,
  PLATFORM_FLAG_KEYS,
  isFlagKey,
  isOptionalFlagKey,
  isPlatformFlagKey,
  type FlagDefinition,
  type FlagKey,
  type OptionalFlagKey,
  type PlatformFlagKey,
} from "./catalog"
export {
  featureEnvName,
  hasRequiredEnv,
  isFeatureHardOff,
  missingRequiredEnv,
  requiredEnvFor,
  type EnvMap,
} from "./env"
