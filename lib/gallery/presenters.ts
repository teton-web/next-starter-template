export type GalleryAlbumStatus = "draft" | "published"

export type GalleryItemSource = {
  id: string
  title: string
  description: string | null
  src: string
  thumbnailUrl: string | null
  alt: string | null
  kind: "image" | "video" | "document"
  sortOrder: number
}

export type GalleryAlbumSource = {
  id: string
  slug: string
  title: string
  description: string | null
  status: GalleryAlbumStatus
  coverMediaAssetId: string | null
  sortOrder: number
  createdAt: Date
  updatedAt: Date
  items: GalleryItemSource[]
}

export type GalleryItemView = {
  id: string
  title: string
  description: string | null
  src: string
  thumbnailSrc: string
  alt: string | null
  kind: "image" | "video" | "document"
  sortOrder: number
}

export type GalleryAlbumView = {
  id: string
  slug: string
  title: string
  description: string | null
  status: GalleryAlbumStatus
  coverMediaAssetId: string | null
  coverSrc: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
  items: GalleryItemView[]
}

export function isPublishedGalleryStatus(status: string | null | undefined): status is "published" {
  return status === "published"
}

export function publishedGalleryAlbumOrNull<T extends { status: string }>(album: T | null | undefined): T | null {
  if (!album || !isPublishedGalleryStatus(album.status)) return null
  return album
}

function compareBySortThenTitle<T extends { sortOrder: number; title: string }>(a: T, b: T) {
  return a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)
}

export function presentGalleryItem(item: GalleryItemSource): GalleryItemView {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    src: item.src,
    thumbnailSrc: item.thumbnailUrl || item.src,
    alt: item.alt,
    kind: item.kind,
    sortOrder: item.sortOrder,
  }
}

export function presentGalleryAlbums(source: GalleryAlbumSource[]): GalleryAlbumView[] {
  return [...source].sort(compareBySortThenTitle).map((album) => {
    const items = [...album.items].sort(compareBySortThenTitle).map(presentGalleryItem)
    const coverItem =
      items.find((item) => item.id === album.coverMediaAssetId) ?? items[0] ?? null

    return {
      id: album.id,
      slug: album.slug,
      title: album.title,
      description: album.description,
      status: album.status,
      coverMediaAssetId: album.coverMediaAssetId,
      coverSrc: coverItem ? coverItem.thumbnailSrc : null,
      sortOrder: album.sortOrder,
      createdAt: album.createdAt.toISOString(),
      updatedAt: album.updatedAt.toISOString(),
      items,
    }
  })
}

export function emptyPublishedAlbumMessage() {
  return "This album is published, but no media has been added yet."
}
