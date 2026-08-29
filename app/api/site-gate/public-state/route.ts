import { NextResponse } from "next/server"
import { isEnabled, readFlagRow } from "@/lib/flags/resolve"
import { hasStoredSiteGateHash, SITE_GATE_PASSWORD_HASH_KEY } from "@/lib/flags/site-gate-password"
import { SITE_GATE_PUBLIC_STATE_TTL_MS } from "@/lib/flags/cache"
import { shouldEnforceSiteGate, siteGateUnlockBinding } from "@/lib/site-gate"

const maxAgeSeconds = Math.max(1, Math.floor(SITE_GATE_PUBLIC_STATE_TTL_MS / 1000))

export async function GET() {
  try {
    const row = await readFlagRow("site_gate")
    const flagEnabled = await isEnabled("site_gate", {
      dbEnabled: row?.enabled ?? null,
      config: row?.config ?? {},
    })
    const hashPresent = hasStoredSiteGateHash(row?.config)
    const enforce = shouldEnforceSiteGate({
      flagEnabled,
      hashPresent,
    })
    const storedHash = row?.config?.[SITE_GATE_PASSWORD_HASH_KEY]
    const hv =
      enforce && hashPresent && typeof storedHash === "string"
        ? await siteGateUnlockBinding(storedHash)
        : ""
    return NextResponse.json(
      hv ? { enforce, hv } : { enforce },
      {
        headers: {
          "Cache-Control": `public, max-age=${maxAgeSeconds}, s-maxage=${maxAgeSeconds}`,
        },
      },
    )
  } catch {
    return NextResponse.json({ error: "Site gate unavailable." }, { status: 503 })
  }
}
