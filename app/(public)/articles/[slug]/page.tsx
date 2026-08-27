import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getPublishedEntryByPath } from "@/lib/cms/queries"
import { routeForEntry } from "@/lib/cms/slugs"

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  try {
    const row = await getPublishedEntryByPath(routeForEntry("article", slug))
    if (!row) return { title: "Article" }
    return { title: row.entry.title, description: row.entry.excerpt ?? undefined }
  } catch {
    return { title: "Article" }
  }
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
