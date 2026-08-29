import { HttpError } from "@/lib/api/http-error"

export function assertGalleriesEnabled(enabled: boolean) {
  if (!enabled) {
    throw new HttpError(404, "Not found")
  }
}
