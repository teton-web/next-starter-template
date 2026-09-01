import { and, desc, eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/lib/db"
import { cmsEntries, cmsRevisions, mediaAssets, mediaUsages, users } from "@/lib/db/schema"
import { jsonOk, requireCapabilityResponse, requireUserId } from "@/lib/api/helpers"
import { errorResponse, HttpError } from "@/lib/api/http-error"
import { auditClientMeta, writeAuditLog } from "@/lib/admin/audit"
import { isReservedSlug, isValidSlug, routeForEntry } from "@/lib/cms/slugs"
import { sanitizeCmsHtml } from "@/lib/cms/sanitize"
import { canHardDeleteCmsEntry } from "@/lib/cms/delete-pure"
import { restoreCmsRevision } from "@/lib/cms/restore"
import { revalidatePublic } from "@/lib/cache/public-cache"
import { trackEvent } from "@/lib/analytics"
import { isEnabled } from "@/lib/flags/resolve"
import {
  INVALID_PUBLISH_AT_MESSAGE,
  SCHEDULED_PUBLISH_DISABLED_MESSAGE,
  assertPublishAtAllowed,
  nextCmsStatusForSave,
  nextPublishAtForSave,
  nextPublishedAtForSave,
  parsePublishAtInput,
} from "@/lib/cms/scheduled-publish-pure"

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z.string().optional(),
  excerpt: z.string().max(500).nullable().optional(),
  body: z.string().optional(),
  heroMediaId: z.string().nullable().optional(),
  status: z.enum(["draft", "in_review", "published"]).optional(),
  publishAt: z.union([z.string(), z.null()]).optional(),
  restoreRevisionId: z.string().optional(),
})

async function requireEditor() {
  const userId = await requireUserId()
  if (userId instanceof Response) return userId
  const allowed = await requireCapabilityResponse(userId, "moderate")
  if (allowed instanceof Response) return allowed
  return userId
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return getCmsEntryResponse(_request, context)
}

