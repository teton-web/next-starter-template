import { NextResponse } from "next/server"
import { z } from "zod"
import { jsonOk, parseJson, requireCapabilityResponse, requireUserId } from "@/lib/api/helpers"
import { errorResponse, HttpError } from "@/lib/api/http-error"
import { isFlagKey, isPlatformFlagKey, type FlagKey } from "@/lib/flags/catalog"
import {
  FEATURE_FLAG_CACHE_COOKIE,
  FEATURE_FLAG_CACHE_TTL_MS,
  encodeFeatureFlagCacheCookie,
  featureFlagCacheCookieAttrs,
  type OptionalFlagOverrides,
} from "@/lib/flags/cache"
import { isFeatureHardOff } from "@/lib/flags/env"
import { loadAdminFlagState } from "@/lib/flags/list"
import { setFeatureFlag } from "@/lib/flags/mutate"
import { hashSiteGatePassword } from "@/lib/flags/site-gate-password"
import { killSwitchReason } from "@/lib/flags/status"

const patchSchema = z
  .object({
    key: z.string().min(1),
    enabled: z.boolean().optional(),
    password: z.string().max(1024).optional(),
  })
  .refine((value) => value.enabled !== undefined || (value.password?.trim().length ?? 0) > 0, {
    message: "Provide enabled or password",
  })

async function requireAdmin() {
  const userId = await requireUserId()
  if (userId instanceof Response) return userId
  const allowed = await requireCapabilityResponse(userId, "admin")
  if (allowed instanceof Response) return allowed
  return userId
}

function mapMutateError(error: unknown): never {
  if (error instanceof Error) {
    if (error.message.startsWith("Platform feature")) {
      throw new HttpError(400, error.message)
    }
    if (error.message.startsWith("Unknown feature flag")) {
      throw new HttpError(422, error.message)
    }
  }
  throw error
}

async function attachFlagOverrideCookie(response: NextResponse, overlays: OptionalFlagOverrides) {
  const now = Date.now()
  const encoded = await encodeFeatureFlagCacheCookie(overlays, { now })
  if (!encoded) return response
  response.cookies.set(
    FEATURE_FLAG_CACHE_COOKIE,
    encoded,
    featureFlagCacheCookieAttrs(now + FEATURE_FLAG_CACHE_TTL_MS, now),
  )
  return response
}

export async function GET() {
  try {
    const auth = await requireAdmin()
    if (auth instanceof Response) return auth
    const { flags } = await loadAdminFlagState()
    return jsonOk({ flags })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const actorUserId = await requireAdmin()
    if (actorUserId instanceof Response) return actorUserId

    const parsed = await parseJson(request, patchSchema)
    if (parsed instanceof Response) return parsed

    if (!isFlagKey(parsed.key)) {
      throw new HttpError(422, `Unknown feature flag: ${parsed.key}`)
    }

    const key: FlagKey = parsed.key
    if (isPlatformFlagKey(key) && parsed.enabled === false) {
      throw new HttpError(400, `Platform feature ${key} cannot be turned off in the database`)
    }

    if (parsed.enabled === true && isFeatureHardOff(key)) {
      throw new HttpError(409, killSwitchReason(key))
    }

    const password = parsed.password?.trim() ?? ""
    if (password && key !== "site_gate") {
      throw new HttpError(422, "password is only valid for site_gate")
    }

    let config: Record<string, unknown> | undefined
    if (key === "site_gate" && password) {
      config = { passwordHash: await hashSiteGatePassword(password) }
    }

    let saved: { key: FlagKey; enabled: boolean; config: Record<string, unknown> }
    try {
      saved = await setFeatureFlag({
        key,
        enabled: parsed.enabled,
        config,
        actorUserId,
        request,
      })
    } catch (error) {
      mapMutateError(error)
    }

    const { flags, overlays } = await loadAdminFlagState()
    const flag = flags.find((item) => item.key === saved.key) ?? flags[0]
    const response = jsonOk({ flag, flags })
    return attachFlagOverrideCookie(response, overlays)
  } catch (error) {
    return errorResponse(error)
  }
}
