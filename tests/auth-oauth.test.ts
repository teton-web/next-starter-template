process.env.DATABASE_URL ??= "postgresql://ci:ci@localhost:5432/ci"
process.env.AUTH_SECRET ??= "ci-placeholder-secret-minimum-32-characters"

import { describe, expect, mock, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"
import {
  decideGoogleOAuthSignIn,
  googleOAuthAvailable,
  googleOAuthClientError,
  googleOAuthDisabledResponse,
  googleOAuthKeysPresent,
  googleOAuthRouteStatus,
  googleOAuthValidateUserInfo,
  googleSocialProviders,
  isGoogleOAuthAuthPath,
} from "@/lib/auth/google-oauth"
import { LOGIN_GENERIC_ERROR, loginQueryErrorMessage } from "@/lib/auth/login-error-pure"
import { LoginGoogleButton } from "@/app/(auth)/login/login-form"

const root = join(import.meta.dir, "..")

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8")
}

const keys = {
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
}

describe("google OAuth availability", () => {
  test("missing keys keep OAuth dark even if the flag is on", () => {
    expect(googleOAuthKeysPresent({})).toBe(false)
    expect(googleOAuthKeysPresent({ GOOGLE_CLIENT_ID: "id" })).toBe(false)
    expect(googleOAuthKeysPresent({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "  " })).toBe(false)
    expect(googleOAuthAvailable(true, {})).toBe(false)
    expect(googleOAuthAvailable(true, { GOOGLE_CLIENT_ID: "id" })).toBe(false)
    expect(googleOAuthAvailable(true, keys)).toBe(true)
  })

  test("flag off wins before keys (reorder would register Google while dark)", () => {
    expect(googleOAuthAvailable(false, keys)).toBe(false)
    expect(googleOAuthAvailable(false, {})).toBe(false)
    expect(Object.keys(googleSocialProviders({ flagEnabled: false, env: keys }))).toEqual([])
    expect(googleSocialProviders({ flagEnabled: true, env: {} })).toEqual({})
  })

  test("provider is registered only when flag + keys are on, with disableSignUp", () => {
    const providers = googleSocialProviders({ flagEnabled: true, env: keys })
    expect("google" in providers).toBe(true)
    if (!("google" in providers)) throw new Error("expected google provider")
    expect(providers.google.disableSignUp).toBe(true)
    expect(providers.google.disableImplicitSignUp).toBe(true)
    expect(providers.google.clientId).toBe(keys.GOOGLE_CLIENT_ID)
    expect(providers.google.clientSecret).toBe(keys.GOOGLE_CLIENT_SECRET)
  })
})

describe("google OAuth user decisions", () => {
  const live = { id: "user-42", deletedAt: null }
  const deleted = { id: "user-9", deletedAt: new Date("2024-01-01T00:00:00.000Z") }

  test("flag off wins even when the email is unknown or the user is soft-deleted", () => {
    expect(decideGoogleOAuthSignIn({ available: false, existingUser: null })).toEqual({
      ok: false,
      kind: "disabled",
    })
    expect(decideGoogleOAuthSignIn({ available: false, existingUser: deleted })).toEqual({
      ok: false,
      kind: "disabled",
    })
    expect(decideGoogleOAuthSignIn({ available: false, existingUser: live })).toEqual({
      ok: false,
      kind: "disabled",
    })
    expect(googleOAuthClientError({ ok: false, kind: "disabled" })).toEqual({
      status: 404,
      message: "Not found",
      code: "NOT_FOUND",
    })
  })

  test("unknown Google email cannot create an account", () => {
    const outcome = decideGoogleOAuthSignIn({ available: true, existingUser: null })
    expect(outcome).toEqual({ ok: false, kind: "unknown_email" })
    expect(googleOAuthClientError(outcome)?.code).toBe("SIGNUP_DISABLED")

    const createUser = mock(async () => ({ id: "new-user" }))
    const gate = googleOAuthValidateUserInfo({ available: true, existingUser: null })
    expect(gate).toEqual({
      error: "SIGNUP_DISABLED",
      errorDescription: "signup disabled",
    })
    if (!gate) {
      void createUser()
    }
    expect(createUser).not.toHaveBeenCalled()
  })

  test("existing invited/seeded user is linked and keeps the same user id", () => {
    expect(decideGoogleOAuthSignIn({ available: true, existingUser: live })).toEqual({
      ok: true,
      kind: "link",
      userId: "user-42",
    })
    expect(googleOAuthClientError({ ok: true, kind: "link", userId: "user-42" })).toBeNull()
  })

  test("soft-deleted users are blocked with the same public error as a bad password", () => {
    const outcome = decideGoogleOAuthSignIn({ available: true, existingUser: deleted })
    expect(outcome).toEqual({ ok: false, kind: "blocked" })
    expect(googleOAuthClientError(outcome)).toEqual({
      status: 401,
      message: "Invalid email or password",
      code: "INVALID_EMAIL_OR_PASSWORD",
    })
    expect(googleOAuthClientError(outcome)?.message).toBe("Invalid email or password")
    expect(googleOAuthClientError(outcome)?.code).not.toContain("DELETE")
    expect(googleOAuthClientError(outcome)?.message.toLowerCase()).not.toContain("deleted")
  })
})

