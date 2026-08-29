process.env.DATABASE_URL ??= "postgresql://ci:ci@localhost:5432/ci"
process.env.AUTH_SECRET ??= "ci-placeholder-secret-minimum-32-characters"

import {
  dbInsert,
  dbInsertOnConflictDoNothing,
  dbInsertValues,
  resetSharedDbInsert,
  resetSharedDbTransaction,
  setDbTransaction,
} from "./helpers/mock-db"
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import Stripe from "stripe"
import { stripeEvents } from "@/lib/db/schema"
import {
  parseStripeAmountCents,
  stripeCheckoutLineItems,
  stripePayConfig,
  stripePayPageVisible,
} from "@/lib/stripe/config"
import { isSameOriginCheckoutRequest } from "@/lib/stripe/checkout"
import { isStripeWebhookPath } from "@/lib/stripe/webhook-path"
import { staticPublicSitemapPaths } from "@/lib/sitemap/static-paths"
import { PAY_SUCCESS_BODY, PAY_SUCCESS_HEADING } from "@/app/(public)/pay/success/page"
import { resetMemoryRateLimits } from "@/lib/services/rate-limit"
import { verifyEnvContract } from "../scripts/verify-env-contract.mjs"

const { stripeCheckoutPostResponse } = await import("@/lib/stripe/checkout")
const {
  paymentFieldsFromEvent,
  recordStripeEvent,
  shouldApplyCheckoutSessionCompleted,
  stripeWebhookPostResponse,
  verifyStripeWebhookEvent,
} = await import("@/lib/stripe/webhook")

const root = join(import.meta.dir, "..")

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8")
}

const webhookSecret = "whsec_test_fixture_secret"

function checkoutSessionCompletedPayload(
  id = "evt_test_checkout_1",
  paymentStatus: string | undefined = "paid",
) {
  return JSON.stringify({
    id,
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_1",
        object: "checkout.session",
        amount_total: 2500,
        currency: "usd",
        payment_intent: "pi_test_1",
        payment_status: paymentStatus,
        mode: "payment",
      },
    },
  })
}

async function signedWebhookRequest(payload: string, secret = webhookSecret) {
  const signature = await Stripe.webhooks.generateTestHeaderStringAsync({ payload, secret })
  return new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": signature, "content-type": "application/json" },
    body: payload,
  })
}

function unsignedWebhookRequest(payload: string) {
  return new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
  })
}

