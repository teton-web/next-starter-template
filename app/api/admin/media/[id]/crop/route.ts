import { NextRequest } from "next/server"
import { z } from "zod"
import { jsonOk, requireCapabilityResponse, requireUserId } from "@/lib/api/helpers"
import { errorResponse, HttpError } from "@/lib/api/http-error"
import { getStorageDriver, storageNotConfiguredMessage } from "@/lib/storage"
import { saveCroppedMedia } from "@/lib/media/crop"
import { validateUploadFile } from "@/lib/media/validate-upload"

const cropParamsSchema = z.object({
  id: z.string().min(1),
})

async function requireAdmin() {
  const userId = await requireUserId()
  if (userId instanceof Response) return userId
  const allowed = await requireCapabilityResponse(userId, "admin")
  if (allowed instanceof Response) {
    const moderate = await requireCapabilityResponse(userId, "moderate")
    if (moderate instanceof Response) return moderate
  }
  return userId
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireAdmin()
    if (userId instanceof Response) return userId

    const parsedParams = cropParamsSchema.safeParse(await context.params)
    if (!parsedParams.success) throw new HttpError(400, "id is required")
    const { id } = parsedParams.data

    const driver = getStorageDriver()
    if (!driver) {
      throw new HttpError(503, storageNotConfiguredMessage())
    }

    const form = await request.formData()
    const file = form.get("file")
    const validated = await validateUploadFile(file)
    if (!validated.ok) {
      throw new HttpError(400, `Upload rejected: ${validated.error}`)
    }
    if (validated.value.kind !== "image") {
      throw new HttpError(400, "Crop output must be an image")
    }

    const result = await saveCroppedMedia({
      assetId: id,
      userId,
      request,
      validated: validated.value,
      bytes: Buffer.from(await (file as File).arrayBuffer()),
      driver,
    })
    return jsonOk(result)
  } catch (error) {
    return errorResponse(error)
  }
}