describe("google OAuth routes", () => {
  test("does not 404 /login when OAuth is dark", () => {
    expect(isGoogleOAuthAuthPath("/login")).toBe(false)
    expect(googleOAuthRouteStatus({ available: false, pathname: "/login" })).toBeNull()
    expect(googleOAuthRouteStatus({ available: false, pathname: "/login?callbackUrl=/admin" })).toBeNull()
    expect(googleOAuthDisabledResponse("/login", false)).toBeNull()
  })

  test("social callback and sign-in are 404 when the flag is off", async () => {
    expect(googleOAuthRouteStatus({ available: false, pathname: "/api/auth/callback/google" })).toBe(404)
    expect(googleOAuthRouteStatus({ available: false, pathname: "/api/auth/sign-in/social" })).toBe(404)
    expect(googleOAuthRouteStatus({ available: false, pathname: "/api/auth/link-social" })).toBe(404)
    expect(googleOAuthRouteStatus({ available: false, pathname: "/callback/google/" })).toBe(404)
    expect(googleOAuthRouteStatus({ available: true, pathname: "/api/auth/callback/google" })).toBeNull()
    expect(googleOAuthRouteStatus({ available: true, pathname: "/api/auth/link-social" })).toBeNull()
    expect(googleOAuthRouteStatus({ available: true, pathname: "/api/auth/sign-in/email" })).toBeNull()

    const blocked = googleOAuthDisabledResponse("/api/auth/callback/google", false)
    expect(blocked).toBeInstanceOf(Response)
    expect(blocked!.status).toBe(404)
    expect(await blocked!.json()).toEqual({ error: "Not found" })
    expect(googleOAuthDisabledResponse("/api/auth/callback/google", true)).toBeNull()
  })
})

describe("google OAuth wiring", () => {
  test("Better Auth registers Google only through the helper and never allows signup", () => {
    const auth = read("lib/auth.ts")
    expect(auth).toContain("googleSocialProviders")
    expect(auth).toContain("googleOAuthKeysPresent")
    expect(auth).toContain("googleOAuthValidateUserInfo")
    expect(auth).toContain("validateUserInfo")
    expect(auth).toContain('isEnabled("oauth")')
    expect(auth).toContain('trustedProviders: ["google"]')
    expect(auth).toContain("disableSignUp: true")
    expect(auth).not.toContain("requestSignUp: true")
    expect(read("lib/auth/google-oauth.ts")).toContain("disableSignUp: true")
    expect(read("lib/auth/google-oauth.ts")).toContain("disableImplicitSignUp: true")
  })

  test("login shows Google only when enabled; query error uses the same copy as a bad password", () => {
    const noop = () => undefined
    const off = renderToStaticMarkup(
      createElement(LoginGoogleButton, { enabled: false, busy: false, loading: false, onClick: noop }),
    )
    const on = renderToStaticMarkup(
      createElement(LoginGoogleButton, { enabled: true, busy: false, loading: false, onClick: noop }),
    )
    expect(off).not.toContain("Continue with Google")
    expect(on).toContain("Continue with Google")

    expect(loginQueryErrorMessage(null)).toBeNull()
    expect(loginQueryErrorMessage("")).toBeNull()
    expect(loginQueryErrorMessage("signup_disabled")).toBe(LOGIN_GENERIC_ERROR)
    expect(loginQueryErrorMessage("oauth_provider_not_found")).toBe(LOGIN_GENERIC_ERROR)
    expect(loginQueryErrorMessage("signup_disabled")).toBe("Invalid email or password")

    const page = read("app/(auth)/login/page.tsx")
    expect(page).toContain('isEnabled("oauth")')
    expect(page).toContain("googleEnabled")
    const form = read("app/(auth)/login/login-form.tsx")
    expect(form).toContain("LoginGoogleButton")
    expect(form).toContain("loginQueryErrorMessage")
    expect(form.indexOf("</form>")).toBeLessThan(form.indexOf("<LoginGoogleButton"))
    expect(read("lib/auth-client.ts")).toContain('provider: "google"')
    expect(read("lib/auth-client.ts")).toContain("errorCallbackURL: loginErrorCallbackUrl(callbackURL)")
    expect(read("lib/auth-client.ts")).not.toContain('errorCallbackURL: "/login"')
    expect(read("lib/auth-client.ts")).not.toContain("requestSignUp")
    expect(read(".env.example")).toContain(
      "{AUTH_URL || NEXT_PUBLIC_BASE_URL || NEXT_PUBLIC_SITE_URL}/api/auth/callback/google",
    )

    const route = read("app/api/auth/[...all]/route.ts")
    expect(route).toContain('isEnabled("oauth")')
    expect(route).toContain("googleOAuthDisabledResponse")
    const post = route.slice(route.indexOf("export async function POST"))
    expect(post.indexOf("rejectDisabledGoogleOAuth")).toBeLessThan(post.indexOf("enforceAuthRouteRateLimit"))

    const proxy = read("proxy.ts")
    expect(proxy).not.toContain('isEnabled("oauth")')
    expect(proxy).toContain('new URL("/login", request.url)')
    expect(proxy).not.toContain("/api/auth/callback/google")
    expect(proxy).not.toContain("/sign-in/social")
    expect(proxy).not.toContain("/link-social")
  })

  test("FEATURE_FLAGS Google OAuth is its own section after Waitlist so Stripe's slice stays Stripe-only", () => {
    const flags = read("docs/FEATURE_FLAGS.md")
    const stripeSection = flags.slice(flags.indexOf("## Stripe"), flags.indexOf("## Waitlist"))
    expect(stripeSection).toContain("## Stripe")
    expect(stripeSection).not.toContain("Google OAuth")
    expect(flags.indexOf("## Google OAuth")).toBeGreaterThan(flags.indexOf("## Waitlist"))
    expect(flags).toContain("AUTH_URL || NEXT_PUBLIC_BASE_URL || NEXT_PUBLIC_SITE_URL")
    expect(flags).toContain("/api/auth/link-social")
  })
})
