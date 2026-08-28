import { NextRequest } from "next/server"
import { jsonError, jsonOk } from "@/lib/api/helpers"
import { requireCronSecret } from "@/lib/cron/require-cron-secret"
import { isEnabled } from "@/lib/flags/resolve"

export function cronHealthResponse(request: Request, cronEnabled: boolean) {
  if (!cronEnabled) {
    return jsonError("Not found", 404)
  }

  const authorized = requireCronSecret(request)
  if (authorized instanceof Response) return authorized

  return jsonOk({ ok: true })
}

export async function GET(request: NextRequest) {
  return cronHealthResponse(request, await isEnabled("cron"))
}
