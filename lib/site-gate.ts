import { isFeatureHardOff, type EnvMap } from "@/lib/flags/env"

export const SITE_GATE_COOKIE = "site_gate"
export const SITE_GATE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
export const SITE_GATE_PASSWORD_MAX_LENGTH = 1024
export const SITE_GATE_PUBLIC_STATE_PATH = "/api/site-gate/public-state"

const COOKIE_VERSION = "v1"

function base64UrlEncode(bytes: Uint8Array) {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false

  let mismatch = 0
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

function bytesToHex(bytes: Uint8Array) {
  let hex = ""
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0")
  }
  return hex
}

/**
 * Stable id for the current gate secret material (stored scrypt string, or
 * leftover env password when there is no hash). HMAC key stays AUTH_SECRET.
 */
export async function siteGateUnlockBinding(material: string) {
  const trimmed = material.trim()
  if (!trimmed) return ""
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(trimmed))
  return bytesToHex(new Uint8Array(digest))
}

async function signValue(secret: string, expiresAt: number, binding: string) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${COOKIE_VERSION}:${expiresAt}:${binding}`),
  )
  return base64UrlEncode(new Uint8Array(signature))
}

/** Preview/production only. Local `dev` is never gated. */
export function isSiteGateEnabled(env: EnvMap = process.env) {
  return env.VERCEL_ENV === "preview" || env.VERCEL_ENV === "production"
}

/** HMAC key for the unlock cookie. Never the typed review password. */
export function siteGateSigningSecret(env: EnvMap = process.env) {
  const dedicated = env.SITE_GATE_SIGNING_SECRET?.trim() ?? ""
  if (dedicated) return dedicated
  return env.AUTH_SECRET?.trim() ?? ""
}

/**
 * Leftover Doppler password for clones that have not stored a hash yet.
 * Not the product toggle and not the cookie HMAC key.
 */
export function leftoverSiteGatePassword(env: EnvMap = process.env) {
  return env.SITE_GATE_PASSWORD?.trim() ?? ""
}

export function siteGatePasswordsEqual(left: string, right: string) {
  return constantTimeEqual(left.normalize("NFKC"), right.normalize("NFKC"))
}

/**
 * Enforce the gate on preview/prod when `isEnabled('site_gate')` is on
 * (hash already folded into that overlay), or when leftover
 * `SITE_GATE_PASSWORD` is set and no stored hash is known (clone pull).
 */
export function shouldEnforceSiteGate(options: {
  flagEnabled: boolean
  hashPresent?: boolean
  env?: EnvMap
}): boolean {
  const env = options.env ?? process.env
  if (!isSiteGateEnabled(env)) return false
  if (isFeatureHardOff("site_gate", env)) return false
  if (options.flagEnabled) return true
  if (!leftoverSiteGatePassword(env)) return false
  if (options.hashPresent === true) return false
  return true
}

export function safeSiteGateNext(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/"
  }
  if (value.includes("\\") || /%5c/i.test(value) || /[\u0000-\u001F\u007F]/.test(value)) {
    return "/"
  }

  try {
    const url = new URL(value, "http://starter.local")
    if (url.origin !== "http://starter.local" || url.username || url.password) {
      return "/"
    }
    return `${url.pathname}${url.search}`
  } catch {
    return "/"
  }
}

export async function createSiteGateCookieValue(secret: string, binding: string) {
  if (!secret || !binding) return ""
  const expiresAt = Date.now() + SITE_GATE_MAX_AGE_SECONDS * 1000
  const signature = await signValue(secret, expiresAt, binding)
  return `${COOKIE_VERSION}.${expiresAt}.${signature}`
}

export async function verifySiteGateCookie(
  value: string | undefined,
  secret: string,
  binding: string,
) {
  if (!value || !secret || !binding) return false

  const [version, expiresAtRaw, signature] = value.split(".")
  const expiresAt = Number(expiresAtRaw)
  if (version !== COOKIE_VERSION || !Number.isFinite(expiresAt) || !signature) {
    return false
  }
  if (expiresAt <= Date.now()) {
    return false
  }

  const expectedSignature = await signValue(secret, expiresAt, binding)
  return constantTimeEqual(signature, expectedSignature)
}
