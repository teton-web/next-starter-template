import { NextRequest } from "next/server"
import { isEnabled } from "@/lib/flags/resolve"
import { stripeWebhookPostResponse } from "@/lib/stripe/webhook"

export async function POST(request: NextRequest) {
  return stripeWebhookPostResponse(request, {
    enabled: await isEnabled("stripe"),
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  })
}
