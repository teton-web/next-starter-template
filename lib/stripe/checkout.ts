import { z } from "zod"
import Stripe from "stripe"
import { jsonError } from "@/lib/api/helpers"
import { errorResponse, HttpError } from "@/lib/api/http-error"
import { checkRateLimit, clientKey } from "@/lib/services/rate-limit"
import { createStripeClient } from "@/lib/stripe/client"
import { stripeCheckoutLineItems, stripePayConfig, type StripePayConfig } from "@/lib/stripe/config"
import { NextResponse } from "next/server"

const checkoutBodySchema = z.object({}).strict()

export type CreateCheckoutSession = (
  params: Stripe.Checkout.SessionCreateParams,
) => Promise<Pick<Stripe.Checkout.Session, "id" | "url">>

export function defaultCreateCheckoutSession(
  env: Record<string, string | undefined> = process.env,
): CreateCheckoutSession {
  return async (params) => {
    const secret = env.STRIPE_SECRET_KEY?.trim() ?? ""
    if (!secret) {
      throw new HttpError(503, "Checkout is not configured")
    }
    const stripe = createStripeClient(secret)
    return stripe.checkout.sessions.create(params)
  }
}

function checkoutOrigin(request: Request, env: Record<string, string | undefined>) {
  const configured = env.NEXT_PUBLIC_SITE_URL?.trim() || env.CANONICAL_SITE_URL?.trim()
  if (configured) return configured.replace(/\/+$/, "")
  return new URL(request.url).origin
}

export function isSameOriginCheckoutRequest(request: Request): boolean {
  const expected = new URL(request.url).origin
  const originHeader = request.headers.get("origin")?.trim()
  if (originHeader) return originHeader === expected
  const referer = request.headers.get("referer")?.trim()
  if (!referer) return false
  try {
    return new URL(referer).origin === expected
  } catch {
    return false
  }
}

async function maybeParseEmptyJson(request: Request) {
  const contentType = request.headers.get("content-type") ?? ""
  if (!contentType.includes("application/json")) return true
  try {
    const body = await request.json()
    const parsed = checkoutBodySchema.safeParse(body ?? {})
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message ?? "Invalid request", 422)
    }
    return true
  } catch {
    return jsonError("Invalid JSON body", 400)
  }
}

export async function stripeCheckoutPostResponse(
  request: Request,
  options: {
    enabled: boolean
    env?: Record<string, string | undefined>
    createSession?: CreateCheckoutSession
    payConfig?: StripePayConfig | null
  },
) {
  try {
    if (!options.enabled) {
      return jsonError("Not found", 404)
    }

    const env = options.env ?? process.env
    if (!isSameOriginCheckoutRequest(request)) {
      throw new HttpError(403, "Forbidden")
    }
    const parsed = await maybeParseEmptyJson(request)
    if (parsed instanceof Response) return parsed

    const ip = clientKey(request)
    const limited = await checkRateLimit({ key: `stripe:checkout:${ip}`, max: 5, windowMs: 60_000 })
    if (!limited.allowed) {
      throw new HttpError(429, "Too many checkout requests. Please try again later.")
    }

    const payConfig = options.payConfig !== undefined ? options.payConfig : stripePayConfig(env)
    if (!payConfig) {
      throw new HttpError(503, "Checkout is not configured")
    }

    const origin = checkoutOrigin(request, env)
    const createSession = options.createSession ?? defaultCreateCheckoutSession(env)
    const session = await createSession({
      mode: "payment",
      line_items: stripeCheckoutLineItems(payConfig),
      success_url: `${origin}/pay/success`,
      cancel_url: `${origin}/pay/cancel`,
    })

    if (!session.url) {
      throw new HttpError(502, "Checkout session is missing a redirect URL")
    }

    return NextResponse.redirect(session.url, 303)
  } catch (error) {
    return errorResponse(error)
  }
}
