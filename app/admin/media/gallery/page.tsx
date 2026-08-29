import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { checkCapability } from "@/lib/auth/capabilities"
import { isEnabled } from "@/lib/flags/resolve"
import { GalleryAlbumList } from "@/components/admin/gallery-album-list"

export default async function AdminGalleryPage() {
  if (!(await isEnabled("galleries"))) {
    notFound()
  }

  const session = await getSession()
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/admin/media/gallery")
  }

  const canModerate = await checkCapability(session.user.id, "moderate")
  if (!canModerate) {
    redirect("/admin")
  }

  return <GalleryAlbumList />
}
