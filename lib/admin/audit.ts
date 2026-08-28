import { db } from "@/lib/db"
import { auditLogs } from "@/lib/db/schema"

export async function writeAuditLog(input: {
  actorUserId?: string | null
  action: "create" | "update" | "delete" | "invite"
  entityType: string
  entityId: string
  metadata?: Record<string, unknown>
}) {
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata ?? null,
  })
}
