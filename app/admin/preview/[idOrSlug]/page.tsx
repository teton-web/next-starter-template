import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { checkCapability } from "@/lib/auth/capabilities"
import { getCmsEntryForPreview } from "@/lib/cms/queries"
import { cmsPreviewPath, isUnpublishedCmsStatus } from "@/lib/cms/preview-pure"
import { noindexMetadata } from "@/lib/seo"
import { CmsDocument } from "@/components/cms-document"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ idOrSlug: string }> }

async function requirePreviewEditor(callbackPath: string) {
  const session = await getSession()
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackPath)}`)
  }
  const allowed = await checkCapability(session.user.id, "moderate")
  if (!allowed) notFound()
  return session.user.id
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { idOrSlug } = await params
  const robots = noindexMetadata()
  try {
    const session = await getSession()
    if (!session?.user?.id) return { title: "Preview", ...robots }
    const allowed = await checkCapability(session.user.id, "moderate")
    if (!allowed) return { title: "Preview", ...robots }
    const row = await getCmsEntryForPreview(idOrSlug)
    return {
      title: row ? `Preview: ${row.entry.title}` : "Preview",
      ...robots,
    }
  } catch {
    return { title: "Preview", ...robots }
  }
}

export default async function CmsPreviewPage({ params }: Props) {
  const { idOrSlug } = await params
  const callbackPath = cmsPreviewPath(idOrSlug)
  await requirePreviewEditor(callbackPath)

  let row: Awaited<ReturnType<typeof getCmsEntryForPreview>> = null
  try {
    row = await getCmsEntryForPreview(idOrSlug)
  } catch {
    row = null
  }
  if (!row) notFound()

  const unpublished = isUnpublishedCmsStatus(row.entry.status)

  return (
    <div>
      <div className="border-b bg-muted/40">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {unpublished ? "Unpublished preview" : "Preview"}
              <span className="ml-2 font-normal text-muted-foreground">not indexed</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{row.entry.status}</Badge>
              <span className="text-xs text-muted-foreground">{row.entry.routePath}</span>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/content/${row.entry.id}`}>Edit</Link>
          </Button>
        </div>
      </div>
      <CmsDocument
        title={row.entry.title}
        body={row.entry.body}
        heroUrl={row.heroUrl}
        heroAlt={row.heroAlt}
      />
    </div>
  )
}
