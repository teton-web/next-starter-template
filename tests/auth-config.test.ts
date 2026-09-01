import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dir, "..")

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8")
}

describe("Better Auth cutover", () => {
  test("package.json pins better-auth and drops next-auth", () => {
    const pkg = JSON.parse(read("package.json")) as {
      dependencies: Record<string, string>
    }
    expect(pkg.dependencies["better-auth"]).toBe("1.7.2")
    expect(pkg.dependencies["next-auth"]).toBeUndefined()
    expect(pkg.dependencies["@auth/drizzle-adapter"]).toBeUndefined()
  })

  test("auth config uses betterAuth with public signup disabled", () => {
    const auth = read("lib/auth.ts")
    expect(auth).toContain("betterAuth(")
    expect(auth).toContain("drizzleAdapter")
    expect(auth).toContain("emailAndPassword")
    expect(auth).toContain("secret: process.env.AUTH_SECRET")
    expect(auth).not.toContain("next-auth")
    expect(auth).not.toContain("NextAuth")

    const emailAndPassword = auth.match(/emailAndPassword:\s*\{[\s\S]*?\n  \},/)
    expect(emailAndPassword?.[0]).toContain("disableSignUp: true")
    expect(emailAndPassword?.[0]).toContain("onPasswordReset")
    expect(emailAndPassword?.[0]).toContain("mustChangePassword: false")

    const magicLink = auth.match(/magicLink\(\{[\s\S]*?\}\)/)
    expect(magicLink?.[0]).toContain("disableSignUp: true")
    expect(auth).toContain("mustChangePassword")
    expect(auth).toContain("renderSignInEmail")
    expect(auth).toContain("googleSocialProviders")
    expect(auth).toContain("disableSignUp: true")
    expect(auth).toContain('trustedProviders: ["google"]')
    expect(auth).toContain("googleOAuthValidateUserInfo")
    expect(auth).toContain('isEnabled("oauth")')
    expect(auth).not.toContain("requestSignUp: true")
  })

  test("drizzleAdapter maps Better Auth models to plural tables for joins", () => {
    const auth = read("lib/auth.ts")
    expect(auth).toContain("user: schema.users")
    expect(auth).toContain("session: schema.sessions")
    expect(auth).toContain("account: schema.accounts")
    expect(auth).toContain("verification: schema.verifications")
    expect(auth).not.toContain("usePlural: true")
    expect(read("lib/db/schema/users.ts")).toContain("accounts: many(accounts)")
  })

  test("auth handler uses toNextJsHandler catch-all", () => {
    const route = read("app/api/auth/[...all]/route.ts")
    expect(route).toContain("toNextJsHandler")
    expect(route).toContain("better-auth/next-js")
    expect(route).not.toContain("handlers")
  })

  test("proxy still sets callbackUrl for unauthenticated admin", () => {
    const proxy = read("proxy.ts")
    expect(proxy).toContain('auth.api.getSession({ headers: request.headers })')
    expect(proxy).toContain("isAccountBlocked(session.user.id)")
    expect(proxy).toContain('searchParams.set("callbackUrl"')
    expect(proxy).toContain('new URL("/login", request.url)')
    expect(proxy).toContain("shouldRejectApiForMustChangePassword")
    expect(proxy).toContain("passwordChangeRequiredResponse")
  })

  test("login forgot-password footer is not gated on magicLinkEnabled", () => {
    const form = read("app/(auth)/login/login-form.tsx")
    expect(form).toContain('href="/forgot-password"')
    expect(form).not.toMatch(/footer=\{\s*magicLinkEnabled/)
    expect(form).toMatch(/magicLinkEnabled \? \(\s*<Button[\s\S]*Email me a sign-in link/)
  })

  test("providers no longer wrap SessionProvider", () => {
    const providers = read("components/providers.tsx")
    expect(providers).not.toContain("SessionProvider")
    expect(providers).not.toContain("next-auth")
  })
})
