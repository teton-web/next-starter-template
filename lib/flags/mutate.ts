import "server-only"

import { eq } from "drizzle-orm"
import { auditClientMeta, writeAuditLog } from "@/lib/admin/audit"
import { db } from "@/lib/db"
import { featureFlags } from "@/lib/db/schema"
import { FLAG_CATALOG, isFlagKey, isPlatformFlagKey, type FlagKey } from "./catalog"

export type SetFeatureFlagInput = {
  key: string
  enabled: boolean
  config?: Record<string, unknown>
  actorUserId?: string | null
  request?: Request | { headers?: Headers | null } | null
}

function stableJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJson)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableJson(nested)]),
    )
  }
  return value
}

function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(stableJson(left)) === JSON.stringify(stableJson(right))
}

export async function setFeatureFlag(input: SetFeatureFlagInput): Promise<{
  key: FlagKey
  enabled: boolean
  config: Record<string, unknown>
}> {
  if (!isFlagKey(input.key)) {
    throw new Error(`Unknown feature flag: ${input.key}`)
  }

  const key = input.key
  if (isPlatformFlagKey(key) && input.enabled === false) {
    throw new Error(`Platform feature ${key} cannot be turned off in the database`)
  }

  const definition = FLAG_CATALOG[key]
  const { ipAddress, userAgent } = auditClientMeta(input.request)
  const updatedByUserId = input.actorUserId ?? null

  return db.transaction(async (tx) => {
    const existing = await tx
      .select({
        enabled: featureFlags.enabled,
        config: featureFlags.config,
      })
      .from(featureFlags)
      .where(eq(featureFlags.key, key))
      .limit(1)
      .for("update")

    const previous = existing[0]
    const previousConfig = previous?.config ?? {}
    const nextConfig = input.config ?? previousConfig

    if (previous && previous.enabled === input.enabled && jsonEqual(previousConfig, nextConfig)) {
      return { key, enabled: previous.enabled, config: previousConfig }
    }

    const updatedAt = new Date()
    await tx
      .insert(featureFlags)
      .values({
        key,
        enabled: input.enabled,
        config: nextConfig,
        updatedAt,
        updatedByUserId,
      })
      .onConflictDoUpdate({
        target: featureFlags.key,
        set: {
          enabled: input.enabled,
          config: nextConfig,
          updatedAt,
          updatedByUserId,
        },
      })

    await writeAuditLog(
      {
        actorUserId: updatedByUserId,
        action: previous ? "update" : "create",
        entityType: "feature_flag",
        entityId: key,
        metadata: {
          key,
          old: previous?.enabled ?? definition.defaultEnabled,
          new: input.enabled,
          config: { old: previousConfig, new: nextConfig },
        },
        ipAddress,
        userAgent,
      },
      tx,
    )

    return { key, enabled: input.enabled, config: nextConfig }
  })
}
