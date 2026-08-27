import type { Metadata } from "next"
import { siteName } from "@/lib/site-visibility"

export const metadata: Metadata = { title: "Privacy" }

export default function PrivacyPage() {
  const name = siteName()
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-16">
      <h1>Privacy policy</h1>
      <p>
        {name} collects contact details you submit through this site (such as name, email, and
        message) in order to respond to inquiries. Replace this placeholder with counsel-approved
        policy text before launch.
      </p>
    </main>
  )
}
