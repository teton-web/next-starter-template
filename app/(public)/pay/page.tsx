import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { isEnabled } from "@/lib/flags/resolve"
import { stripePayConfig, stripePayPageVisible } from "@/lib/stripe/config"

async function payRouteHidden() {
  return !stripePayPageVisible(await isEnabled("stripe"), stripePayConfig())
}

export async function generateMetadata(): Promise<Metadata> {
  if (await payRouteHidden()) {
    notFound()
  }
  return { title: "Pay" }
}

export default async function PayPage() {
  if (await payRouteHidden()) {
    notFound()
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-3xl font-bold">Pay</h1>
      <p className="mt-2 text-muted-foreground">
        Complete a one-time payment. You will be redirected to Stripe Checkout.
      </p>
      <form action="/api/stripe/checkout" method="post" className="mt-8">
        <Button type="submit">Continue to checkout</Button>
      </form>
    </main>
  )
}
