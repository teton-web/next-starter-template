import { mock } from "bun:test"
import {
  ADMIN_CAPABILITIES,
  DEFAULT_CAPABILITIES,
  hasCapability,
  roleForCapabilities,
  sanitizeCapabilities,
  type Capability,
} from "@/lib/auth/capabilities-pure"

export {
  ADMIN_CAPABILITIES,
  DEFAULT_CAPABILITIES,
  hasCapability,
  roleForCapabilities,
  sanitizeCapabilities,
}

export const checkCapability = mock(async (_userId: string, _capability: Capability) => false)
export const getUserCapabilities = mock(async (_userId: string): Promise<Capability[]> => [])

/**
 * Full `@/lib/auth/capabilities` ESM surface for `mock.module`.
 * Bun last-wins process-wide; a partial stub drops `sanitizeCapabilities`
 * and Linux CI fails to load later files such as admin-users.test.ts.
 */
export function capabilitiesMockExports(
  overrides: {
    checkCapability?: typeof checkCapability
    getUserCapabilities?: typeof getUserCapabilities
  } = {},
) {
  return {
    ADMIN_CAPABILITIES,
    DEFAULT_CAPABILITIES,
    hasCapability,
    roleForCapabilities,
    sanitizeCapabilities,
    getUserCapabilities: overrides.getUserCapabilities ?? getUserCapabilities,
    checkCapability: overrides.checkCapability ?? checkCapability,
  }
}
