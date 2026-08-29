export type StripePayConfig =
  | { kind: "price"; priceId: string }
  | { kind: "amount"; amount: number; currency: string }

const CURRENCY_RE = /^[a-z]{3}$/
const AMOUNT_RE = /^[1-9]\d*$/

export function parseStripeAmountCents(value: string | undefined): number | null {
  const trimmed = value?.trim() ?? ""
  if (!AMOUNT_RE.test(trimmed)) return null
  const amount = Number.parseInt(trimmed, 10)
  if (!Number.isSafeInteger(amount) || amount <= 0) return null
  return amount
}

export function stripePayConfig(
  env: Record<string, string | undefined> = process.env,
): StripePayConfig | null {
  const priceId = env.STRIPE_PRICE_ID?.trim()
  if (priceId) {
    return { kind: "price", priceId }
  }

  const amount = parseStripeAmountCents(env.STRIPE_AMOUNT)
  const currency = env.STRIPE_CURRENCY?.trim().toLowerCase() ?? ""
  if (amount !== null && CURRENCY_RE.test(currency)) {
    return { kind: "amount", amount, currency }
  }

  return null
}

export function stripePayPageVisible(
  flagEnabled: boolean,
  config: StripePayConfig | null,
): boolean {
  return flagEnabled && config !== null
}

export function stripeCheckoutLineItems(config: StripePayConfig) {
  if (config.kind === "price") {
    return [{ price: config.priceId, quantity: 1 as const }]
  }

  return [
    {
      quantity: 1 as const,
      price_data: {
        currency: config.currency,
        unit_amount: config.amount,
        product_data: { name: "Payment" },
      },
    },
  ]
}
