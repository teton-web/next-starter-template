import { hasCapability, sanitizeCapabilities } from "./capabilities-pure"

export const GENERIC_INVITE_ERROR = "Unable to complete this invite."

export const LAST_ADMIN_ERROR = "Cannot remove the last remaining admin."

export const WELCOME_TOKEN_TTL_MS = 48 * 60 * 60 * 1000

export const WELCOME_EMAIL_ERROR = "Unable to send welcome email."

/** Soft-delete or stripping `admin` is blocked when this user is the last active admin. */
export function wouldRemoveLastAdmin(input: {
  activeAdminCount: number
  targetIsAdmin: boolean
}): boolean {
  return input.targetIsAdmin && input.activeAdminCount <= 1
}

/** Delete or capability strip is blocked; keeping `admin` is allowed. */
export function lastAdminCapabilityChangeBlocked(input: {
  activeAdminCount: number
  targetIsAdmin: boolean
  nextIsAdmin: boolean
}): boolean {
  return (
    wouldRemoveLastAdmin({
      activeAdminCount: input.activeAdminCount,
      targetIsAdmin: input.targetIsAdmin,
    }) && !input.nextIsAdmin
  )
}

export function inviteExistingDecision(
  existing: { deletedAt?: Date | string | null } | null | undefined,
): "create" | "restore" | "reject_live" {
  if (!existing) return "create"
  return existing.deletedAt ? "restore" : "reject_live"
}

export function isAdminUser(capabilities: unknown): boolean {
  return hasCapability(sanitizeCapabilities(capabilities), "admin")
}

export function countActiveAdmins(
  users: Array<{ capabilities: unknown; deletedAt?: Date | string | null }>,
): number {
  return users.filter((user) => !user.deletedAt && isAdminUser(user.capabilities)).length
}
