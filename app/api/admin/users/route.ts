import { randomBytes } from "node:crypto"
import { and, desc, eq, isNull, sql } from "drizzle-orm"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { accounts, users, verifications } from "@/lib/db/schema"
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
  GENERIC_INVITE_ERROR,
  inviteExistingDecision,
  restoreCompensateCredentialAction,
  restoreCompensateUserFields,
  type RestoreInviteSnapshot,
  WELCOME_EMAIL_ERROR,
  WELCOME_TOKEN_TTL_MS,
} from "@/lib/auth/admin-users-pure"
import { sendWelcomeEmail } from "@/lib/auth"
import { setPasswordPageUrl } from "@/lib/auth/reset-password-url-pure"
import {
  checkRateLimit,
  clientKey,
  tooManyRequestsResponse,
} from "@/lib/services/rate-limit"

const createSchema = z.object({
  email: z.string().trim().email().max(320),
  name: z.string().trim().min(1).max(120),
  capabilities: z.array(z.string()),
})

async function requireAdmin() {
  const userId = await requireUserId()
  if (userId instanceof Response) return userId
  const allowed = await requireCapabilityResponse(userId, "admin")
  if (allowed instanceof Response) return allowed
  return userId
}

function listUserRow(row: typeof users.$inferSelect) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    capabilities: sanitizeCapabilities(row.capabilities),
    createdAt: row.createdAt,
  }
}

export async function GET() {
  try {
    const auth = await requireAdmin()
    if (auth instanceof Response) return auth

    const rows = await db
      .select()
      .from(users)
      .where(isNull(users.deletedAt))
      .orderBy(desc(users.createdAt))

    return jsonOk({ users: rows.map(listUserRow) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const actorUserId = await requireAdmin()
    if (actorUserId instanceof Response) return actorUserId

    const limited = await checkRateLimit({
      key: `admin-users-invite:${actorUserId}:${clientKey(request)}`,
      max: 10,
      windowMs: 60_000,
    })
    if (!limited.allowed) {
      return tooManyRequestsResponse(limited.retryAfterMs)
    }

    const parsed = await parseJson(request, createSchema)
    if (parsed instanceof Response) return parsed

    const email = parsed.email.toLowerCase()
    const capabilities = sanitizeCapabilities(parsed.capabilities)
    const token = randomBytes(24).toString("base64url")
    const hashedPassword = await bcrypt.hash(randomBytes(32).toString("hex"), 10)
    const origin =
      process.env.AUTH_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      ""
    const url = setPasswordPageUrl(origin, token)
    if (!url) {
      throw new HttpError(500, WELCOME_EMAIL_ERROR)
    }

    let userId: string
    let inviteDecision: "create" | "restore"
    let restoreSnapshot: RestoreInviteSnapshot | null = null
    try {
      const committed = await db.transaction(async (tx) => {
        const existing = await tx
          .select({
            id: users.id,
            deletedAt: users.deletedAt,
            name: users.name,
            capabilities: users.capabilities,
            emailVerified: users.emailVerified,
            mustChangePassword: users.mustChangePassword,
          })
          .from(users)
          .where(sql`lower(${users.email}) = ${email}`)
          .limit(1)
        const decision = inviteExistingDecision(existing[0])
        if (decision === "reject_live") {
          throw new HttpError(400, GENERIC_INVITE_ERROR)
        }

        const now = new Date()
        const id = decision === "restore" ? existing[0]!.id : crypto.randomUUID()

        if (decision === "restore") {
          await tx
            .update(users)
            .set({
              name: parsed.name,
              capabilities,
              emailVerified: true,
              mustChangePassword: true,
              deletedAt: null,
              updatedAt: now,
            })
            .where(eq(users.id, id))
        } else {
          await tx.insert(users).values({
            id,
            email,
            name: parsed.name,
            emailVerified: true,
            capabilities,
            mustChangePassword: true,
          })
        }

        const credential = await tx
          .select({ id: accounts.id, password: accounts.password })
          .from(accounts)
          .where(and(eq(accounts.userId, id), eq(accounts.providerId, "credential")))
          .limit(1)
        const existingCredential = credential[0]
        let credentialId: string | null = existingCredential?.id ?? null
        if (existingCredential) {
          await tx
            .update(accounts)
            .set({ password: hashedPassword, updatedAt: now })
            .where(eq(accounts.id, existingCredential.id))
        } else {
          credentialId = crypto.randomUUID()
          await tx.insert(accounts).values({
            id: credentialId,
            userId: id,
            issuer: "local:credential",
            accountId: id,
            providerId: "credential",
            password: hashedPassword,
          })
        }

        await tx.insert(verifications).values({
          id: crypto.randomUUID(),
          identifier: `reset-password:${token}`,
          value: id,
          expiresAt: new Date(Date.now() + WELCOME_TOKEN_TTL_MS),
        })

        const snapshot: RestoreInviteSnapshot | null =
          decision === "restore"
            ? {
                name: existing[0]!.name,
                capabilities: existing[0]!.capabilities,
                emailVerified: existing[0]!.emailVerified,
                mustChangePassword: existing[0]!.mustChangePassword,
                credentialId,
                priorPasswordHash: existingCredential ? existingCredential.password : null,
                credentialWasInserted: !existingCredential,
              }
            : null

        return { id, decision, restoreSnapshot: snapshot }
      })
      userId = committed.id
      inviteDecision = committed.decision
      restoreSnapshot = committed.restoreSnapshot
    } catch (error) {
      if (error instanceof HttpError) throw error
      throw new HttpError(400, GENERIC_INVITE_ERROR)
    }

    let emailSent = false
    if (process.env.RESEND_API_KEY) {
      try {
        await sendWelcomeEmail({ user: { email, name: parsed.name }, url })
        emailSent = true
      } catch {
        await db.transaction(async (tx) => {
          await tx
            .delete(verifications)
            .where(eq(verifications.identifier, `reset-password:${token}`))
          if (inviteDecision === "restore") {
            const snapshot = restoreSnapshot
            const now = new Date()
            if (snapshot) {
              const fields = restoreCompensateUserFields(snapshot, now)
              await tx
                .update(users)
                .set({
                  name: fields.name,
                  capabilities: fields.capabilities as string[] | null,
                  emailVerified: fields.emailVerified,
                  mustChangePassword: fields.mustChangePassword,
                  deletedAt: fields.deletedAt,
                  updatedAt: fields.updatedAt,
                })
                .where(eq(users.id, userId))
              const action = restoreCompensateCredentialAction(snapshot)
              if (action.type === "restore_hash") {
                await tx
                  .update(accounts)
                  .set({ password: action.password, updatedAt: now })
                  .where(eq(accounts.id, action.id))
              } else if (action.type === "delete_inserted") {
                await tx.delete(accounts).where(eq(accounts.id, action.id))
              }
            } else {
              await tx
                .update(users)
                .set({ deletedAt: now, updatedAt: now })
                .where(eq(users.id, userId))
            }
          } else {
            await tx.delete(users).where(eq(users.id, userId))
          }
        })
        throw new HttpError(500, WELCOME_EMAIL_ERROR)
      }
    }

    await writeAuditLog({
      actorUserId,
      action: "invite",
      entityType: "user",
      entityId: userId,
      ...auditClientMeta(request),
    })

    return jsonOk(
      {
        id: userId,
        email,
        name: parsed.name,
        capabilities,
        emailSent,
        ...(emailSent ? {} : { setPasswordUrl: url }),
      },
      201,
    )
  } catch (error) {
    return errorResponse(error)
  }
}
