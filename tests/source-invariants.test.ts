import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { OPTIONAL_FLAG_KEYS } from "@/lib/flags/catalog"

const root = join(import.meta.dir, "..")

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8")
}

describe("source invariants", () => {
  test("proxy sends unauthenticated admin users to /login with callbackUrl", () => {
    const proxy = read("proxy.ts")
    expect(proxy).toContain('new URL("/login", request.url)')
    expect(proxy).not.toContain('new URL("/admin/login"')
    expect(proxy).toContain('searchParams.set("callbackUrl"')
    expect(proxy).toContain("isAdminPagePath")
    expect(proxy).toContain("shouldRedirectForMustChangePassword")
    expect(proxy).toContain("shouldRejectApiForMustChangePassword")
    expect(proxy).toContain("passwordChangeRequiredResponse")
    expect(proxy).toContain("/admin/account")
    expect(proxy).toContain('searchParams.set("callbackUrl", dest)')
    expect(proxy).not.toContain("isAdminPath(pathname)")
  })

  test("auth client uses same-origin relative /api URLs", () => {
    const client = read("lib/auth-client.ts")
    expect(client).toContain("better-auth/react")
    expect(client).toContain("createAuthClient")
    expect(client).toContain('fetch("/api/admin/change-password"')
    expect(client).not.toContain("localhost:3000")
    expect(client).not.toContain("NEXT_PUBLIC_BASE_URL")
    expect(client).not.toContain("next-auth")
  })

  test("package.json pins versions and drops crypto packages", () => {
    const pkg = JSON.parse(read("package.json")) as {
      dependencies: Record<string, string>
      devDependencies: Record<string, string>
    }
    const versions = [...Object.values(pkg.dependencies), ...Object.values(pkg.devDependencies)]
    expect(versions.some((v) => v === "latest" || v === "beta")).toBe(false)
    expect(pkg.dependencies.crypto).toBeUndefined()
    expect(pkg.dependencies.webcrypto).toBeUndefined()
    expect(pkg.dependencies.stripe).toBeUndefined()
  })

  test("gitignore does not ignore .env.example", () => {
    const gitignore = read(".gitignore")
    expect(gitignore).toContain(".env*")
    expect(gitignore).toContain("!.env.example")
    expect(existsSync(join(root, ".env.example"))).toBe(true)
  })

  test("error pages exist and global-error owns html/body", () => {
    expect(existsSync(join(root, "app/error.tsx"))).toBe(true)
    expect(existsSync(join(root, "app/not-found.tsx"))).toBe(true)
    const globalError = read("app/global-error.tsx")
    expect(globalError).toContain("<html")
    expect(globalError).toContain("<body")
  })

  test("upload route requires a session", () => {
    const upload = read("app/api/upload/route.ts")
    const media = read("app/api/admin/media/route.ts")
    expect(upload).toContain("api/admin/media")
    expect(media).toContain("requireUserId")
  })

  test("sitemap does not advertise /admin", () => {
    expect(read("app/sitemap.ts")).not.toContain("/admin")
    expect(read("app/sitemap.ts")).not.toContain("preview")
    expect(read("app/sitemap.ts")).toContain("listPublishedEntries")
  })

  test("hardcoded personal admin email is gone", () => {
    const forgot = read("app/(auth)/forgot-password/page.tsx")
    const forgotForm = read("app/(auth)/forgot-password/forgot-password-form.tsx")
    expect(forgot).not.toContain("admin@davidsolheim.com")
    expect(forgotForm).not.toContain("admin@davidsolheim.com")
  })

  test("package is MIT licensed with a LICENSE file", () => {
    const pkg = JSON.parse(read("package.json")) as { license?: string }
    expect(pkg.license).toBe("MIT")
    const license = read("LICENSE")
    expect(license).toContain("MIT License")
    expect(license).toContain("David Solheim")
  })

  test("seed script exists", () => {
    expect(existsSync(join(root, "scripts/seed-admin.ts"))).toBe(true)
  })

  test("seed script upserts default en locale", () => {
    const seed = read("scripts/seed-admin.ts")
    expect(seed).toContain("locales")
    expect(seed).toContain('code: "en"')
    expect(seed).toContain('name: "English"')
    expect(seed).toContain("isDefault: true")
    expect(seed).toContain(".select")
    expect(seed).toContain(".from(locales)")
    expect(seed).toContain(".insert(locales)")
    expect(seed).toContain(".update(locales)")
    expect(seed).toContain("eq(locales.isDefault, true)")
    expect(seed).toContain('eq(locales.code, "en")')
    expect(seed).toContain("await seedDefaultLocale()")
    expect(seed).toContain("await seedPlatformFeatureFlags()")
    expect(seed).toContain("PLATFORM_FLAG_KEYS")
    expect(seed).toContain("FLAG_CATALOG[key].defaultEnabled")
    expect(seed).toContain("onConflictDoNothing")
    expect(seed).toContain("featureFlags")
    expect(seed).not.toContain("OPTIONAL_FLAG_KEYS")
    expect(seed).toContain('console.log("Default locale already present")')
    expect(seed).toContain('console.log("Default locale en already present")')
    expect(seed).toContain('console.log("Created default locale en")')
  })

  test("seed does not insert optional feature flag keys", () => {
    const seed = read("scripts/seed-admin.ts")
    for (const key of OPTIONAL_FLAG_KEYS) {
      expect(seed).not.toContain(`"${key}"`)
      expect(seed).not.toContain(`'${key}'`)
    }
    expect(seed).toContain("PLATFORM_FLAG_KEYS.map")
    expect(seed).toContain(".insert(featureFlags)")
    expect(seed).toContain("onConflictDoNothing")
  })

  test("public chrome lists Articles, Contact, Privacy, and Terms without Admin in primary nav", () => {
    const header = read("components/site-header.tsx")
    const footer = read("components/site-footer.tsx")
    const publicLayout = read("app/(public)/layout.tsx")
    const home = read("app/(public)/page.tsx")
    expect(publicLayout).toContain("SiteHeader")
    expect(publicLayout).toContain("SiteFooter")
    expect(header).toContain("siteName")
    expect(header).toContain('href: "/articles"')
    expect(header).toContain('label: "Articles"')
    expect(header).toContain('href: "/contact"')
    expect(header).toContain('label: "Contact"')
    expect(header).toContain('href="/login"')
    expect(header).toContain("Sign in")
    expect(header).not.toContain("/admin")
    expect(header).not.toContain("Admin")
    expect(footer).toContain('href="/privacy"')
    expect(footer).toContain("Privacy")
    expect(footer).toContain('href="/terms"')
    expect(footer).toContain("Terms")
    expect(home).toContain('href="/login"')
    expect(home).toContain("Sign in")
    expect(home).toContain("siteName")
    expect(home).not.toContain("next-auth")
    expect(home).not.toContain("NextAuth")
  })

  test("auth, admin, and site-gate stay off marketing chrome", () => {
    expect(read("app/layout.tsx")).not.toContain("SiteHeader")
    expect(read("app/layout.tsx")).not.toContain("SiteFooter")
    expect(read("app/(auth)/layout.tsx")).not.toContain("SiteHeader")
    expect(read("app/(auth)/login/page.tsx")).toContain("AuthShell")
    expect(read("app/(auth)/login/login-form.tsx")).toContain("AuthShell")
    expect(read("app/(auth)/login/login-form.tsx")).toContain("Email me a sign-in link")
    expect(read("app/(auth)/login/login-form.tsx")).toContain("passwordChangeRedirectUrl")
    expect(read("app/(auth)/login/page.tsx")).toContain("isResendConfigured")
    expect(read("app/(auth)/login/page.tsx")).toContain("magicLinkEnabled")
    expect(read("app/(auth)/login/login-form.tsx")).toContain("magicLinkEnabled ? (")
    expect(read("app/(auth)/login/login-form.tsx")).toContain('from "@/lib/auth/callback-url-pure"')
    expect(read("lib/auth/callback-url-pure.ts")).toContain('value.includes("\\\\")')
    expect(read("lib/auth/callback-url-pure.ts")).toContain("value.startsWith(\"//\")")
    expect(read("app/(auth)/forgot-password/page.tsx")).toContain("isResendConfigured")
    expect(read("app/(auth)/forgot-password/page.tsx")).toContain("ForgotPasswordForm")
    expect(read("app/(auth)/forgot-password/forgot-password-form.tsx")).toContain("recoveryEnabled")
    expect(read("app/(auth)/forgot-password/forgot-password-form.tsx")).toContain("Password recovery is not configured on this site")
    expect(read("app/admin/layout.tsx")).not.toContain("SiteHeader")
    expect(read("app/admin/layout.tsx")).not.toContain("SiteFooter")
    expect(read("app/admin/admin-shell.tsx")).not.toContain("SiteHeader")
    expect(read("app/admin/admin-shell.tsx")).not.toContain("SiteFooter")
    expect(read("app/site-gate/page.tsx")).not.toContain("SiteHeader")
    expect(read("app/site-gate/page.tsx")).not.toContain("SiteFooter")
  })

  test("admin home is a dashboard, not a stub", () => {
    const page = read("app/admin/page.tsx")
    expect(page).not.toContain("Add your admin functionality here")
    expect(page).toContain("Drafts")
    expect(page).toContain("Contact")
    expect(page).toContain("Recent activity")
    expect(page).toContain("/admin/content/")
  })

  test("seed script creates a credential account without users.password", () => {
    const seed = read("scripts/seed-admin.ts")
    expect(seed).toContain("async function ensureCredentialAccount")
    expect(seed).toContain("insert(accounts)")
    expect(seed).toContain('providerId: "credential"')
    expect(seed).toContain('issuer: "local:credential"')
    expect(seed).toContain("if (credential[0])")
    expect(seed).toMatch(/if \(credential\[0\]\) \{\s*return false/)
    const userInsert = seed.match(/await db\.insert\(users\)\.values\(\{[\s\S]*?\}\)/)
    expect(userInsert?.[0]).toBeTruthy()
    expect(userInsert?.[0]).not.toContain("password")
    expect(userInsert?.[0]).toContain("mustChangePassword: true")
    const existingUpdate = seed.match(/if \(existing\[0\]\) \{[\s\S]*?\.update\(users\)[\s\S]*?\.where\(eq\(users\.id, existing\[0\]\.id\)\)/)
    expect(existingUpdate?.[0]).toBeTruthy()
    expect(existingUpdate?.[0]).not.toContain("mustChangePassword")
    expect(existingUpdate?.[0]).toContain("emailVerified: true")
    expect(seed).toContain("const createdCredential = await ensureCredentialAccount")
    expect(seed).toContain("if (createdCredential)")
    const credentialGate = seed.match(/if \(createdCredential\) \{[\s\S]*?mustChangePassword: true[\s\S]*?\.where\(eq\(users\.id, existing\[0\]\.id\)\)/)
    expect(credentialGate?.[0]).toBeTruthy()
    expect(seed).toContain('SEED_ADMIN_MUST_CHANGE_PASSWORD')
    expect(seed).toContain('=== "false"')
    expect(seed).toContain("mustChangePassword: false")
  })

  test("account page uses changePassword client and change-password clears the flag", () => {
    expect(existsSync(join(root, "app/admin/account/page.tsx"))).toBe(true)
    const account = read("app/admin/account/page.tsx")
    expect(account).toContain("changePassword")
    expect(account).toContain("currentPassword")
    expect(account).toContain("newPassword")
    expect(account).toContain("postPasswordChangeUrl")
    expect(account).toContain("Suspense")
    const changePasswordRoute = read("app/api/admin/change-password/route.ts")
    expect(changePasswordRoute).toContain("mustChangePassword: false")
    expect(changePasswordRoute).toContain("parsed.newPassword === parsed.currentPassword")
    expect(changePasswordRoute).toContain("New password must be different from the current password")
  })

  test("email password reset clears mustChangePassword via onPasswordReset", () => {
    const auth = read("lib/auth.ts")
    expect(auth).toContain("onPasswordReset")
    const onPasswordReset = auth.match(
      /onPasswordReset:\s*async\s*\(\{\s*user\s*\}\)\s*=>\s*\{[\s\S]*?\n    \},/,
    )
    expect(onPasswordReset?.[0]).toBeTruthy()
    expect(onPasswordReset?.[0]).toContain("mustChangePassword: false")
    expect(onPasswordReset?.[0]).toContain("eq(schema.users.id, user.id)")
    expect(onPasswordReset?.[0]).toContain("isNull(schema.users.deletedAt)")
    expect(onPasswordReset?.[0]).not.toContain("hooks.before")
    expect(auth).toContain("resetPasswordTokenFromCtx")
    expect(auth).toContain("publicResetPasswordUrl")
    expect(auth).toContain("sendResetPassword: async ({ user, url, token })")
    const helper = read("lib/auth/reset-password-token-pure.ts")
    expect(helper).toContain("ctx.query")
    const resetBeforeHook = auth.match(/if \(ctx\.path === "\/reset-password"\) \{[\s\S]*?code: "INVALID_TOKEN"/)
    expect(resetBeforeHook?.[0]).toBeTruthy()
    expect(resetBeforeHook?.[0]).toContain("resetPasswordTokenFromCtx")
    expect(resetBeforeHook?.[0]).toContain("ctx.query")
    expect(resetBeforeHook?.[0]).not.toContain("mustChangePassword")
  })

  test("forgot-password and sign-in use the DB rate limiter", () => {
    expect(existsSync(join(root, "lib/api/rate-limit.ts"))).toBe(false)
    const authRoute = read("app/api/auth/[...all]/route.ts")
    expect(authRoute).toContain("enforceAuthRouteRateLimit")
    const limiter = read("lib/services/rate-limit.ts")
    expect(limiter).toContain("checkRateLimit")
    expect(limiter).toContain("`auth:${name}:${clientKey(request)}`")
    expect(limiter).toContain("max: 5")
    expect(limiter).toContain("windowMs: 60_000")
    expect(limiter).toContain("Retry-After")
    expect(read("app/api/contact/route.ts")).toContain('from "@/lib/services/rate-limit"')
    expect(read("app/api/contact/route.ts")).not.toContain("lib/api/rate-limit")
  })

  test("AGENTS.md first-run marker matches package identity", () => {
    const pkg = JSON.parse(read("package.json")) as { name?: string }
    const agents = read("AGENTS.md")
    const marker = "<!-- first-run: starter-onboard -->"
    if (pkg.name === "next-starter-template") {
      expect(agents).toContain(marker)
      expect(agents).toContain("Prefill from the user’s message")
      expect(agents).toContain("Overwrite **`AGENTS.md` in full**")
      expect(agents).toContain("## Onboarded AGENTS.md")
    } else {
      expect(agents).not.toContain(marker)
      expect(agents).toContain("## Linear")
      expect(agents).toContain("## Secrets")
    }
  })

  test("admin users API exists, requires admin capability, and has no public register", () => {
    expect(existsSync(join(root, "app/api/admin/users/route.ts"))).toBe(true)
    expect(existsSync(join(root, "app/api/admin/users/[id]/route.ts"))).toBe(true)
    expect(existsSync(join(root, "app/admin/users/page.tsx"))).toBe(true)
    expect(existsSync(join(root, "app/register/page.tsx"))).toBe(false)
    expect(existsSync(join(root, "app/(auth)/register/page.tsx"))).toBe(false)
    expect(existsSync(join(root, "app/(public)/register/page.tsx"))).toBe(false)

    const list = read("app/api/admin/users/route.ts")
    const patch = read("app/api/admin/users/[id]/route.ts")
    expect(list).toContain('requireCapabilityResponse(userId, "admin")')
    expect(patch).toContain('requireCapabilityResponse(userId, "admin")')
    expect(list).toContain("mustChangePassword: true")
    expect(list).toContain("sendWelcomeEmail")
    expect(list).toContain("db.transaction")
    expect(list).toContain("inviteExistingDecision")
    expect(read("lib/auth.ts")).toContain("renderWelcomeEmail")
    expect(list).not.toContain("already exists")
    expect(list).toContain("GENERIC_INVITE_ERROR")
    expect(list).toContain("WELCOME_EMAIL_ERROR")
    expect(list.lastIndexOf("sendWelcomeEmail")).toBeGreaterThan(list.indexOf("return { id, decision }"))
    expect(patch).toContain("lastAdminCapabilityChangeBlocked")
    expect(patch).toContain("LAST_ADMIN_ERROR")
    expect(patch).toContain("db.transaction")
    expect(patch).toContain("orderBy(users.id)")
    expect(patch.split('.for("update")')).toHaveLength(2)
    expect(read("app/admin/users/page.tsx")).toContain("disabled={isLastAdmin}")
    expect(read("app/admin/admin-shell.tsx")).toContain('href="/admin/users"')
    expect(read("app/admin/admin-shell.tsx")).toContain('href="/admin/features"')
    expect(read("app/admin/admin-shell.tsx")).toContain("{canAdmin ? (")
    expect(read("lib/auth.ts")).toContain("disableSignUp: true")
  })
})
