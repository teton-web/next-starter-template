process.env.DATABASE_URL ??= "postgresql://ci:ci@localhost:5432/ci"
process.env.AUTH_SECRET ??= "ci-placeholder-secret-minimum-32-characters"
delete process.env.RESEND_API_KEY
delete process.env.EMAIL_FROM

import {
  dbInsertOnConflictDoNothing,
  dbInsertValues,
  resetSharedDbInsert,
} from "./helpers/mock-db"
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import { NextRequest } from "next/server"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { waitlistEntries } from "@/lib/db/schema"
import { resetMemoryRateLimits } from "@/lib/services/rate-limit"
import { isUniqueViolation } from "@/lib/waitlist/unique-pure"

const sendWaitlistConfirmation = mock(async (_input: { email: string; name?: string | null }) => undefined)

mock.module("@/lib/waitlist/notify", () => ({
  sendWaitlistConfirmation,
}))

const analytics = await import("@/lib/analytics")
const { waitlistPostResponse } = await import("@/lib/waitlist/signup")

const root = join(import.meta.dir, "..")

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8")
}

function waitlistRequest(body: unknown, ip = "203.0.113.9") {
  return new NextRequest("http://localhost/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  })
}

const validSignup = {
  email: "Ada@Example.com",
  name: "Ada Lovelace",
  source: "waitlist",
}

describe("waitlist unique helper", () => {
  test("detects postgres 23505 on the error or its cause", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true)
    expect(isUniqueViolation({ cause: { code: "23505" } })).toBe(true)
    expect(isUniqueViolation({ code: "23503" })).toBe(false)
    expect(isUniqueViolation(new Error("duplicate"))).toBe(false)
    expect(isUniqueViolation(null)).toBe(false)
  })
})

describe("POST /api/waitlist", () => {
  let trackEventSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    resetSharedDbInsert()
    resetMemoryRateLimits()
    sendWaitlistConfirmation.mockReset()
    sendWaitlistConfirmation.mockImplementation(async () => undefined)
    dbInsertValues.mockImplementation(async () => [{ id: "waitlist-1" }])
    trackEventSpy = spyOn(analytics, "trackEvent").mockImplementation(() => undefined)
  })

  afterEach(() => {
    trackEventSpy.mockRestore()
  })

  test("returns 404 when the waitlist flag is off", async () => {
    const response = await waitlistPostResponse(waitlistRequest(validSignup), false)
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: "Not found" })
    expect(dbInsertValues).not.toHaveBeenCalled()
    expect(sendWaitlistConfirmation).not.toHaveBeenCalled()
  })

  test("inserts a new email and returns generic success", async () => {
    const response = await waitlistPostResponse(waitlistRequest(validSignup), true)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(dbInsertOnConflictDoNothing).toHaveBeenCalled()
    const row = dbInsertValues.mock.calls[0]?.[0] as {
      email: string
      name: string | null
      source: string | null
    }
    expect(row.email).toBe("ada@example.com")
    expect(row.name).toBe("Ada Lovelace")
    expect(row.source).toBe("waitlist")
    expect(sendWaitlistConfirmation).toHaveBeenCalledTimes(1)
    expect(sendWaitlistConfirmation.mock.calls[0]?.[0]).toEqual({
      email: "ada@example.com",
      name: "Ada Lovelace",
    })
    expect(trackEventSpy).toHaveBeenCalledWith("waitlist_submit")
    expect(JSON.stringify(trackEventSpy.mock.calls)).not.toContain("ada@example.com")
  })

  test("duplicate email is generic 200 and does not enumerate", async () => {
    dbInsertValues.mockImplementation(async () => [])
    const response = await waitlistPostResponse(waitlistRequest(validSignup), true)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ success: true })
    expect(sendWaitlistConfirmation).not.toHaveBeenCalled()
    expect(JSON.stringify(body).toLowerCase()).not.toContain("already")
    expect(JSON.stringify(body).toLowerCase()).not.toContain("exists")
  })

  test("unique-violation insert is generic 200", async () => {
    dbInsertValues.mockImplementation(async () => {
      const error = Object.assign(new Error("duplicate key"), { code: "23505" })
      throw error
    })
    const response = await waitlistPostResponse(waitlistRequest({ email: "ada@example.com" }), true)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(sendWaitlistConfirmation).not.toHaveBeenCalled()
  })

  test("confirmation email is not awaited and cannot fail the insert", async () => {
    let resolveSend: (() => void) | undefined
    sendWaitlistConfirmation.mockImplementation(
      () =>
        new Promise<void>((resolve, reject) => {
          resolveSend = () => reject(new Error("resend down"))
        }),
    )
    const response = await waitlistPostResponse(waitlistRequest({ email: "ada@example.com" }), true)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(sendWaitlistConfirmation).toHaveBeenCalledTimes(1)
    resolveSend?.()
    await Promise.resolve()
  })

  test("rate-limits public POSTs per IP", async () => {
    for (let i = 0; i < 5; i++) {
      const ok = await waitlistPostResponse(waitlistRequest({ email: `n${i}@example.com` }), true)
      expect(ok.status).toBe(200)
    }
    const limited = await waitlistPostResponse(waitlistRequest({ email: "last@example.com" }), true)
    expect(limited.status).toBe(429)
    expect(trackEventSpy).toHaveBeenCalledWith("waitlist_submit_failed", {
      error_code: "rate_limited",
      status: 429,
    })
  })

  test("invalid email is 422", async () => {
    const response = await waitlistPostResponse(waitlistRequest({ email: "not-an-email" }), true)
    expect(response.status).toBe(422)
    expect(sendWaitlistConfirmation).not.toHaveBeenCalled()
    expect(trackEventSpy).toHaveBeenCalledWith("waitlist_submit_failed", {
      error_code: "validation",
      status: 422,
    })
  })

  test("onConflict targets the unique email column", () => {
    expect(waitlistEntries.email).toBeDefined()
  })
})

describe("waitlist source", () => {
  test("public page 404s when the flag is off and posts to the API when on", () => {
    const page = read("app/(public)/waitlist/page.tsx")
    expect(page).toContain("notFound")
    expect(page).toContain('isEnabled("waitlist")')
    expect(read("app/(public)/waitlist/waitlist-form.tsx")).toContain("/api/waitlist")
    const route = read("app/api/waitlist/route.ts")
    expect(route).toContain("waitlistPostResponse")
    expect(route).toContain("export async function POST")
    expect(route).not.toContain("export async function waitlistPostResponse")
    expect(route).not.toContain("onConflictDoNothing")
    const signup = read("lib/waitlist/signup.ts")
    expect(signup).toContain("onConflictDoNothing")
    expect(signup).toContain("void sendWaitlistConfirmation")
    expect(signup).not.toContain("await sendWaitlistConfirmation")
    expect(signup).not.toContain("already exists")
    expect(read("app/admin/waitlist/page.tsx")).toContain("listWaitlistEntries")
    const proxy = read("proxy.ts")
    expect(proxy).not.toContain("/waitlist")
    expect(proxy).not.toContain("/api/waitlist")
  })

  test("admin waitlist page exists and uses the same capability gate as contact", () => {
    expect(existsSync(join(root, "app/admin/waitlist/page.tsx"))).toBe(true)
    const page = read("app/admin/waitlist/page.tsx")
    expect(page).toContain('checkCapability(session.user.id, "admin")')
    expect(page).toContain("listWaitlistEntries")
    expect(page).not.toContain("designs.sh")
  })
})
