import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { isEnabled } from "@/lib/flags/resolve"

export const PAY_SUCCESS_HEADING = "Checkout"
export const PAY_SUCCESS_BODY =
  "If you completed checkout, you will receive a receipt from Stripe."

export async function generateMetadata(): Promise<Metadata> {
  if (!(await isEnabled("stripe"))) {
    notFound()
  }
  return { title: "Checkout" }
}

export default async function PaySuccessPage() {
  if (!(await isEnabled("stripe"))) {
    notFound()
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-3xl font-bold">{PAY_SUCCESS_HEADING}</h1>
      <p className="mt-2 text-muted-foreground">{PAY_SUCCESS_BODY}</p>
      <Button asChild className="mt-8" variant="outline">
        <Link href="/">Back home</Link>
      </Button>
    </main>
  )
}