export async function getCmsEntryResponse(
  _request: Request,
  context: { params: Promise<{ id: string }> },
  scheduledPublishEnabled?: boolean,
) {
  try {
    const auth = await requireEditor()
    if (auth instanceof Response) return auth
    const { id } = await context.params
    const [entry] = await db.select().from(cmsEntries).where(eq(cmsEntries.id, id)).limit(1)
    if (!entry) throw new HttpError(404, "Entry not found")
    let heroMedia: { id: string; filename: string } | null = null
    if (entry.heroMediaId) {
      const [asset] = await db
        .select({ id: mediaAssets.id, filename: mediaAssets.filename })
        .from(mediaAssets)
        .where(eq(mediaAssets.id, entry.heroMediaId))
        .limit(1)
      heroMedia = asset ?? { id: entry.heroMediaId, filename: "Current hero" }
    }
    const revisions = await db
      .select({
        id: cmsRevisions.id,
        revisionNumber: cmsRevisions.revisionNumber,
        snapshot: cmsRevisions.snapshot,
        createdAt: cmsRevisions.createdAt,
        createdByUserId: cmsRevisions.createdByUserId,
        actorEmail: users.email,
      })
      .from(cmsRevisions)
      .leftJoin(users, eq(cmsRevisions.createdByUserId, users.id))
      .where(eq(cmsRevisions.entryId, id))
      .orderBy(desc(cmsRevisions.revisionNumber))
    return jsonOk({
      entry,
      revisions,
      heroMedia,
      scheduledPublishEnabled: scheduledPublishEnabled ?? (await isEnabled("scheduled_publish")),
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return patchCmsEntryResponse(request, context)
}

export async function patchCmsEntryResponse(
  request: Request,
  context: { params: Promise<{ id: string }> },
  scheduledPublishEnabled?: boolean,
  now: Date = new Date(),
) {
  try {
    const userId = await requireEditor()
    if (userId instanceof Response) return userId
    const { id } = await context.params
    const [entry] = await db.select().from(cmsEntries).where(eq(cmsEntries.id, id)).limit(1)
    if (!entry) throw new HttpError(404, "Entry not found")

    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      throw new HttpError(400, "Invalid JSON body")
    }
    const parsedResult = patchSchema.safeParse(raw)
    if (!parsedResult.success) {
      throw new HttpError(422, parsedResult.error.message)
    }
    const parsed = parsedResult.data

    if (parsed.restoreRevisionId) {
      const result = await restoreCmsRevision({
        entryId: id,
        revisionId: parsed.restoreRevisionId,
        userId,
        request,
      })
      return jsonOk({ success: true, ...result })
    }

    const slug = parsed.slug && isValidSlug(parsed.slug) ? parsed.slug : entry.slug
    if (isReservedSlug(slug)) throw new HttpError(400, "Reserved slug")
    const body = parsed.body !== undefined ? sanitizeCmsHtml(parsed.body) : entry.body
    const routePath = routeForEntry(entry.entryType, slug)
    let parsedPublishAt: Date | null | undefined
    try {
      parsedPublishAt = parsed.publishAt === undefined ? undefined : parsePublishAtInput(parsed.publishAt)
    } catch {
      throw new HttpError(422, INVALID_PUBLISH_AT_MESSAGE)
    }
    try {
      assertPublishAtAllowed(
        parsedPublishAt,
        scheduledPublishEnabled ?? (parsedPublishAt ? await isEnabled("scheduled_publish") : true),
      )
    } catch (error) {
      if (error instanceof Error && error.message === SCHEDULED_PUBLISH_DISABLED_MESSAGE) {
        throw new HttpError(400, SCHEDULED_PUBLISH_DISABLED_MESSAGE)
      }
      throw error
    }
    const requestedStatus = parsed.status ?? entry.status
    const scheduledForStatus = parsedPublishAt === undefined ? entry.publishAt : parsedPublishAt
    const status = nextCmsStatusForSave({
      requestedStatus,
      previousStatus: entry.status,
      publishAt: scheduledForStatus,
      now,
    })
    const resolvedPublishAt = nextPublishAtForSave({
      status,
      previousStatus: entry.status,
      previousPublishAt: entry.publishAt,
      previousPublishedAt: entry.publishedAt,
      parsedPublishAt,
      now,
    })

    await db
      .update(cmsEntries)
      .set({
        title: parsed.title ?? entry.title,
        slug,
        routePath,
        excerpt: parsed.excerpt === undefined ? entry.excerpt : parsed.excerpt,
        body,
        heroMediaId: parsed.heroMediaId === undefined ? entry.heroMediaId : parsed.heroMediaId,
        status,
        publishAt: resolvedPublishAt,
        publishedAt: nextPublishedAtForSave({
          status,
          previousPublishedAt: entry.publishedAt,
          publishAt: resolvedPublishAt,
          now,
        }),
        updatedByUserId: userId,
        updatedAt: now,
        translationsStale: Boolean(entry.sourceEntryId) ? false : entry.translationsStale,
      })
      .where(eq(cmsEntries.id, id))

    const latest = await db
      .select({ revisionNumber: cmsRevisions.revisionNumber })
      .from(cmsRevisions)
      .where(eq(cmsRevisions.entryId, id))
      .orderBy(desc(cmsRevisions.revisionNumber))
      .limit(1)

    await db.insert(cmsRevisions).values({
      id: crypto.randomUUID(),
      entryId: id,
      revisionNumber: (latest[0]?.revisionNumber ?? 0) + 1,
      snapshot: {
        title: parsed.title ?? entry.title,
        slug,
        body,
        excerpt: parsed.excerpt === undefined ? entry.excerpt : parsed.excerpt,
        heroMediaId: parsed.heroMediaId === undefined ? entry.heroMediaId : parsed.heroMediaId,
        status,
      },
      createdByUserId: userId,
    })

    if (parsed.heroMediaId !== undefined) {
      await db
        .delete(mediaUsages)
        .where(and(eq(mediaUsages.entityType, "cms_entry"), eq(mediaUsages.entityId, id), eq(mediaUsages.fieldKey, "hero")))
      if (parsed.heroMediaId) {
        await db.insert(mediaUsages).values({
          id: crypto.randomUUID(),
          assetId: parsed.heroMediaId,
          entityType: "cms_entry",
          entityId: id,
          fieldKey: "hero",
          sortOrder: 0,
        })
      }
    }

    if (entry.sourceEntryId === null && status === "published") {
      await db
        .update(cmsEntries)
        .set({ translationsStale: true })
        .where(eq(cmsEntries.sourceEntryId, id))
    }

    revalidatePublic(entry.entryType === "article" ? "articles" : "pages")
    await writeAuditLog({
      actorUserId: userId,
      action: "update",
      entityType: "cms_entry",
      entityId: id,
      ...auditClientMeta(request),
    })
    if (status === "published" && entry.status !== "published") {
      trackEvent("cms_publish", { entry_type: entry.entryType })
    }
    return jsonOk({ success: true, status, routePath })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireEditor()
    if (userId instanceof Response) return userId
    const { id } = await context.params
    const [entry] = await db.select().from(cmsEntries).where(eq(cmsEntries.id, id)).limit(1)
    if (!entry) throw new HttpError(404, "Entry not found")
    if (!canHardDeleteCmsEntry(entry.status)) {
      throw new HttpError(409, "Only draft entries can be deleted")
    }

    await db
      .delete(mediaUsages)
      .where(and(eq(mediaUsages.entityType, "cms_entry"), eq(mediaUsages.entityId, id)))
    await db.delete(cmsEntries).where(eq(cmsEntries.id, id))

    revalidatePublic(entry.entryType === "article" ? "articles" : "pages")
    await writeAuditLog({
      actorUserId: userId,
      action: "delete",
      entityType: "cms_entry",
      entityId: id,
      ...auditClientMeta(request),
    })
    return jsonOk({ success: true })
  } catch (error) {
    return errorResponse(error)
  }
}
