const FALLBACK_CALLBACK_URL = "/admin"

function isUnsafeCallbackUrl(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return true
  }
  if (value.includes("\\") || /%5c/i.test(value) || /[\u0000-\u001F\u007F]/.test(value)) {
    return true
  }
  return false
}

export function safeCallbackUrl(value: string | null | undefined, fallback = FALLBACK_CALLBACK_URL) {
  if (!value || isUnsafeCallbackUrl(value)) {
    return fallback
  }

  try {
    const url = new URL(value, "https://starter.invalid")
    if (url.origin !== "https://starter.invalid" || url.username || url.password) {
      return fallback
    }
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}

function isAccountCallback(path: string) {
  return path === "/admin/account" || path.startsWith("/admin/account/") || path.startsWith("/admin/account?")
}

/** Failed Google OAuth returns here so `/login` still has `callbackUrl`. */
export function loginErrorCallbackUrl(callbackUrl: string | null | undefined) {
  const dest = safeCallbackUrl(callbackUrl)
  return `/login?callbackUrl=${encodeURIComponent(dest)}`
}

export function passwordChangeRedirectUrl(callbackUrl: string | null | undefined) {
  const dest = safeCallbackUrl(callbackUrl)
  if (isAccountCallback(dest)) {
    return "/admin/account"
  }
  return `/admin/account?callbackUrl=${encodeURIComponent(dest)}`
}

export function postPasswordChangeUrl(callbackUrl: string | null | undefined) {
  const dest = safeCallbackUrl(callbackUrl)
  if (isAccountCallback(dest)) {
    return FALLBACK_CALLBACK_URL
  }
  return dest
}
