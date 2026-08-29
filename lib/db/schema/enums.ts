import { pgEnum } from "drizzle-orm/pg-core"

export const auditAction = pgEnum("audit_action", [
  "create",
  "update",
  "delete",
  "login",
  "logout",
  "invite",
])

export const mediaKind = pgEnum("media_kind", ["image", "video", "document"])

export const cmsEntryType = pgEnum("cms_entry_type", ["page", "article"])

export const cmsEntryStatus = pgEnum("cms_entry_status", [
  "draft",
  "in_review",
  "published",
])

export const galleryAlbumStatus = pgEnum("gallery_album_status", [
  "draft",
  "published",
])
