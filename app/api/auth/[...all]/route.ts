import { toNextJsHandler } from "better-auth/next-js"
import { auth } from "@/lib/auth"
import { enforceAuthRouteRateLimit } from "@/lib/services/rate-limit"

const handler = toNextJsHandler(auth)

export const GET = handler.GET

export async function POST(request: Request) {
  const limited = await enforceAuthRouteRateLimit(request)
  if (limited) return limited
  return handler.POST(request)
}
