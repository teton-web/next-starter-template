import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isLocalTcpPostgresUrl } from "@/lib/db/connection-pure"

const root = join(import.meta.dir, "..")

describe("isLocalTcpPostgresUrl", () => {
  test("detects localhost TCP URLs used by CI postgres", () => {
    expect(isLocalTcpPostgresUrl("postgresql://ci:ci@localhost:5432/ci")).toBe(true)
    expect(isLocalTcpPostgresUrl("postgresql://ci:ci@127.0.0.1:5432/ci")).toBe(true)
    expect(isLocalTcpPostgresUrl("postgresql://ci:ci@[::1]:5432/ci")).toBe(true)
  })

  test("leaves Neon hosts on the serverless driver", () => {
    expect(isLocalTcpPostgresUrl("postgresql://user:pass@ep-cool.neon.tech/neondb?sslmode=require")).toBe(false)
    expect(isLocalTcpPostgresUrl(undefined)).toBe(false)
    expect(isLocalTcpPostgresUrl("not-a-url")).toBe(false)
  })
})

describe("db adapter wiring", () => {
  test("runtime picks node-postgres for localhost and neon otherwise", () => {
    const source = readFileSync(join(root, "lib/db/index.ts"), "utf8")
    expect(source).toContain("isLocalTcpPostgresUrl")
    expect(source).toContain('drizzle-orm/node-postgres')
    expect(source).toContain('drizzle-orm/neon-serverless')
    expect(source).toContain('from "pg"')
  })
})
