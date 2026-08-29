import { and, asc, eq, isNull, isNotNull, lte } from "drizzle-orm"
import { writeAuditLog } from "@/lib/admin/audit"
import { revalidatePublic } from "@/lib/cache/public-cache"
import {
  isDueScheduledPublish,
  scheduledPublishFlipValues,
} from "@/lib/cms/scheduled-publish-pure"
import { db } from "@/lib/db"
import { cmsEntries } from "@/lib/db/schema"

export type ScheduledPublishResult = {
  published: number
  ids: string[]
}

type ScheduledPublishDb = Pick<typeof db, "transaction">

/**
 * Publish due CMS rows in one transaction: lock by id (skip locked), flip status + publishedAt,
 * audit each row. A later failure rolls back every flip from this run.
 */
export async function runScheduledPublishWorker(options: {
  now?: Date
  db?: ScheduledPublishDb
} = {}): Promise<ScheduledPublishResult> {
  const now = options.now ?? new Date()
  const client = options.db ?? db
  const flip = scheduledPublishFlipValues(now)

  const ids = await client.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(cmsEntries)
      .where(
        and(
          isNotNull(cmsEntries.publishAt),
          lte(cmsEntries.publishAt, now),
          isNull(cmsEntries.publishedAt),
        ),
      )
      .orderBy(asc(cmsEntries.id))
      .for("update", { skipLocked: true })

    const publishedIds: string[] = []
    for (const row of rows) {
      if (!isDueScheduledPublish(row, now)) continue
      const fromStatus = row.status
      const publishAtIso =
        row.publishAt instanceof Date ? row.publishAt.toISOString() : row.publishAt
      await tx
        .update(cmsEntries)
        .set({
          status: flip.status,
          publishedAt: flip.publishedAt,
          updatedAt: now,
        })
        .where(eq(cmsEntries.id, row.id))

      await writeAuditLog(
        {
          actorUserId: null,
          action: "update",
          entityType: "cms_entry",
          entityId: row.id,
          metadata: {
            from: fromStatus,
            to: "published",
            publishAt: publishAtIso,
            source: "scheduled_publish",
          },
        },
        tx,
      )
      publishedIds.push(row.id)
    }

    return publishedIds
  })

  if (ids.length > 0) {
    try {
      revalidatePublic("pages")
      revalidatePublic("articles")
    } catch (error) {
      console.error("scheduled publish revalidate failed", error)
    }
  }

  return { published: ids.length, ids }
}
