import { listAuditLogs } from "@/lib/admin/audit"
import { jsonOk, requireCapabilityResponse, requireUserId } from "@/lib/api/helpers"
import { errorResponse } from "@/lib/api/http-error"

async function requireAdmin() {
  const userId = await requireUserId()
  if (userId instanceof Response) return userId
  const allowed = await requireCapabilityResponse(userId, "admin")
  if (allowed instanceof Response) return allowed
  return userId
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin()
    if (auth instanceof Response) return auth

    const { searchParams } = new URL(request.url)
    const result = await listAuditLogs(searchParams)
    return jsonOk(result)
  } catch (error) {
    return errorResponse(error)
  }
}
