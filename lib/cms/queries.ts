import { and, desc, eq, isNull, lte, or } from "drizzle-orm"
import { db } from "@/lib/db"
import { cmsEntries, locales, mediaAssets } from "@/lib/db/schema"
import { isLivePublishedEntry } from "@/lib/cms/live-pure"
import { cmsPreviewKeyCandidates, pickCmsPreviewEntry } from "@/lib/cms/preview-pure"
import { publishedEntriesForPublic } from "@/lib/cms/scheduled-publish-pure"

function publiclyListedWhere(now: Date = new Date()) {
  return and(
    eq(cmsEntries.status, "published"),
    or(isNull(cmsEntries.publishAt), lte(cmsEntries.publishAt, now)),
  )
}

export async function getDefaultLocaleId() {
  const rows = await db.select().from(locales).where(eq(locales.isDefault, true)).limit(1)
  if (rows[0]) return rows[0].id
  const any = await db.select().from(locales).limit(1)
  return any[0]?.id ?? null
}

export async function getPublishedEntryByPath(routePath: string) {
  const rows = await db
    .select({
      entry: cmsEntries,
      heroUrl: mediaAssets.storageUrl,
      heroAlt: mediaAssets.altText,
    })
    .from(cmsEntries)
    .leftJoin(mediaAssets, eq(cmsEntries.heroMediaId, mediaAssets.id))
    .where(and(eq(cmsEntries.routePath, routePath), publiclyListedWhere()))
    .limit(1)
  if (!rows.length) return null
  if (!isLivePublishedEntry(rows[0].entry)) return null
  return rows[0]
}

export type PublishedCmsRow = NonNullable<Awaited<ReturnType<typeof getPublishedEntryByPath>>>

export async function listPublishedEntries(entryType: "page" | "article") {
  const rows = await db
    .select()
    .from(cmsEntries)
    .where(and(eq(cmsEntries.entryType, entryType), publiclyListedWhere()))
    .orderBy(desc(cmsEntries.publishedAt))
  return publishedEntriesForPublic(rows)
}

export async function getCmsEntryForPreview(idOrSlug: string) {
  const { id, slug, routePaths } = cmsPreviewKeyCandidates(idOrSlug)
  if (!id) return null

  const rows = await db
    .select({
      entry: cmsEntries,
      heroUrl: mediaAssets.storageUrl,
      heroAlt: mediaAssets.altText,
    })
    .from(cmsEntries)
    .leftJoin(mediaAssets, eq(cmsEntries.heroMediaId, mediaAssets.id))
    .where(
      or(
        eq(cmsEntries.id, id),
        eq(cmsEntries.slug, slug),
        ...routePaths.map((path) => eq(cmsEntries.routePath, path)),
      ),
    )

  const picked = pickCmsPreviewEntry(
    rows.map((row) => row.entry),
    id,
  )
  if (!picked) return null
  return rows.find((row) => row.entry.id === picked.id) ?? null
}
