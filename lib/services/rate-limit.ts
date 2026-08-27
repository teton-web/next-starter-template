import { createHash } from "crypto"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"

type LimitInput = { key: string; max: number; windowMs: number }

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterMs?: number
}

const memoryStore = new Map<string, { count: number; resetAt: number }>()

function storageKey(key: string) {
  return createHash("sha256").update(key).digest("hex")
}

export function checkMemoryRateLimit(input: LimitInput): RateLimitResult {
  const now = Date.now()
  const key = storageKey(input.key)
  const current = memoryStore.get(key)

  if (!current || current.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt: now + input.windowMs })
    return { allowed: true, remaining: input.max - 1 }
  }

  if (current.count >= input.max) {
    return { allowed: false, remaining: 0, retryAfterMs: current.resetAt - now }
  }

  current.count += 1
  return { allowed: true, remaining: input.max - current.count }
}

export function resetMemoryRateLimits() {
  memoryStore.clear()
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]!.trim()
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    "unknown"
  )
}

export function retryAfterSeconds(retryAfterMs?: number) {
  return Math.max(1, Math.ceil((retryAfterMs ?? 60_000) / 1000))
}

export function tooManyRequestsResponse(retryAfterMs?: number) {
  const retryAfter = retryAfterSeconds(retryAfterMs)
  return new Response(
    JSON.stringify({
      error: "Too many requests. Please try again shortly.",
      message: "Too many requests. Please try again shortly.",
      code: "TOO_MANY_REQUESTS",
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    },
  )
}

export function authRateLimitBucket(pathname: string): "sign-in" | "forgot-password" | null {
  const path = pathname.replace(/\/+$/, "")
  if (path.endsWith("/sign-in/email")) return "sign-in"
  if (path.endsWith("/request-password-reset") || path.endsWith("/forget-password")) {
    return "forgot-password"
  }
  return null
}

export async function enforceAuthRouteRateLimit(request: Request): Promise<Response | null> {
  const name = authRateLimitBucket(new URL(request.url).pathname)
  if (!name) return null

  const result = await checkRateLimit({
    key: `auth:${name}:${clientKey(request)}`,
    max: 5,
    windowMs: 60_000,
  })
  if (result.allowed) return null
  return tooManyRequestsResponse(result.retryAfterMs)
}

export async function checkRateLimit(input: LimitInput): Promise<RateLimitResult> {
  const resetAt = new Date(Date.now() + input.windowMs)
  const key = storageKey(input.key)

  try {
    const result = await db.execute(sql`
      insert into rate_limit_buckets ("key", request_count, reset_at, created_at, updated_at)
      values (${key}, 1, ${resetAt}, now(), now())
      on conflict ("key") do update set
        request_count = case
          when rate_limit_buckets.reset_at <= now() then 1
          else rate_limit_buckets.request_count + 1
        end,
        reset_at = case
          when rate_limit_buckets.reset_at <= now() then ${resetAt}
          else rate_limit_buckets.reset_at
        end,
        updated_at = now()
      returning request_count, reset_at
    `)
    const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows
    const row = Array.isArray(rows) ? (rows[0] as { request_count: number; reset_at: Date | string } | undefined) : undefined
    if (!row) return checkMemoryRateLimit(input)

    const requestCount = Number(row.request_count)
    const rowResetAt = new Date(row.reset_at).getTime()
    if (requestCount > input.max) {
      return { allowed: false, remaining: 0, retryAfterMs: Math.max(1, rowResetAt - Date.now()) }
    }
    return { allowed: true, remaining: Math.max(0, input.max - requestCount) }
  } catch {
    return checkMemoryRateLimit(input)
  }
}
