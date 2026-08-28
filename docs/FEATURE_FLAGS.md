# Feature flags (proxy cache)

Flags live in `lib/flags/`. Resolution is shared; **where** the DB overlay comes from depends on the caller.

## Resolution (highest wins)

1. Doppler kill switch `FEATURE_<KEY>=0` (exact `"0"` only) — no database
2. Platform keys (`auth`, `admin`, `cms`, `media`, `contact`, `seo`, `analytics`, `theme`) stay on unless killed in Doppler. Admin/DB cannot turn them off
3. Optional keys: DB `enabled` when a row exists, otherwise the catalog default (off)
4. Required env still keeps a flag dark (`stripe`, `oauth`, `cron`, galleries blob on Vercel)

`dependsOn` is catalog metadata only; it is not walked.

## Node vs proxy

| Path | Module | Overlay |
| --- | --- | --- |
| Server / Route Handlers | `lib/flags/resolve.ts` `isEnabled` | Neon, through a ≤60s **per-key** in-memory cache |
| `proxy.ts` | `lib/flags/proxy-resolve.ts` `isEnabledForProxy` / `resolveProxyFlags` | **No Neon.** Catalog + Doppler + signed `ff_overrides` cookie (hydrated into isolate memory without extending TTL) |

`proxy.ts` must not import `lib/db`, Drizzle, or `lib/flags/resolve.ts`. `lib/cache/public-cache.ts` is CMS tag revalidation and is not used here.

Node memory is **isolate-local**. The proxy isolate does not share it. Cross-isolate optional-flag on/off is the HMAC cookie, not the Node map.

## Cache

- Per-key in-memory overlays, TTL **30s** from that key's `issuedAt` (`FEATURE_FLAG_CACHE_TTL_MS` ≤ 60s). Writing a sibling key does not slide other keys.
- `setFeatureFlag` invalidates **after** a successful commit, then seeds the written optional key. A generation/epoch drops in-flight `isEnabled` fills that started before invalidate (including rollback: no invalidate, so no refill from a failed tx).
- Signed cookie `ff_overrides`: HMAC-SHA256 with Doppler `AUTH_SECRET` (not `SITE_GATE_PASSWORD`). Payload `exp` is `iat + TTL` (or remaining life when re-emitted). Re-signing never extends past the original `iat + TTL`.
- `resolveProxyFlags` decodes a valid cookie and overlays it (`setCachedOptionalOverrides` fills only cold keys, preserving original `iat`/`exp`).
- `encodeFeatureFlagCacheCookie` is the helper POR-381 should `Set-Cookie` after a flag save. Proxy re-emits remaining life when isolate memory is already warm (cookie or post-save seed); it does not mint a DB snapshot.
- Same-isolate invalidation ignores cookies issued at or before the invalidation timestamp.

## Failure mode

- Optional flags **fail closed** if the overlay is cold and Neon throws (Node caches that miss for the key's TTL so **Node** callers do not stampede Neon). Proxy never queries Neon, so it cannot absorb a Node miss cache; without a cookie it uses catalog defaults (optional off, platform on).
- Platform routes (`/login`, `/admin`) do not depend on the optional overlay; they stay up unless Doppler sets `FEATURE_AUTH=0` / `FEATURE_ADMIN=0`
- Missing `AUTH_SECRET` skips the flag cookie; flags still resolve from catalog + Doppler + (Node) memory

## Site-gate HMAC (POR-383)

Site-gate cookies today still HMAC with the typed `SITE_GATE_PASSWORD`. When that password moves to the database, cookie HMAC must use a Doppler signing secret (`AUTH_SECRET` or `SITE_GATE_SIGNING_SECRET`), not the password. This file does not change site-gate product UX.
