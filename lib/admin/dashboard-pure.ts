const DEFAULT_MESSAGE_LIMIT = 120

export function truncateMessage(
  message: string,
  maxLength = DEFAULT_MESSAGE_LIMIT,
): string {
  const normalized = message.replace(/\s+/g, " ").trim()
  if (maxLength < 1 || normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`
}

export function formatDashboardDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC")
}

const SELF_USER_AUDIT_ACTIONS = new Set(["login", "logout"])

export function formatAuditSummary(log: {
  action: string
  entityType: string | null
  entityId: string | null
  actorEmail: string | null
}): string {
  const omitUserId =
    log.entityType === "user" &&
    Boolean(log.actorEmail) &&
    SELF_USER_AUDIT_ACTIONS.has(log.action)
  const entity = omitUserId
    ? ""
    : [log.entityType, log.entityId].filter(Boolean).join(" ")
  const actor = log.actorEmail ?? "system"
  return entity ? `${log.action} ${entity} · ${actor}` : `${log.action} · ${actor}`
}