function checkoutRequest(
  body: unknown = {},
  extras: { ip?: string; origin?: string | null; referer?: string | null } = {},
) {
  const headers = new Headers({
    "content-type": "application/json",
    "x-forwarded-for": extras.ip ?? "203.0.113.9",
  })
  if (extras.origin !== null) {
    headers.set("origin", extras.origin ?? "http://localhost")
  }
  if (extras.referer) headers.set("referer", extras.referer)
  return new NextRequest("http://localhost/api/stripe/checkout", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
}

function isEventRow(row: unknown): row is { id: string; type: string } {
  return Boolean(row && typeof row === "object" && "type" in row && "id" in row && !("action" in row))
}

function isAuditRow(row: unknown): row is { action: string; entityType: string; entityId: string } {
  return Boolean(row && typeof row === "object" && "action" in row && "entityType" in row)
}

describe("stripe pay config", () => {
  test("prefers a price id over amount", () => {
    expect(
      stripePayConfig({
        STRIPE_PRICE_ID: "price_123",
        STRIPE_AMOUNT: "999",
        STRIPE_CURRENCY: "usd",
      }),
    ).toEqual({ kind: "price", priceId: "price_123" })
    expect(stripeCheckoutLineItems({ kind: "price", priceId: "price_123" })).toEqual([
      { price: "price_123", quantity: 1 },
    ])
  })

  test("accepts amount plus 3-letter currency in cents", () => {
    expect(stripePayConfig({ STRIPE_AMOUNT: "2500", STRIPE_CURRENCY: "USD" })).toEqual({
      kind: "amount",
      amount: 2500,
      currency: "usd",
    })
    expect(stripePayConfig({ STRIPE_AMOUNT: "0", STRIPE_CURRENCY: "usd" })).toBeNull()
    expect(stripePayConfig({ STRIPE_AMOUNT: "2500" })).toBeNull()
    expect(stripePayConfig({})).toBeNull()
  })

  test("rejects truncated or junk STRIPE_AMOUNT strings", () => {
    for (const amount of ["12.50", "2,500", "2500usd"]) {
      expect(parseStripeAmountCents(amount)).toBeNull()
      expect(stripePayConfig({ STRIPE_AMOUNT: amount, STRIPE_CURRENCY: "usd" })).toBeNull()
    }
    expect(parseStripeAmountCents("2500")).toBe(2500)
  })

  test("pay page stays hidden without price or amount even if the flag is on", () => {
    expect(stripePayPageVisible(true, stripePayConfig({ STRIPE_SECRET_KEY: "sk_test" }))).toBe(false)
    expect(stripePayPageVisible(true, null)).toBe(false)
    expect(stripePayPageVisible(false, { kind: "amount", amount: 2500, currency: "usd" })).toBe(false)
    expect(stripePayPageVisible(true, { kind: "amount", amount: 2500, currency: "usd" })).toBe(true)
  })
})

describe("stripe webhook path", () => {
  test("recognizes only the webhook route", () => {
    expect(isStripeWebhookPath("/api/stripe/webhook")).toBe(true)
    expect(isStripeWebhookPath("/api/stripe/webhook/")).toBe(true)
    expect(isStripeWebhookPath("/api/stripe/checkout")).toBe(false)
    expect(isStripeWebhookPath("/pay")).toBe(false)
    expect(isStripeWebhookPath("/api/health")).toBe(false)
  })
})

describe("stripe webhook signature", () => {
  test("constructEvent accepts a Stripe CLI-style test header", async () => {
    const payload = checkoutSessionCompletedPayload()
    const signature = await Stripe.webhooks.generateTestHeaderStringAsync({
      payload,
      secret: webhookSecret,
    })
    const verified = await verifyStripeWebhookEvent(payload, signature, webhookSecret)
    expect(verified.ok).toBe(true)
    if (verified.ok) {
      expect(verified.event.id).toBe("evt_test_checkout_1")
      expect(verified.event.type).toBe("checkout.session.completed")
    }
  })

  test("missing or wrong signature fails closed", async () => {
    const payload = checkoutSessionCompletedPayload()
    expect((await verifyStripeWebhookEvent(payload, null, webhookSecret)).ok).toBe(false)
    expect((await verifyStripeWebhookEvent(payload, "t=1,v1=deadbeef", webhookSecret)).ok).toBe(false)
    expect(
      (
        await verifyStripeWebhookEvent(
          payload,
          await Stripe.webhooks.generateTestHeaderStringAsync({ payload, secret: webhookSecret }),
          undefined,
        )
      ).ok,
    ).toBe(false)
  })
})

describe("POST /api/stripe/webhook", () => {
  const seenIds = new Set<string>()
  const persisted: unknown[] = []

  beforeEach(() => {
    resetSharedDbInsert()
    seenIds.clear()
    persisted.length = 0
    dbInsertValues.mockImplementation(async (row: unknown) => {
      if (isEventRow(row)) {
        if (seenIds.has(row.id)) return []
        seenIds.add(row.id)
        persisted.push(row)
        return [{ id: row.id }]
      }
      persisted.push(row)
      return [{ id: "audit" }]
    })
    setDbTransaction(async (fn) => {
      const start = persisted.length
      const startIds = new Set(seenIds)
      try {
        return await fn({ insert: dbInsert })
      } catch (error) {
        persisted.length = start
        seenIds.clear()
        for (const id of startIds) seenIds.add(id)
        throw error
      }
    })
  })

  afterEach(() => {
    resetSharedDbInsert()
    resetSharedDbTransaction()
  })

  test("unsigned is 400 and does not write whether the flag is off or on", async () => {
    const payload = checkoutSessionCompletedPayload()
    const off = await stripeWebhookPostResponse(unsignedWebhookRequest(payload), {
      enabled: false,
      webhookSecret,
    })
    expect(off.status).toBe(400)
    expect(await off.json()).toEqual({ error: "Invalid signature" })
    expect(off.status).not.toBe(404)

    const on = await stripeWebhookPostResponse(unsignedWebhookRequest(payload), {
      enabled: true,
      webhookSecret,
    })
    expect(on.status).toBe(400)
    expect(dbInsert).not.toHaveBeenCalled()
    expect(persisted).toEqual([])
  })

  test("invalid stripe-signature header is 400 and does not write", async () => {
    const payload = checkoutSessionCompletedPayload("evt_bad_sig")
    const request = await signedWebhookRequest(payload, "whsec_other_secret")
    const response = await stripeWebhookPostResponse(request, {
      enabled: true,
      webhookSecret,
    })
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "Invalid signature" })
    expect(dbInsert).not.toHaveBeenCalled()
    expect(persisted).toEqual([])
  })

  test("raw body is verified as sent (pretty JSON is not re-serialized)", async () => {
    const payload = `${JSON.stringify(JSON.parse(checkoutSessionCompletedPayload("evt_pretty")), null, 2)}\n`
    const response = await stripeWebhookPostResponse(await signedWebhookRequest(payload), {
      enabled: true,
      webhookSecret,
    })
    expect(response.status).toBe(200)
    expect(persisted.filter(isEventRow)).toHaveLength(1)
  })

  test("flag off with a valid signature is 503 and does not apply payment", async () => {
    const payload = checkoutSessionCompletedPayload()
    const response = await stripeWebhookPostResponse(await signedWebhookRequest(payload), {
      enabled: false,
      webhookSecret,
    })
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: "Stripe is not enabled" })
    expect(dbInsert).not.toHaveBeenCalled()
    expect(persisted).toEqual([])
  })

  test("checkout.session.completed records payment fields once", async () => {
    const payload = checkoutSessionCompletedPayload("evt_once")
    const response = await stripeWebhookPostResponse(await signedWebhookRequest(payload), {
      enabled: true,
      webhookSecret,
    })
    expect(response.status).toBe(200)
    expect(dbInsertOnConflictDoNothing).toHaveBeenCalled()
    const events = persisted.filter(isEventRow)
    const audits = persisted.filter(isAuditRow)
    expect(events).toHaveLength(1)
    expect(audits).toHaveLength(1)
    expect(events[0]?.id).toBe("evt_once")
    expect((events[0] as { checkoutSessionId?: string }).checkoutSessionId).toBe("cs_test_1")
    expect((events[0] as { amount?: number }).amount).toBe(2500)
    expect((events[0] as { currency?: string }).currency).toBe("usd")
    expect(audits[0]?.action).toBe("create")
    expect(audits[0]?.entityType).toBe("stripe_event")
    expect(audits[0]?.entityId).toBe("evt_once")
  })

  test("duplicate event id does not double-apply", async () => {
    const payload = checkoutSessionCompletedPayload("evt_dup")
    const first = await stripeWebhookPostResponse(await signedWebhookRequest(payload), {
      enabled: true,
      webhookSecret,
    })
    const second = await stripeWebhookPostResponse(await signedWebhookRequest(payload), {
      enabled: true,
      webhookSecret,
    })
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(persisted.filter(isEventRow)).toHaveLength(1)
    expect(persisted.filter(isAuditRow)).toHaveLength(1)

    const recorded = await recordStripeEvent({
      id: "evt_dup",
      type: "checkout.session.completed",
      data: {
        object: { id: "cs_test_1", amount_total: 2500, currency: "usd", payment_status: "paid" },
      },
    })
    expect(recorded).toEqual({ applied: false, duplicate: true })
    expect(persisted.filter(isEventRow)).toHaveLength(1)
    expect(persisted.filter(isAuditRow)).toHaveLength(1)
  })

  test("audit insert reject rolls back the event write", async () => {
    dbInsertValues.mockImplementation(async (row: unknown) => {
      persisted.push(row)
      if (isAuditRow(row)) {
        throw new Error("audit_logs unavailable")
      }
      if (isEventRow(row)) {
        if (seenIds.has(row.id)) return []
        seenIds.add(row.id)
        return [{ id: row.id }]
      }
      return [{ id: "other" }]
    })
    const payload = checkoutSessionCompletedPayload("evt_rollback")
    const response = await stripeWebhookPostResponse(await signedWebhookRequest(payload), {
      enabled: true,
      webhookSecret,
    })
    expect(response.status).toBe(500)
    expect(persisted).toEqual([])
  })

  test("unpaid checkout.session.completed is not applied", async () => {
    const payload = checkoutSessionCompletedPayload("evt_unpaid", "unpaid")
    const response = await stripeWebhookPostResponse(await signedWebhookRequest(payload), {
      enabled: true,
      webhookSecret,
    })
    expect(response.status).toBe(200)
    expect(shouldApplyCheckoutSessionCompleted(JSON.parse(payload))).toBe(false)
    expect(persisted.filter(isEventRow)).toHaveLength(1)
    expect(persisted.filter(isAuditRow)).toHaveLength(0)
    const recorded = await recordStripeEvent(JSON.parse(payload))
    expect(recorded.duplicate).toBe(true)
    expect(recorded.applied).toBe(false)
  })

  test("paymentFieldsFromEvent only fills checkout.session.completed", () => {
    expect(
      paymentFieldsFromEvent({
        id: "evt_other",
        type: "product.created",
        data: { object: { id: "prod_1" } },
      }),
    ).toEqual({
      checkoutSessionId: null,
      paymentIntentId: null,
      amount: null,
      currency: null,
    })
    expect(stripeEvents.id).toBeDefined()
  })
})

