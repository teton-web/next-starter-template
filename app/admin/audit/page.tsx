import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { checkCapability } from "@/lib/auth/capabilities"
import { listAuditLogs } from "@/lib/admin/audit"
import { formatAuditSummary, formatDashboardDate } from "@/lib/admin/dashboard-pure"
import { Button } from "@/components/ui/button"

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string; offset?: string }>
}) {
  const session = await getSession()

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/admin/audit")
  }

  const isAdmin = await checkCapability(session.user.id, "admin")
  if (!isAdmin) {
    redirect("/admin")
  }

  const params = await searchParams
  const query = new URLSearchParams()
  if (params.limit) query.set("limit", params.limit)
  if (params.offset) query.set("offset", params.offset)
  const { logs, total, limit, offset } = await listAuditLogs(query)
  const prevOffset = Math.max(0, offset - limit)
  const nextOffset = offset + limit
  const hasPrev = offset > 0
  const hasNext = nextOffset < total

  return (
    <div className="container mx-auto space-y-8 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Audit</h1>
          <p className="text-sm text-muted-foreground">
            {total === 0 ? "No audit events yet." : `${total} event${total === 1 ? "" : "s"}, newest first.`}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin">Back to dashboard</Link>
        </Button>
      </div>

      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing to show on this page.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Action</th>
                <th className="px-4 py-2 font-medium">Actor</th>
                <th className="px-4 py-2 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                    {formatDashboardDate(log.createdAt)}
                  </td>
                  <td className="px-4 py-2">{formatAuditSummary(log)}</td>
                  <td className="px-4 py-2">{log.actorEmail ?? "system"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{log.ipAddress ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > limit ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Showing {offset + 1}–{Math.min(offset + logs.length, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link
                href={hasPrev ? `/admin/audit?limit=${limit}&offset=${prevOffset}` : "/admin/audit"}
                aria-disabled={!hasPrev}
                className={!hasPrev ? "pointer-events-none opacity-50" : undefined}
              >
                Previous
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link
                href={hasNext ? `/admin/audit?limit=${limit}&offset=${nextOffset}` : `/admin/audit?limit=${limit}&offset=${offset}`}
                aria-disabled={!hasNext}
                className={!hasNext ? "pointer-events-none opacity-50" : undefined}
              >
                Next
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
