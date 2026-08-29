import Stripe from "stripe"

export function createStripeClient(secretKey: string) {
  return new Stripe(secretKey)
}
