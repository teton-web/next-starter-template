import Link from "next/link"
import { listPublishedEntries } from "@/lib/cms/queries"

export const metadata = { title: "Articles" }

export default async function ArticlesPage() {
  let articles: Awaited<ReturnType<typeof listPublishedEntries>> = []
  try {
    articles = await listPublishedEntries("article")
  } catch {
    articles = []
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold">Articles</h1>
      {articles.length === 0 ? (
        <p className="mt-4 text-muted-foreground">No published articles yet.</p>
      ) : (
        <ul className="mt-8 space-y-4">
          {articles.map((article) => (
            <li key={article.id}>
              <Link href={article.routePath} className="text-lg font-medium hover:underline">
                {article.title}
              </Link>
              {article.excerpt ? <p className="text-sm text-muted-foreground">{article.excerpt}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
