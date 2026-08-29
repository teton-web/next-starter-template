import Link from "next/link"
import { notFound } from "next/navigation"
import { isEnabled } from "@/lib/flags/resolve"
import { listPublishedGalleryAlbums } from "@/lib/gallery/queries"

export const metadata = { title: "Gallery" }

export default async function GalleryPage() {
  if (!(await isEnabled("galleries"))) {
    notFound()
  }

  let albums: Awaited<ReturnType<typeof listPublishedGalleryAlbums>> = []
  try {
    albums = await listPublishedGalleryAlbums()
  } catch {
    albums = []
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-3xl font-bold">Gallery</h1>
      {albums.length === 0 ? (
        <p className="mt-4 text-muted-foreground">No published albums yet.</p>
      ) : (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => (
            <li key={album.id}>
              <Link href={`/gallery/${album.slug}`} className="group block overflow-hidden rounded-lg border">
                {album.coverSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={album.coverSrc} alt="" className="aspect-[4/3] w-full object-cover" />
                ) : (
                  <div className="aspect-[4/3] bg-muted" />
                )}
                <div className="p-4">
                  <h2 className="font-medium group-hover:underline">{album.title}</h2>
                  {album.description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{album.description}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">{album.items.length} items</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