describe("POST /api/stripe/checkout", () => {
  const createSession = mock(async (_params: unknown) => ({
    id: "cs_test_created",
    url: "https://checkout.stripe.com/c/pay/cs_test_created",
  }))

  beforeEach(() => {
    resetMemoryRateLimits()
    createSession.mockReset()
    createSession.mockImplementation(async () => ({
      id: "cs_test_created",
      url: "https://checkout.stripe.com/c/pay/cs_test_created",
    }))
  })

  test("flag off is 404 and does not create a session", async () => {
    const response = await stripeCheckoutPostResponse(checkoutRequest(), {
      enabled: false,
      createSession,
      payConfig: { kind: "amount", amount: 2500, currency: "usd" },
    })
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: "Not found" })
    expect(createSession).not.toHaveBeenCalled()
  })

  test("cross-origin and missing Origin/Referer are 403", async () => {
    const cross = await stripeCheckoutPostResponse(
      checkoutRequest({}, { origin: "https://evil.example" }),
      {
        enabled: true,
        createSession,
        payConfig: { kind: "amount", amount: 2500, currency: "usd" },
      },
    )
    expect(cross.status).toBe(403)
    expect(createSession).not.toHaveBeenCalled()

    const missing = await stripeCheckoutPostResponse(checkoutRequest({}, { origin: null }), {
      enabled: true,
      createSession,
      payConfig: { kind: "amount", amount: 2500, currency: "usd" },
    })
    expect(missing.status).toBe(403)
    expect(isSameOriginCheckoutRequest(checkoutRequest({}, { origin: null }))).toBe(false)
    expect(
      isSameOriginCheckoutRequest(
        checkoutRequest({}, { origin: null, referer: "http://localhost/pay" }),
      ),
    ).toBe(true)
  })

  test("flag on without price or amount is 503", async () => {
    const response = await stripeCheckoutPostResponse(checkoutRequest(), {
      enabled: true,
      createSession,
      env: { STRIPE_SECRET_KEY: "sk_test", STRIPE_WEBHOOK_SECRET: "whsec" },
      payConfig: null,
    })
    expect(response.status).toBe(503)
    expect(createSession).not.toHaveBeenCalled()
  })

  test("creates a payment-mode Checkout Session and 303s to Stripe", async () => {
    const response = await stripeCheckoutPostResponse(checkoutRequest(), {
      enabled: true,
      createSession,
      env: {
        STRIPE_SECRET_KEY: "sk_test",
        STRIPE_WEBHOOK_SECRET: "whsec",
        NEXT_PUBLIC_SITE_URL: "https://example.test",
      },
      payConfig: { kind: "amount", amount: 2500, currency: "usd" },
    })
    expect(response.status).toBe(303)
    expect(response.headers.get("location")).toBe("https://checkout.stripe.com/c/pay/cs_test_created")
    expect(createSession).toHaveBeenCalledTimes(1)
    const params = createSession.mock.calls[0]?.[0] as {
      mode: string
      line_items: unknown[]
      success_url: string
      cancel_url: string
    }
    expect(params.mode).toBe("payment")
    expect(params.line_items).toEqual([
      {
        quantity: 1,
        price_data: { currency: "usd", unit_amount: 2500, product_data: { name: "Payment" } },
      },
    ])
    expect(params.success_url).toBe("https://example.test/pay/success")
    expect(params.success_url).not.toContain("session_id")
    expect(params.success_url).not.toContain("CHECKOUT_SESSION_ID")
    expect(params.cancel_url).toBe("https://example.test/pay/cancel")
    expect(JSON.stringify(params)).not.toContain("subscription")
  })
})

