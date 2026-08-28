import { afterEach, describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  createSiteGateCookieValue,
  isSiteGateEnabled,
  leftoverSiteGatePassword,
  safeSiteGateNext,
  shouldEnforceSiteGate,
  SITE_GATE_PASSWORD_MAX_LENGTH,
  SITE_GATE_PUBLIC_STATE_PATH,
  siteGatePasswordsEqual,
  siteGateSigningSecret,
  verifySiteGateCookie,
} from "@/lib/site-gate"
import { hashSiteGatePassword, verifySiteGatePassword } from "@/lib/flags/site-gate-password"
import {
  resetFeatureFlagCache,
  setCachedDbEnabled,
  setCachedSiteGatePublicEnforce,
} from "@/lib/flags/cache"
import { resolveSiteGateEnforce } from "@/lib/flags/site-gate-enforce"

const originalVercelEnv = process.env.VERCEL_ENV
const originalAuth = process.env.AUTH_SECRET
const originalSigning = process.env.SITE_GATE_SIGNING_SECRET
const originalLeftover = process.env.SITE_GATE_PASSWORD
const root = join(import.meta.dir, "..")

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8")
}

afterEach(() => {
  resetFeatureFlagCache()
  if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV
  else process.env.VERCEL_ENV = originalVercelEnv
  if (originalAuth === undefined) delete process.env.AUTH_SECRET
  else process.env.AUTH_SECRET = originalAuth
  if (originalSigning === undefined) delete process.env.SITE_GATE_SIGNING_SECRET
  else process.env.SITE_GATE_SIGNING_SECRET = originalSigning
  if (originalLeftover === undefined) delete process.env.SITE_GATE_PASSWORD
  else process.env.SITE_GATE_PASSWORD = originalLeftover
})

