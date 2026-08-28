import { eq, isNull } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/lib/db"
import { users } from "@/lib/db/schema"
import {
  jsonOk,
  parseJson,
  requireCapabilityResponse,
  requireUserId,
} from "@/lib/api/helpers"
import { errorResponse, HttpError } from "@/lib/api/http-error"
import { auditClientMeta, writeAuditLog } from "@/lib/admin/audit"
import { sanitizeCapabilities } from "@/lib/auth/capabilities"
import {
  isAdminUser,
  LAST_ADMIN_ERROR,
  lastAdminCapabilityChangeBlocked,
} from "@/lib/auth/admin-users-pure"

const patchSchema = z
  .object({
    capabilities: z.array(z.string()).optional(),
    deletedAt: z.literal(true).optional(),
  })
  .refine((value) => value.capabilities !== undefined || value.deletedAt === true, {
    message: "Provide capabilities or deletedAt",
  })

async function requireAdmin() {
  const userId = await requireUserId()
  if (userId instanceof Response) return userId
  const allowed = await requireCapabilityResponse(userId, "admin")
  if (allowed instanceof Response) return allowed
  return userId
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actorUserId = await requireAdmin()
    if (actorUserId instanceof Response) return actorUserId

    const { id } = await context.params
    const parsed = await parseJson(request, patchSchema)
    if (parsed instanceof Response) return parsed

    const result = await db.transaction(async (tx) => {
      const locked = await tx
        .select()
        .from(users)
        .where(isNull(users.deletedAt))
        .orderBy(users.id)
        .for("update")
      const target = locked.find((row) => row.id === id)
      if (!target) throw new HttpError(404, "User not found")

      const activeAdminCount = locked.filter((row) => isAdminUser(row.capabilities)).length
      const targetIsAdmin = isAdminUser(target.capabilities)

      if (parsed.deletedAt === true) {
        if (
          lastAdminCapabilityChangeBlocked({
            activeAdminCount,
            targetIsAdmin,
            nextIsAdmin: false,
          })
        ) {
          throw new HttpError(400, LAST_ADMIN_ERROR)
        }
        await tx
          .update(users)
          .set({ deletedAt: new Date(), updatedAt: new Date() })
          .where(eq(users.id, id))
        return { kind: "delete" as const }
      }

      const capabilities = sanitizeCapabilities(parsed.capabilities)
      const nextIsAdmin = isAdminUser(capabilities)
      if (
        lastAdminCapabilityChangeBlocked({
          activeAdminCount,
          targetIsAdmin,
          nextIsAdmin,
        })
      ) {
        throw new HttpError(400, LAST_ADMIN_ERROR)
      }

      await tx
        .update(users)
        .set({ capabilities, updatedAt: new Date() })
        .where(eq(users.id, id))
      return { kind: "update" as const, capabilities }
    })

    if (result.kind === "delete") {
      await writeAuditLog({
        actorUserId,
        action: "delete",
        entityType: "user",
        entityId: id,
        ...auditClientMeta(request),
      })
      return jsonOk({ id, deletedAt: true })
    }

    await writeAuditLog({
      actorUserId,
      action: "update",
      entityType: "user",
      entityId: id,
      metadata: { capabilities: result.capabilities },
      ...auditClientMeta(request),
    })
    return jsonOk({ id, capabilities: result.capabilities })
  } catch (error) {
    return errorResponse(error)
  }
}
