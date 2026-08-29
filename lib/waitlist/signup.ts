import { z } from "zod"
import { db } from "@/lib/db"
import { waitlistEntries } from "@/lib/db/schema"
import { parseJson, jsonOk, jsonError } from "@/lib/api/helpers"
import { errorResponse, HttpError } from "@/lib/api/http-error"
import { trackEvent } from "@/lib/analytics"
import { checkRateLimit, clientKey } from "@/lib/services/rate-limit"
import { sendWaitlistConfirmation } from "@/lib/waitlist/notify"
import { isUniqueViolation } from "@/lib/waitlist/unique-pure"

const schema = z.object({
  email: z.string().trim().email().max(320),
  name: z.string().trim().max(120).optional(),
  source: z.string().trim().max(120).optional(),
})

const GENERIC_SUCCESS = { success: true } as const

function emptyToNull(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function waitlistPostResponse(request: Request, waitlistEnabled: boolean) {
  try {
    if (!waitlistEnabled) {
      return jsonError("Not found", 404)
    }

    const ip = clientKey(request)
    const limited = await checkRateLimit({ key: `waitlist:ip:${ip}`, max: 5, windowMs: 60_000 })
    if (!limited.allowed) {
      throw new HttpError(429, "Too many waitlist requests. Please try again later.")
    }

    const parsed = await parseJson(request, schema)
    if (parsed instanceof Response) {
      trackEvent("waitlist_submit_failed", { error_code: "validation", status: parsed.status })
      return parsed
    }

    const email = parsed.email.toLowerCase()
    const name = emptyToNull(parsed.name)
    const source = emptyToNull(parsed.source)
    let created = false

    try {
      const inserted = await db
        .insert(waitlistEntries)
        .values({
          id: crypto.randomUUID(),
          email,
          name,
          source,
        })
        .onConflictDoNothing({ target: waitlistEntries.email })
        .returning({ id: waitlistEntries.id })
      created = Array.isArray(inserted) && inserted.length > 0
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
    }

    if (created) {
      void sendWaitlistConfirmation({ email, name }).catch(() => {})
    }

    trackEvent("waitlist_submit")
    return jsonOk(GENERIC_SUCCESS)
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500
    const error_code =
      status === 429 ? "rate_limited" : status === 400 || status === 422 ? "validation" : "internal"
    trackEvent("waitlist_submit_failed", { error_code, status })
    return errorResponse(error)
  }
}
