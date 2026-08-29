import type React from "react"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { isEnabled } from "@/lib/flags/resolve"

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const waitlistEnabled = await isEnabled("waitlist")

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader waitlistEnabled={waitlistEnabled} />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  )
}
