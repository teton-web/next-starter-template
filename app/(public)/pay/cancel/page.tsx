import Link from "next/link"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { isEnabled } from "@/lib/flags/resolve"

export const metadata = { title: "Payment canceled" }

export default async function PayCancelPage() {
  if (!(await isEnabled("stripe"))) {
    notFound()
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-3xl font-bold">Payment canceled</h1>
      <p className="mt-2 text-muted-foreground">No charge was made. You can try again when you are ready.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/pay">Return to checkout</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Back home</Link>
        </Button>
      </div>
    </main>
  )
}
