import { isOptionalFlagKey, type OptionalFlagKey } from "./catalog"
import type { EnvMap } from "./env"

/** Isolate-local DB overlay. Must stay ≤ 60s from each entry's issuedAt. */
export const FEATURE_FLAG_CACHE_TTL_MS = 30_000
export const SITE_GATE_PUBLIC_STATE_TTL_MS = 15_000

export const FEATURE_FLAG_CACHE_COOKIE = "ff_overrides"

const COOKIE_VERSION = "v1"

export type OptionalFlagOverrides = Partial<Record<OptionalFlagKey, boolean | null>>

type MemoryEntry = {
  enabled: boolean | null
  issuedAt: number
  expiresAt: number
}

type SiteGateHashEntry = {
  present: boolean
  issuedAt: number
  expiresAt: number
}

type SiteGatePublicEnforceEntry = {
  enforce: boolean
  hv?: string
  issuedAt: number
  expiresAt: number
}

let entries: Partial<Record<OptionalFlagKey, MemoryEntry>> = {}
let siteGateHashEntry: SiteGateHashEntry | undefined
let siteGatePublicEnforceEntry: SiteGatePublicEnforceEntry | undefined
let epoch = 0
let lastInvalidatedAt = 0

export function cacheEpoch() {
  return epoch
}

function liveEntry(key: OptionalFlagKey, now: number): MemoryEntry | undefined {
  const entry = entries[key]
  if (!entry) return undefined
  if (entry.expiresAt <= now) {
    delete entries[key]
    return undefined
  }
  return entry
}

export function getCachedOptionalOverrides(now = Date.now()): OptionalFlagOverrides | null {
  const overrides: OptionalFlagOverrides = {}
  let any = false
  for (const key of Object.keys(entries) as OptionalFlagKey[]) {
    const entry = liveEntry(key, now)
    if (!entry) continue
    overrides[key] = entry.enabled
    any = true
  }
  return any ? overrides : null
}

function liveSiteGateHash(now: number): SiteGateHashEntry | undefined {
  const entry = siteGateHashEntry
  if (!entry) return undefined
  if (entry.expiresAt <= now) {
    siteGateHashEntry = undefined
    return undefined
  }
  return entry
}

export function getWarmFlagCacheSnapshot(now = Date.now()): {
  overrides: OptionalFlagOverrides
  iat: number
  exp: number
  siteGateHashPresent?: boolean
} | null {
  const overrides: OptionalFlagOverrides = {}
  let iat = Number.POSITIVE_INFINITY
  let exp = Number.POSITIVE_INFINITY
  let any = false
  for (const key of Object.keys(entries) as OptionalFlagKey[]) {
    const entry = liveEntry(key, now)
    if (!entry) continue
    overrides[key] = entry.enabled
    iat = Math.min(iat, entry.issuedAt)
    exp = Math.min(exp, entry.expiresAt)
    any = true
  }
  const hashEntry = liveSiteGateHash(now)
  if (hashEntry) {
    iat = Math.min(iat, hashEntry.issuedAt)
    exp = Math.min(exp, hashEntry.expiresAt)
    any = true
  }
  if (!any || exp <= now) return null
  return {
    overrides,
    iat,
    exp,
    siteGateHashPresent: hashEntry?.present,
  }
}

/** `undefined` = cold miss; `null` = known no-row / fail-closed. */
export function getCachedDbEnabled(key: OptionalFlagKey, now = Date.now()): boolean | null | undefined {
  const entry = liveEntry(key, now)
  if (!entry) return undefined
  return entry.enabled
}

export function getCachedSiteGateHashPresent(now = Date.now()): boolean | undefined {
  return liveSiteGateHash(now)?.present
}

function liveSiteGatePublicEnforce(now: number): SiteGatePublicEnforceEntry | undefined {
  const entry = siteGatePublicEnforceEntry
  if (!entry) return undefined
  if (entry.expiresAt <= now) {
    siteGatePublicEnforceEntry = undefined
    return undefined
  }
  return entry
}

export function getCachedSiteGatePublicEnforce(now = Date.now()): boolean | undefined {
  return liveSiteGatePublicEnforce(now)?.enforce
}

export function getCachedSiteGateUnlockBinding(now = Date.now()): string | undefined {
  return liveSiteGatePublicEnforce(now)?.hv
}

