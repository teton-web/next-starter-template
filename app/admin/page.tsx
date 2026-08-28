import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { getUserCapabilities, hasCapability } from "@/lib/auth/capabilities"
import {
  listContactInquiries,
  listRecentAuditLogs,
  listUnpublishedCmsEntries,
} from "@/lib/admin/dashboard"
import {
  formatAuditSummary,
  formatDashboardDate,
  truncateMessage,
} from "@/lib/admin/dashboard-pure"
import { Button } from "@/components/ui/button"

export default async function AdminPage() {
  const session = await getSession()

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/admin")
  }

  const caps = await getUserCapabilities(session.user.id)
  const canModerate = hasCapability(caps, "moderate")
  const canAdmin = hasCapability(caps, "admin")

  const [drafts, inquiries, auditLogs] = await Promise.all([
    canModerate ? listUnpublishedCmsEntries() : Promise.resolve([]),
    canAdmin ? listContactInquiries(10) : Promise.resolve([]),
    canAdmin ? listRecentAuditLogs(10) : Promise.resolve([]),
  ])

  return (
    <div className="container mx-auto space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Signed in as {session.user.email}</p>
      </div>

      {canModerate ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Drafts</h2>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/content">View content</Link>
            </Button>
          </div>
          {drafts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No drafts or entries in review.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {drafts.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div>
                    <p className="font-medium">{entry.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.entryType} · {entry.status} · {entry.routePath}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/content/${entry.id}`}>Edit</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {canAdmin ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Contact</h2>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/contact">View all</Link>
            </Button>
          </div>
          {inquiries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contact inquiries yet.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {inquiries.map((inquiry) => (
                <li key={inquiry.id} className="space-y-1 px-4 py-3">
                  <p className="font-medium">
                    {inquiry.name}{" "}
                    <span className="font-normal text-muted-foreground">&lt;{inquiry.email}&gt;</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDashboardDate(inquiry.createdAt)}</p>
                  <p className="text-sm">{truncateMessage(inquiry.message)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {canAdmin ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Recent activity</h2>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/audit">View audit</Link>
            </Button>
          </div>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity yet.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {auditLogs.map((log) => (
                <li key={log.id} className="px-4 py-3">
                  <p className="text-sm">{formatAuditSummary(log)}</p>
                  <p className="text-xs text-muted-foreground">{formatDashboardDate(log.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  )
}
