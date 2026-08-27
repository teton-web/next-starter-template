import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { checkCapability } from "@/lib/auth/capabilities"
import { listContactInquiries } from "@/lib/admin/dashboard"
import { formatDashboardDate, truncateMessage } from "@/lib/admin/dashboard-pure"
import { Button } from "@/components/ui/button"

export default async function AdminContactPage() {
  const session = await getSession()

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/admin/contact")
  }

  const isAdmin = await checkCapability(session.user.id, "admin")
  if (!isAdmin) {
    redirect("/admin")
  }

  const inquiries = await listContactInquiries(100)

  return (
    <div className="container mx-auto space-y-8 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Contact</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin">Back to dashboard</Link>
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
              <p className="text-sm">{truncateMessage(inquiry.message, 400)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
