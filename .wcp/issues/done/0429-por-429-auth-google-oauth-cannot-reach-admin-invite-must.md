---
id: "0429"
title: "[Auth] Google OAuth cannot reach /admin — invite mustChangePassword trap"
status: done
priority: high
assignee:
lease_expires:
scope: "Imported from Linear POR-429. Stay inside that description."
acceptance: "Implementer contract"
files: []
commit:
reason:
created: "2026-08-29T18:11:30.707Z"
linear_id: "POR-429"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-429/auth-google-oauth-cannot-reach-admin-invite-mustchangepassword-trap"
linear_status: "Done"
linear_status_type: "completed"
linear_team: "POR"
linear_project: "next-starter-template"
linear_assignee: "David Solheim <david@tetonweb.com>"
linear_labels: ["Bug"]
linear_priority: "High"
linear_parent: ""
linear_cycle: ""
linear_due: ""
linear_updated: "2026-08-30T02:08:26.667Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-429
- URL: https://linear.app/teton-web-ventures/issue/POR-429/auth-google-oauth-cannot-reach-admin-invite-mustchangepassword-trap
- Linear status: Done (completed)
- Queue status: done
- Team: Portfolio (POR)
- Project: next-starter-template
- Assignee: David Solheim <david@tetonweb.com>
- Labels: Bug
- Parent: none
- Priority: High
- Estimate: none
- Cycle: none
- Due: none
- Created: 2026-08-29T18:11:30.707Z
- Updated: 2026-08-30T02:08:26.667Z
- Completed: 2026-08-30T02:08:26.645Z
- Canceled: no
- Archived: no
- Branch: david/por-429-auth-google-oauth-cannot-reach-admin-invite

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

## Implementer contract

