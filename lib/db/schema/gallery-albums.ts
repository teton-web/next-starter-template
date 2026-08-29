import { relations } from "drizzle-orm"
import {
  pgTable,
  text,
  timestamp,
  integer,
  index,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { galleryAlbumStatus } from "./enums"
import { mediaAssets } from "./media-assets"

export const galleryAlbums = pgTable(
  "gallery_albums",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    status: galleryAlbumStatus("status").default("draft").notNull(),
    coverMediaAssetId: text("cover_media_asset_id").references(() => mediaAssets.id, {
      onDelete: "set null",
    }),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex("idx_gallery_albums_slug").on(table.slug),
    statusIdx: index("idx_gallery_albums_status").on(table.status),
    sortOrderIdx: index("idx_gallery_albums_sort_order").on(table.sortOrder),
    coverIdx: index("idx_gallery_albums_cover_media_asset_id").on(table.coverMediaAssetId),
  }),
)

export const galleryAlbumItems = pgTable(
  "gallery_album_items",
  {
    albumId: text("album_id")
      .notNull()
      .references(() => galleryAlbums.id, { onDelete: "cascade" }),
    mediaAssetId: text("media_asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.albumId, table.mediaAssetId] }),
    albumIdx: index("idx_gallery_album_items_album_id").on(table.albumId),
    mediaAssetIdx: index("idx_gallery_album_items_media_asset_id").on(table.mediaAssetId),
    sortOrderIdx: index("idx_gallery_album_items_sort_order").on(table.albumId, table.sortOrder),
  }),
)

export const galleryAlbumsRelations = relations(galleryAlbums, ({ many, one }) => ({
  items: many(galleryAlbumItems),
  coverMediaAsset: one(mediaAssets, {
    fields: [galleryAlbums.coverMediaAssetId],
    references: [mediaAssets.id],
  }),
}))

export const galleryAlbumItemsRelations = relations(galleryAlbumItems, ({ one }) => ({
  album: one(galleryAlbums, {
    fields: [galleryAlbumItems.albumId],
    references: [galleryAlbums.id],
  }),
  mediaAsset: one(mediaAssets, {
    fields: [galleryAlbumItems.mediaAssetId],
    references: [mediaAssets.id],
  }),
}))

export type GalleryAlbum = typeof galleryAlbums.$inferSelect
export type NewGalleryAlbum = typeof galleryAlbums.$inferInsert
export type GalleryAlbumItem = typeof galleryAlbumItems.$inferSelect
export type NewGalleryAlbumItem = typeof galleryAlbumItems.$inferInsert
