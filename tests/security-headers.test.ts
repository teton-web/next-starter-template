import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dir, "..")

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8")
}

describe("document security headers", () => {
  const config = read("next.config.mjs")

  test("headers() applies CSP, DENY, and nosniff", () => {
    expect(config).toContain("async headers()")
    expect(config).toContain('key: "X-Frame-Options"')
    expect(config).toContain('value: "DENY"')
    expect(config).toContain('key: "X-Content-Type-Options"')
    expect(config).toContain('value: "nosniff"')
    expect(config).toContain('key: "Referrer-Policy"')
    expect(config).toContain('value: "strict-origin-when-cross-origin"')
    expect(config).toContain('key: "Content-Security-Policy"')
    expect(config).toContain("frame-ancestors 'none'")
    expect(config).toContain(
      "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://*.vercel-scripts.com https://vercel.live",
    )
    expect(config).not.toContain("'unsafe-eval'")
  })

  test("TypeScript errors are not ignored", () => {
    expect(config).not.toContain("ignoreBuildErrors")
  })
})
