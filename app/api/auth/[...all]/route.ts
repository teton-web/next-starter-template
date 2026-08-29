import { toNextJsHandler } from "better-auth/next-js"
import { auth } from "@/lib/auth"
import { googleOAuthDisabledResponse } from "@/lib/auth/google-oauth"
import { isEnabled } from "@/lib/flags/resolve"
import { enforceAuthRouteRateLimit } from "@/lib/services/rate-limit"

const handler = toNextJsHandler(auth)

async function rejectDisabledGoogleOAuth(request: Request) {
  const pathname = new URL(request.url).pathname
  return googleOAuthDisabledResponse(pathname, await isEnabled("oauth"))
}

export async function GET(request: Request) {
  const blocked = await rejectDisabledGoogleOAuth(request)
  if (blocked) return blocked
  return handler.GET(request)
}

export async function POST(request: Request) {
  const blocked = await rejectDisabledGoogleOAuth(request)
  if (blocked) return blocked
  const limited = await enforceAuthRouteRateLimit(request)
  if (limited) return limited
  return handler.POST(request)
}
