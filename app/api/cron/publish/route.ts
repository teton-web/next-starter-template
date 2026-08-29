import { NextRequest } from "next/server"
import { jsonError, jsonOk } from "@/lib/api/helpers"
import { requireCronSecret } from "@/lib/cron/require-cron-secret"
import { runScheduledPublishWorker } from "@/lib/cms/scheduled-publish"
import { isEnabled } from "@/lib/flags/resolve"

export async function cronPublishResponse(
  request: Request,
  scheduledPublishEnabled: boolean,
  run: typeof runScheduledPublishWorker = runScheduledPublishWorker,
) {
  if (!scheduledPublishEnabled) {
    return jsonError("Not found", 404)
  }

  const authorized = requireCronSecret(request)
  if (authorized instanceof Response) return authorized

  try {
    const result = await run()
    return jsonOk({ ok: true, published: result.published })
  } catch (error) {
    console.error("scheduled publish worker failed", error)
    return jsonError("Scheduled publish failed", 500)
  }
}

export async function GET(request: NextRequest) {
  return cronPublishResponse(request, await isEnabled("scheduled_publish"))
}
