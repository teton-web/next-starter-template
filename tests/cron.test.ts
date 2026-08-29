process.env.DATABASE_URL ??= "postgresql://ci:ci@localhost:5432/ci"
process.env.AUTH_SECRET ??= "ci-placeholder-secret-minimum-32-characters"

import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { cronHealthResponse } from "@/app/api/cron/health/route"
import {
  CRON_SECRET_HEADER,
  VERCEL_CRON_HEADER,
  isAuthorizedCronRequest,
  isCronApiPath,
  requireCronSecret,
} from "@/lib/cron/require-cron-secret"
import { verifyEnvContract } from "../scripts/verify-env-contract.mjs"

const root = join(import.meta.dir, "..")

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

function walkCronModules(entryRel: string) {
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
    expect(source).not.toContain('from "@/lib/db"')
    expect(source).not.toContain("from '@/lib/db'")
    expect(source).not.toContain('from "@/lib/flags/resolve"')
    expect(source).not.toContain('from "@/lib/auth"')
    for (const spec of importedSpecs(source)) {
      expect(spec).not.toBe("@/lib/db")
      expect(spec.startsWith("@/lib/db/")).toBe(false)
      expect(spec).not.toBe("@/lib/flags/resolve")
      expect(spec).not.toBe("@/lib/auth")
      const next = resolveImport(rel, spec)
      if (next && (next.startsWith("lib/cron/") || rel.startsWith("lib/cron/"))) {
        stack.push(next)
      }
    }
  }
  return seen
}

const secret = "cron-test-secret"
const env = { CRON_SECRET: secret }

function request(headers: HeadersInit = {}, url = "http://localhost/api/cron/health") {
  return new Request(url, { headers })
}

describe("cron secret helper", () => {
  test("paths under /api/cron are recognized", () => {
    expect(isCronApiPath("/api/cron")).toBe(true)
    expect(isCronApiPath("/api/cron/health")).toBe(true)
    expect(isCronApiPath("/api/cron/health/")).toBe(true)
    expect(isCronApiPath("/api/health")).toBe(false)
    expect(isCronApiPath("/api/cronicle")).toBe(false)
    expect(isCronApiPath("/cron")).toBe(false)
  })

  test("helper graph stays off Neon, auth, and Node isEnabled", () => {
    walkCronModules("lib/cron/require-cron-secret.ts")
  })

  test("fails closed without CRON_SECRET or with a wrong bearer", async () => {
    expect(isAuthorizedCronRequest(request({ authorization: `Bearer ${secret}` }), {})).toBe(false)
    expect(isAuthorizedCronRequest(request({ authorization: `Bearer ${secret}` }), { CRON_SECRET: "" })).toBe(
      false,
    )
    expect(isAuthorizedCronRequest(request({ authorization: "Bearer wrong-secret" }), env)).toBe(false)
    expect(isAuthorizedCronRequest(request(), env)).toBe(false)

    const denied = requireCronSecret(request({ authorization: "Bearer wrong-secret" }), env)
    expect(denied).toBeInstanceOf(Response)
    const response = denied as Response
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "Unauthorized" })
  })

  test("accepts Bearer CRON_SECRET with a constant-time equal match", () => {
    expect(isAuthorizedCronRequest(request({ authorization: `Bearer ${secret}` }), env)).toBe(true)
    expect(isAuthorizedCronRequest(request({ authorization: `bearer ${secret}` }), env)).toBe(true)
    expect(requireCronSecret(request({ authorization: `Bearer ${secret}` }), env)).toBe(true)
    expect(isAuthorizedCronRequest(request({ authorization: `Bearer ${secret}x` }), env)).toBe(false)
    expect(isAuthorizedCronRequest(request({ authorization: `Bearer ${secret.slice(0, -1)}` }), env)).toBe(
      false,
    )
  })

  test("accepts Vercel cron header plus secret, not the header alone", () => {
    expect(
      isAuthorizedCronRequest(
        request({ [VERCEL_CRON_HEADER]: "1", authorization: `Bearer ${secret}` }),
        env,
      ),
    ).toBe(true)
    expect(
      isAuthorizedCronRequest(
        request({ [VERCEL_CRON_HEADER]: "1", [CRON_SECRET_HEADER]: secret }),
        env,
      ),
    ).toBe(true)
    expect(isAuthorizedCronRequest(request({ [VERCEL_CRON_HEADER]: "1" }), env)).toBe(false)
    expect(isAuthorizedCronRequest(request({ [CRON_SECRET_HEADER]: secret }), env)).toBe(false)
    expect(
      isAuthorizedCronRequest(
        request({ [VERCEL_CRON_HEADER]: "1", [CRON_SECRET_HEADER]: "nope" }),
        env,
      ),
    ).toBe(false)
  })
})

