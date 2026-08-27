export function isAdminPagePath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/")
}

export function isAccountPagePath(pathname: string) {
  return pathname === "/admin/account" || pathname.startsWith("/admin/account/")
}

export function isChangePasswordApiPath(pathname: string) {
  return pathname === "/api/admin/change-password"
}

export function isCmsApiPath(pathname: string) {
  return pathname === "/api/upload" || pathname === "/api/admin" || pathname.startsWith("/api/admin/")
}

export function shouldRedirectForMustChangePassword(pathname: string) {
  return isAdminPagePath(pathname) && !isAccountPagePath(pathname)
}

export function shouldRejectApiForMustChangePassword(pathname: string) {
  return isCmsApiPath(pathname) && !isChangePasswordApiPath(pathname)
}
