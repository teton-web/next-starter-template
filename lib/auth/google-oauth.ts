type EnvMap = Record<string, string | undefined>

export const GOOGLE_OAUTH_PROVIDER = "google" as const

export type GoogleOAuthExistingUser = {
  id: string
  deletedAt: Date | null
} | null

export type GoogleOAuthOutcome =
  | { ok: true; kind: "link"; userId: string }
  | { ok: false; kind: "disabled" }
  | { ok: false; kind: "unknown_email" }
  | { ok: false; kind: "blocked" }

export type GoogleSocialProviders = {
  google: {
    clientId: string
    clientSecret: string
    disableSignUp: true
    disableImplicitSignUp: true
  }
}

function normalizePath(pathname: string) {
  const path = pathname.split("?")[0] ?? pathname
  if (path.length > 1 && path.endsWith("/")) return path.replace(/\/+$/, "")
  return path || "/"
}

export function googleOAuthKeysPresent(env: EnvMap = process.env): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID?.trim() && env.GOOGLE_CLIENT_SECRET?.trim())
}

/** Flag AND keys. Keys-only is not enough; missing env keeps OAuth dark. */
export function googleOAuthAvailable(flagEnabled: boolean, env: EnvMap = process.env): boolean {
  if (!flagEnabled) return false
  return googleOAuthKeysPresent(env)
}

export function googleSocialProviders(input: {
  flagEnabled: boolean
  env?: EnvMap
}): GoogleSocialProviders | Record<string, never> {
  const env = input.env ?? process.env
  if (!googleOAuthAvailable(input.flagEnabled, env)) return {}
  return {
    google: {
      clientId: env.GOOGLE_CLIENT_ID!.trim(),
      clientSecret: env.GOOGLE_CLIENT_SECRET!.trim(),
      disableSignUp: true,
      disableImplicitSignUp: true,
    },
  }
}

/**
 * Flag-off / missing keys win first so a deleted or unknown email cannot
 * change the response. Soft-deleted is `blocked` (same public error as a
 * bad password), never a distinct "deleted" code.
 */
export function decideGoogleOAuthSignIn(input: {
  available: boolean
  existingUser: GoogleOAuthExistingUser
}): GoogleOAuthOutcome {
  if (!input.available) return { ok: false, kind: "disabled" }
  if (!input.existingUser) return { ok: false, kind: "unknown_email" }
  if (input.existingUser.deletedAt) return { ok: false, kind: "blocked" }
  return { ok: true, kind: "link", userId: input.existingUser.id }
}

export function googleOAuthClientError(outcome: GoogleOAuthOutcome): {
  status: number
  message: string
  code: string
} | null {
  if (outcome.ok) return null
  if (outcome.kind === "disabled") {
    return { status: 404, message: "Not found", code: "NOT_FOUND" }
  }
  if (outcome.kind === "blocked") {
    return {
      status: 401,
      message: "Invalid email or password",
      code: "INVALID_EMAIL_OR_PASSWORD",
    }
  }
  return { status: 403, message: "signup disabled", code: "SIGNUP_DISABLED" }
}

/** Better Auth `user.validateUserInfo` result. Never creates a user. */
export function googleOAuthValidateUserInfo(input: {
  available: boolean
  existingUser: GoogleOAuthExistingUser
}): { error: string; errorDescription?: string } | undefined {
  const decision = decideGoogleOAuthSignIn(input)
  const error = googleOAuthClientError(decision)
  if (!error) return undefined
  return { error: error.code, errorDescription: error.message }
}

export function isGoogleOAuthAuthPath(pathname: string): boolean {
  const path = normalizePath(pathname)
  if (path === "/login" || path.startsWith("/login/")) return false
  return (
    path.endsWith("/callback/google") ||
    path.endsWith("/sign-in/social") ||
    path.endsWith("/link-social")
  )
}

const GOOGLE_CALLBACK_TEMPLATE = "/callback/:id"

function normalizedSessionPaths(input: {
  path?: string | null
  requestPath?: string | null
}): string[] {
  const paths: string[] = []
  for (const value of [input.path, input.requestPath]) {
    if (typeof value === "string" && value.length > 0) {
      paths.push(normalizePath(value))
    }
  }
  return paths
}

/**
 * Better Auth `session.create` path detector. True for a Google session.
 * Better Auth 1.7.2 ALS `context.path` is the route template `/callback/:id`
 * with `params.id` as the provider (`dispatch.mjs` sets `path: endpoint.path`).
 * Also accepts a filled `/callback/google` pathname and `/sign-in/social` +
 * `body.provider === "google"` (idToken). Credential/magic-link/reset must
 * keep `mustChangePassword`.
 */
export function shouldClearMustChangePasswordOnSession(input: {
  path?: string | null
  bodyProvider?: string | null
  paramsId?: string | null
  requestPath?: string | null
}): boolean {
  const paths = normalizedSessionPaths(input)
  if (paths.length === 0) return false
  if (paths.some((path) => path.endsWith(`/callback/${GOOGLE_OAUTH_PROVIDER}`))) return true
  if (
    input.paramsId === GOOGLE_OAUTH_PROVIDER &&
    paths.some(
      (path) => path === GOOGLE_CALLBACK_TEMPLATE || path.endsWith(GOOGLE_CALLBACK_TEMPLATE),
    )
  ) {
    return true
  }
  if (paths.some((path) => path.endsWith("/sign-in/social"))) {
    return input.bodyProvider === GOOGLE_OAUTH_PROVIDER
  }
  return false
}

/** Never 404 `/login`. Social callback / sign-in is 404 when OAuth is dark. */
export function googleOAuthRouteStatus(input: {
  available: boolean
  pathname: string
}): 404 | null {
  if (input.available) return null
  if (!isGoogleOAuthAuthPath(input.pathname)) return null
  return 404
}

export function googleOAuthDisabledResponse(pathname: string, enabled: boolean): Response | null {
  if (googleOAuthRouteStatus({ available: enabled, pathname }) !== 404) return null
  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  })
}
