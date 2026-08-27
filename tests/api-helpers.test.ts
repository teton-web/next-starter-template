process.env.DATABASE_URL ??= "postgresql://ci:ci@localhost:5432/ci"
process.env.AUTH_SECRET ??= "ci-placeholder-secret-minimum-32-characters"

import { describe, expect, test } from "bun:test"
import { z } from "zod"
import { parseJson } from "@/lib/api/helpers"
import { parsePagination } from "@/lib/api/pagination"
import { hasCapability, sanitizeCapabilities } from "@/lib/auth/capabilities-pure"
import {
  isAdminPagePath,
  isAccountPagePath,
  shouldRedirectForMustChangePassword,
  shouldRejectApiForMustChangePassword,
} from "@/lib/auth/must-change-password-pure"
import { resetPasswordTokenFromCtx } from "@/lib/auth/reset-password-token-pure"
import { publicResetPasswordUrl } from "@/lib/auth/reset-password-url-pure"
import {
  passwordChangeRedirectUrl,
  postPasswordChangeUrl,
  safeCallbackUrl,
} from "@/lib/auth/callback-url-pure"
import { passwordChangeRequiredResponse } from "@/lib/api/helpers"

describe("parseJson", () => {
  test("returns 422 on invalid bodies", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: 12 }),
    })
    const result = await parseJson(request, z.object({ email: z.string() }))
    expect(result).toBeInstanceOf(Response)
    const response = result as Response
    expect(response.status).toBe(422)
    const body = await response.json()
    expect(body.error).toBeTruthy()
  })

  test("returns parsed data on valid bodies", async () => {
    const request = new Request("http://localhost/api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "you@example.com" }),
    })
    const result = await parseJson(request, z.object({ email: z.string().email() }))
    expect(result).toEqual({ email: "you@example.com" })
  })
})

describe("mustChangePassword path gates", () => {
  test("HTML redirect is /admin pages except /admin/account, not /api/admin", () => {
    expect(isAdminPagePath("/admin")).toBe(true)
    expect(isAdminPagePath("/admin/content")).toBe(true)
    expect(isAdminPagePath("/api/admin/cms")).toBe(false)
    expect(isAccountPagePath("/admin/account")).toBe(true)
    expect(shouldRedirectForMustChangePassword("/admin")).toBe(true)
    expect(shouldRedirectForMustChangePassword("/admin/content")).toBe(true)
    expect(shouldRedirectForMustChangePassword("/admin/account")).toBe(false)
    expect(shouldRedirectForMustChangePassword("/admin/account/security")).toBe(false)
    expect(shouldRedirectForMustChangePassword("/api/admin/cms")).toBe(false)
    expect(shouldRedirectForMustChangePassword("/api/admin/change-password")).toBe(false)
  })

  test("CMS APIs except change-password are blocked", () => {
    expect(shouldRejectApiForMustChangePassword("/api/admin/cms")).toBe(true)
    expect(shouldRejectApiForMustChangePassword("/api/admin/media")).toBe(true)
    expect(shouldRejectApiForMustChangePassword("/api/upload")).toBe(true)
    expect(shouldRejectApiForMustChangePassword("/api/admin/change-password")).toBe(false)
    expect(shouldRejectApiForMustChangePassword("/admin/content")).toBe(false)
    expect(shouldRejectApiForMustChangePassword("/admin/account")).toBe(false)
  })

  test("passwordChangeRequiredResponse is 403", async () => {
    const response = passwordChangeRequiredResponse()
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toBe("Password change required.")
  })
})

describe("resetPasswordTokenFromCtx", () => {
  test("body token wins over query", () => {
    expect(
      resetPasswordTokenFromCtx({ body: { token: "a" }, query: { token: "b" } }),
    ).toBe("a")
  })

  test("query token is used when body token is missing, empty, or non-string", () => {
    expect(resetPasswordTokenFromCtx({ body: {}, query: { token: "b" } })).toBe("b")
    expect(resetPasswordTokenFromCtx({ body: { token: "" }, query: { token: "b" } })).toBe("b")
    expect(
      resetPasswordTokenFromCtx({ body: { token: 1 }, query: { token: "b" } }),
    ).toBe("b")
    expect(resetPasswordTokenFromCtx({ query: { token: "b" } })).toBe("b")
  })

  test("non-string query and missing tokens return empty string", () => {
    expect(resetPasswordTokenFromCtx({ query: { token: 1 } })).toBe("")
    expect(resetPasswordTokenFromCtx({})).toBe("")
    expect(resetPasswordTokenFromCtx({ body: { token: "" }, query: { token: "" } })).toBe("")
    expect(resetPasswordTokenFromCtx({ body: null, query: null })).toBe("")
  })
})

