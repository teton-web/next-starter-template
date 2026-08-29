export const PLATFORM_FLAG_KEYS = [
  "auth",
  "admin",
  "cms",
  "media",
  "contact",
  "seo",
  "analytics",
  "theme",
] as const

export const OPTIONAL_FLAG_KEYS = [
  "site_gate",
  "waitlist",
  "stripe",
  "galleries",
  "scheduled_publish",
  "oauth",
  "cron",
] as const

export const FLAG_KEYS = [...PLATFORM_FLAG_KEYS, ...OPTIONAL_FLAG_KEYS] as const

export type PlatformFlagKey = (typeof PLATFORM_FLAG_KEYS)[number]
export type OptionalFlagKey = (typeof OPTIONAL_FLAG_KEYS)[number]
export type FlagKey = (typeof FLAG_KEYS)[number]

export type FlagDefinition = {
  key: FlagKey
  label: string
  defaultEnabled: boolean
  platform: boolean
  requiresEnv: readonly string[]
  dependsOn: readonly FlagKey[]
}

function platformFlag<K extends PlatformFlagKey>(key: K, label: string): FlagDefinition & { key: K } {
  return {
    key,
    label,
    defaultEnabled: true,
    platform: true,
    requiresEnv: [],
    dependsOn: [],
  }
}

function optionalFlag<K extends OptionalFlagKey>(
  key: K,
  label: string,
  extras: { requiresEnv?: readonly string[]; dependsOn?: readonly FlagKey[] } = {},
): FlagDefinition & { key: K } {
  return {
    key,
    label,
    defaultEnabled: false,
    platform: false,
    requiresEnv: extras.requiresEnv ?? [],
    dependsOn: extras.dependsOn ?? [],
  }
}

export const FLAG_CATALOG: { [K in FlagKey]: FlagDefinition & { key: K } } = {
  auth: platformFlag("auth", "Auth"),
  admin: platformFlag("admin", "Admin"),
  cms: platformFlag("cms", "CMS"),
  media: platformFlag("media", "Media"),
  contact: platformFlag("contact", "Contact"),
  seo: platformFlag("seo", "SEO"),
  analytics: platformFlag("analytics", "Analytics"),
  theme: platformFlag("theme", "Theme"),
  site_gate: optionalFlag("site_gate", "Site gate"),
  waitlist: optionalFlag("waitlist", "Waitlist"),
  stripe: optionalFlag("stripe", "Stripe", {
    requiresEnv: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
  }),
  galleries: optionalFlag("galleries", "Galleries"),
  scheduled_publish: optionalFlag("scheduled_publish", "Scheduled publish", {
    dependsOn: ["cron"],
    requiresEnv: ["CRON_SECRET"],
  }),
  oauth: optionalFlag("oauth", "Google OAuth", {
    requiresEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  }),
  cron: optionalFlag("cron", "Cron", {
    requiresEnv: ["CRON_SECRET"],
  }),
}

export const GALLERIES_VERCEL_REQUIRED_ENV = ["BLOB_READ_WRITE_TOKEN"] as const

export function isFlagKey(key: string): key is FlagKey {
  return Object.hasOwn(FLAG_CATALOG, key)
}

export function isPlatformFlagKey(key: string): key is PlatformFlagKey {
  return (PLATFORM_FLAG_KEYS as readonly string[]).includes(key)
}

export function isOptionalFlagKey(key: string): key is OptionalFlagKey {
  return (OPTIONAL_FLAG_KEYS as readonly string[]).includes(key)
}
