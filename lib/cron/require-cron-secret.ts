import { NextResponse } from "next/server"

export const VERCEL_CRON_HEADER = "x-vercel-cron"
export const CRON_SECRET_HEADER = "x-cron-secret"

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false

  let mismatch = 0
  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i)
  }
  return mismatch === 0
}

export function isCronApiPath(pathname: string) {
  return pathname === "/api/cron" || pathname.startsWith("/api/cron/")
}

export function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization") ?? ""
  const match = authorization.match(/^Bearer\s+(\S+)$/i)
  return match?.[1] ?? null
}

export function hasVercelCronHeader(request: Request) {
  const value = request.headers.get(VERCEL_CRON_HEADER)?.trim().toLowerCase()
  return value === "1" || value === "true"
}

/**
 * Bearer `CRON_SECRET`, or Vercel cron header plus the same secret
 * (`Authorization` or `x-cron-secret`). Constant-time compare. Fail closed.
 */
export function isAuthorizedCronRequest(
  request: Request,
  env: Record<string, string | undefined> = process.env,
) {
  const expected = env.CRON_SECRET?.trim() ?? ""
  if (!expected) return false

  const bearer = bearerToken(request)
  const headerSecret = request.headers.get(CRON_SECRET_HEADER)?.trim() ?? ""
  const vercelCron = hasVercelCronHeader(request)

  if (bearer && constantTimeEqual(bearer, expected)) return true
  if (vercelCron && headerSecret && constantTimeEqual(headerSecret, expected)) return true
  return false
}

export function requireCronSecret(
  request: Request,
  env: Record<string, string | undefined> = process.env,
): true | NextResponse {
  if (!isAuthorizedCronRequest(request, env)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return true
}
