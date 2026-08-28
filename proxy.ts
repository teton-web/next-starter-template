import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth, isAccountBlocked } from "@/lib/auth"
import { safeCallbackUrl } from "@/lib/auth/callback-url-pure"
import { passwordChangeRequiredResponse } from "@/lib/api/helpers"
import {
  isAdminPagePath,
  shouldRedirectForMustChangePassword,
  shouldRejectApiForMustChangePassword,
} from "@/lib/auth/must-change-password-pure"
import {
  FEATURE_FLAG_CACHE_COOKIE,
  encodeFeatureFlagCacheCookie,
  featureFlagCacheCookieAttrs,
  getWarmFlagCacheSnapshot,
  resolveProxyFlags,
} from "@/lib/flags/proxy-resolve"
import { resolveSiteGateEnforce } from "@/lib/flags/site-gate-enforce"
import { isCronApiPath } from "@/lib/cron/require-cron-secret"
import {
  safeSiteGateNext,
  SITE_GATE_COOKIE,
  SITE_GATE_PUBLIC_STATE_PATH,
  siteGateSigningSecret,
  verifySiteGateCookie,
} from "@/lib/site-gate"

function isGateRoute(pathname: string) {
  return pathname === "/site-gate" || pathname === "/api/site-gate"
}

function isStaticAsset(pathname: string) {
  return (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/manifest.webmanifest" ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  )
}

function isSiteGateExempt(pathname: string) {
  return (
    isStaticAsset(pathname) ||
    pathname === "/api/health" ||
    pathname === SITE_GATE_PUBLIC_STATE_PATH ||
    isCronApiPath(pathname)
  )
}

function isHtmlNavigation(request: NextRequest) {
  const accept = request.headers.get("accept") || ""
  return request.method === "GET" && accept.includes("text/html")
}

async function withFlagCacheCookie(response: NextResponse) {
  const snapshot = getWarmFlagCacheSnapshot()
  if (!snapshot) return response
  const value = await encodeFeatureFlagCacheCookie(snapshot.overrides, {
    iat: snapshot.iat,
    exp: snapshot.exp,
    siteGateHashPresent: snapshot.siteGateHashPresent,
  })
  if (!value) return response
  response.cookies.set(FEATURE_FLAG_CACHE_COOKIE, value, featureFlagCacheCookieAttrs(snapshot.exp))
  return response
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  // Cookie overlay only — catalog + Doppler + ff_overrides. Never Neon.
  // Cold preview/prod fetches GET /api/site-gate/public-state (Node), not Drizzle.
  const flags = await resolveProxyFlags(request.cookies.get(FEATURE_FLAG_CACHE_COOKIE)?.value)
  const enforceGate = await resolveSiteGateEnforce(request, flags)

  if (enforceGate && !isSiteGateExempt(pathname)) {
    const hasGateAccess = await verifySiteGateCookie(
      request.cookies.get(SITE_GATE_COOKIE)?.value,
      siteGateSigningSecret(),
    )

    if (isGateRoute(pathname)) {
      if (hasGateAccess && pathname === "/site-gate") {
        return withFlagCacheCookie(
          NextResponse.redirect(
            new URL(safeSiteGateNext(request.nextUrl.searchParams.get("next")), request.url),
          ),
        )
      }
      return withFlagCacheCookie(NextResponse.next())
    }

    if (!hasGateAccess) {
      if (pathname.startsWith("/api/") && !isHtmlNavigation(request)) {
        return withFlagCacheCookie(
          NextResponse.json({ error: "Site gate access required." }, { status: 401 }),
        )
      }

      const gate = new URL("/site-gate", request.url)
      gate.searchParams.set("next", safeSiteGateNext(`${pathname}${search}`))
      return withFlagCacheCookie(NextResponse.redirect(gate))
    }
  }

  if (pathname === "/admin/login") {
    const login = new URL("/login", request.url)
    login.searchParams.set("callbackUrl", `/admin${search}`)
    return withFlagCacheCookie(NextResponse.redirect(login))
  }

  if (isAdminPagePath(pathname)) {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session || await isAccountBlocked(session.user.id)) {
      const login = new URL("/login", request.url)
      login.searchParams.set("callbackUrl", `${pathname}${search}`)
      return withFlagCacheCookie(NextResponse.redirect(login))
    }

    const mustChangePassword = session.user.mustChangePassword === true
    if (mustChangePassword && shouldRedirectForMustChangePassword(pathname)) {
      const account = new URL("/admin/account", request.url)
      const dest = safeCallbackUrl(`${pathname}${search}`)
      if (dest !== "/admin/account") {
        account.searchParams.set("callbackUrl", dest)
      }
      return withFlagCacheCookie(NextResponse.redirect(account))
    }
  }

  if (shouldRejectApiForMustChangePassword(pathname)) {
    const session = await auth.api.getSession({ headers: request.headers })
    if (session && !await isAccountBlocked(session.user.id) && session.user.mustChangePassword === true) {
      return withFlagCacheCookie(passwordChangeRequiredResponse())
    }
  }

  return withFlagCacheCookie(NextResponse.next())
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
}
