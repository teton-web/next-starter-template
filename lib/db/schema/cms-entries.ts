import { pgTable, text, timestamp, boolean, index, uniqueIndex } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { cmsEntryStatus, cmsEntryType } from "./enums"
import { locales } from "./locales"
import { mediaAssets } from "./media-assets"
import { users } from "./users"
import { cmsRevisions } from "./cms-revisions"

export const cmsEntries = pgTable("cms_entries", {
  id: text("id").primaryKey(),
  entryType: cmsEntryType("entry_type").notNull(),
  localeId: text("locale_id").notNull().references(() => locales.id, { onDelete: "restrict" }),
  slug: text("slug").notNull(),
  routePath: text("route_path").notNull(),
  title: text("title").notNull(),
  excerpt: text("excerpt"),
  body: text("body").default("").notNull(),
  heroMediaId: text("hero_media_id").references(() => mediaAssets.id, { onDelete: "set null" }),
  status: cmsEntryStatus("status").default("draft").notNull(),
  sourceEntryId: text("source_entry_id"),
  translationsStale: boolean("translations_stale").default(false).notNull(),
  publishedAt: timestamp("published_at"),
  publishAt: timestamp("publish_at", { withTimezone: true }),
  createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  updatedByUserId: text("updated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  localeTypeSlugIdx: uniqueIndex("idx_cms_entries_locale_type_slug").on(
    table.localeId,
    table.entryType,
    table.slug,
  ),
  localeRouteIdx: uniqueIndex("idx_cms_entries_locale_route").on(table.localeId, table.routePath),
  statusIdx: index("idx_cms_entries_status").on(table.status),
  publishAtIdx: index("idx_cms_entries_publish_at").on(table.publishAt),
}))

export const cmsEntriesRelations = relations(cmsEntries, ({ many, one }) => ({
  revisions: many(cmsRevisions),
  locale: one(locales, {
    fields: [cmsEntries.localeId],
    references: [locales.id],
  }),
  hero: one(mediaAssets, {
    fields: [cmsEntries.heroMediaId],
    references: [mediaAssets.id],
  }),
}))

export type CmsEntry = typeof cmsEntries.$inferSelect
export type NewCmsEntry = typeof cmsEntries.$inferInsert