describe("safeCallbackUrl", () => {
  test("allows same-origin relative paths and query strings", () => {
    expect(safeCallbackUrl("/admin")).toBe("/admin")
    expect(safeCallbackUrl("/admin/content?tab=pages")).toBe("/admin/content?tab=pages")
    expect(safeCallbackUrl("/admin#top")).toBe("/admin#top")
  })

  test("rejects protocol-relative, absolute, and backslash open redirects", () => {
    expect(safeCallbackUrl(null)).toBe("/admin")
    expect(safeCallbackUrl("https://evil.example/path")).toBe("/admin")
    expect(safeCallbackUrl("//evil.example/path")).toBe("/admin")
    expect(safeCallbackUrl("/\\evil.example/path")).toBe("/admin")
    expect(safeCallbackUrl("/\\\\evil.example/path")).toBe("/admin")
    expect(safeCallbackUrl("/%5Cevil.example/path")).toBe("/admin")
  })

  test("password-change redirects carry a safe callback through /admin/account", () => {
    expect(passwordChangeRedirectUrl("/admin/content/123")).toBe(
      "/admin/account?callbackUrl=%2Fadmin%2Fcontent%2F123",
    )
    expect(passwordChangeRedirectUrl("/admin")).toBe("/admin/account?callbackUrl=%2Fadmin")
    expect(passwordChangeRedirectUrl("/admin/account")).toBe("/admin/account")
    expect(passwordChangeRedirectUrl("//evil.example/path")).toBe("/admin/account?callbackUrl=%2Fadmin")
    expect(postPasswordChangeUrl("/admin/content/123")).toBe("/admin/content/123")
    expect(postPasswordChangeUrl("/admin/account")).toBe("/admin")
    expect(postPasswordChangeUrl(null)).toBe("/admin")
    expect(postPasswordChangeUrl("/\\evil.example/path")).toBe("/admin")
  })
})

describe("publicResetPasswordUrl", () => {
  test("rewrites Better Auth API callback URLs to the page token query", () => {
    expect(
      publicResetPasswordUrl("https://example.com/api/auth/reset-password/abc123?callbackURL=/reset-password"),
    ).toBe("https://example.com/reset-password?token=abc123")
    expect(
      publicResetPasswordUrl("https://example.com/api/auth/reset-password/abc123", "abc123"),
    ).toBe("https://example.com/reset-password?token=abc123")
    expect(
      publicResetPasswordUrl("https://example.com/reset-password?token=abc123"),
    ).toBe("https://example.com/reset-password?token=abc123")
  })

  test("leaves unparseable or tokenless URLs unchanged", () => {
    expect(publicResetPasswordUrl("not-a-url")).toBe("not-a-url")
    expect(publicResetPasswordUrl("https://example.com/api/auth/forget-password")).toBe(
      "https://example.com/api/auth/forget-password",
    )
  })
})

describe("capabilities", () => {
  test("admin implies moderate", () => {
    expect(hasCapability(["admin"], "moderate")).toBe(true)
    expect(hasCapability(["admin"], "admin")).toBe(true)
    expect(hasCapability(["moderate"], "admin")).toBe(false)
    expect(hasCapability(["moderate"], "moderate")).toBe(true)
    expect(hasCapability([], "moderate")).toBe(false)
  })

  test("sanitizeCapabilities drops unknown values", () => {
    expect(sanitizeCapabilities(["admin", "narnia", 3])).toEqual(["admin"])
    expect(sanitizeCapabilities(null)).toEqual([])
  })
})

describe("parsePagination", () => {
  test("clamps limit and floors offset", () => {
    expect(parsePagination(new URLSearchParams("limit=9999"), { maxLimit: 100 }).limit).toBe(100)
    expect(parsePagination(new URLSearchParams("limit=-5&offset=-10"))).toEqual({
      limit: 20,
      offset: 0,
    })
  })
})
