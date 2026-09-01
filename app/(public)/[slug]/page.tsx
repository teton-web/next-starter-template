import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CmsDocument } from "@/components/cms-document"
import { getPublishedEntryByPath } from "@/lib/cms/queries"
import { isReservedSlug, routeForEntry } from "@/lib/cms/slugs"

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  if (isReservedSlug(slug)) return {}
  let row: Awaited<ReturnType<typeof getPublishedEntryByPath>> | null = null
  try {
    row = await getPublishedEntryByPath(routeForEntry("page", slug))
  } catch {
    row = null
  }
  if (!row) {
    notFound()
    return { title: "Page not found" }
  }
  return { title: row.entry.title, description: row.entry.excerpt ?? undefined }
}

export default async function CmsPage({ params }: Props) {
  const { slug } = await params
  if (isReservedSlug(slug)) notFound()
  let row: Awaited<ReturnType<typeof getPublishedEntryByPath>> | null = null
  try {
    row = await getPublishedEntryByPath(routeForEntry("page", slug))
  } catch {
    row = null
  }
  if (!row) notFound()

  return (
    <CmsDocument
      title={row.entry.title}
      body={row.entry.body}
      heroUrl={row.heroUrl}
      heroAlt={row.heroAlt}
    />
  )
}
