# API auth matrix

Update this table whenever you add a Route Handler.

| Route | Auth | Notes |
| --- | --- | --- |
| `GET/POST /api/auth/[...all]` | Public (Better Auth) | `toNextJsHandler` catch-all (`sign-in/email`, password reset, optional magic-link) |
| `POST /api/admin/change-password` | Session required | Authenticated user only; bcrypt against credential account |
| `POST /api/upload` | Session required | Local disk fallback under `public/uploads` |
| `POST /api/site-gate` | Public | Sets HMAC cookie when `SITE_GATE_PASSWORD` matches |
| `GET /api/health` | Public (unauthenticated) | DB ping (`select 1`). `200 { ok: true }` when the ping succeeds; `503 { ok: false }` on error. Never includes secrets or connection strings in the JSON. Site-gate exempt in `proxy.ts` (same as static assets). |

Site gate (preview/production only) runs in `proxy.ts` before page auth. `GET /api/health` is exempt, like static assets. Cron/webhook bypasses should be added explicitly if you introduce those routes.

Capabilities (`admin` implies `moderate`) live on `users.capabilities`. Use `requireUserId` + `requireCapabilityResponse` from `lib/api/helpers.ts`.
