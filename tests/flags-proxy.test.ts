import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import {
  FEATURE_FLAG_CACHE_TTL_MS,
  decodeFeatureFlagCacheCookie,
  encodeFeatureFlagCacheCookie,
  encodeWarmFlagCacheCookie,
  getCachedDbEnabled,
  getCachedSiteGateHashPresent,
  getWarmFlagCacheSnapshot,
  invalidateFeatureFlagCache,
  resetFeatureFlagCache,
  sanitizeOptionalOverrides,
  setCachedDbEnabled,
} from "@/lib/flags/cache"
import { isEnabledForProxy, resolveProxyFlags } from "@/lib/flags/proxy-resolve"

const root = join(import.meta.dir, "..")
const authSecret = "ci-placeholder-secret-minimum-32-characters"

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8")
}

function importedSpecs(source: string) {
  return [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1])
}

function resolveImport(fromRel: string, spec: string) {
  if (spec === "@/lib/db" || spec.startsWith("@/lib/db/")) return spec
  if (spec.startsWith("@/")) {
    const withoutAlias = spec.slice(2)
    for (const candidate of [withoutAlias, `${withoutAlias}.ts`, `${withoutAlias}/index.ts`]) {
      if (existsSync(join(root, candidate)) && candidate.endsWith(".ts")) return candidate
    }
    return withoutAlias
  }
  if (!spec.startsWith(".")) return null
  const base = join(dirname(join(root, fromRel)), spec)
  for (const candidate of [`${base}.ts`, join(base, "index.ts")]) {
    if (existsSync(candidate)) return candidate.slice(root.length + 1)
  }
  return null
}

function walkFlagModules(entryRel: string) {
  const seen = new Set<string>()
  const stack = [entryRel]
  while (stack.length > 0) {
    const rel = stack.pop()
    if (!rel || seen.has(rel)) continue
    seen.add(rel)
    const source = read(rel)
    expect(source).not.toContain("drizzle-orm")
    expect(source).not.toContain('from "server-only"')
    expect(source).not.toContain("from 'server-only'")
    for (const spec of importedSpecs(source)) {
      expect(spec).not.toBe("@/lib/db")
      expect(spec.startsWith("@/lib/db/")).toBe(false)
      const next = resolveImport(rel, spec)
      if (next && (next.startsWith("lib/flags/") || rel.startsWith("lib/flags/"))) {
        stack.push(next)
      }
    }
  }
  return seen
}

afterEach(() => {
  resetFeatureFlagCache()
})

