import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { isEnabled } from "@/lib/flags/resolve"
import { emptyPublishedAlbumMessage } from "@/lib/gallery/presenters"
import { getPublishedGalleryAlbumBySlug } from "@/lib/gallery/queries"

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!(await isEnabled("galleries"))) {
    notFound()
  }
  const { slug } = await params
  try {
    const album = await getPublishedGalleryAlbumBySlug(slug)
    if (!album) notFound()
    return { title: album.title, description: album.description ?? undefined }
  } catch {
    notFound()
  }
}

export default async function GalleryAlbumPage({ params }: Props) {
  if (!(await isEnabled("galleries"))) {
    notFound()
  }

  const { slug } = await params
  let album: Awaited<ReturnType<typeof getPublishedGalleryAlbumBySlug>> = null
  try {
    album = await getPublishedGalleryAlbumBySlug(slug)
  } catch {
    album = null
  }
  if (!album) notFound()

  return (
    <main className="mx-auto max-w-5xl px-4 py-16">
      <p className="text-sm text-muted-foreground">
        <Link href="/gallery" className="hover:underline">
          Gallery
        </Link>
      </p>
      <h1 className="mt-2 text-3xl font-bold">{album.title}</h1>
      {album.description ? <p className="mt-2 text-muted-foreground">{album.description}</p> : null}

      {album.items.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
          {emptyPublishedAlbumMessage()}
        </p>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {album.items.map((item) => (
            <li key={item.id} className="overflow-hidden rounded-lg border">
              {item.kind === "video" ? (
                <video src={item.src} poster={item.thumbnailSrc} controls className="aspect-[4/3] w-full bg-muted" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.thumbnailSrc} alt={item.alt ?? ""} className="aspect-[4/3] w-full object-cover" />
              )}
              <p className="p-3 text-sm font-medium">{item.title}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
