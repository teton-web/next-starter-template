import { describe, expect, test } from "bun:test"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { sanitizeAnalyticsProps } from "@/lib/analytics"
import { checkMemoryRateLimit, resetMemoryRateLimits } from "@/lib/services/rate-limit"

const root = join(import.meta.dir, "..")

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8")
}

describe("harvest invariants", () => {
  test("typecheck script and packageManager are declared", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string>; packageManager?: string }
    expect(pkg.scripts.typecheck).toContain("tsc")
    expect(pkg.packageManager).toContain("bun")
  })

  test("CI runs bun audit after frozen install and Dependabot is additional", () => {
    const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> }
    expect(pkg.scripts.audit).toContain("bun audit")
    expect(pkg.scripts.audit).toContain("--audit-level=high")
    expect(pkg.scripts.audit).not.toContain("--ignore")

    const ci = read(".github/workflows/ci.yml")
    expect(ci).not.toMatch(/^\s*RESEND_API_KEY:/m)
    expect(ci).not.toMatch(/^\s*EMAIL_FROM:/m)
    expect(ci).not.toContain("db:push")
    expect(ci).toContain("run: bun run audit")
    expect(ci).not.toMatch(/bun run audit[^\n]*--ignore/)

    const installIdx = ci.indexOf("bun install --frozen-lockfile")
    const auditIdx = ci.indexOf("run: bun run audit")
    expect(installIdx).toBeGreaterThan(-1)
    expect(auditIdx).toBeGreaterThan(installIdx)

    const auditStep = ci.match(/- name: Audit dependencies\n([\s\S]*?)(?=\n      - name:|\n*$)/)
    expect(auditStep?.[1]).toContain("run: bun run audit")
    expect(auditStep?.[1]).not.toContain("continue-on-error")
    expect(auditStep?.[1]).not.toContain("--ignore")

    expect(existsSync(join(root, ".github/dependabot.yml"))).toBe(true)
    const dependabot = read(".github/dependabot.yml")
    expect(dependabot).toMatch(/package-ecosystem:\s*bun/)
    expect(dependabot).toMatch(/package-ecosystem:\s*github-actions/)
    expect(dependabot).toMatch(/target-branch:\s*dev/)
    expect(dependabot).not.toMatch(/auto-?merge/i)
  })

  test("capabilities mock.module always includes sanitizeCapabilities", () => {
    const helper = read("tests/helpers/mock-capabilities.ts")
    expect(helper).toContain("sanitizeCapabilities")
    expect(helper).toContain("capabilitiesMockExports")
    expect(helper).toMatch(/checkCapability:/)

    const files = readdirSync(join(root, "tests")).filter((name) => name.endsWith(".test.ts"))
    for (const file of files) {
      const source = read(join("tests", file))
      if (!source.includes('mock.module("@/lib/auth/capabilities"')) continue
      expect(source).toContain("capabilitiesMockExports")
    }
    expect(read("tests/helpers/mock-db.ts")).toContain("capabilitiesMockExports")
  })

  test("next.config noindexes admin/api/auth and supports preview noindex", () => {
    const config = read("next.config.mjs")
    expect(config).toContain("/admin/:path*")
    expect(config).toContain("noindex, nofollow")
    expect(config).toContain("SEARCH_INDEXING_ENABLED")
  })

  test("llms.txt and legal/contact routes exist", () => {
    expect(read("app/llms.txt/route.ts")).toContain("text/plain")
    expect(read("app/(public)/privacy/page.tsx")).toContain("Privacy")
    expect(read("app/(public)/terms/page.tsx")).toContain("Terms")
    expect(read("app/(public)/contact/page.tsx")).toContain("/api/contact")
    expect(read("app/(public)/waitlist/page.tsx")).toContain("notFound")
    expect(read("app/(public)/waitlist/page.tsx")).toContain('isEnabled("waitlist")')
    expect(read("app/(public)/waitlist/waitlist-form.tsx")).toContain("/api/waitlist")
    expect(read("app/(public)/gallery/page.tsx")).toContain("notFound")
    expect(read("app/(public)/gallery/page.tsx")).toContain('isEnabled("galleries")')
    expect(read("app/(public)/gallery/[slug]/page.tsx")).toContain("emptyPublishedAlbumMessage")
    expect(read("app/(public)/pay/page.tsx")).toContain("notFound")
    expect(read("app/(public)/pay/page.tsx")).toContain('isEnabled("stripe")')
    expect(read("app/(public)/pay/success/page.tsx")).toContain('isEnabled("stripe")')
    expect(read("app/(public)/pay/cancel/page.tsx")).toContain('isEnabled("stripe")')
  })

  test("cms and media schema are committed", () => {
    const sql = read("drizzle/0001_cms_media_contact.sql")
    expect(sql).toContain("media_assets")
    expect(sql).toContain("media_usages")
    expect(sql).toContain("cms_entries")
    expect(sql).toContain("cms_revisions")
  })
})

