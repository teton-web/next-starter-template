import {
  ADMIN_CAPABILITIES as adminCapabilitiesFromPure,
  DEFAULT_CAPABILITIES as defaultCapabilitiesFromPure,
  hasCapability as hasCapabilityFromPure,
  roleForCapabilities as roleForCapabilitiesFromPure,
  sanitizeCapabilities as sanitizeFromPure,
  type Capability,
  type UserRole,
} from "./capabilities-pure"

export type { Capability, UserRole }

export const ADMIN_CAPABILITIES = adminCapabilitiesFromPure
export const DEFAULT_CAPABILITIES = defaultCapabilitiesFromPure

export function hasCapability(
  caps: Capability[],
  capability: Capability,
): boolean {
  return hasCapabilityFromPure(caps, capability)
}

export function roleForCapabilities(caps: Capability[]): UserRole {
  return roleForCapabilitiesFromPure(caps)
}

/** Local named export so Bun `mock.module` can intercept this file on Linux CI. */
export function sanitizeCapabilities(raw: unknown): Capability[] {
  return sanitizeFromPure(raw)
}

export async function getUserCapabilities(userId: string): Promise<Capability[]> {
  const [{ db }, { users }, { eq }] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/db/schema"),
    import("drizzle-orm"),
  ])
  const rows = await db
    .select({ capabilities: users.capabilities })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  return sanitizeCapabilities(rows[0]?.capabilities)
}

export async function checkCapability(
  userId: string,
  capability: Capability,
): Promise<boolean> {
  const caps = await getUserCapabilities(userId)
  return hasCapability(caps, capability)
}