describe("stripe source", () => {
  test("pages 404 via Node isEnabled and proxy does not 404 /pay", () => {
    for (const rel of [
      "app/(public)/pay/page.tsx",
      "app/(public)/pay/success/page.tsx",
      "app/(public)/pay/cancel/page.tsx",
    ]) {
      const page = read(rel)
      expect(page).toContain("notFound")
    }
    expect(read("app/(public)/pay/page.tsx")).toContain("stripePayPageVisible")
    expect(read("app/(public)/pay/page.tsx")).toContain("stripePayConfig")
    expect(read("app/(public)/pay/page.tsx")).toContain('isEnabled("stripe")')
    expect(read("app/(public)/pay/success/page.tsx")).toContain('isEnabled("stripe")')
    expect(read("app/(public)/pay/page.tsx")).toContain('action="/api/stripe/checkout"')

    const checkout = read("app/api/stripe/checkout/route.ts")
    expect(checkout).toContain('isEnabled("stripe")')
    expect(checkout).toContain("stripeCheckoutPostResponse")
    expect(checkout).not.toContain("products.create")

    const webhook = read("app/api/stripe/webhook/route.ts")
    expect(webhook).toContain("stripeWebhookPostResponse")
    expect(webhook).toContain('isEnabled("stripe")')
    expect(webhook).toContain("STRIPE_WEBHOOK_SECRET")
    expect(read("lib/stripe/webhook.ts")).toContain("constructEventAsync")
    expect(read("lib/stripe/webhook.ts")).toContain("await request.text()")
    expect(read("lib/stripe/webhook.ts")).toContain("onConflictDoNothing")
    expect(read("lib/stripe/webhook.ts")).toContain("writeAuditLog")
    expect(read("lib/stripe/webhook.ts")).toContain(",\n        tx,")
    expect(read("lib/stripe/webhook.ts")).not.toContain("products.create")

    const proxy = read("proxy.ts")
    expect(proxy).toContain("isStripeWebhookPath")
    expect(proxy).not.toContain('isEnabled("stripe")')
    expect(proxy).not.toContain('"/pay"')
    expect(proxy).not.toContain("/api/stripe/checkout")
  })

  test("success page does not claim a payment without verifying a session", () => {
    expect(PAY_SUCCESS_HEADING).toBe("Checkout")
    expect(PAY_SUCCESS_BODY).toContain("If you completed checkout")
    expect(PAY_SUCCESS_BODY.toLowerCase()).not.toContain("was received")
    const page = read("app/(public)/pay/success/page.tsx")
    expect(page).toContain("PAY_SUCCESS_BODY")
    expect(page).not.toContain("session_id")
    expect(read("lib/stripe/checkout.ts")).not.toContain("CHECKOUT_SESSION_ID")
  })

  test("no product catalog table or subscription routes", () => {
    expect(existsSync(join(root, "lib/db/schema/stripe-events.ts"))).toBe(true)
    expect(existsSync(join(root, "lib/db/schema/stripe-products.ts"))).toBe(false)
    expect(existsSync(join(root, "lib/db/schema/products.ts"))).toBe(false)
    expect(existsSync(join(root, "app/api/stripe/portal/route.ts"))).toBe(false)
    expect(read("lib/db/schema/index.ts")).toContain('from "./stripe-events"')
    expect(read("lib/db/schema/index.ts")).not.toContain("stripe-products")
    expect(read("lib/stripe/checkout.ts")).toContain('mode: "payment"')
    expect(read("lib/stripe/checkout.ts")).not.toContain('mode: "subscription"')
  })

  test("sitemap /pay follows the stripe flag independently of sibling flags", () => {
    const off = staticPublicSitemapPaths({
      waitlistEnabled: true,
      galleriesEnabled: true,
      stripeEnabled: false,
    })
    expect(off).toContain("/waitlist")
    expect(off).toContain("/gallery")
    expect(off.includes("/pay")).toBe(false)

    const on = staticPublicSitemapPaths({
      waitlistEnabled: false,
      galleriesEnabled: false,
      stripeEnabled: true,
    })
    expect(on.includes("/pay")).toBe(true)
    expect(on).not.toContain("/waitlist")
    expect(on).not.toContain("/gallery")
    expect(on.filter((path) => path === "/pay")).toHaveLength(1)

    expect(read("app/sitemap.ts")).toContain("staticPublicSitemapPaths")
    expect(read("app/sitemap.ts")).toContain('isEnabled("stripe")')
  })

  test("API matrix, env example, and ADR document signature-auth webhook", () => {
    const matrix = read("docs/API_AUTH_MATRIX.md")
    expect(matrix).toContain("POST /api/stripe/webhook")
    expect(matrix).toContain("Stripe-Signature")
    expect(matrix).toContain("constructEventAsync")
    expect(matrix).toContain("Site-gate exempt")
    expect(matrix).toContain("POST /api/stripe/checkout")
    expect(matrix).toContain("same-origin")

    const example = read(".env.example")
    expect(example).toContain("# STRIPE_SECRET_KEY=")
    expect(example).toContain("# STRIPE_WEBHOOK_SECRET=")
    expect(example).toContain("# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=")
    expect(example).toContain("# STRIPE_PRICE_ID=")
    expect(example).toContain("# STRIPE_AMOUNT=")
    expect(example).toContain("# STRIPE_CURRENCY=")
    expect(example).not.toContain("# STRIPE_CURRENCY=usd")
    expect(example).toContain("# FEATURE_STRIPE=0")
    const contract = verifyEnvContract({
      DATABASE_URL: "postgresql://ci:ci@localhost:5432/ci",
      AUTH_SECRET: "ci-placeholder-secret-minimum-32-characters",
    })
    expect(contract.missing).not.toContain("STRIPE_SECRET_KEY")
    expect(contract.missingRecommended).not.toContain("STRIPE_SECRET_KEY")

    const adr = read("docs/adr/0001-starter-boundaries.md")
    expect(adr).toContain("simple pay flagged off")
    expect(adr).toContain("product globes/catalogs")
    expect(adr).not.toMatch(/does \*\*not\*\* ship: ecommerce/)

    const flags = read("docs/FEATURE_FLAGS.md")
    const siteGate = flags.slice(flags.indexOf("## Site gate"), flags.indexOf("## Stripe"))
    expect(siteGate).toContain("/api/stripe/webhook")
    expect(siteGate).toContain("/api/cron/*")
    const stripeSection = flags.slice(flags.indexOf("## Stripe"), flags.indexOf("## Waitlist"))
    expect(stripeSection).toContain("503")
    expect(stripeSection).not.toContain("acknowledges (`200`)")
  })
})
