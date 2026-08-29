export {
  ADMIN_CAPABILITIES,
  DEFAULT_CAPABILITIES,
  hasCapability,
  roleForCapabilities,
} from "./capabilities-pure"
export type { Capability, UserRole } from "./capabilities-pure"
import {
  hasCapability,
  sanitizeCapabilities as sanitizeCapabilitiesPure,
  type Capability,
} from "./capabilities-pure"

/** Local named export so Bun `mock.module` can intercept this file on Linux CI. */
export function sanitizeCapabilities(raw: unknown): Capability[] {
  return sanitizeCapabilitiesPure(raw)
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
