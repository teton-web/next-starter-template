import "server-only"

import { desc, eq, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { auditLogs, cmsEntries, contactInquiries, users } from "@/lib/db/schema"

const HOME_LIMIT = 10
const MAX_LIST_LIMIT = 100

function clampLimit(limit: number, fallback: number) {
  if (!Number.isFinite(limit) || limit < 1) return fallback
  return Math.min(Math.floor(limit), MAX_LIST_LIMIT)
}

export async function listUnpublishedCmsEntries(limit = 20) {
  return db
    .select({
      id: cmsEntries.id,
      title: cmsEntries.title,
      slug: cmsEntries.slug,
      entryType: cmsEntries.entryType,
      status: cmsEntries.status,
      routePath: cmsEntries.routePath,
      updatedAt: cmsEntries.updatedAt,
    })
    .from(cmsEntries)
    .where(inArray(cmsEntries.status, ["draft", "in_review"]))
    .orderBy(desc(cmsEntries.updatedAt))
    .limit(clampLimit(limit, 20))
}

export async function listContactInquiries(limit = HOME_LIMIT) {
  return db
    .select({
      id: contactInquiries.id,
      name: contactInquiries.name,
      email: contactInquiries.email,
      message: contactInquiries.message,
      createdAt: contactInquiries.createdAt,
    })
    .from(contactInquiries)
    .orderBy(desc(contactInquiries.createdAt))
    .limit(clampLimit(limit, HOME_LIMIT))
}

export async function listRecentAuditLogs(limit = HOME_LIMIT) {
  try {
    return await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        createdAt: auditLogs.createdAt,
        actorEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(clampLimit(limit, HOME_LIMIT))
  } catch {
    return []
  }
}
