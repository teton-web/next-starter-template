import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { isEnabled } from "@/lib/flags/resolve"
import { stripePayConfig, stripePayPageVisible } from "@/lib/stripe/config"

export const metadata = { title: "Pay" }

export default async function PayPage() {
  if (!stripePayPageVisible(await isEnabled("stripe"), stripePayConfig())) {
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
