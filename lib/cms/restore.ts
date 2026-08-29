import { and, desc, eq, ne, or } from "drizzle-orm"
import { db } from "@/lib/db"
import { cmsEntries, cmsRevisions, mediaUsages } from "@/lib/db/schema"
import { auditClientMeta, writeAuditLog } from "@/lib/admin/audit"
import { HttpError } from "@/lib/api/http-error"
import { revalidatePublic } from "@/lib/cache/public-cache"
import { isReservedSlug, isValidSlug, routeForEntry } from "@/lib/cms/slugs"
import { sanitizeCmsHtml } from "@/lib/cms/sanitize"
import {
  cmsRevisionSnapshotFromDraft,
  nextCmsRevisionNumber,
  parseCmsRevisionSnapshot,
  workingDraftFromRevision,
} from "@/lib/cms/restore-pure"

const SLUG_ROUTE_TAKEN = "Slug or route is already in use"

async function assertSlugAndRouteAvailable(
  tx: Pick<typeof db, "select">,
  entry: { id: string; localeId: string; entryType: "page" | "article" },
  slug: string,
  routePath: string,
) {
  const [conflict] = await tx
    .select({ id: cmsEntries.id })
    .from(cmsEntries)
    .where(
      and(
        ne(cmsEntries.id, entry.id),
        or(
          and(
            eq(cmsEntries.localeId, entry.localeId),
            eq(cmsEntries.entryType, entry.entryType),
            eq(cmsEntries.slug, slug),
          ),
          and(eq(cmsEntries.localeId, entry.localeId), eq(cmsEntries.routePath, routePath)),
        ),
      ),
    )
    .limit(1)
  if (conflict) throw new HttpError(409, SLUG_ROUTE_TAKEN)
}

export async function restoreCmsRevision(input: {
  entryId: string
  revisionId: string
  userId: string
  request: Request
}) {
  const result = await db.transaction(async (tx) => {
    const [entry] = await tx
      .select()
      .from(cmsEntries)
      .where(eq(cmsEntries.id, input.entryId))
      .limit(1)
      .for("update")
    if (!entry) throw new HttpError(404, "Entry not found")

    const [revision] = await tx
      .select()
      .from(cmsRevisions)
      .where(and(eq(cmsRevisions.id, input.revisionId), eq(cmsRevisions.entryId, input.entryId)))
      .limit(1)
    if (!revision) throw new HttpError(404, "Revision not found")

    const restored = workingDraftFromRevision(entry, parseCmsRevisionSnapshot(revision.snapshot))
    const slug = isValidSlug(restored.slug) ? restored.slug : entry.slug
    if (isReservedSlug(slug)) throw new HttpError(400, "Reserved slug")
    const body = sanitizeCmsHtml(restored.body)
    const routePath = routeForEntry(entry.entryType, slug)
    await assertSlugAndRouteAvailable(tx, entry, slug, routePath)
    const now = new Date()

    const latest = await tx
      .select({ revisionNumber: cmsRevisions.revisionNumber })
      .from(cmsRevisions)
      .where(eq(cmsRevisions.entryId, input.entryId))
      .orderBy(desc(cmsRevisions.revisionNumber))
      .limit(1)

    await tx
      .update(cmsEntries)
      .set({
        title: restored.title,
        slug,
        routePath,
        excerpt: restored.excerpt,
        body,
        heroMediaId: restored.heroMediaId,
        status: restored.status,
        publishedAt: restored.publishedAt,
        publishAt: restored.publishAt,
        updatedByUserId: input.userId,
        updatedAt: now,
        translationsStale: Boolean(entry.sourceEntryId) ? false : entry.translationsStale,
      })
      .where(eq(cmsEntries.id, input.entryId))

    await tx.insert(cmsRevisions).values({
      id: crypto.randomUUID(),
      entryId: input.entryId,
      revisionNumber: nextCmsRevisionNumber(latest[0]?.revisionNumber),
      snapshot: cmsRevisionSnapshotFromDraft({
        title: restored.title,
        slug,
        excerpt: restored.excerpt,
        body,
        heroMediaId: restored.heroMediaId,
        status: restored.status,
      }),
      createdByUserId: input.userId,
    })

    await tx
      .delete(mediaUsages)
      .where(
        and(
          eq(mediaUsages.entityType, "cms_entry"),
          eq(mediaUsages.entityId, input.entryId),
          eq(mediaUsages.fieldKey, "hero"),
        ),
      )
    if (restored.heroMediaId) {
      await tx.insert(mediaUsages).values({
        id: crypto.randomUUID(),
        assetId: restored.heroMediaId,
        entityType: "cms_entry",
        entityId: input.entryId,
        fieldKey: "hero",
        sortOrder: 0,
      })
    }

    await writeAuditLog(
      {
        actorUserId: input.userId,
        action: "update",
        entityType: "cms_entry",
        entityId: input.entryId,
        metadata: {
          restoreRevisionId: input.revisionId,
          fromRevisionNumber: revision.revisionNumber,
        },
        ...auditClientMeta(input.request),
      },
      tx,
    )

    return { status: restored.status, routePath, entryType: entry.entryType }
  })

  revalidatePublic(result.entryType === "article" ? "articles" : "pages")
  return { status: result.status, routePath: result.routePath }
}
