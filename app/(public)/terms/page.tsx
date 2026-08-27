import type { Metadata } from "next"
import { siteName } from "@/lib/site-visibility"

export const metadata: Metadata = { title: "Terms" }

export default function TermsPage() {
  const name = siteName()
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-16">
      <h1>Terms of use</h1>
      <p>
        Use of {name} is subject to these terms. Replace this placeholder with counsel-approved
        terms before launch.
      </p>
    </main>
  )
}
