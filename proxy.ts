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
  isSiteGateEnabled,
  safeSiteGateNext,
  SITE_GATE_COOKIE,
  siteGatePassword,
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
  return isStaticAsset(pathname) || pathname === "/api/health"
}

function isHtmlNavigation(request: NextRequest) {
  const accept = request.headers.get("accept") || ""
  return request.method === "GET" && accept.includes("text/html")
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const password = siteGatePassword()

  if (isSiteGateEnabled() && password && !isSiteGateExempt(pathname)) {
    const hasGateAccess = await verifySiteGateCookie(
      request.cookies.get(SITE_GATE_COOKIE)?.value,
      password,
    )

    if (isGateRoute(pathname)) {
      if (hasGateAccess && pathname === "/site-gate") {
        return NextResponse.redirect(
          new URL(safeSiteGateNext(request.nextUrl.searchParams.get("next")), request.url),
        )
      }
      return NextResponse.next()
    }

    if (!hasGateAccess) {
      if (pathname.startsWith("/api/") && !isHtmlNavigation(request)) {
        return NextResponse.json({ error: "Site gate access required." }, { status: 401 })
      }

      const gate = new URL("/site-gate", request.url)
      gate.searchParams.set("next", safeSiteGateNext(`${pathname}${search}`))
      return NextResponse.redirect(gate)
    }
  }

  if (pathname === "/admin/login") {
    const login = new URL("/login", request.url)
    login.searchParams.set("callbackUrl", `/admin${search}`)
    return NextResponse.redirect(login)
  }

  if (isAdminPagePath(pathname)) {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session || await isAccountBlocked(session.user.id)) {
      const login = new URL("/login", request.url)
      login.searchParams.set("callbackUrl", `${pathname}${search}`)
      return NextResponse.redirect(login)
    }

    const mustChangePassword = session.user.mustChangePassword === true
    if (mustChangePassword && shouldRedirectForMustChangePassword(pathname)) {
      const account = new URL("/admin/account", request.url)
      const dest = safeCallbackUrl(`${pathname}${search}`)
      if (dest !== "/admin/account") {
        account.searchParams.set("callbackUrl", dest)
      }
      return NextResponse.redirect(account)
    }
  }

  if (shouldRejectApiForMustChangePassword(pathname)) {
    const session = await auth.api.getSession({ headers: request.headers })
    if (session && !await isAccountBlocked(session.user.id) && session.user.mustChangePassword === true) {
      return passwordChangeRequiredResponse()
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
}
