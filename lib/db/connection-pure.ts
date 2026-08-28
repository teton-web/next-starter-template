/** True when DATABASE_URL points at a local TCP Postgres (CI service / docker), not Neon. */
export function isLocalTcpPostgresUrl(url: string | undefined | null) {
  if (!url?.trim()) return false
  try {
    const host = new URL(url).hostname
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]"
  } catch {
    return false
  }
}
