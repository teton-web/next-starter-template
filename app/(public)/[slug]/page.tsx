import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getPublishedEntryByPath } from "@/lib/cms/queries"
import { isReservedSlug, routeForEntry } from "@/lib/cms/slugs"

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  if (isReservedSlug(slug)) return {}
  try {
    const row = await getPublishedEntryByPath(routeForEntry("page", slug))
    if (!row) return { title: "Page" }
    return { title: row.entry.title, description: row.entry.excerpt ?? undefined }
  } catch {
    return { title: "Page" }
  }
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
    <article className="mx-auto max-w-2xl px-4 py-16">
      {row.heroUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.heroUrl} alt={row.heroAlt ?? ""} className="mb-8 w-full rounded-lg" />
      ) : null}
      <h1 className="text-4xl font-bold">{row.entry.title}</h1>
      <div className="mt-8 space-y-4" dangerouslySetInnerHTML={{ __html: row.entry.body }} />
    </article>
  )
}
