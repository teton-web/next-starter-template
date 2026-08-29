import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { checkCapability } from "@/lib/auth/capabilities"
import { listWaitlistEntries } from "@/lib/admin/dashboard"
import { formatDashboardDate } from "@/lib/admin/dashboard-pure"
import { Button } from "@/components/ui/button"

export default async function AdminWaitlistPage() {
  const session = await getSession()

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/admin/waitlist")
  }

  const isAdmin = await checkCapability(session.user.id, "admin")
  if (!isAdmin) {
    redirect("/admin")
  }

  const entries = await listWaitlistEntries(100)

  return (
    <div className="container mx-auto space-y-8 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Waitlist</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin">Back to dashboard</Link>
        </Button>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No waitlist entries yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {entries.map((entry) => (
            <li key={entry.id} className="space-y-1 px-4 py-3">
              <p className="font-medium">
                {entry.name ? (
                  <>
                    {entry.name}{" "}
                    <span className="font-normal text-muted-foreground">&lt;{entry.email}&gt;</span>
                  </>
                ) : (
                  entry.email
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDashboardDate(entry.createdAt)}
                {entry.source ? ` · ${entry.source}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
