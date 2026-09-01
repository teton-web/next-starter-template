import type React from "react"

import { getSession } from "@/lib/auth"
import { checkCapability } from "@/lib/auth/capabilities"
import { isEnabled } from "@/lib/flags/resolve"
import { AdminShell } from "./admin-shell"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  const canAdmin = session?.user?.id ? await checkCapability(session.user.id, "admin") : false
  const galleriesEnabled = await isEnabled("galleries")
  const waitlistEnabled = await isEnabled("waitlist")

  return (
    <AdminShell
      canAdmin={canAdmin}
      galleriesEnabled={galleriesEnabled}
      waitlistEnabled={waitlistEnabled}
    >
      {children}
    </AdminShell>
  )
}
