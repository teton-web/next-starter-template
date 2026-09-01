import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CmsDocument } from "@/components/cms-document"
import { getPublishedEntryByPath } from "@/lib/cms/queries"
import { routeForEntry } from "@/lib/cms/slugs"

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  let row: Awaited<ReturnType<typeof getPublishedEntryByPath>> | null = null
  try {
    row = await getPublishedEntryByPath(routeForEntry("article", slug))
  } catch {
    row = null
  }
  if (!row) {
    notFound()
    return { title: "Page not found" }
  }
  return { title: row.entry.title, description: row.entry.excerpt ?? undefined }
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params
  let row: Awaited<ReturnType<typeof getPublishedEntryByPath>> | null = null
  try {
    row = await getPublishedEntryByPath(routeForEntry("article", slug))
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