export function setCachedSiteGatePublicEnforce(
  enforce: boolean,
  options: { now?: number; epoch?: number; hv?: string } = {},
): boolean {
  if (options.epoch !== undefined && options.epoch !== epoch) return false
  const now = options.now ?? Date.now()
  siteGatePublicEnforceEntry = {
    enforce,
    hv: options.hv,
    issuedAt: now,
    expiresAt: now + SITE_GATE_PUBLIC_STATE_TTL_MS,
  }
  return true
}

export function isSiteGateOverlayCold(now = Date.now()): boolean {
  return getCachedDbEnabled("site_gate", now) === undefined && getCachedSiteGateHashPresent(now) === undefined
}

export function setCachedSiteGateHashPresent(
  present: boolean,
  options: { now?: number; epoch?: number; issuedAt?: number; expiresAt?: number } = {},
): boolean {
  if (options.epoch !== undefined && options.epoch !== epoch) return false
  const now = options.now ?? Date.now()
  const issuedAt = options.issuedAt ?? now
  const expiresAt = Math.min(
    options.expiresAt ?? issuedAt + FEATURE_FLAG_CACHE_TTL_MS,
    issuedAt + FEATURE_FLAG_CACHE_TTL_MS,
  )
  if (expiresAt <= now) return false
  siteGateHashEntry = { present, issuedAt, expiresAt }
  return true
}

export function setCachedDbEnabled(
  key: OptionalFlagKey,
  enabled: boolean | null,
  options: { now?: number; epoch?: number; siteGateHashPresent?: boolean } = {},
): boolean {
  if (options.epoch !== undefined && options.epoch !== epoch) return false
  const now = options.now ?? Date.now()
  entries[key] = {
    enabled,
    issuedAt: now,
    expiresAt: now + FEATURE_FLAG_CACHE_TTL_MS,
  }
  if (key === "site_gate" && options.siteGateHashPresent !== undefined) {
    setCachedSiteGateHashPresent(options.siteGateHashPresent, { now, epoch: options.epoch })
  }
  return true
}

export function setCachedOptionalOverrides(
  overrides: OptionalFlagOverrides,
  options: {
    now?: number
    issuedAt?: number
    expiresAt?: number
    epoch?: number
    siteGateHashPresent?: boolean
  } = {},
): boolean {
  if (options.epoch !== undefined && options.epoch !== epoch) return false
  const now = options.now ?? Date.now()
  const issuedAt = options.issuedAt ?? now
  const expiresAt = Math.min(options.expiresAt ?? issuedAt + FEATURE_FLAG_CACHE_TTL_MS, issuedAt + FEATURE_FLAG_CACHE_TTL_MS)
  if (expiresAt <= now) return false
  if (issuedAt <= lastInvalidatedAt) return false

  const sanitized = sanitizeOptionalOverrides(overrides)
  let wrote = false
  for (const key of Object.keys(sanitized) as OptionalFlagKey[]) {
    if (liveEntry(key, now)) continue
    const enabled = sanitized[key]
    if (enabled === undefined) continue
    entries[key] = { enabled, issuedAt, expiresAt }
    wrote = true
  }
  if (options.siteGateHashPresent !== undefined && !liveSiteGateHash(now)) {
    siteGateHashEntry = { present: options.siteGateHashPresent, issuedAt, expiresAt }
    wrote = true
  }
  return wrote
}

export function invalidateFeatureFlagCache(now = Date.now()) {
  entries = {}
  siteGateHashEntry = undefined
  siteGatePublicEnforceEntry = undefined
  lastInvalidatedAt = now
  epoch += 1
}

export function resetFeatureFlagCache() {
  entries = {}
  siteGateHashEntry = undefined
  siteGatePublicEnforceEntry = undefined
  lastInvalidatedAt = 0
  epoch = 0
}

/**
 * Memory wins when warm. Cookie is ignored when it was issued at or before
 * the last same-isolate invalidation.
 */
export function overlayDbEnabled(
  key: OptionalFlagKey,
  cookieOverrides: OptionalFlagOverrides | null | undefined,
  cookieIssuedAt?: number,
  now = Date.now(),
): boolean | null | undefined {
  const cached = getCachedDbEnabled(key, now)
  if (cached !== undefined) return cached
  if (!cookieOverrides || !Object.hasOwn(cookieOverrides, key)) return undefined
  if (cookieIssuedAt !== undefined && cookieIssuedAt <= lastInvalidatedAt) return undefined
  return cookieOverrides[key] ?? null
}