describe("proxy source graph", () => {
  test("proxy.ts uses proxy-resolve and does not import db or Node isEnabled", () => {
    const proxy = read("proxy.ts")
    expect(proxy).toContain('from "@/lib/flags/proxy-resolve"')
    expect(proxy).toContain('from "@/lib/flags/site-gate-enforce"')
    expect(proxy).toContain("resolveProxyFlags")
    expect(proxy).toContain("resolveSiteGateEnforce")
    expect(proxy).toContain("FEATURE_FLAG_CACHE_COOKIE")
    expect(proxy).not.toContain("platformUp")
    expect(proxy).not.toContain('from "@/lib/flags/resolve"')
    expect(proxy).not.toContain('from "@/lib/flags/mutate"')
    expect(proxy).not.toContain("from '@/lib/flags/resolve'")
    expect(proxy).not.toContain("from '@/lib/flags/mutate'")
    expect(proxy).not.toContain("drizzle-orm")
    for (const spec of importedSpecs(proxy)) {
      expect(spec).not.toBe("@/lib/db")
      expect(spec.startsWith("@/lib/db/")).toBe(false)
      if (spec.startsWith("@/lib/flags/")) {
        const rel = resolveImport("proxy.ts", spec)
        expect(rel).toBeTruthy()
        if (rel) walkFlagModules(rel)
      }
    }
  })

  test("proxy-resolve, catalog, and env graphs never import Neon", () => {
    walkFlagModules("lib/flags/proxy-resolve.ts")
    walkFlagModules("lib/flags/catalog.ts")
    walkFlagModules("lib/flags/env.ts")
    expect(read("lib/flags/proxy-resolve.ts")).toContain('from "./resolve-pure"')
    expect(read("lib/flags/proxy-resolve.ts")).not.toMatch(/from ["']\.\/resolve["']/)
    expect(read("docs/FEATURE_FLAGS.md")).toContain("lib/flags/proxy-resolve.ts")
    expect(read("docs/FEATURE_FLAGS.md")).toContain("AUTH_SECRET")
    expect(read("docs/FEATURE_FLAGS.md")).toContain("isolate-local")
    expect(read("AGENTS.md")).toContain("<!-- first-run: starter-onboard -->")
    expect(read("AGENTS.md")).toContain("lib/flags/proxy-resolve.ts")
  })
})

describe("isEnabledForProxy return values", () => {
  test("cold overlay fails closed for optional flags; platform stays up", () => {
    expect(isEnabledForProxy("waitlist", { env: {} })).toBe(false)
    expect(isEnabledForProxy("site_gate", { env: {} })).toBe(false)
    expect(isEnabledForProxy("stripe", { env: {} })).toBe(false)
    expect(isEnabledForProxy("auth", { env: {} })).toBe(true)
    expect(isEnabledForProxy("admin", { env: {} })).toBe(true)
    expect(isEnabledForProxy("not_a_flag", { env: {} })).toBe(false)
  })

  test("Doppler FEATURE_*=0 kills without any overlay", () => {
    expect(
      isEnabledForProxy("waitlist", {
        env: { FEATURE_WAITLIST: "0" },
        overrides: { waitlist: true },
      }),
    ).toBe(false)
    expect(isEnabledForProxy("auth", { env: { FEATURE_AUTH: "0" } })).toBe(false)
    expect(isEnabledForProxy("admin", { env: { FEATURE_ADMIN: "0" } })).toBe(false)
    expect(isEnabledForProxy("waitlist", { env: { FEATURE_WAITLIST: "false" }, overrides: { waitlist: true } })).toBe(
      true,
    )
  })

  test("memory overlay turns optional flags on until TTL or invalidate", () => {
    const t0 = 1_700_000_000_000
    setCachedDbEnabled("waitlist", true, { now: t0 })
    expect(isEnabledForProxy("waitlist", { env: {}, now: t0 })).toBe(true)
    expect(isEnabledForProxy("waitlist", { env: {}, now: t0 + FEATURE_FLAG_CACHE_TTL_MS - 1 })).toBe(true)
    expect(isEnabledForProxy("waitlist", { env: {}, now: t0 + FEATURE_FLAG_CACHE_TTL_MS })).toBe(false)
    setCachedDbEnabled("waitlist", true, { now: t0 })
    invalidateFeatureFlagCache(t0 + 1)
    expect(isEnabledForProxy("waitlist", { env: {}, now: t0 + 1 })).toBe(false)
  })

  test("sibling key writes do not extend an older key TTL", () => {
    const t0 = 1_700_000_000_000
    setCachedDbEnabled("waitlist", true, { now: t0 })
    setCachedDbEnabled("site_gate", true, { now: t0 + 20_000 })
    expect(getCachedDbEnabled("waitlist", t0 + FEATURE_FLAG_CACHE_TTL_MS - 1)).toBe(true)
    expect(getCachedDbEnabled("waitlist", t0 + FEATURE_FLAG_CACHE_TTL_MS)).toBeUndefined()
    expect(getCachedDbEnabled("site_gate", t0 + 20_000 + FEATURE_FLAG_CACHE_TTL_MS - 1)).toBe(true)
    expect(isEnabledForProxy("waitlist", { env: {}, now: t0 + FEATURE_FLAG_CACHE_TTL_MS })).toBe(false)
    expect(isEnabledForProxy("site_gate", { env: {}, now: t0 + 20_000 })).toBe(true)
  })

  test("platform ignores a cookie/memory off overlay", () => {
    setCachedDbEnabled("waitlist", false)
    expect(isEnabledForProxy("auth", { env: {}, overrides: { waitlist: true } })).toBe(true)
    expect(isEnabledForProxy("waitlist", { env: {} })).toBe(false)
  })
})

describe("signed flag-cache cookie", () => {
  const env = { AUTH_SECRET: authSecret }

  test("round-trip overlay enables waitlist; tamper and wrong secret fail closed", async () => {
    expect(sanitizeOptionalOverrides({ waitlist: true, auth: true, nope: false })).toEqual({ waitlist: true })

    const cookie = await encodeFeatureFlagCacheCookie({ waitlist: true }, { env })
    expect(cookie).toBeTruthy()

    const decoded = await decodeFeatureFlagCacheCookie(cookie ?? undefined, { env })
    expect(decoded?.overrides).toEqual({ waitlist: true })

    expect(
      isEnabledForProxy("waitlist", {
        env,
        overrides: decoded?.overrides,
        cookieIssuedAt: decoded?.iat,
      }),
    ).toBe(true)
    expect(isEnabledForProxy("auth", { env, overrides: decoded?.overrides })).toBe(true)

    const flags = await resolveProxyFlags(cookie ?? undefined, { env })
    expect(flags.isEnabled("waitlist")).toBe(true)
    expect(flags.isEnabled("admin")).toBe(true)
    expect(flags.isEnabled("stripe")).toBe(false)
    expect(getCachedDbEnabled("waitlist")).toBe(true)

    expect(await decodeFeatureFlagCacheCookie(`${cookie}x`, { env })).toBeNull()
    expect(await decodeFeatureFlagCacheCookie(cookie ?? undefined, { env: { AUTH_SECRET: "other-secret-minimum-32-chars!!" } })).toBeNull()
    expect(await decodeFeatureFlagCacheCookie(cookie ?? undefined, { env: { AUTH_SECRET: "" } })).toBeNull()
    expect(await encodeFeatureFlagCacheCookie({ waitlist: true }, { env: { AUTH_SECRET: "" } })).toBeNull()
  })

  test("cookie and memory overlay carry site-gate hash presence without the hash bytes", async () => {
    const cookie = await encodeFeatureFlagCacheCookie(
      { site_gate: true },
      { env, siteGateHashPresent: true },
    )
    const decoded = await decodeFeatureFlagCacheCookie(cookie ?? undefined, { env })
    expect(decoded?.overrides.site_gate).toBe(true)
    expect(decoded?.siteGateHashPresent).toBe(true)
    expect(JSON.stringify(decoded)).not.toContain("scrypt")
    expect(JSON.stringify(decoded)).not.toContain("passwordHash")

    const flags = await resolveProxyFlags(cookie ?? undefined, { env })
    expect(flags.isEnabled("site_gate")).toBe(true)
    expect(flags.siteGateHashPresent).toBe(true)
    expect(getCachedSiteGateHashPresent()).toBe(true)

    const off = await encodeFeatureFlagCacheCookie(
      { site_gate: false },
      { env, siteGateHashPresent: true },
    )
    resetFeatureFlagCache()
    const offFlags = await resolveProxyFlags(off ?? undefined, { env })
    expect(offFlags.isEnabled("site_gate")).toBe(false)
    expect(offFlags.siteGateHashPresent).toBe(true)

    setCachedDbEnabled("site_gate", true, { siteGateHashPresent: false })
    expect(getCachedSiteGateHashPresent()).toBe(false)
    expect(getWarmFlagCacheSnapshot()?.siteGateHashPresent).toBe(false)
  })

  test("cookie issued before invalidate is ignored", async () => {
    const issuedAt = 1_700_000_000_000
    const cookie = await encodeFeatureFlagCacheCookie({ waitlist: true }, { env, now: issuedAt })
    const decoded = await decodeFeatureFlagCacheCookie(cookie ?? undefined, { env, now: issuedAt + 1 })
    expect(decoded?.overrides.waitlist).toBe(true)

    invalidateFeatureFlagCache(issuedAt + 50)
    expect(
      isEnabledForProxy("waitlist", {
        env,
        overrides: decoded?.overrides,
        cookieIssuedAt: decoded?.iat,
        now: issuedAt + 50,
      }),
    ).toBe(false)

    expect(
      isEnabledForProxy("waitlist", {
        env,
        overrides: { waitlist: true },
        cookieIssuedAt: issuedAt + 100,
        now: issuedAt + 100,
      }),
    ).toBe(true)
  })

  test("cookie and memory expire at original iat+TTL; re-sign does not extend", async () => {
    const t0 = 1_700_000_000_000
    const cookie = await encodeFeatureFlagCacheCookie(
      { waitlist: true },
      { env, now: t0, iat: t0, exp: t0 + FEATURE_FLAG_CACHE_TTL_MS },
    )
    expect(await decodeFeatureFlagCacheCookie(cookie ?? undefined, { env, now: t0 + FEATURE_FLAG_CACHE_TTL_MS - 1 })).not.toBeNull()
    expect(await decodeFeatureFlagCacheCookie(cookie ?? undefined, { env, now: t0 + FEATURE_FLAG_CACHE_TTL_MS })).toBeNull()

    resetFeatureFlagCache()
    await resolveProxyFlags(cookie ?? undefined, { env, now: t0 + 5_000 })
    const snapshot = getWarmFlagCacheSnapshot(t0 + 5_000)
    expect(snapshot?.iat).toBe(t0)
    expect(snapshot?.exp).toBe(t0 + FEATURE_FLAG_CACHE_TTL_MS)
    expect(isEnabledForProxy("waitlist", { env, now: t0 + 5_000 })).toBe(true)

    const resigned = await encodeWarmFlagCacheCookie({ env, now: t0 + 5_000 })
    const resignedDecoded = await decodeFeatureFlagCacheCookie(resigned ?? undefined, { env, now: t0 + 5_000 })
    expect(resignedDecoded?.iat).toBe(t0)
    expect(resignedDecoded?.exp).toBe(t0 + FEATURE_FLAG_CACHE_TTL_MS)
    expect(isEnabledForProxy("waitlist", { env, now: t0 + FEATURE_FLAG_CACHE_TTL_MS })).toBe(false)
    expect(await decodeFeatureFlagCacheCookie(resigned ?? undefined, { env, now: t0 + FEATURE_FLAG_CACHE_TTL_MS })).toBeNull()
    expect(FEATURE_FLAG_CACHE_TTL_MS).toBeGreaterThan(0)
    expect(FEATURE_FLAG_CACHE_TTL_MS).toBeLessThanOrEqual(60_000)
  })
})

describe("proxy-resolve runtime without DATABASE_URL", () => {
  test("subprocess import returns fail-closed optional and live platform", async () => {
    const modulePath = join(root, "lib/flags/proxy-resolve.ts")
    const childEnv = { ...process.env }
    delete childEnv.DATABASE_URL
    delete childEnv.NEON_DATABASE_URL

    const script = `
      import { plugin } from "bun";
      plugin({
        name: "block-db",
        setup(build) {
          build.onResolve({ filter: /^@\\/lib\\/db/ }, (args) => {
            throw new Error("lib/db loaded from proxy-resolve: " + args.path);
          });
        },
      });
      const { isEnabledForProxy } = await import(${JSON.stringify(modulePath)});
      if (isEnabledForProxy("waitlist", { env: {} }) !== false) process.exit(2);
      if (isEnabledForProxy("auth", { env: {} }) !== true) process.exit(3);
      if (isEnabledForProxy("admin", { env: { FEATURE_ADMIN: "0" } }) !== false) process.exit(4);
      if (isEnabledForProxy("waitlist", { env: {}, overrides: { waitlist: true } }) !== true) process.exit(5);
    `

    const proc = Bun.spawn(["bun", "-e", script], {
      cwd: root,
      env: childEnv,
      stdout: "pipe",
      stderr: "pipe",
    })
    const exitCode = await proc.exited
    const stderr = await new Response(proc.stderr).text()
    expect(stderr).not.toMatch(/DATABASE_URL|NEON_DATABASE_URL|postgres:\/\//i)
    expect(stderr).not.toContain("lib/db loaded from proxy-resolve")
    expect(exitCode).toBe(0)
  })
})

describe("cache helpers", () => {
  test("getCachedDbEnabled distinguishes cold from stored null", () => {
    expect(getCachedDbEnabled("waitlist")).toBeUndefined()
    setCachedDbEnabled("waitlist", null)
    expect(getCachedDbEnabled("waitlist")).toBeNull()
    expect(isEnabledForProxy("waitlist", { env: {} })).toBe(false)
  })
})