describe("analytics allow-list", () => {
  test("drops unknown keys", () => {
    expect(sanitizeAnalyticsProps({ destination: "/x", email: "a@b.c", token: "nope" })).toEqual({
      destination: "/x",
    })
  })

  test("strips PII keys including name, IP, and body", () => {
    expect(
      sanitizeAnalyticsProps({
        entry_type: "article",
        kind: "image",
        email: "a@b.c",
        name: "Ada",
        ipAddress: "203.0.113.9",
        body: "<p>secret</p>",
        message: "hello there",
      }),
    ).toEqual({ entry_type: "article", kind: "image" })
  })

  test("trackEvent is wired at contact, CMS publish, and media upload", () => {
    const analytics = read("lib/analytics.ts")
    expect(analytics).toContain('from "@vercel/analytics/server"')
    expect(analytics).toContain("export const ANALYTICS_EVENTS")
    expect(analytics).toContain("contact_submit")
    expect(analytics).toContain("contact_submit_failed")
    expect(analytics).toContain("waitlist_submit")
    expect(analytics).toContain("waitlist_submit_failed")
    expect(analytics).toContain("cms_publish")
    expect(analytics).toContain("media_upload")
    expect(analytics).toContain("sanitizeAnalyticsProps")

    const pii = /\b(email|name|ipAddress|ip|message|body|filename)\b/

    const contact = read("app/api/contact/route.ts")
    expect(contact).toContain('from "@/lib/analytics"')
    expect(contact).toContain('trackEvent("contact_submit")')
    expect(contact).toContain('trackEvent("contact_submit_failed"')
    const contactCalls = contact.match(/trackEvent\([^)]*\)/g) ?? []
    expect(contactCalls.length).toBeGreaterThanOrEqual(3)
    for (const call of contactCalls) expect(call).not.toMatch(pii)

    const waitlist = read("lib/waitlist/signup.ts")
    expect(waitlist).toContain('from "@/lib/analytics"')
    expect(waitlist).toContain('trackEvent("waitlist_submit")')
    expect(waitlist).toContain('trackEvent("waitlist_submit_failed"')
    const waitlistCalls = waitlist.match(/trackEvent\([^)]*\)/g) ?? []
    expect(waitlistCalls.length).toBeGreaterThanOrEqual(3)
    for (const call of waitlistCalls) expect(call).not.toMatch(pii)

    const cmsPatch = read("app/api/admin/cms/[id]/route.ts")
    expect(cmsPatch).toContain('from "@/lib/analytics"')
    expect(cmsPatch).toContain('trackEvent("cms_publish", { entry_type: entry.entryType })')
    expect(cmsPatch).toContain('status === "published" && entry.status !== "published"')
    const cmsCalls = cmsPatch.match(/trackEvent\([^)]*\)/g) ?? []
    expect(cmsCalls).toEqual(['trackEvent("cms_publish", { entry_type: entry.entryType })'])
    for (const call of cmsCalls) expect(call).not.toMatch(pii)

    const cmsCreate = read("app/api/admin/cms/route.ts")
    expect(cmsCreate).toContain('status: "draft"')
    expect(cmsCreate).not.toContain("trackEvent")

    const media = read("app/api/admin/media/route.ts")
    expect(media).toContain('from "@/lib/analytics"')
    expect(media).toContain('trackEvent("media_upload", { kind: validated.value.kind })')
    expect(media).toContain("db.insert(mediaAssets)")
    expect(read("app/api/upload/route.ts")).toContain('from "@/app/api/admin/media/route"')
    const mediaCalls = media.match(/trackEvent\([^)]*\)/g) ?? []
    expect(mediaCalls).toEqual(['trackEvent("media_upload", { kind: validated.value.kind })'])
    for (const call of mediaCalls) expect(call).not.toMatch(pii)

    expect(read("lib/analytics.ts")).toContain("export function trackEvent")
  })

  test("event name allowlist is not duplicated outside lib/analytics.ts", () => {
    const files = [
      "app/api/contact/route.ts",
      "app/api/admin/cms/route.ts",
      "app/api/admin/cms/[id]/route.ts",
      "app/api/admin/media/route.ts",
      "app/api/admin/media/[id]/crop/route.ts",
      "lib/media/crop.ts",
      "app/api/upload/route.ts",
    ]
    for (const file of files) {
      expect(read(file)).not.toContain("ANALYTICS_EVENTS")
    }
  })
})

describe("memory rate limit fallback", () => {
  test("blocks after max", () => {
    resetMemoryRateLimits()
    expect(checkMemoryRateLimit({ key: "k", max: 1, windowMs: 60_000 }).allowed).toBe(true)
    expect(checkMemoryRateLimit({ key: "k", max: 1, windowMs: 60_000 }).allowed).toBe(false)
  })
})