describe("site gate", () => {
  test("is disabled when VERCEL_ENV is unset", () => {
    delete process.env.VERCEL_ENV
    expect(isSiteGateEnabled()).toBe(false)
  })

  test("is enabled on Vercel preview and production", () => {
    process.env.VERCEL_ENV = "preview"
    expect(isSiteGateEnabled()).toBe(true)
    process.env.VERCEL_ENV = "production"
    expect(isSiteGateEnabled()).toBe(true)
    process.env.VERCEL_ENV = "development"
    expect(isSiteGateEnabled()).toBe(false)
  })

  test("cookie HMAC uses AUTH_SECRET or SITE_GATE_SIGNING_SECRET, not leftover password", async () => {
    const env = {
      AUTH_SECRET: "auth-secret-minimum-32-characters!!",
      SITE_GATE_PASSWORD: "typed-review-password",
    }
    expect(siteGateSigningSecret(env)).toBe(env.AUTH_SECRET)
    expect(siteGateSigningSecret({ ...env, SITE_GATE_SIGNING_SECRET: "dedicated-signing" })).toBe(
      "dedicated-signing",
    )
    expect(leftoverSiteGatePassword(env)).toBe("typed-review-password")

    const cookie = await createSiteGateCookieValue(siteGateSigningSecret(env))
    expect(await verifySiteGateCookie(cookie, siteGateSigningSecret(env))).toBe(true)
    expect(await verifySiteGateCookie(cookie, env.SITE_GATE_PASSWORD)).toBe(false)
    expect(await verifySiteGateCookie(`${cookie}x`, siteGateSigningSecret(env))).toBe(false)
    expect(await verifySiteGateCookie(cookie.replace("v1", "v2"), siteGateSigningSecret(env))).toBe(false)
    expect(await verifySiteGateCookie(undefined, siteGateSigningSecret(env))).toBe(false)
  })

  test("safeSiteGateNext rejects open redirects", () => {
    expect(safeSiteGateNext("/admin")).toBe("/admin")
    expect(safeSiteGateNext("/admin?tab=users")).toBe("/admin?tab=users")
    expect(safeSiteGateNext("https://evil.example")).toBe("/")
    expect(safeSiteGateNext("//evil.example")).toBe("/")
    expect(safeSiteGateNext(null)).toBe("/")
  })

  test("shouldEnforceSiteGate: flag off even with hash; flag on needs password; leftover only without hash", () => {
    const preview = { VERCEL_ENV: "preview" as const }
    expect(shouldEnforceSiteGate({ flagEnabled: true, hashPresent: true, env: {} })).toBe(false)
    expect(shouldEnforceSiteGate({ flagEnabled: false, hashPresent: true, env: preview })).toBe(false)
    expect(shouldEnforceSiteGate({ flagEnabled: true, hashPresent: true, env: preview })).toBe(true)
    expect(shouldEnforceSiteGate({ flagEnabled: false, hashPresent: false, env: preview })).toBe(false)
    expect(
      shouldEnforceSiteGate({
        flagEnabled: false,
        hashPresent: false,
        env: { ...preview, SITE_GATE_PASSWORD: "clone" },
      }),
    ).toBe(true)
    expect(
      shouldEnforceSiteGate({
        flagEnabled: false,
        hashPresent: true,
        env: { ...preview, SITE_GATE_PASSWORD: "clone" },
      }),
    ).toBe(false)
    expect(
      shouldEnforceSiteGate({
        flagEnabled: false,
        env: { ...preview, SITE_GATE_PASSWORD: "clone" },
      }),
    ).toBe(true)
    expect(
      shouldEnforceSiteGate({
        flagEnabled: true,
        hashPresent: true,
        env: { VERCEL_ENV: "development" },
      }),
    ).toBe(false)
    expect(
      shouldEnforceSiteGate({
        flagEnabled: true,
        hashPresent: true,
        env: { ...preview, FEATURE_SITE_GATE: "0" },
      }),
    ).toBe(false)
    expect(
      shouldEnforceSiteGate({
        flagEnabled: false,
        env: { ...preview, FEATURE_SITE_GATE: "0", SITE_GATE_PASSWORD: "clone" },
      }),
    ).toBe(false)
  })

  test("leftover password compare is constant-time and NFKC-normalized", () => {
    expect(siteGatePasswordsEqual("gate", "gate")).toBe(true)
    expect(siteGatePasswordsEqual("gate", "other")).toBe(false)
    expect(siteGatePasswordsEqual("café", "café".normalize("NFD"))).toBe(true)
  })

  test("scrypt hash round-trip uses timing-safe compare", async () => {
    const hash = await hashSiteGatePassword("review-secret")
    expect(hash.startsWith("scrypt$")).toBe(true)
    expect(await verifySiteGatePassword("review-secret", hash)).toBe(true)
    expect(await verifySiteGatePassword("wrong", hash)).toBe(false)
    expect(await verifySiteGatePassword("review-secret", "not-a-hash")).toBe(false)
  })

  test("docs and env example retire SITE_GATE_PASSWORD as the source of truth", () => {
    const example = read(".env.example")
    expect(example).toContain("# SITE_GATE_SIGNING_SECRET=")
    expect(example).toContain("# SITE_GATE_PASSWORD=")
    expect(example).toContain("Bill Lax")
    expect(example.split("\n").some((line) => /^SITE_GATE_PASSWORD=/.test(line))).toBe(false)

    const readme = read("README.md")
    expect(readme).toContain("Bill Lax")
    expect(readme).toContain("MKFF")
    expect(readme).toContain("gateway-match")
    expect(readme).toContain("inventRight")
    expect(readme).toContain("AUTH_SECRET")

    const flags = read("docs/FEATURE_FLAGS.md")
    expect(flags).toContain("SITE_GATE_SIGNING_SECRET")
    expect(flags).toContain("passwordHash")
    expect(flags).not.toContain("This file does not change site-gate product UX")

    expect(read("AGENTS.md")).toContain("<!-- first-run: starter-onboard -->")
    expect(read("proxy.ts")).not.toContain("siteGatePassword(")
    expect(read("proxy.ts")).toContain("resolveSiteGateEnforce")
    expect(read("proxy.ts")).toContain("SITE_GATE_PUBLIC_STATE_PATH")
    expect(read("proxy.ts")).toContain("siteGateSigningSecret")
    expect(read("proxy.ts")).not.toContain("@/lib/db")
    expect(read("proxy.ts")).not.toContain("drizzle-orm")
    expect(read("lib/site-gate.ts")).not.toContain("@/lib/db")
    expect(read("lib/site-gate.ts")).not.toContain("drizzle-orm")
    expect(read("lib/flags/site-gate-enforce.ts")).not.toContain("@/lib/db")
    expect(read("lib/flags/site-gate-enforce.ts")).not.toContain("drizzle-orm")
    expect(read("lib/flags/site-gate-enforce.ts")).not.toContain('from "./resolve"')
    expect(SITE_GATE_PASSWORD_MAX_LENGTH).toBe(1024)
    expect(SITE_GATE_PUBLIC_STATE_PATH).toBe("/api/site-gate/public-state")
  })

  test("proxy warm overlay passes hashPresent from flags into shouldEnforceSiteGate", () => {
    const enforce = read("lib/flags/site-gate-enforce.ts")
    expect(enforce).toContain("shouldEnforceSiteGate")
    expect(enforce).toContain("flagEnabled: flags.isEnabled(\"site_gate\")")
    expect(enforce).toContain("hashPresent: flags.siteGateHashPresent")
    expect(enforce).toContain("isSiteGateOverlayCold")
    expect(enforce).toContain("fetchSiteGatePublicEnforce")
    expect(read("proxy.ts")).toContain("await resolveSiteGateEnforce(request, flags)")
  })

  test("cold overlay fetches public-state; failure fail-closes in preview", async () => {
    const request = { url: "https://preview.example/", nextUrl: { pathname: "/" } }
    const flags = {
      isEnabled: () => false,
      siteGateHashPresent: undefined as boolean | undefined,
    }
    const env = { VERCEL_ENV: "preview" }

    const fetched = await resolveSiteGateEnforce(request, flags, {
      env,
      fetchImpl: (async () =>
        new Response(JSON.stringify({ enforce: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })) as typeof fetch,
    })
    expect(fetched).toBe(true)

    resetFeatureFlagCache()
    const failed = await resolveSiteGateEnforce(request, flags, {
      env,
      fetchImpl: (async () => {
        throw new Error("network")
      }) as typeof fetch,
    })
    expect(failed).toBe(true)

    resetFeatureFlagCache()
    const unavailable = await resolveSiteGateEnforce(request, flags, {
      env,
      fetchImpl: (async () => new Response("nope", { status: 503 })) as typeof fetch,
    })
    expect(unavailable).toBe(true)
  })

  test("warm overlay uses hashPresent and does not fetch public-state", async () => {
    setCachedDbEnabled("site_gate", true, { siteGateHashPresent: true })
    let fetched = 0
    const enforce = await resolveSiteGateEnforce(
      { url: "https://preview.example/", nextUrl: { pathname: "/" } },
      {
        isEnabled: (key) => key === "site_gate",
        siteGateHashPresent: true,
      },
      {
        env: { VERCEL_ENV: "preview" },
        fetchImpl: (async () => {
          fetched += 1
          return new Response(JSON.stringify({ enforce: false }), { status: 200 })
        }) as typeof fetch,
      },
    )
    expect(enforce).toBe(true)
    expect(fetched).toBe(0)

    resetFeatureFlagCache()
    setCachedDbEnabled("site_gate", false, { siteGateHashPresent: true })
    const off = await resolveSiteGateEnforce(
      { url: "https://preview.example/", nextUrl: { pathname: "/" } },
      {
        isEnabled: () => false,
        siteGateHashPresent: true,
      },
      {
        env: { VERCEL_ENV: "preview", SITE_GATE_PASSWORD: "clone" },
        fetchImpl: (async () => {
          fetched += 1
          return new Response(JSON.stringify({ enforce: true }), { status: 200 })
        }) as typeof fetch,
      },
    )
    expect(off).toBe(false)
    expect(fetched).toBe(0)
  })

  test("local dev never fetches or enforces even if public-state would say on", async () => {
    let fetched = 0
    const enforce = await resolveSiteGateEnforce(
      { url: "http://localhost:3000/", nextUrl: { pathname: "/" } },
      { isEnabled: () => true, siteGateHashPresent: true },
      {
        env: { VERCEL_ENV: "development" },
        fetchImpl: (async () => {
          fetched += 1
          return new Response(JSON.stringify({ enforce: true }), { status: 200 })
        }) as typeof fetch,
      },
    )
    expect(enforce).toBe(false)
    expect(fetched).toBe(0)
  })

  test("public-state path is not gated and cached enforce is reused", async () => {
    const skip = await resolveSiteGateEnforce(
      { url: "https://preview.example/", nextUrl: { pathname: SITE_GATE_PUBLIC_STATE_PATH } },
      { isEnabled: () => true, siteGateHashPresent: true },
      { env: { VERCEL_ENV: "preview" } },
    )
    expect(skip).toBe(false)

    setCachedSiteGatePublicEnforce(true)
    let fetched = 0
    const cached = await resolveSiteGateEnforce(
      { url: "https://preview.example/", nextUrl: { pathname: "/" } },
      { isEnabled: () => false },
      {
        env: { VERCEL_ENV: "preview" },
        fetchImpl: (async () => {
          fetched += 1
          return new Response(JSON.stringify({ enforce: false }), { status: 200 })
        }) as typeof fetch,
      },
    )
    expect(cached).toBe(true)
    expect(fetched).toBe(0)
  })
})
