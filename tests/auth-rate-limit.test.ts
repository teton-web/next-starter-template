process.env.DATABASE_URL ??= "postgresql://ci:ci@localhost:5432/ci"
process.env.AUTH_SECRET ??= "ci-placeholder-secret-minimum-32-characters"

import { describe, expect, test } from "bun:test"
import {
  authRateLimitBucket,
  enforceAuthRouteRateLimit,
  resetMemoryRateLimits,
  tooManyRequestsResponse,
} from "@/lib/services/rate-limit"

describe("auth rate limit helpers", () => {
  test("maps credential sign-in and forgot-password paths", () => {
    expect(authRateLimitBucket("/api/auth/sign-in/email")).toBe("sign-in")
    expect(authRateLimitBucket("/api/auth/request-password-reset")).toBe("forgot-password")
    expect(authRateLimitBucket("/api/auth/forget-password")).toBe("forgot-password")
    expect(authRateLimitBucket("/api/auth/sign-in/magic-link")).toBeNull()
    expect(authRateLimitBucket("/api/contact")).toBeNull()
  })

  test("429 responses include Retry-After", async () => {
    const response = tooManyRequestsResponse(45_000)
    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("45")
    const body = await response.json() as { error: string; code: string }
    expect(body.error).toContain("Too many requests")
    expect(body.code).toBe("TOO_MANY_REQUESTS")
  })

  test("blocks the 6th sign-in from the same IP within 60s", async () => {
    resetMemoryRateLimits()
    const ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`
    const makeRequest = () =>
      new Request("http://localhost/api/auth/sign-in/email", {
        method: "POST",
        headers: { "x-forwarded-for": ip },
      })

    for (let i = 0; i < 5; i++) {
      expect(await enforceAuthRouteRateLimit(makeRequest())).toBeNull()
    }

    const blocked = await enforceAuthRouteRateLimit(makeRequest())
    expect(blocked).toBeInstanceOf(Response)
    expect(blocked!.status).toBe(429)
    expect(blocked!.headers.get("Retry-After")).toBeTruthy()
  })
})
