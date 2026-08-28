import "server-only"

import { eq } from "drizzle-orm"
import { auditClientMeta, writeAuditLog } from "@/lib/admin/audit"
import { db } from "@/lib/db"
import { featureFlags } from "@/lib/db/schema"
import { FLAG_CATALOG, isFlagKey, isOptionalFlagKey, isPlatformFlagKey, type FlagKey } from "./catalog"
import { invalidateFeatureFlagCache, setCachedDbEnabled } from "./cache"
import { optionalDbOverlay } from "./status"
import {
  auditSafeFlagConfig,
  hasStoredSiteGateHash,
  storedConfigWithoutSecrets,
} from "./site-gate-password"

export type SetFeatureFlagInput = {
  key: string
  enabled?: boolean
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

  const outcome = await db.transaction(async (tx) => {
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
    const previousConfig = storedConfigWithoutSecrets(previous?.config ?? {})
    const nextConfig = storedConfigWithoutSecrets(
      input.config === undefined ? previousConfig : { ...previousConfig, ...input.config },
    )
    const nextEnabled = input.enabled ?? previous?.enabled ?? definition.defaultEnabled
    if (isPlatformFlagKey(key) && nextEnabled === false) {
      throw new Error(`Platform feature ${key} cannot be turned off in the database`)
    }

    if (previous && previous.enabled === nextEnabled && jsonEqual(previousConfig, nextConfig)) {
      return { wrote: false as const, key, enabled: previous.enabled, config: previousConfig }
    }

    const updatedAt = new Date()
    await tx
      .insert(featureFlags)
      .values({
        key,
        enabled: nextEnabled,
        config: nextConfig,
        updatedAt,
        updatedByUserId,
      })
      .onConflictDoUpdate({
        target: featureFlags.key,
        set: {
          enabled: nextEnabled,
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
          new: nextEnabled,
          config: {
            old: auditSafeFlagConfig(previousConfig),
            new: auditSafeFlagConfig(nextConfig),
          },
        },
        ipAddress,
        userAgent,
      },
      tx,
    )

    return { wrote: true as const, key, enabled: nextEnabled, config: nextConfig }
  })

  if (outcome.wrote) {
    invalidateFeatureFlagCache()
    if (isOptionalFlagKey(outcome.key)) {
      setCachedDbEnabled(
        outcome.key,
        optionalDbOverlay(outcome.key, { enabled: outcome.enabled, config: outcome.config }) ?? outcome.enabled,
        {
          siteGateHashPresent:
            outcome.key === "site_gate" ? hasStoredSiteGateHash(outcome.config) : undefined,
        },
      )
    }
  }

  return { key: outcome.key, enabled: outcome.enabled, config: outcome.config }
}
