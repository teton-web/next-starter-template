import { count, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { auditLogs, users } from "@/lib/db/schema"
import { parsePagination } from "@/lib/api/pagination"

export const AUDIT_ACTIONS = [
  "create",
  "update",
  "delete",
  "login",
  "logout",
  "invite",
] as const

export type AuditAction = (typeof AUDIT_ACTIONS)[number]

type RequestLike = Request | { headers?: Headers | null } | null | undefined

type NetworkMeta = {
  ipAddress?: string | null
  userAgent?: string | null
}

export type WriteAuditLogInput = {
  actorUserId?: string | null
  action: AuditAction
  entityType: string
  entityId: string
  metadata?: Record<string, unknown>
  ipAddress?: string | null
  userAgent?: string | null
}

export function auditClientMeta(source?: RequestLike, fallback?: NetworkMeta): NetworkMeta {
  const headers = source instanceof Request ? source.headers : source?.headers ?? null
  const forwarded = headers?.get("x-forwarded-for")
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    headers?.get("x-real-ip") ||
    headers?.get("cf-connecting-ip") ||
    fallback?.ipAddress ||
    null
  const userAgent = headers?.get("user-agent") || fallback?.userAgent || null
  return {
    ipAddress: ip || null,
    userAgent: userAgent || null,
  }
}

export async function writeAuditLog(input: WriteAuditLogInput) {
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata ?? null,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  })
}

export async function writeAuditLogSafe(input: WriteAuditLogInput) {
  try {
    await writeAuditLog(input)
  } catch (error) {
    console.error("Failed to write audit log", error)
  }
}

export async function listAuditLogs(searchParams: URLSearchParams) {
  const { limit, offset } = parsePagination(searchParams)
  const [logs, totalRows] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
        actorUserId: auditLogs.actorUserId,
        actorEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(auditLogs),
  ])

  return { logs, total: Number(totalRows[0]?.total ?? 0), limit, offset }
}
