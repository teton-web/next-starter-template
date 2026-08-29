import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { APIError, createAuthMiddleware } from "better-auth/api"
import { magicLink } from "better-auth/plugins"
import { and, eq, isNull, sql } from "drizzle-orm"
import bcrypt from "bcryptjs"
import { Resend as ResendClient } from "resend"
import { db } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { resetPasswordTokenFromCtx } from "@/lib/auth/reset-password-token-pure"
import { publicResetPasswordUrl } from "@/lib/auth/reset-password-url-pure"
import {
  renderResetPasswordEmail,
  renderSignInEmail,
  renderVerifyEmail,
  renderWelcomeEmail,
} from "@/emails/render"
import { auditClientMeta, writeAuditLogSafe } from "@/lib/admin/audit"
import {
  googleOAuthKeysPresent,
  googleOAuthValidateUserInfo,
  googleSocialProviders,
  shouldClearMustChangePasswordOnSession,
} from "@/lib/auth/google-oauth"
import { isEnabled } from "@/lib/flags/resolve"

function getResend() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set")
  }
  return new ResendClient(apiKey)
}

function emailFrom() {
  const from = process.env.EMAIL_FROM
  if (!from) {
    throw new Error("EMAIL_FROM is not set")
  }
  return from
}

export function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
}

function invalidEmailOrPassword() {
  return new APIError("UNAUTHORIZED", {
    message: "Invalid email or password",
    code: "INVALID_EMAIL_OR_PASSWORD",
  })
}

export async function isAccountBlocked(userId: string): Promise<boolean> {
  const rows = await db
    .select({ deletedAt: schema.users.deletedAt })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1)

  return Boolean(rows[0]?.deletedAt)
}

async function findUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase()
  const rows = await db
    .select({
      id: schema.users.id,
      deletedAt: schema.users.deletedAt,
    })
    .from(schema.users)
    .where(sql`lower(${schema.users.email}) = ${normalized}`)
    .limit(1)

  return rows[0] ?? null
}

export async function sendWelcomeEmail({
  user,
  url,
}: {
  user: { email: string; name?: string | null }
  url: string
}) {
  if (!isResendConfigured()) {
    return
  }

  const resend = getResend()
  const { error } = await resend.emails.send({
    from: emailFrom(),
    to: user.email,
    subject: "Set up your account",
    html: await renderWelcomeEmail({ url, name: user.name }),
  })
  if (error) {
    throw new Error(error.message || "Failed to send welcome email")
  }
}

async function sendResetPasswordEmail({
  user,
  url,
  token,
}: {
  user: { id: string; email: string }
  url: string
  token?: string
}) {
  if (await isAccountBlocked(user.id)) {
    return
  }
  if (!isResendConfigured()) {
    return
  }

  const pageUrl = publicResetPasswordUrl(url, token)
  const resend = getResend()
  await resend.emails.send({
    from: emailFrom(),
    to: user.email,
    subject: "Reset your password",
    html: await renderResetPasswordEmail({ url: pageUrl }),
  })
}

const authSchema = {
  ...schema,
  user: schema.users,
  session: schema.sessions,
  account: schema.accounts,
  verification: schema.verifications,
}

