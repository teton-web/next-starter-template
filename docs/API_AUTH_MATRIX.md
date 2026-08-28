# API auth matrix

Update this table whenever you add a Route Handler.

| Route | Auth | Notes |
| --- | --- | --- |
| `GET/POST /api/auth/[...all]` | Public (Better Auth) | `toNextJsHandler` catch-all (`sign-in/email`, password reset, optional magic-link) |
| `POST /api/admin/change-password` | Session required | Authenticated user only; bcrypt against credential account |
| `POST /api/upload` | Session required | Local disk fallback under `public/uploads` |
| `POST /api/site-gate` | Public | Sets HMAC cookie when `SITE_GATE_PASSWORD` matches |
| `GET /api/health` | Public (unauthenticated) | DB ping (`select 1`). `200 { ok: true }` when the ping succeeds; `503 { ok: false }` on error. Never includes secrets or connection strings in the JSON. Site-gate exempt in `proxy.ts` (same as static assets). |
| `GET/POST /api/admin/users` | Session + `admin` capability | Invite-only. POST `{ email, name, capabilities }` → 201 `{ id, email, name, capabilities, emailSent, setPasswordUrl? }`. `mustChangePassword` true. Welcome email when Resend is configured (`emailSent: true`, no URL). When email is skipped, 201 includes `setPasswordUrl` and `/admin/users` shows a copyable link. Missing origin is 500. Generic error on duplicate email (no enumeration). Modest rate limit on POST. |
| `PATCH /api/admin/users/:id` | Session + `admin` capability | `{ capabilities }` (sanitized) or `{ deletedAt: true }`. Cannot strip/soft-delete the last remaining admin. |
| `GET /api/admin/audit` | Session + `admin` capability | Paginated newest-first audit log (`limit`/`offset`). Read-only; no create/update/delete. |
| `GET/PATCH /api/admin/features` | Session + `admin` capability | Catalog list with resolved state, kill-switch / missing-key / dependency reasons. PATCH `{ key, enabled?, password? }`. Platform cannot be turned off. `FEATURE_<KEY>=0` rejects `enabled: true` (409); password-only / config updates still persist. Site-gate password is scrypt-hashed into `config.passwordHash`; GET and audit metadata never return password or hash. PATCH `Set-Cookie: ff_overrides` is a snapshot of all optional DB overlays. |
| `GET/POST /api/admin/cms` | Session + `moderate` (admin implies moderate) | List/create CMS entries. |
| `GET/PATCH/DELETE /api/admin/cms/:id` | Session + `moderate` | Load entry + revisions; save/publish/unpublish; hard-delete drafts only. |
| `POST /api/admin/cms/:id/restore` | Session + `moderate` | `{ revisionId }` copies title/slug/excerpt/body/hero into the working draft, forces `draft` (does not republish; `publishedAt` is live-at, not restored), writes a **new** revision, never deletes old ones. Audited as `update` with restore metadata. |

Site gate (preview/production only) runs in `proxy.ts` before page auth. `GET /api/health` is exempt, like static assets. Cron/webhook bypasses should be added explicitly if you introduce those routes.

Capabilities (`admin` implies `moderate`) live on `users.capabilities`. Use `requireUserId` + `requireCapabilityResponse` from `lib/api/helpers.ts`.
