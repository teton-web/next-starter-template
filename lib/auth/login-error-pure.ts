export const LOGIN_GENERIC_ERROR = "Invalid email or password"

/** OAuth callback `?error=` — same copy as a bad password; no enumeration. */
export function loginQueryErrorMessage(error: string | null | undefined): string | null {
  if (!error?.trim()) return null
  return LOGIN_GENERIC_ERROR
}
