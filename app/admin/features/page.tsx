import Link from "next/link"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { checkCapability } from "@/lib/auth/capabilities"
import { loadFlagStatuses } from "@/lib/flags/list"
import { Button } from "@/components/ui/button"
import { FeaturesForm } from "./features-form"

export default async function AdminFeaturesPage() {
  const session = await getSession()

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/admin/features")
  }

  const isAdmin = await checkCapability(session.user.id, "admin")
  if (!isAdmin) {
    redirect("/admin")
  }

  const flags = await loadFlagStatuses()

  return (
    <div className="container mx-auto space-y-8 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Features</h1>
          <p className="text-sm text-muted-foreground">
            Optional modules persist to the database. Platform flags stay on unless Doppler sets FEATURE_*=0.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin">Back to dashboard</Link>
        </Button>
      </div>
      <FeaturesForm initialFlags={flags} />
    </div>
  )
}
