import "server-only"

import { db } from "@/lib/db"
import { featureFlags } from "@/lib/db/schema"
import {
  listFlagStatuses,
  optionalOverlaysFromRows,
  siteGateHashPresentFromRows,
  type FlagStatus,
} from "./status"
import type { OptionalFlagOverrides } from "./cache"
import type { EnvMap } from "./env"

export type FeatureFlagRow = {
  key: string
  enabled: boolean
  config: Record<string, unknown>
}

export async function loadFeatureFlagRows(): Promise<FeatureFlagRow[]> {
  const rows = await db
    .select({
      key: featureFlags.key,
      enabled: featureFlags.enabled,
      config: featureFlags.config,
    })
    .from(featureFlags)
  return rows.map((row) => ({
    key: row.key,
    enabled: row.enabled,
    config: row.config ?? {},
  }))
}

export async function loadFlagStatuses(env: EnvMap = process.env): Promise<FlagStatus[]> {
  return listFlagStatuses(await loadFeatureFlagRows(), env)
}

export async function loadAdminFlagState(env: EnvMap = process.env): Promise<{
  flags: FlagStatus[]
  overlays: OptionalFlagOverrides
  siteGateHashPresent: boolean
}> {
  const rows = await loadFeatureFlagRows()
  return {
    flags: listFlagStatuses(rows, env),
    overlays: optionalOverlaysFromRows(rows),
    siteGateHashPresent: siteGateHashPresentFromRows(rows),
  }
}
