import { NextRequest, NextResponse } from "next/server"
import { readFlagRow } from "@/lib/flags/resolve"
import {
  hasStoredSiteGateHash,
  SITE_GATE_PASSWORD_HASH_KEY,
  verifySiteGatePassword,
} from "@/lib/flags/site-gate-password"
import { checkRateLimit, clientKey, tooManyRequestsResponse } from "@/lib/services/rate-limit"
import {
  createSiteGateCookieValue,
  isSiteGateEnabled,
  leftoverSiteGatePassword,
  safeSiteGateNext,
  SITE_GATE_COOKIE,
  SITE_GATE_MAX_AGE_SECONDS,
  SITE_GATE_PASSWORD_MAX_LENGTH,
  siteGatePasswordsEqual,
  siteGateSigningSecret,
  siteGateUnlockBinding,
} from "@/lib/site-gate"

function shouldUseSecureCookie(request: NextRequest) {
  return isSiteGateEnabled() && !["localhost", "127.0.0.1"].includes(request.nextUrl.hostname)
}

function wantsHtml(request: NextRequest) {
  const accept = request.headers.get("accept") || ""
  return accept.includes("text/html")
}

function gateRedirect(request: NextRequest, nextPath: string, error?: string) {
  const url = new URL("/site-gate", request.url)
  url.searchParams.set("next", nextPath)
  if (error) {
    url.searchParams.set("error", error)
  }
  return NextResponse.redirect(url, { status: 303 })
}

function invalidUnlock(request: NextRequest, nextPath: string) {
  if (wantsHtml(request)) {
    return gateRedirect(request, nextPath, "invalid")
  }
  return NextResponse.json({ error: "Site gate access required." }, { status: 401 })
}

async function unlockBindingIfPasswordMatches(password: string) {
  const row = await readFlagRow("site_gate")
  const storedHash = row?.config?.[SITE_GATE_PASSWORD_HASH_KEY]
  const hash = hasStoredSiteGateHash(row?.config) && typeof storedHash === "string" ? storedHash : ""
  if (hash) {
    if (!(await verifySiteGatePassword(password, hash))) return ""
    return siteGateUnlockBinding(hash)
  }

  const leftover = leftoverSiteGatePassword()
  if (!leftover || !siteGatePasswordsEqual(password, leftover)) return ""
  return siteGateUnlockBinding(leftover)
}

function unavailableUnlock() {
  return NextResponse.json({ error: "Site gate unavailable." }, { status: 503 })
}

export async function POST(request: NextRequest) {
  const ip = clientKey(request)
  const limited = await checkRateLimit({ key: `site-gate:ip:${ip}`, max: 5, windowMs: 60_000 })
  if (!limited.allowed) {
    return tooManyRequestsResponse(limited.retryAfterMs)
  }

  const form = await request.formData()
  const password = String(form.get("password") ?? "")
  const nextPath = safeSiteGateNext(String(form.get("next") ?? "/"))
  if (password.length > SITE_GATE_PASSWORD_MAX_LENGTH) {
    return invalidUnlock(request, nextPath)
  }

  let binding = ""
  try {
    binding = await unlockBindingIfPasswordMatches(password)
  } catch {
    return unavailableUnlock()
  }
  const secret = siteGateSigningSecret()
  const cookieValue = binding && secret ? await createSiteGateCookieValue(secret, binding) : ""

  if (!cookieValue) {
    return invalidUnlock(request, nextPath)
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url), { status: 303 })
  response.cookies.set({
    name: SITE_GATE_COOKIE,
    value: cookieValue,
    httpOnly: true,
    maxAge: SITE_GATE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: shouldUseSecureCookie(request),
  })
  return response
}
