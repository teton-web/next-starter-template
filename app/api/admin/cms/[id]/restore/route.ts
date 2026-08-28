import { z } from "zod"
import { jsonOk, parseJson, requireCapabilityResponse, requireUserId } from "@/lib/api/helpers"
import { errorResponse } from "@/lib/api/http-error"
import { restoreCmsRevision } from "@/lib/cms/restore"

const restoreSchema = z.object({
  revisionId: z.string().min(1),
})

async function requireEditor() {
  const userId = await requireUserId()
  if (userId instanceof Response) return userId
  const allowed = await requireCapabilityResponse(userId, "moderate")
  if (allowed instanceof Response) return allowed
  return userId
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireEditor()
    if (userId instanceof Response) return userId
    const { id } = await context.params
    const parsed = await parseJson(request, restoreSchema)
    if (parsed instanceof Response) return parsed

    const result = await restoreCmsRevision({
      entryId: id,
      revisionId: parsed.revisionId,
      userId,
      request,
    })
    return jsonOk({ success: true, ...result })
  } catch (error) {
    return errorResponse(error)
  }
}
