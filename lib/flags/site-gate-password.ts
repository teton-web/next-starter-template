import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto"

export const SITE_GATE_PASSWORD_HASH_KEY = "passwordHash"

const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEY_LEN = 64

export function hasStoredSiteGateHash(config: Record<string, unknown> | null | undefined): boolean {
  const value = config?.[SITE_GATE_PASSWORD_HASH_KEY]
  return typeof value === "string" && value.trim().length > 0
}

function scryptHash(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }, (error, derived) => {
      if (error) {
        reject(error)
        return
      }
      resolve(derived as Buffer)
    })
  })
}

export async function hashSiteGatePassword(plaintext: string): Promise<string> {
  const password = plaintext.normalize("NFKC")
  const salt = randomBytes(16)
  const derived = await scryptHash(password, salt)
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64url")}$${derived.toString("base64url")}`
}

function parseStoredHash(stored: string): { salt: Buffer; hash: Buffer } | null {
  const parts = stored.split("$")
  if (parts.length !== 6 || parts[0] !== "scrypt") return null
  const n = Number(parts[1])
  const r = Number(parts[2])
  const p = Number(parts[3])
  if (n !== SCRYPT_N || r !== SCRYPT_R || p !== SCRYPT_P) return null
  if (!parts[4] || !parts[5]) return null
  try {
    const salt = Buffer.from(parts[4], "base64url")
    const hash = Buffer.from(parts[5], "base64url")
    if (salt.length === 0 || hash.length !== KEY_LEN) return null
    return { salt, hash }
  } catch {
    return null
  }
}

export async function verifySiteGatePassword(plaintext: string, stored: string): Promise<boolean> {
  const parsed = parseStoredHash(stored)
  if (!parsed) return false
  const derived = await scryptHash(plaintext.normalize("NFKC"), parsed.salt)
  if (derived.length !== parsed.hash.length) return false
  return timingSafeEqual(derived, parsed.hash)
}

export function storedConfigWithoutSecrets(
  config: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(config ?? {}) }
  delete next.password
  return next
}

/** Config as stored in `audit_logs` — never hashes or plaintext. */
export function auditSafeFlagConfig(
  config: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const source = { ...(config ?? {}) }
  const hasPassword = hasStoredSiteGateHash(source)
  const hadSecret =
    hasPassword ||
    Object.hasOwn(source, SITE_GATE_PASSWORD_HASH_KEY) ||
    Object.hasOwn(source, "password")
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(source)) {
    if (key === "password" || key === SITE_GATE_PASSWORD_HASH_KEY) continue
    if (/password|secret|hash|token/i.test(key)) continue
    next[key] = value
  }
  if (hadSecret) next.hasPassword = hasPassword
  return next
}
