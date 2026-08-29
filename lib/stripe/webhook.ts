import Stripe from "stripe"
import { jsonError, jsonOk } from "@/lib/api/helpers"
import { errorResponse } from "@/lib/api/http-error"
import { writeAuditLog } from "@/lib/admin/audit"
import { db } from "@/lib/db"
import { stripeEvents } from "@/lib/db/schema"

export type StripeEventLike = {
  id: string
  type: string
  data: { object: unknown }
}

export type RecordStripeEventResult = { applied: boolean; duplicate: boolean }

function checkoutSessionObject(event: StripeEventLike) {
  return event.data.object as {
    id?: string
    amount_total?: number | null
    currency?: string | null
    payment_status?: string | null
    payment_intent?: string | { id?: string } | null
  }
}

export function shouldApplyCheckoutSessionCompleted(event: StripeEventLike): boolean {
  if (event.type !== "checkout.session.completed") return false
  return checkoutSessionObject(event).payment_status === "paid"
}

export function paymentFieldsFromEvent(event: StripeEventLike) {
  if (event.type !== "checkout.session.completed") {
    return {
      checkoutSessionId: null as string | null,
      paymentIntentId: null as string | null,
      amount: null as number | null,
      currency: null as string | null,
    }
  }

  const session = checkoutSessionObject(event)
  const paymentIntent = session.payment_intent

  return {
    checkoutSessionId: session.id ?? null,
    paymentIntentId:
      typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id ?? null,
    amount: typeof session.amount_total === "number" ? session.amount_total : null,
    currency: session.currency ?? null,
  }
}

export async function recordStripeEvent(event: StripeEventLike): Promise<RecordStripeEventResult> {
  const fields = paymentFieldsFromEvent(event)

  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(stripeEvents)
      .values({
        id: event.id,
        type: event.type,
        checkoutSessionId: fields.checkoutSessionId,
        paymentIntentId: fields.paymentIntentId,
        amount: fields.amount,
        currency: fields.currency,
      })
      .onConflictDoNothing({ target: stripeEvents.id })
      .returning({ id: stripeEvents.id })

    const created = Array.isArray(inserted) && inserted.length > 0
    if (!created) {
      return { applied: false, duplicate: true }
    }

    const applied = shouldApplyCheckoutSessionCompleted(event)
    if (applied) {
      await writeAuditLog(
        {
          action: "create",
          entityType: "stripe_event",
          entityId: event.id,
          metadata: {
            type: event.type,
            checkoutSessionId: fields.checkoutSessionId,
            amount: fields.amount,
            currency: fields.currency,
          },
        },
        tx,
      )
    }

    return { applied, duplicate: false }
  })
}

export type ConstructStripeEvent = (
  payload: string,
  header: string,
  secret: string,
) => Stripe.Event | Promise<Stripe.Event>

export async function verifyStripeWebhookEvent(
  rawBody: string,
  signature: string | null,
  secret: string | undefined,
  constructEvent: ConstructStripeEvent = (payload, header, secretKey) =>
    Stripe.webhooks.constructEventAsync(payload, header, secretKey),
): Promise<{ ok: true; event: Stripe.Event } | { ok: false }> {
  const trimmedSecret = secret?.trim() ?? ""
  if (!signature || !trimmedSecret) {
    return { ok: false }
  }

  try {
    const event = await constructEvent(rawBody, signature, trimmedSecret)
    return { ok: true, event }
  } catch {
    return { ok: false }
  }
}

export async function stripeWebhookPostResponse(
  request: Request,
  options: {
    enabled: boolean
    webhookSecret?: string
    constructEvent?: ConstructStripeEvent
    recordEvent?: (event: StripeEventLike) => Promise<RecordStripeEventResult>
  },
) {
  try {
    const signature = request.headers.get("stripe-signature")
    const rawBody = await request.text()
    const verified = await verifyStripeWebhookEvent(
      rawBody,
      signature,
      options.webhookSecret,
      options.constructEvent,
    )

    if (!verified.ok) {
      return jsonError("Invalid signature", 400)
    }

    if (!options.enabled) {
      return jsonError("Stripe is not enabled", 503)
    }

    const recordEvent = options.recordEvent ?? recordStripeEvent
    await recordEvent(verified.event)
    return jsonOk({ received: true })
  } catch (error) {
    return errorResponse(error)
  }
}
