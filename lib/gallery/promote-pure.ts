/**
 * KEC-655 promotes private blobs on publish. Starter Blob and local disk
 * already serve public URLs, so publish is a status gate only.
 */
export function shouldPromoteGalleryAssetsOnPublish(storageName: string | null | undefined) {
  return storageName === "private"
}
