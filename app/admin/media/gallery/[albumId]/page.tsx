import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { checkCapability } from "@/lib/auth/capabilities"
import { isEnabled } from "@/lib/flags/resolve"
import { GalleryAlbumDetail } from "@/components/admin/gallery-album-detail"

export default async function AdminGalleryAlbumPage({
  params,
}: {
  params: Promise<{ albumId: string }>
}) {
  if (!(await isEnabled("galleries"))) {
    notFound()
  }

  const session = await getSession()
  const { albumId } = await params
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/admin/media/gallery/${albumId}`)
  }

  const canModerate = await checkCapability(session.user.id, "moderate")
  if (!canModerate) {
    redirect("/admin")
  }

  if (!albumId?.trim()) notFound()

  return <GalleryAlbumDetail albumId={albumId} />
}