/** Memory wins when warm. `undefined` = cold / unknown (leftover env may still apply). */
export function overlaySiteGateHashPresent(
  cookieHashPresent: boolean | undefined,
  cookieIssuedAt?: number,
  now = Date.now(),
): boolean | undefined {
  const cached = getCachedSiteGateHashPresent(now)
  if (cached !== undefined) return cached
  if (cookieHashPresent === undefined) return undefined
  if (cookieIssuedAt !== undefined && cookieIssuedAt <= lastInvalidatedAt) return undefined
  return cookieHashPresent
}

export function sanitizeOptionalOverrides(input: Record<string, unknown>): OptionalFlagOverrides {
  const overrides: OptionalFlagOverrides = {}
  for (const [key, value] of Object.entries(input)) {
    if (!isOptionalFlagKey(key)) continue
    if (value === null || typeof value === "boolean") {
      overrides[key] = value
    }
  }
  return overrides
}

function flagCacheSecret(env: EnvMap = process.env) {
  return env.AUTH_SECRET?.trim() ?? ""
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/")
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4))
  const binary = atob(padded + pad)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

async function hmacSha256(secret: string, message: string) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message))
  return base64UrlEncode(new Uint8Array(signature))
}

export type DecodedFlagCacheCookie = {
  overrides: OptionalFlagOverrides
  iat: number
  exp: number
  siteGateHashPresent?: boolean
}

export async function encodeFeatureFlagCacheCookie(
  overrides: OptionalFlagOverrides,
  options: {
    env?: EnvMap
    now?: number
    iat?: number
    exp?: number
    siteGateHashPresent?: boolean
  } = {},
): Promise<string | null> {
  const secret = flagCacheSecret(options.env)
  if (!secret) return null
  const now = options.now ?? Date.now()
  const iat = options.iat ?? now
  const exp = Math.min(options.exp ?? iat + FEATURE_FLAG_CACHE_TTL_MS, iat + FEATURE_FLAG_CACHE_TTL_MS)
  if (exp <= now) return null
  const body: { iat: number; exp: number; o: OptionalFlagOverrides; sgh?: boolean } = {
    iat,
    exp,
    o: sanitizeOptionalOverrides(overrides),
  }
  if (typeof options.siteGateHashPresent === "boolean") {
    body.sgh = options.siteGateHashPresent
  }
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(body)))
  const signature = await hmacSha256(secret, `${COOKIE_VERSION}.${payload}`)
  return `${COOKIE_VERSION}.${payload}.${signature}`
}

export async function encodeWarmFlagCacheCookie(options: { env?: EnvMap; now?: number } = {}) {
  const snapshot = getWarmFlagCacheSnapshot(options.now)
  if (!snapshot) return null
  return encodeFeatureFlagCacheCookie(snapshot.overrides, {
    env: options.env,
    now: options.now,
    iat: snapshot.iat,
    exp: snapshot.exp,
    siteGateHashPresent: snapshot.siteGateHashPresent,
  })
}

export function featureFlagCacheCookieAttrs(exp: number, now = Date.now()) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.max(0, Math.floor((exp - now) / 1000)),
    secure: process.env.VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "production",
  }
}

export async function decodeFeatureFlagCacheCookie(
  value: string | undefined,
  options: { env?: EnvMap; now?: number } = {},
): Promise<DecodedFlagCacheCookie | null> {
  if (!value) return null
  const secret = flagCacheSecret(options.env)
  if (!secret) return null

  const parts = value.split(".")
  if (parts.length !== 3) return null
  const [version, payload, signature] = parts
  if (version !== COOKIE_VERSION || !payload || !signature) return null

  const expected = await hmacSha256(secret, `${COOKIE_VERSION}.${payload}`)
  if (!constantTimeEqual(signature, expected)) return null

  try {
    const json = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as {
      iat?: unknown
      exp?: unknown
      o?: unknown
      sgh?: unknown
    }
    const iat = json.iat
    const exp = json.exp
    if (typeof iat !== "number" || typeof exp !== "number" || !Number.isFinite(iat) || !Number.isFinite(exp)) {
      return null
    }
    if (exp - iat > FEATURE_FLAG_CACHE_TTL_MS) return null
    const now = options.now ?? Date.now()
    if (exp <= now) return null
    if (!json.o || typeof json.o !== "object" || Array.isArray(json.o)) return null
    return {
      iat,
      exp,
      overrides: sanitizeOptionalOverrides(json.o as Record<string, unknown>),
      siteGateHashPresent: typeof json.sgh === "boolean" ? json.sgh : undefined,
    }
  } catch {
    return null
  }
}