export const auth = betterAuth({
  appName: process.env.NEXT_PUBLIC_SITE_NAME || "Next Starter",
  secret: process.env.AUTH_SECRET,
  baseURL: process.env.AUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  // Keys at boot register Google; Node `isEnabled("oauth")` 404s the
  // social routes when the flag is off. `disableSignUp` stays on.
  socialProviders: googleSocialProviders({
    flagEnabled: googleOAuthKeysPresent(),
  }),
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
    },
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url, token }) => {
      await sendResetPasswordEmail({ user, url, token })
    },
    onPasswordReset: async ({ user }) => {
      await db
        .update(schema.users)
        .set({
          mustChangePassword: false,
          updatedAt: new Date(),
        })
        .where(and(eq(schema.users.id, user.id), isNull(schema.users.deletedAt)))
    },
    password: {
      hash: (password) => bcrypt.hash(password, 10),
      verify: ({ hash, password }) => bcrypt.compare(password, hash),
    },
  },
  emailVerification: isResendConfigured()
    ? {
        sendVerificationEmail: async ({ user, url }) => {
          const resend = getResend()
          await resend.emails.send({
            from: emailFrom(),
            to: user.email,
            subject: "Verify your email",
            html: await renderVerifyEmail({ url }),
          })
        },
      }
    : undefined,
  user: {
    additionalFields: {
      capabilities: {
        type: "json",
        required: false,
        defaultValue: [],
        input: false,
      },
      deletedAt: {
        type: "date",
        required: false,
        input: false,
      },
      mustChangePassword: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
    validateUserInfo: async ({ user, source }) => {
      if (source.oauth?.providerId !== "google") return
      const email = typeof user.email === "string" ? user.email : ""
      const existing = email ? await findUserByEmail(email) : null
      return googleOAuthValidateUserInfo({
        available: await isEnabled("oauth"),
        existingUser: existing,
      })
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-in/email") {
        const email = typeof ctx.body?.email === "string" ? ctx.body.email : ""
        const user = email ? await findUserByEmail(email) : null
        if (user?.deletedAt) {
          throw invalidEmailOrPassword()
        }
      }

      if (ctx.path === "/reset-password") {
        const token = resetPasswordTokenFromCtx({ body: ctx.body, query: ctx.query })
        if (!token) return
        const rows = await db
          .select({ value: schema.verifications.value })
          .from(schema.verifications)
          .where(eq(schema.verifications.identifier, `reset-password:${token}`))
          .limit(1)
        const userId = rows[0]?.value
        if (userId && await isAccountBlocked(userId)) {
          throw new APIError("BAD_REQUEST", {
            message: "Invalid token",
            code: "INVALID_TOKEN",
          })
        }
      }
    }),
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          if (await isAccountBlocked(session.userId)) {
            return false
          }
          return { data: session }
        },
        after: async (session, context) => {
          const meta = auditClientMeta(context?.request, {
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
          })
          await writeAuditLogSafe({
            actorUserId: session.userId,
            action: "login",
            entityType: "user",
            entityId: session.userId,
            ...meta,
          })
          const path = typeof context?.path === "string" ? context.path : undefined
          const rawProvider =
            context?.body && typeof context.body === "object" && "provider" in context.body
              ? context.body.provider
              : undefined
          const bodyProvider = typeof rawProvider === "string" ? rawProvider : undefined
          const rawParamsId =
            context?.params && typeof context.params === "object" && "id" in context.params
              ? context.params.id
              : undefined
          const paramsId = typeof rawParamsId === "string" ? rawParamsId : undefined
          let requestPath: string | undefined
          const requestUrl =
            context?.request && typeof context.request === "object" && "url" in context.request
              ? context.request.url
              : undefined
          if (typeof requestUrl === "string" && requestUrl.length > 0) {
            try {
              requestPath = new URL(requestUrl).pathname
            } catch {
              requestPath = undefined
            }
          }
          if (shouldClearMustChangePasswordOnSession({ path, bodyProvider, paramsId, requestPath })) {
            await db
              .update(schema.users)
              .set({
                mustChangePassword: false,
                updatedAt: new Date(),
              })
              .where(and(eq(schema.users.id, session.userId), isNull(schema.users.deletedAt)))
          }
        },
      },
      delete: {
        after: async (session, context) => {
          const meta = auditClientMeta(context?.request, {
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
          })
          await writeAuditLogSafe({
            actorUserId: session.userId,
            action: "logout",
            entityType: "user",
            entityId: session.userId,
            ...meta,
          })
        },
      },
    },
  },
  plugins: isResendConfigured()
    ? [
        magicLink({
          disableSignUp: true,
          sendMagicLink: async ({ email, url }) => {
            const user = await findUserByEmail(email)
            if (!user || user.deletedAt) {
              return
            }
            const resend = getResend()
            await resend.emails.send({
              from: emailFrom(),
              to: email,
              subject: "Sign in",
              html: await renderSignInEmail({ url }),
            })
          },
        }),
      ]
    : [],
})

export async function getSession() {
  const { headers } = await import("next/headers")
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user) {
    return null
  }

  if (await isAccountBlocked(session.user.id)) {
    return null
  }

  return session
}

export type Session = typeof auth.$Infer.Session