* You are implementing **this ticket only** (not [POR-394](https://linear.app/teton-web-ventures/issue/POR-394/add-optional-google-oauth-on-better-auth-behind-oauth-flag), not invite/welcome, not magic-link). Do not expand scope.
* Prefer the **step-by-step plan** and **file-by-file changes** below over inventing a new design.
* **Mandatory approach:** on a successful **Google** session create, clear `users.mustChangePassword` (email already proven by Google). Do **not** add a first-time set-password path that skips `currentPassword` on `POST /api/admin/change-password`.
* Before coding: run the **Drift check**. If anchors still match, do **not** re-research the whole area — implement.
* If drift broke the plan (paths/symbols gone), stop and report; do not freestyle a rewrite.
* Smallest complete change that meets **Acceptance criteria**. Mirror existing patterns; do not introduce new libraries or architectural layers unless this ticket says so.
* Never commit secrets, `.env` values, or real credentials.

## Intensity

* Band: **standard**
* Why: isolated Google session-create clearer + pure path helper + unit/source tests; no schema/migration; credential first-login gate stays
* Proof: on

Intensity: standard

## Summary

`docs/FEATURE_FLAGS.md` tells clones to sign in at `/login` with a Google account whose email matches a seed/invite user and confirm they land in `/admin` as that same user. Invite `POST /api/admin/users` always writes `mustChangePassword: true` plus a **random** bcrypt credential the invitee never sees. Google linking succeeds (`validateUserInfo` + `disableSignUp`), but `session.create` only blocks deleted users and writes a login audit — it never clears the flag. Proxy then redirects every `/admin` HTML request except `/admin/account` to the change-password form. That form requires `currentPassword` against the random hash, so an invited Google user is stuck. Credential `onPasswordReset` is the only clearer today. `tests/auth-oauth.test.ts` never exercises `mustChangePassword`; helper 404/`disableSignUp` tests must not be treated as proof the invite user reaches `/admin`.

## User report

> Filed by `/prb` Phase 1.5 exhaustive review after [POR-410](https://linear.app/teton-web-ventures/issue/POR-410/gallery-csp-blocks-vercel-blob-media-on-public-album-pages)/411/426.
>
> Problem (P1 / High): docs/FEATURE_FLAGS.md Google OAuth manual check says: sign in at `/login` with a Google account whose email matches the seed/invite user; confirm you land in `/admin` as that same user.
>
> Invite POST always writes `mustChangePassword: true` plus a random bcrypt credential (`app/api/admin/users/route.ts`). Google linking succeeds (`validateUserInfo` + `disableSignUp`) but `session.create` in `lib/auth.ts:246-266` only blocks deleted users / writes login audit — it never clears `mustChangePassword`. Proxy then sends every `/admin` HTML request except `/admin/account` to the password form. `POST /api/admin/change-password` requires `currentPassword` matched against that random hash (invite always inserts a credential). The invited user cannot know that password. Credential `onPasswordReset` is the only clearer. `tests/auth-oauth.test.ts` never exercises `mustChangePassword`.
>
> Suggested fix: clear `mustChangePassword` on successful Google link/session (email already proven), or allow a first-time set without current password. Do not treat helper 404/`disableSignUp` tests as proof the invite user reaches `/admin`.
>
> Related [POR-394](https://linear.app/teton-web-ventures/issue/POR-394/add-optional-google-oauth-on-better-auth-behind-oauth-flag). Priority High (2). Type: bug.

## Current behavior

1. Admin invites `{ email, name, capabilities }` → `POST /api/admin/users` inserts/restores the user with `mustChangePassword: true` and a credential whose password is `bcrypt.hash(randomBytes(32).toString("hex"), 10)` (never shown in the 201 body).
2. Welcome email / `setPasswordUrl` can later clear the flag via Better Auth `onPasswordReset`. If the invitee instead uses **Continue with Google** on `/login` with that same email, linking succeeds and a session is created for the existing user id.
3. `session.create.before` only returns `false` when `isAccountBlocked`. `session.create.after` only writes `action: "login"` audit. Flag stays `true`.
4. Callback redirects to `callbackURL` (default `/admin`). `proxy.ts` sees `session.user.mustChangePassword === true` and `shouldRedirectForMustChangePassword("/admin") === true` → 302 to `/admin/account`.
5. `/admin/account` always requires Current password. `POST /api/admin/change-password` 400s `Current password is incorrect` unless bcrypt matches that random hash. Invitee cannot proceed. Admin APIs except change-password 403 `Password change required.`
6. Seed users *might* complete the form if they still know `SEED_ADMIN_PASSWORD`, but the documented check (“land in `/admin`”) still fails — they land on `/admin/account`.

* Evidence: `app/api/admin/users/route.ts` (`POST`, ~L94–177) — random hash + `mustChangePassword: true` on insert and restore
* Evidence: `lib/auth.ts` (`onPasswordReset`, ~L160–168) — only clearer today; (`session.create`, ~L246–266) — no flag write
* Evidence: `proxy.ts` (~L123–131) + `lib/auth/must-change-password-pure.ts` (`shouldRedirectForMustChangePassword`)
* Evidence: `app/api/admin/change-password/route.ts` (~L23–38) — requires current bcrypt
* Evidence: `app/admin/account/page.tsx` (~L54–72) — Current password field always required
* Evidence: `docs/FEATURE_FLAGS.md` (`## Google OAuth`, ~L80–84) — manual check claims `/admin`
* Evidence: `tests/auth-oauth.test.ts` — no `mustChangePassword` string; link/id tests stop at `kind: "link"`

## Expected behavior

* After a **successful Google** sign-in/link for a live invited or seeded user, `users.mustChangePassword` is `false` before the next `/admin` HTML request is gated.
* That user lands on `/admin` (or the safe `callbackUrl`) as the **same user id**, not `/admin/account`.
* Credential email/password login with `mustChangePassword: true` still redirects to `/admin/account` and still requires `currentPassword`.
* Magic-link, invite POST, welcome email, and `onPasswordReset` stay as they are.
* Unknown Google emails still cannot sign up. Soft-deleted users still cannot authenticate. Flag-off Google still 404s.
* Non-goals: skip-current-password on the account form; dropping the random credential on invite; disabling the first-login gate for password logins; GitHub OAuth.

## Suspected root cause / scope

**Confirmed: **[POR-394](https://linear.app/teton-web-ventures/issue/POR-394/add-optional-google-oauth-on-better-auth-behind-oauth-flag) wired Google as invite/seed-only (`disableSignUp` + `validateUserInfo` + account linking) and documented “land in `/admin`”, but left the [TW-1635](https://linear.app/teton-web-ventures/issue/TW-1635/starter-login-rate-limits-first-login-password-change-magic-link-ui)/[TW-1652](https://linear.app/teton-web-ventures/issue/TW-1652/starter-clear-mustchangepassword-after-email-password-reset) first-login gate (`mustChangePassword`) in place. Invite always creates a credential the Google user does not know. Session create never clears the flag (unlike `onPasswordReset`).

Better Auth `databaseHooks.session.create.after` receives `context.path` (see `better-auth` `last-login-method` plugin: `/callback/<provider>`). This starter does **not** enable `session.cookieCache`, so `auth.api.getSession` in proxy reads the user row from Neon after the after-hook. Clearing the column in `session.create.after` is enough for the subsequent `/admin` navigation.

Scope: Google session-create path only + tests + one FEATURE_FLAGS sentence. Leave invite, change-password, and proxy helpers alone.

## Code map

| Path | Role | Symbols / notes |
| -- | -- | -- |
| `lib/auth.ts` | **Primary fix** | `onPasswordReset` ~L160–168 (mirror); `session.create.before/after` ~L246–266; `validateUserInfo` ~L207–215 |
| `lib/auth/google-oauth.ts` | Pure helpers to extend | `normalizePath`, `isGoogleOAuthAuthPath`, `GOOGLE_OAUTH_PROVIDER`; add session-create detector |
| `app/api/admin/users/route.ts` | Why the trap exists | `hashedPassword = await bcrypt.hash(randomBytes(32)...` ~L95; insert/restore `mustChangePassword: true` ~L139, ~L151; credential insert ~L169–176 |
| `app/api/admin/change-password/route.ts` | Why invitee cannot escape | `bodySchema.currentPassword` min 1; bcrypt compare; 400 “Current password is incorrect” |
| `proxy.ts` | Gate | `session.user.mustChangePassword` + `shouldRedirectForMustChangePassword` ~L123–131 |
| `lib/auth/must-change-password-pure.ts` | Path math (do not change) | `shouldRedirectForMustChangePassword`, `shouldRejectApiForMustChangePassword` |
| `app/admin/account/page.tsx` | UI trap | Current password always required ~L61–72 |
| `lib/auth-client.ts` | Google start | `signInGoogle` → `signIn.social({ provider: "google", callbackURL })` |
| `lib/db/schema/users.ts` | Column | `mustChangePassword` / `must_change_password` default false |
| `docs/FEATURE_FLAGS.md` | Lying manual check | `## Google OAuth` ~L80–84 |
| `tests/auth-oauth.test.ts` | **Must extend** | availability, decisions, routes, wiring; no flag coverage today |
| `tests/source-invariants.test.ts` | Pin the clearer | `onPasswordReset` test ~L246–267 is the mirror; add Google session.create pin |
| `tests/auth-config.test.ts` | Existing auth source | already pins `onPasswordReset` + Google wiring |
| `tests/api-helpers.test.ts` | Proxy path gates | keep; do not weaken |

Primary package/app: repo-root Next.js 16 App Router (`next-starter-template`)
Owning monorepo path: N/A — single Next app

## Relevant contracts (types / APIs / data)

* **Types: **`GoogleOAuthOutcome` `{ ok: true; kind: "link"; userId }` already means “existing live user”. New helper should be a boolean on Better Auth `context.path` (+ optional `body.provider` for `/sign-in/social`).
* **Better Auth paths** (no `/api/auth` prefix on `context.path`, matching `last-login-method`): `/callback/google`, `/sign-in/social` with `body.provider === "google"`. Do **not** match `/sign-in/email`, `/magic-link/verify`, `/reset-password`.
* **API / route: **`POST /api/admin/change-password` stays `{ currentPassword, newPassword }` — no optional current password. Invite `POST /api/admin/users` still sets `mustChangePassword: true` at insert time (credential first login must stay gated).
* **DB:** table `users`, column `must_change_password`. Update `{ mustChangePassword: false, updatedAt }` where `id = session.userId` AND `deletedAt IS NULL`. No migration.
* **Env / flags (names only):** optional flag `oauth`; `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. `FEATURE_OAUTH=0` still fail-closed. Never paste values.
* **Auth: **`disableSignUp` stays. Session cookie cache is **not** enabled in this starter (`cookieCache` absent in `lib/auth.ts`); do not enable it here. If drift later enables cookie cache, the clearer must run before the user payload is snapshotted — call that out, do not add cookie cache in this ticket.

## Code anchors (excerpts)

### `lib/auth.ts` — `onPasswordReset` (mirror, ~L160–168)

```ts
onPasswordReset: async ({ user }) => {
  await db
    .update(schema.users)
    .set({
      mustChangePassword: false,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.users.id, user.id), isNull(schema.users.deletedAt)))
},
```

Copy this update (same `set` + `deletedAt` guard). Trigger it from Google session create, not from password reset.

### `lib/auth.ts` — `session.create` (today, ~L246–266)

```ts
session: {
  create: {
    before: async (session) => {
      if (await isAccountBlocked(session.userId)) {
        return false
      }
      return { data: session }
    },
    after: async (session, context) => {
      const meta = auditClientMeta(context?.request, {
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      })
      await writeAuditLogSafe({ /* action: "login" … */ })
    },
  },
},
```

After the audit write (or immediately before it), if `shouldClearMustChangePasswordOnSession({ path: context?.path, bodyProvider })`, run the `onPasswordReset`-style update for `session.userId`. Do not clear on credential/magic-link paths.

### `app/api/admin/users/route.ts` — invite credential (~L94–95, ~L151)

```ts
const hashedPassword = await bcrypt.hash(randomBytes(32).toString("hex"), 10)
// …
mustChangePassword: true,
```

Leave this. Google must not require that hash.

### Pattern to mirror

* **Mirror: **`lib/auth.ts` `emailAndPassword.onPasswordReset` — same Drizzle update + `isNull(deletedAt)`.
* **Mirror: **`lib/auth/google-oauth.ts` `isGoogleOAuthAuthPath` / `normalizePath` — put the new detector next to those helpers; unit-test it in `tests/auth-oauth.test.ts` like `decideGoogleOAuthSignIn`.
* **Mirror:** Better Auth `last-login-method` (`node_modules/better-auth/dist/plugins/last-login-method/index.mjs`) — `context.path.startsWith("/callback/")` and `/sign-in/email`. Do **not** add that plugin.
* **Why:** cheapest lock that Google session is the only new clearer; credential first-login stays.

## Step-by-step implementation plan

Recommended approach is **mandatory** unless drift proves Google session create no longer uses `databaseHooks.session.create.after`.

1. In `lib/auth/google-oauth.ts`, add a pure helper (names can match; behavior must):
   * Treat Better Auth `context.path` as Google session-create when normalized path is `/callback/google` or ends with `/callback/google`.
   * Also true when normalized path is `/sign-in/social` (or ends with it) **and **`bodyProvider === "google"` (idToken / social POST).
   * False for `/sign-in/email`, `/magic-link/verify`, `/reset-password`, `/callback/github`, empty/undefined path, `/sign-in/social` with missing/other provider.
   * Reuse existing `normalizePath` (strip query, strip trailing slash).
2. In `lib/auth.ts` `session.create.after`, after the existing login audit (keep audit even when clearing):
   * Read `context?.path` and `context?.body?.provider` defensively (string only).
   * If the helper is true, `db.update(schema.users).set({ mustChangePassword: false, updatedAt: new Date() }).where(and(eq(schema.users.id, session.userId), isNull(schema.users.deletedAt)))` — same as `onPasswordReset`.
   * Do not change `session.create.before`.
3. Do **not** edit `app/api/admin/change-password/route.ts` or `/admin/account` to allow empty `currentPassword`.
4. Tests (see Test plan): unit the helper; source-pin `session.create.after` uses the helper + `mustChangePassword: false`; pin `/sign-in/email` is not a clear path; keep existing 404/`disableSignUp` tests **and** add an explicit comment or test name that they are **not** the `/admin` landing proof.
5. `docs/FEATURE_FLAGS.md` Google OAuth section: keep the manual check; add that a successful Google sign-in clears `mustChangePassword` so invite/seed users land in `/admin` without knowing the invite random password. One or two sentences, not a new section.
6. Run Verification commands.

## File-by-file changes

| Path | Action | What to change |
| -- | -- | -- |
| `lib/auth/google-oauth.ts` | edit | Add `shouldClearMustChangePasswordOnSession` (or equivalent) using `normalizePath` |
| `lib/auth.ts` | edit | `session.create.after`: if helper, clear flag like `onPasswordReset`; keep login audit |
| `tests/auth-oauth.test.ts` | edit test | Helper true/false cases; source pin that `session.create.after` (not `before`) contains the helper + `mustChangePassword: false`; `/sign-in/email` must not clear |
| `tests/source-invariants.test.ts` | edit test | Extend the existing `onPasswordReset` pin **or** add a sibling test that Google session after-hook clears the flag and email sign-in hook does not |
| `docs/FEATURE_FLAGS.md` | edit | One/two sentences under `## Google OAuth` that Google session clears `mustChangePassword` so the manual `/admin` check is true |
| `app/api/admin/users/route.ts` | do not touch | Invite still sets the flag + random credential |
| `app/api/admin/change-password/route.ts` | do not touch | Current password still required |
| `proxy.ts` / `lib/auth/must-change-password-pure.ts` | do not touch | Gate stays; Google users simply won't have the flag |
| `app/admin/account/page.tsx` | do not touch |  |

## Do not touch / out of scope

* First-time set-password without `currentPassword` (rejected alternative)
* Stopping invite from inserting a credential or from setting `mustChangePassword: true`
* Magic-link clearing `mustChangePassword` (separate product decision)
* Enabling Better Auth `session.cookieCache`
* Public signup, GitHub OAuth, `disableSignUp` / `disableImplicitSignUp`
* Soft-delete / `isAccountBlocked` behavior
* Feature-flag resolution, proxy Neon rules, CSP ([POR-410](https://linear.app/teton-web-ventures/issue/POR-410/gallery-csp-blocks-vercel-blob-media-on-public-album-pages)/411), media crop ([POR-426](https://linear.app/teton-web-ventures/issue/POR-426/media-unused-crop-replace-overwrites-blob-pathname-cdn-hides-crop))
* `scripts/seed-admin.ts` first-login for credential seed (still true unless `SEED_ADMIN_MUST_CHANGE_PASSWORD=false`); Google login of that seed email **should** clear via this ticket
* No drive-by renames, dependency upgrades, or formatting-only sweeps

## Acceptance criteria

- [ ] Successful Google OAuth session for a live invited/seeded user sets `users.mustChangePassword` to `false` (and does not touch `deletedAt`)
- [ ] Next `/admin` HTML navigation is **not** redirected to `/admin/account` solely because of that flag
- [ ] Same user id as the invite/seed row (no new user); unknown Google email still cannot create an account
- [ ] Credential `POST /sign-in/email` with `mustChangePassword: true` still hits `/admin/account` and `POST /api/admin/change-password` still requires a correct `currentPassword`
- [ ] Soft-deleted Google emails still fail with the generic invalid-password public error; no session, no flag write needed
- [ ] Flag-off / missing keys: no Google button; `/api/auth/callback/google` and `/api/auth/sign-in/social` still 404
- [ ] Helper 404 / `disableSignUp` / `kind: "link"` unit tests remain, but new tests prove the **flag clearer** — they are not a substitute for `/admin` landing
- [ ] `docs/FEATURE_FLAGS.md` Google manual check matches this behavior
- [ ] Verification commands in this ticket pass

## Test plan

**Automated (prefer):**

* File: `tests/auth-oauth.test.ts`
* Cases:
  * `shouldClearMustChangePasswordOnSession({ path: "/callback/google" }) === true`
  * `{ path: "/callback/google/" } === true` (normalize trailing slash)
  * `{ path: "/api/auth/callback/google" } === true` if `endsWith` is used (proxy/route path vs Better Auth path — helper should accept **both** so a future ctx.path change cannot silently skip the clearer)
  * `{ path: "/sign-in/social", bodyProvider: "google" } === true`
  * `{ path: "/sign-in/social" }` without provider === false
  * `{ path: "/sign-in/email" } === false`
  * `{ path: "/magic-link/verify" } === false`
  * `{ path: "/callback/github" } === false`
  * `{ path: undefined } === false`
  * Source: `lib/auth.ts` `session.create.after` body contains the helper name and `mustChangePassword: false`; `session.create.before` still has no `mustChangePassword`
  * Existing `kind: "link"` / 404 / unknown-email tests still pass and are **not** renamed as `/admin` landing proof
* File: `tests/source-invariants.test.ts`
  * Keep `onPasswordReset` clearer pin
  * Add/extend: Google session after-hook clears; email password reset still clears; invite POST still writes `mustChangePassword: true`
* Regression: `bun test tests/auth-config.test.ts` `tests/api-helpers.test.ts` `tests/admin-users.test.ts`

**Manual:**

1. Preconditions: Doppler `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`; enable **Google OAuth** on `/admin/features`. Invite (or use seed) a user whose Gmail matches. Do **not** use the welcome set-password link.
2. Sign out. `/login` → **Continue with Google** → that Gmail.
3. Expected: land on `/admin` (dashboard), same email/user id. **Not **`/admin/account`. Neon: `must_change_password = false`.
4. Invite a second user; sign in with **email/password** is impossible without the random hash — use the set-password URL instead; that flow still clears via `onPasswordReset` (regression).
5. Seed admin credential login with `mustChangePassword: true` still forced to `/admin/account`.
6. Unknown Gmail still no new row. Flag off: button gone, callback 404.

## Verification

* `bun run typecheck`
* `bun test tests/auth-oauth.test.ts`
* `bun test tests/auth-config.test.ts`
* `bun test tests/source-invariants.test.ts`
* `bun test tests/api-helpers.test.ts`
* `bun test tests`
* Manual: Test plan (Google invite/seed → `/admin`, not `/admin/account`)

### Runtime proof (`/solve` / `/prb` drive this — not a new slash)

* Surface: Google callback → `/admin` for an invited user with `mustChangePassword: true` and a random credential.
* Observed end state: `users.must_change_password` is false; HTML `/admin` 200 (or app dashboard), not 302 to `/admin/account`. If live Google cannot be driven, unit helper + source pin + a mocked `session.create.after` update (if you add one) are the minimum; record **unproven** for live Google navigation if not driven. Do **not** treat 404/`SIGNUP_DISABLED` tests as that proof.

## Drift check (before implementing)

Re-verify these anchors; if they still match, **skip full re-investigation** and implement:

- [ ] `lib/auth.ts` `session.create.after` still only audit-logs login (~L254–266) and does not write `mustChangePassword`
- [ ] `onPasswordReset` still sets `mustChangePassword: false` with `isNull(schema.users.deletedAt)`
- [ ] Invite `POST` still `bcrypt.hash(randomBytes(32)...` and `mustChangePassword: true`
- [ ] `POST /api/admin/change-password` still requires `currentPassword` bcrypt match
- [ ] `proxy.ts` still redirects `/admin*` except `/admin/account` when `session.user.mustChangePassword === true`
- [ ] `tests/auth-oauth.test.ts` still has no `mustChangePassword` coverage
- [ ] `session.cookieCache` still absent from `lib/auth.ts`
- [ ] `docs/FEATURE_FLAGS.md` Google manual check still says land in `/admin`

Snapshot: investigated at 2026-08-29, branch `dev`, HEAD hint `6578323` (OAuth ship `50ec28c` [POR-394](https://linear.app/teton-web-ventures/issue/POR-394/add-optional-google-oauth-on-better-auth-behind-oauth-flag)). Found by `/prb` Phase 1.5 exhaustive review after [POR-410](https://linear.app/teton-web-ventures/issue/POR-410/gallery-csp-blocks-vercel-blob-media-on-public-album-pages)/411/426.

## Risks / blockers

* If Better Auth `context.path` is empty on `/callback/google` in this version, the helper will never fire. Confirm with a source test that `lib/auth.ts` reads `context.path`, and keep the `/sign-in/social` + `body.provider` branch for idToken. If both are empty at runtime, stop and report — do not “fix” by clearing on **every** session create (that would skip the credential first-login gate).
* Enabling `session.cookieCache` later could snapshot `mustChangePassword: true` into `session_data` before `after` runs. This ticket must not enable cookie cache. If drift already enabled it, clear in an API `hooks.after` that runs before `setSessionCookie`, or update the user in `session.create.before` via a separate user update **and** invalidate cookie cache — still do not skip currentPassword on the account form.
* Related: [POR-394](https://linear.app/teton-web-ventures/issue/POR-394/add-optional-google-oauth-on-better-auth-behind-oauth-flag) (In Review) AC “existing invited/seeded user can sign in with Google” is incomplete until this lands. Do not reopen/rewrite [POR-394](https://linear.app/teton-web-ventures/issue/POR-394/add-optional-google-oauth-on-better-auth-behind-oauth-flag).
* Rollback: revert the after-hook + helper; invite/password flows unchanged.

## Platform / stack

* Canonical targets: Next.js 16 App Router, Better Auth 1.7.2, Neon + Drizzle (no new migration), Doppler `oauth` flag + `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
* Must not use / abandoned for this work: Auth.js / NextAuth, Server Actions, `db:push`
* Migration dependency: none

## Related

* Related: [POR-394](https://linear.app/teton-web-ventures/issue/POR-394/add-optional-google-oauth-on-better-auth-behind-oauth-flag) (Google OAuth behind `oauth` flag — this is the first-login gap)
* Related pattern (other team, Done): [TW-1652](https://linear.app/teton-web-ventures/issue/TW-1652/starter-clear-mustchangepassword-after-email-password-reset) — `onPasswordReset` clearer; reuse that update, do not duplicate email-reset work
* blockedBy: none ([POR-394](https://linear.app/teton-web-ventures/issue/POR-394/add-optional-google-oauth-on-better-auth-behind-oauth-flag) In Review already shipped the Google provider in this repo at `50ec28c`)
* Duplicate of: none — not a duplicate of [POR-394](https://linear.app/teton-web-ventures/issue/POR-394/add-optional-google-oauth-on-better-auth-behind-oauth-flag) (feature vs this gate interaction)

## Supersedes

* none

## Assumptions / pre-decided

* **Clear on Google session is mandatory.** Do not implement “allow change-password without currentPassword” in this ticket.
* Invite continues to set `mustChangePassword: true` and a random credential so **password** first login stays gated.
* Magic-link does **not** clear the flag here (out of scope).
* Seed Google login should also clear (FEATURE_FLAGS check names seed/invite).
* Team/project = [POR-394](https://linear.app/teton-web-ventures/issue/POR-394/add-optional-google-oauth-on-better-auth-behind-oauth-flag): Portfolio / next-starter-template. Label `Bug`. Priority High (2).
* Intensity: standard; proof on (live Google if keys exist, else helper + source pin with unproven live hop).
