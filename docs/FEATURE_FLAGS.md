# Feature flags (proxy cache)

Flags live in `lib/flags/`. Resolution is shared; **where** the DB overlay comes from depends on the caller.

## Resolution (highest wins)

1. Doppler kill switch `FEATURE_<KEY>=0` (exact `"0"` only) — no database
2. Platform keys (`auth`, `admin`, `cms`, `media`, `contact`, `seo`, `analytics`, `theme`) stay on unless killed in Doppler. Admin/DB cannot turn them off
3. Optional keys: DB `enabled` when a row exists, otherwise the catalog default (off)
4. Required env still keeps a flag dark (`stripe`, `oauth`, `cron`, galleries blob on Vercel)
5. Node `isEnabled('site_gate')` also requires a stored password hash in `feature_flags.config` (`passwordHash`). Flag on + empty password stays dark. Proxy learns hash-presence from the `ff_overrides` cookie/`sgh` overlay (never Neon, never the hash bytes). When that overlay is cold, preview/prod `proxy.ts` fetches `GET /api/site-gate/public-state` `{ enforce }` (Node; no secrets) with a short TTL. Fetch failure fail-closes the gate.

`dependsOn` is a hard gate for Node `isEnabled` and `/admin/features` `enabled` (today: `scheduled_publish` requires `cron`). Admins manage flags at `/admin/features` (session + `admin`). PATCH sets `ff_overrides` for the proxy overlay.

## Node vs proxy

| Path | Module | Overlay |
| --- | --- | --- |
| Server / Route Handlers | `lib/flags/resolve.ts` `isEnabled` | Neon, through a ≤60s **per-key** in-memory cache |
| `proxy.ts` | `lib/flags/proxy-resolve.ts` `isEnabledForProxy` / `resolveProxyFlags` | **No Neon.** Catalog + Doppler + signed `ff_overrides` cookie (hydrated into isolate memory without extending TTL). Cold site-gate: `GET /api/site-gate/public-state` |

`proxy.ts` must not import `lib/db`, Drizzle, or `lib/flags/resolve.ts`. `lib/cache/public-cache.ts` is CMS tag revalidation and is not used here.

Node memory is **isolate-local**. The proxy isolate does not share it. Cross-isolate optional-flag on/off is the HMAC cookie, not the Node map.

## Cache

- Per-key in-memory overlays, TTL **30s** from that key's `issuedAt` (`FEATURE_FLAG_CACHE_TTL_MS` ≤ 60s). Writing a sibling key does not slide other keys.
- `setFeatureFlag` invalidates **after** a successful commit, then seeds the written optional key. A generation/epoch drops in-flight `isEnabled` fills that started before invalidate (including rollback: no invalidate, so no refill from a failed tx).
- Signed cookie `ff_overrides`: HMAC-SHA256 with Doppler `AUTH_SECRET` (not `SITE_GATE_PASSWORD`). Payload `exp` is `iat + TTL` (or remaining life when re-emitted). Re-signing never extends past the original `iat + TTL`.
- `resolveProxyFlags` decodes a valid cookie and overlays it (`setCachedOptionalOverrides` fills only cold keys, preserving original `iat`/`exp`).
- `encodeFeatureFlagCacheCookie` is the helper `/api/admin/features` uses after a flag save. The cookie is a **fresh** snapshot of **all** optional DB overlays (not only the mutated key), issued after `setFeatureFlag` invalidates so a stale overlay is not re-signed. Proxy re-emits remaining life when isolate memory is already warm (cookie or post-save seed); it does not mint a DB snapshot.
- Same-isolate invalidation ignores cookies issued at or before the invalidation timestamp.

## Failure mode

