export function publicResetPasswordUrl(authCallbackUrl: string, token?: string) {
  try {
    const parsed = new URL(authCallbackUrl)
    const queryToken = parsed.searchParams.get("token")
    const match = parsed.pathname.match(/\/reset-password\/([^/]+)\/?$/)
    const resolved = token || queryToken || match?.[1]
    if (!resolved || resolved === "reset-password") {
      return authCallbackUrl
    }
    return `${parsed.origin}/reset-password?token=${encodeURIComponent(resolved)}`
  } catch {
    return authCallbackUrl
  }
}