describe("GET /api/cron/health", () => {
  const previousSecret = process.env.CRON_SECRET

  afterEach(() => {
    if (previousSecret === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = previousSecret
  })

  test("flag off returns 404 even with a valid secret", async () => {
    process.env.CRON_SECRET = secret
    const response = cronHealthResponse(request({ authorization: `Bearer ${secret}` }), false)
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: "Not found" })
  })

  test("missing or wrong secret returns 401 when the flag is on", async () => {
    process.env.CRON_SECRET = secret
    const missing = cronHealthResponse(request(), true)
    expect(missing.status).toBe(401)
    expect(await missing.json()).toEqual({ error: "Unauthorized" })

    const wrong = cronHealthResponse(request({ authorization: "Bearer other-secret" }), true)
    expect(wrong.status).toBe(401)
    expect(await wrong.json()).toEqual({ error: "Unauthorized" })
  })

  test("correct secret returns 200 { ok: true } when the flag is on", async () => {
    process.env.CRON_SECRET = secret
    const response = cronHealthResponse(request({ authorization: `Bearer ${secret}` }), true)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })
})

describe("cron docs and proxy exemption", () => {
  test("proxy site-gate and session skip /api/cron when the secret helper is used", () => {
    const proxy = read("proxy.ts")
    expect(proxy).toContain('from "@/lib/cron/require-cron-secret"')
    expect(proxy).toContain("isCronApiPath")
    const exempt = proxy.match(/function isSiteGateExempt\(pathname: string\) \{[\s\S]*?\n\}/)
    expect(exempt?.[0]).toContain("isCronApiPath(pathname)")
    expect(exempt?.[0]).toContain("isStripeWebhookPath(pathname)")
    expect(proxy).not.toContain('from "@/lib/flags/resolve"')
    expect(proxy).not.toContain('from "@/lib/db"')
    expect(read("lib/auth/must-change-password-pure.ts")).not.toContain("/api/cron")
  })

  test("health route checks flag then requireCronSecret and has no publish_at job", () => {
    const route = read("app/api/cron/health/route.ts")
    expect(route).toContain('isEnabled("cron")')
    expect(route).toContain("cronHealthResponse(request, await isEnabled(\"cron\"))")
    expect(route).toContain("requireCronSecret")
    expect(route).toContain("jsonError(\"Not found\", 404)")
    expect(route).toContain("jsonOk({ ok: true })")
    expect(route).not.toContain("publish_at")
    expect(route).not.toContain("publish-scheduled")
    expect(existsSync(join(root, "app/api/cron/publish-scheduled/route.ts"))).toBe(false)
  })

  test("API matrix and .env.example document CRON_SECRET as optional", () => {
    const matrix = read("docs/API_AUTH_MATRIX.md")
    expect(matrix).toContain("GET /api/cron/health")
    expect(matrix).toContain("requireCronSecret")
    expect(matrix).toContain("CRON_SECRET")
    expect(matrix).toContain("/api/cron/*")
    expect(matrix).toContain("x-vercel-cron")

    const example = read(".env.example")
    expect(example).toContain("CRON_SECRET=")
    expect(example).toContain("# FEATURE_CRON=0")
    const contract = verifyEnvContract({
      DATABASE_URL: "postgresql://ci:ci@localhost:5432/ci",
      AUTH_SECRET: "ci-placeholder-secret-minimum-32-characters",
    })
    expect(contract.missing).not.toContain("CRON_SECRET")
    expect(contract.missingRecommended).not.toContain("CRON_SECRET")
  })
})
