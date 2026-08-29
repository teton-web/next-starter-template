import { notFound } from "next/navigation"
import { isEnabled } from "@/lib/flags/resolve"
import { WaitlistForm } from "./waitlist-form"

export default async function WaitlistPage() {
  if (!(await isEnabled("waitlist"))) {
    notFound()
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-3xl font-bold">Waitlist</h1>
      <p className="mt-2 text-muted-foreground">
        Leave your email and we&apos;ll let you know when there&apos;s news.
      </p>
      <WaitlistForm />
    </main>
  )
}