- Optional flags **fail closed** if the overlay is cold and Neon throws (Node caches that miss for the key's TTL so **Node** callers do not stampede Neon). Proxy never queries Neon, so it cannot absorb a Node miss cache; without a cookie it uses catalog defaults (optional off, platform on).
- Platform routes (`/login`, `/admin`) do not depend on the optional overlay; they stay up unless Doppler sets `FEATURE_AUTH=0` / `FEATURE_ADMIN=0`
- Missing `AUTH_SECRET` skips the flag cookie; flags still resolve from catalog + Doppler + (Node) memory

## Site gate

Catalog default is **off**. Local `dev` (`VERCEL_ENV` unset or `development`) is never gated.

Preview/production enforce the gate when:

- `isEnabled('site_gate')` is on (stored enabled **and** `passwordHash` present), or
- leftover Doppler `SITE_GATE_PASSWORD` is set **and** no stored hash exists (clone pull: Bill Lax, MKFF, gateway-match, inventRight)

Anonymous visitors do not need `ff_overrides`. Warm proxy overlay uses cookie/memory `hashPresent`; cold overlay fetches Node `GET /api/site-gate/public-state`. That fetch failing fail-closes (gate on) in preview/prod. Local `dev` stays ungated.

Flag off + stored hash → public. Flag on + empty password + no leftover → public. `FEATURE_SITE_GATE=0` hard-off.

Unlock compares against the scrypt hash in Node (`POST /api/site-gate`, constant-time, max 1024 chars). Leftover plaintext is compared only after a successful read shows no hash (DB errors are 503, not leftover unlock). The unlock cookie is HMAC-SHA256 with `SITE_GATE_SIGNING_SECRET` or `AUTH_SECRET`, never the typed password.

`/api/health`, `/api/site-gate/public-state`, `/api/cron/*`, `POST /api/stripe/webhook`, and static assets stay exempt.

## Stripe

Catalog default is **off**. `requiresEnv: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]` keeps the flag dark until both Doppler secrets exist (a stored-on row is not enough). Public `/pay`, `/pay/success`, `/pay/cancel`, `POST /api/stripe/checkout`, and the sitemap `/pay` entry stay hidden (`404`) unless Node `isEnabled('stripe')`. Proxy does **not** 404 `/pay` (anonymous visitors have no `ff_overrides`). `POST /api/stripe/webhook` is site-gate exempt; unsigned deliveries are always `400` (do not 404 unsigned). Valid signature + flag off returns `503` (no DB write / no products) so Stripe retries. Event ids live in `stripe_events` (`onConflictDoNothing`). One Checkout Session amount from `STRIPE_PRICE_ID` or integer `STRIPE_AMOUNT` cents + `STRIPE_CURRENCY` (no default currency). `/pay` 404s when price/amount is missing. No subscriptions, SKU catalog, or Shopify.

## Waitlist

Catalog default is **off**. Public `/waitlist`, `POST /api/waitlist`, sitemap, and the header link stay hidden (`404`) unless Node `isEnabled('waitlist')`. Proxy does **not** 404 waitlist (anonymous visitors have no `ff_overrides`). Admin `/admin/waitlist` lists entries for `admin` capability. Duplicate emails are idempotent generic success. Confirmation email is fire-and-forget after insert.

## Galleries

Catalog default is **off**. Schema (`gallery_albums` + `gallery_album_items` on `media_assets`) may exist while UI is dark. Public `/gallery`, `/gallery/[slug]`, sitemap published slugs, header link, admin `/admin/media/gallery` nav, and `/api/admin/gallery*` stay hidden (`404`) unless Node `isEnabled('galleries')`. Proxy does **not** 404 galleries (anonymous visitors have no `ff_overrides`). Draft albums 404 on the public slug; empty published albums show an empty state. Duplicate assets in one album are rejected (`409`). Publish is the public switch; starter Blob is public so publish skips private-blob promote.

## Scheduled publish

Catalog default is **off**. `dependsOn: ["cron"]` is a **hard gate**: `isEnabled('scheduled_publish')` stays false unless `cron` resolves on (which itself requires Doppler `CRON_SECRET`). `/admin/features` reports `enabled: false` and a “Requires cron” / “stays dark” reason until that is true. The admin date picker on `/admin/content/[id]` and `GET /api/cron/publish` stay hidden/404 while the flag is dark. Flag-off cron 404s **before** `requireCronSecret`. Proxy does **not** 404 CMS public routes.

Public queries and the sitemap require `status = published` and (`publish_at` is null or `publish_at <= now()`). A future `publishAt` keeps the entry `draft` or `in_review` until `GET /api/cron/publish` flips it. Unpublished preview may still show those rows to `moderate` admins.

`vercel.json` schedules the worker daily (`0 0 * * *`) so Hobby clones can deploy. Pro clones that want the 1-minute AC can change the cron to `* * * * *`. The worker is cadence-agnostic.

## Clone migration

1. Enable **Site gate** on `/admin/features` and set a password (hash at rest; never shown again).
2. Leftover `SITE_GATE_PASSWORD` is only needed while the flag row has no hash so a pull does not go public. After the hash is stored, remove it from Doppler — public-state (not leftover env) keeps anonymous preview/prod gated.
3. Cookie HMAC stays `AUTH_SECRET` / `SITE_GATE_SIGNING_SECRET`. Do not HMAC with the review password.
