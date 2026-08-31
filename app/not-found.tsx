import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Compass } from "lucide-react"

export const metadata: Metadata = { title: "Page not found" }

export default function NotFound() {
  return (
    <main className="container mx-auto flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Compass className="h-7 w-7 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          404 — Page not found
        </p>
        <h1 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
          We couldn&apos;t find that page.
        </h1>
        <p className="mx-auto max-w-md text-pretty leading-relaxed text-muted-foreground">
          The link may have moved or never existed.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href="/">Back to home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    </main>
  )
}
