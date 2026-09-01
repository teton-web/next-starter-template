import type React from "react"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { getSession } from "@/lib/auth"
import { isEnabled } from "@/lib/flags/resolve"

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [session, waitlistEnabled, galleriesEnabled] = await Promise.all([
    getSession(),
    isEnabled("waitlist"),
    isEnabled("galleries"),
  ])

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        signedIn={Boolean(session?.user)}
        waitlistEnabled={waitlistEnabled}
        galleriesEnabled={galleriesEnabled}
      />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  )
}
