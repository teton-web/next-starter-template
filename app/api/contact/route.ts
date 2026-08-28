import { NextRequest } from "next/server"
import { z } from "zod"
import { Resend } from "resend"
import { db } from "@/lib/db"
import { contactInquiries } from "@/lib/db/schema"
import { parseJson, jsonOk } from "@/lib/api/helpers"
import { checkRateLimit, clientKey } from "@/lib/services/rate-limit"
import { errorResponse, HttpError } from "@/lib/api/http-error"
import { trackEvent } from "@/lib/analytics"

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email(),
  message: z.string().trim().min(10).max(5000),
})

export async function POST(request: NextRequest) {
  try {
    const ip = clientKey(request)
    const limited = await checkRateLimit({ key: `contact:ip:${ip}`, max: 5, windowMs: 60_000 })
    if (!limited.allowed) {
      throw new HttpError(429, "Too many contact requests. Please try again later.")
    }

    const parsed = await parseJson(request, schema)
    if (parsed instanceof Response) {
      trackEvent("contact_submit_failed", { error_code: "validation", status: parsed.status })
      return parsed
    }

    await db.insert(contactInquiries).values({
      id: crypto.randomUUID(),
      name: parsed.name,
      email: parsed.email.toLowerCase(),
      message: parsed.message,
      ipAddress: ip,
    })

    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.EMAIL_FROM
    const to = process.env.CONTACT_TO_EMAIL || from
    if (apiKey && from && to) {
      const resend = new Resend(apiKey)
      await resend.emails.send({
        from,
        to,
        replyTo: parsed.email,
        subject: `Contact form: ${parsed.name}`,
        text: parsed.message,
      })
    }

    trackEvent("contact_submit")
    return jsonOk({ success: true })
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500
    const error_code =
      status === 429 ? "rate_limited" : status === 400 || status === 422 ? "validation" : "internal"
    trackEvent("contact_submit_failed", { error_code, status })
    return errorResponse(error)
  }
}
