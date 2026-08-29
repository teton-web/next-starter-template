import { isEnabled } from "@/lib/flags/resolve"
import { requireCapabilityResponse, requireUserId } from "@/lib/api/helpers"
import { assertGalleriesEnabled } from "@/lib/gallery/access-pure"

export { assertGalleriesEnabled }

export async function requireGalleriesEnabled() {
  assertGalleriesEnabled(await isEnabled("galleries"))
}

export async function requireGalleryAdmin() {
  await requireGalleriesEnabled()
  const userId = await requireUserId()
  if (userId instanceof Response) return userId
  const allowed = await requireCapabilityResponse(userId, "admin")
  if (allowed instanceof Response) {
    const moderate = await requireCapabilityResponse(userId, "moderate")
    if (moderate instanceof Response) return moderate
  }
  return userId
}
