import { mock } from "bun:test"

export const getSession = mock(async (): Promise<{ user: { id: string } } | null> => null)
export const sendWelcomeEmail = mock(
  async (_input: { user: { email: string; name?: string | null }; url: string }) => undefined,
)
export function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
}
export const isAccountBlocked = mock(async (_userId: string) => false)
export const auth = {
  api: { getSession },
}

/**
 * Full `@/lib/auth` ESM surface for `mock.module`.
 * Bun last-wins process-wide; a `{ getSession }`-only stub drops
 * `isResendConfigured` / `sendWelcomeEmail` and Linux CI fails to load
 * later files such as admin-users.test.ts.
 */
export function authMockExports(
  overrides: {
    getSession?: typeof getSession
    sendWelcomeEmail?: typeof sendWelcomeEmail
    isResendConfigured?: typeof isResendConfigured
    isAccountBlocked?: typeof isAccountBlocked
    auth?: typeof auth
  } = {},
) {
  const session = overrides.getSession ?? getSession
  return {
    getSession: session,
    sendWelcomeEmail: overrides.sendWelcomeEmail ?? sendWelcomeEmail,
    isResendConfigured: overrides.isResendConfigured ?? isResendConfigured,
    isAccountBlocked: overrides.isAccountBlocked ?? isAccountBlocked,
    auth: overrides.auth ?? { api: { getSession: session } },
  }
}
