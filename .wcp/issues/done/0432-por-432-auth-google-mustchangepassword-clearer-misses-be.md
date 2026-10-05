---
id: "0432"
title: "[Auth] Google mustChangePassword clearer misses Better Auth /callback/:id"
status: done
priority: high
assignee:
lease_expires:
scope: "Imported from Linear POR-432. Stay inside that description."
acceptance: "Implementer contract"
files: []
commit:
reason:
created: "2026-08-29T18:40:35.057Z"
linear_id: "POR-432"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-432/auth-google-mustchangepassword-clearer-misses-better-auth-callbackid"
linear_status: "Done"
linear_status_type: "completed"
linear_team: "POR"
linear_project: "next-starter-template"
linear_assignee: "maintainer"
linear_labels: ["Bug"]
linear_priority: "High"
linear_parent: ""
linear_cycle: ""
linear_due: ""
linear_updated: "2026-08-30T02:08:28.607Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-432
- URL: https://linear.app/teton-web-ventures/issue/POR-432/auth-google-mustchangepassword-clearer-misses-better-auth-callbackid
- Linear status: Done (completed)
- Queue status: done
- Team: Portfolio (POR)
- Project: next-starter-template
- Assignee: maintainer
- Labels: Bug
- Parent: none
- Priority: High
- Estimate: none
- Cycle: none
- Due: none
- Created: 2026-08-29T18:40:35.057Z
- Updated: 2026-08-30T02:08:28.607Z
- Completed: 2026-08-30T02:08:28.591Z
- Canceled: no
- Archived: no
- Branch: por-432-auth-google-mustchangepassword-clearer-misses-better-auth

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

## Implementer contract

* You are implementing **this ticket only** (not [POR-429](https://linear.app/teton-web-ventures/issue/POR-429/auth-google-oauth-cannot-reach-admin-invite-mustchangepassword-trap)’s original wiring, not invite/welcome, not magic-link, not change-password). Do not expand scope.
* Prefer the **step-by-step plan** and **file-by-file changes** below over inventing a new design.
* **Mandatory approach:** make `shouldClearMustChangePasswordOnSession` true for Better Auth 1.7.2’s real `session.create.after` context: `path === "/callback/:id"` (or ends with it) **and **`params.id === "google"`, and/or the HTTP request pathname ending in `/callback/google`. Do **not** treat existing `/callback/google` unit cases as proof.
* Before coding: run the **Drift check**. If anchors still match, do **not** re-research the whole area — implement.
* If drift broke the plan (paths/symbols gone), stop and report; do not freestyle a rewrite.
* Smallest complete change that meets **Acceptance criteria**. Mirror existing patterns; do not introduce new libraries or architectural layers unless this ticket says so.
* Never commit secrets, `.env` values, or real credentials.

## Intensity

* Band: standard
* Why: one-helper path detector + hook arg pass-through + unit tests; no schema/new gate; credential first-login stays
* Proof: on

## Summary

[POR-429](https://linear.app/teton-web-ventures/issue/POR-429/auth-google-oauth-cannot-reach-admin-invite-mustchangepassword-trap) added `session.create.after` so a successful Google sign-in clears `users.mustChangePassword` and invite/seed users land in `/admin`. That hook only updates when `shouldClearMustChangePasswordOnSession({ path, bodyProvider })` is true. The helper is true only for paths ending in `/callback/google` or `/sign-in/social` with `body.provider === "google"`.

Better Auth 1.7.2 does **not** pass `/callback/google` into that hook. `dispatchAuthEndpoint` overwrites `path` with the route **template** (`endpoint.path`). `callbackOAuth` is `createAuthEndpoint("/callback/:id")`, so ALS `session.create.after` sees `path === "/callback/:id"`. `"/callback/:id".endsWith("/callback/google")` is false, the Drizzle update never runs, and proxy still redirects `/admin` → `/admin/account`.

The `/login` Google button is `signIn.social` **without **`idToken`; that POST only returns an authorize URL. The session is created on the **GET callback**, not on `/sign-in/social`.

## User report

> Filed by `/prb` Phase 1.5. Follow-up to incomplete [POR-429](https://linear.app/teton-web-ventures/issue/POR-429/auth-google-oauth-cannot-reach-admin-invite-mustchangepassword-trap) (In Review). Do not duplicate [POR-429](https://linear.app/teton-web-ventures/issue/POR-429/auth-google-oauth-cannot-reach-admin-invite-mustchangepassword-trap); relatedTo [POR-429](https://linear.app/teton-web-ventures/issue/POR-429/auth-google-oauth-cannot-reach-admin-invite-mustchangepassword-trap).
>
> Problem (P1 / High): [POR-429](https://linear.app/teton-web-ventures/issue/POR-429/auth-google-oauth-cannot-reach-admin-invite-mustchangepassword-trap) / `docs/FEATURE_FLAGS.md` claim a successful `/login` Google sign-in clears `mustChangePassword` so invite/seed users land in `/admin`. The hook in `lib/auth.ts` `session.create.after` only updates when `shouldClearMustChangePasswordOnSession({ path, bodyProvider })` is true. That helper returns true only for paths ending in `/callback/google` or `/sign-in/social` with `body.provider === "google"`.
>
> Better Auth 1.7.2 does not pass that string. `dispatchAuthEndpoint` overwrites path with the route template (`node_modules/better-auth/dist/api/dispatch.mjs`: `path: endpoint.path`). `callbackOAuth` is `createAuthEndpoint("/callback/:id")`, so ALS context `session.create.after` sees `/callback/:id`. `"/callback/:id".endsWith("/callback/google")` is false.
>
> The `/login` button is `signIn.social` without `idToken` (`lib/auth-client.ts`); that POST only issues the authorize URL — the session is created on the GET callback, not on `/sign-in/social`.
>
> Better Auth last-login-method uses `path.startsWith("/callback/")` then `ctx.params?.id`. oauth-proxy plugin checks `context.path === "/callback/:id"`.
>
> [POR-429](https://linear.app/teton-web-ventures/issue/POR-429/auth-google-oauth-cannot-reach-admin-invite-mustchangepassword-trap) tests only feed `/callback/google` and string-scan `lib/auth.ts`; none assert `/callback/:id` or `params.id`.
>
> Fix: treat `/callback/:id` with `params.id === "google"` (or the request pathname). Add a test that the helper is true for that template. Do not treat `/callback/google` unit cases as proof.
>
> Related [POR-429](https://linear.app/teton-web-ventures/issue/POR-429/auth-google-oauth-cannot-reach-admin-invite-mustchangepassword-trap), [POR-394](https://linear.app/teton-web-ventures/issue/POR-394/add-optional-google-oauth-on-better-auth-behind-oauth-flag). Priority High (2). Type: bug.

## Current behavior

1. Invite/seed user has `mustChangePassword: true` and a random bcrypt credential they never see.
2. `/login` **Continue with Google** calls `signInGoogle` → `authClient.signIn.social({ provider: "google", callbackURL })` with **no **`idToken`.
3. `POST /api/auth/sign-in/social` returns `{ redirect: true, url: <Google authorize> }`. No session row is created on that POST.
4. Google redirects to `GET /api/auth/callback/google`. Better Auth `callbackOAuth` (`/callback/:id`) creates the session.
5. `dispatchAuthEndpoint` sets ALS `path` to `endpoint.path` (`"/callback/:id"`), not the filled `/callback/google`.
6. `session.create.after` reads `context.path` (`"/callback/:id"`) and `context.body.provider` (undefined on GET). Helper returns **false**. Flag stays `true`.
7. Redirect to `/admin`. `proxy.ts` sees `mustChangePassword === true` + `shouldRedirectForMustChangePassword("/admin")` → 302 `/admin/account`. Invitee cannot know `currentPassword`.

* Evidence: `lib/auth/google-oauth.ts` (`shouldClearMustChangePasswordOnSession`, ~L118–127) — `path.endsWith("/callback/google")` only
* Evidence: `lib/auth.ts` (`session.create.after`, ~L255–281) — passes `{ path, bodyProvider }` only; never `params.id` or request pathname
* Evidence: `node_modules/better-auth/dist/api/dispatch.mjs` (`dispatchAuthEndpoint`, ~L191–199) — `path: endpoint.path`
* Evidence: `node_modules/better-auth/dist/api/routes/callback.mjs` (`callbackOAuth`, ~L26) — `createAuthEndpoint("/callback/:id")`
* Evidence: `node_modules/better-auth/dist/db/with-hooks.mjs` (~L7, ~L38) — after-hook context is `tryGetCurrentAuthEndpointContext()` (that ALS object)
* Evidence: `lib/auth-client.ts` (`signInGoogle`, ~L36–41) — no `idToken`
* Evidence: `tests/auth-oauth.test.ts` (~L228–328) — true cases are `/callback/google` and `/sign-in/social`+google; no `/callback/:id`, no `params.id`
* Evidence: `docs/FEATURE_FLAGS.md` (`## Google OAuth`, ~L84) — claims Google sign-in clears the flag

## Expected behavior

* For the **real** Better Auth 1.7.2 callback ALS context (`path: "/callback/:id"`, `params.id: "google"`), the helper is **true** and `session.create.after` runs the existing `mustChangePassword: false` update.
* Passing the HTTP request pathname `/api/auth/callback/google` (or `/callback/google`) remains true as a belt-and-suspenders fallback.
* Credential `/sign-in/email`, magic-link, reset-password, `/callback/:id` with `params.id === "github"` (or missing id), and `/sign-in/social` without `body.provider === "google"` stay **false**.
* `/login` Google (redirect, no idToken) invite/seed user lands in `/admin` as the same user id, not `/admin/account`.
* Keep `/sign-in/social` + `bodyProvider === "google"` true (idToken branch can create a session on that literal path).
* Non-goals: new schema; skipping `currentPassword`; clearing the flag on email/magic-link; changing `isGoogleOAuthAuthPath` 404 logic (that already sees the Next.js request pathname).

## Suspected root cause / scope

**Confirmed. **[POR-429](https://linear.app/teton-web-ventures/issue/POR-429/auth-google-oauth-cannot-reach-admin-invite-mustchangepassword-trap) assumed Better Auth `context.path` is `/callback/google` (matching a filled URL and the last-login-method *comment* in that ticket). In 1.7.2 the ALS path is the **route template**. last-login-method still works because it uses `path.startsWith("/callback/")` then `ctx.params?.id`. oauth-proxy matches `context.path === "/callback/:id"`. [POR-429](https://linear.app/teton-web-ventures/issue/POR-429/auth-google-oauth-cannot-reach-admin-invite-mustchangepassword-trap)’s helper copied the filled-path string instead of the template + `params.id`.

The `/sign-in/social` helper branch is **not** the product `/login` path: without `idToken`, that endpoint does not create a session (`signInSocial` ~L155 vs ~L149+ authorize URL). Tests that pass `/sign-in/social` + google do not prove the GET callback clearer.

Scope: detector + hook args + tests. Leave invite, proxy gate, change-password, and 404-when-dark as they are.

## Code map

| Path | Role | Symbols / notes |
| -- | -- | -- |
| `lib/auth/google-oauth.ts` | **Primary fix** | `normalizePath` ~L25–29; `GOOGLE_OAUTH_PROVIDER`; `shouldClearMustChangePasswordOnSession` ~L118–127 |
| `lib/auth.ts` | Hook wiring | `databaseHooks.session.create.after` ~L255–281; currently `{ path, bodyProvider }` only |
| `lib/auth-client.ts` | Product Google start | `signInGoogle` ~L36–41 — no `idToken` |
| `app/(auth)/login/login-form.tsx` | UI | `handleGoogle` ~L106–120 → `signInGoogle` |
| `app/api/auth/[...all]/route.ts` | HTTP entry | `GET` uses real pathname `/api/auth/callback/google` for 404 helper only |
| `node_modules/better-auth/dist/api/dispatch.mjs` | Why path is a template | `dispatchAuthEndpoint` ~L191–199 `path: endpoint.path` |
| `node_modules/better-auth/dist/api/routes/callback.mjs` | Callback endpoint | `callbackOAuth` `"/callback/:id"` ~L26 |
| `node_modules/better-auth/dist/api/routes/sign-in.mjs` | Social POST | `signInSocial` `"/sign-in/social"` ~L118; idToken creates session, else authorize URL |
| `node_modules/better-auth/dist/plugins/last-login-method/index.mjs` | **Mirror** | `defaultResolveMethod` ~L8–11: `path.startsWith("/callback/")` then `ctx.params?.id` |
| `node_modules/better-auth/dist/plugins/oauth-proxy/index.mjs` | Template match proof | `context.path === "/callback/:id"` ~L159, ~L341 |
| `node_modules/better-auth/dist/db/with-hooks.mjs` | Hook context source | `tryGetCurrentAuthEndpointContext()` passed to `create.after` |
| `proxy.ts` | Why users still bounce | `mustChangePassword` + `shouldRedirectForMustChangePassword` ~L123–131 |
| `lib/auth/must-change-password-pure.ts` | Gate math (do not change) | `shouldRedirectForMustChangePassword` |
| `lib/db/schema/users.ts` | Column | `mustChangePassword` / `must_change_password` |
| `docs/FEATURE_FLAGS.md` | Claimed behavior | `## Google OAuth` ~L80–84 |
| `tests/auth-oauth.test.ts` | **Must extend** | `describe("google OAuth mustChangePassword clearer")` ~L228 |
| `tests/source-invariants.test.ts` | Pin detector | Google session.create test ~L269–291 — today only scans `/sign-in/social` |

Primary package/app: repo-root Next.js 16 App Router (`next-starter-template`)
Owning monorepo path: N/A — single Next app

## Relevant contracts (types / APIs / data)

* **Helper signature** (extend, keep name): `shouldClearMustChangePasswordOnSession(input: { path?: string \| null; bodyProvider?: string \| null; paramsId?: string \| null; requestPath?: string \| null }): boolean`
* **True when (any):**
  1. normalized `path` or `requestPath` ends with `/callback/google` (filled URL / HTTP pathname)
  2. normalized `path` or `requestPath` is `/callback/:id` **or** ends with `/callback/:id`, **and **`paramsId === "google"`
  3. normalized `path` or `requestPath` ends with `/sign-in/social` **and **`bodyProvider === "google"`
* **False when:** missing/empty path+requestPath; `/callback/:id` without `paramsId` or with `paramsId !== "google"`; `/sign-in/email`; `/magic-link/verify`; `/reset-password`; `/callback/github`; `/link-social`
* **Hook args: **`paramsId` from `context.params.id` if it is a string. `requestPath` from `context.request.url` via `new URL(...).pathname` when `request` looks like a Request (try/catch; skip invalid URLs).
* **DB:** same update as today / [POR-429](https://linear.app/teton-web-ventures/issue/POR-429/auth-google-oauth-cannot-reach-admin-invite-mustchangepassword-trap) / `onPasswordReset`: `{ mustChangePassword: false, updatedAt }` where `id = session.userId` AND `deletedAt IS NULL`. No migration.
* **Env / flags (names only): **`oauth`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Do not paste values.
* **Auth: **`disableSignUp` stays. Do not enable `session.cookieCache`.
* **Do not change **`isGoogleOAuthAuthPath` — it already receives Next.js `request.url` pathname (`/api/auth/callback/google`), not the ALS template.

## Code anchors (excerpts)

### `lib/auth/google-oauth.ts` — `shouldClearMustChangePasswordOnSession` (~L118–127)

```ts
export function shouldClearMustChangePasswordOnSession(input: {
  path?: string | null
  bodyProvider?: string | null
}): boolean {
  if (typeof input.path !== "string" || input.path.length === 0) return false
  const path = normalizePath(input.path)
  if (path.endsWith(`/callback/${GOOGLE_OAUTH_PROVIDER}`)) return true
  if (!path.endsWith("/sign-in/social")) return false
  return input.bodyProvider === GOOGLE_OAUTH_PROVIDER
}
```

`"/callback/:id".endsWith("/callback/google")` is false. This is the bug.

### `lib/auth.ts` — `session.create.after` (~L267–273)

```ts
const path = typeof context?.path === "string" ? context.path : undefined
const rawProvider =
  context?.body && typeof context.body === "object" && "provider" in context.body
    ? context.body.provider
    : undefined
const bodyProvider = typeof rawProvider === "string" ? rawProvider : undefined
if (shouldClearMustChangePasswordOnSession({ path, bodyProvider })) {
```

Does not read `context.params.id` or `context.request.url`.

### `node_modules/better-auth/dist/api/dispatch.mjs` (~L191–199)

```js
let internalContext = {
  ...input,
  context: { ...input.context, returned: void 0, responseHeaders: void 0, session: input.context.session ?? null },
  path: endpoint.path,
  headers: input.headers ? new Headers(input.headers) : void 0
};
```

### Pattern to mirror

* **Mirror: **`node_modules/better-auth/dist/plugins/last-login-method/index.mjs` `defaultResolveMethod` — `path.startsWith("/callback/")` then `ctx.params?.id` (do **not** add that plugin).
* **Mirror: **`node_modules/better-auth/dist/plugins/oauth-proxy/index.mjs` — equality on `"/callback/:id"`.
* **Mirror:** existing helper + `normalizePath` + defensive string checks in `lib/auth.ts` after-hook (same style as `path` / `bodyProvider`).
* **Why:** BA 1.7.2 first-party plugins already treat ALS `path` as the template and the provider as `params.id`.

## Step-by-step implementation plan

Recommended approach is **mandatory** unless drift shows Better Auth no longer sets ALS `path` to `endpoint.path`.

1. Extend `shouldClearMustChangePasswordOnSession` in `lib/auth/google-oauth.ts`:
   * Add optional `paramsId` and `requestPath`.
   * Consider **both **`path` and `requestPath` (normalize each when it is a non-empty string).
   * True if either normalized value ends with `/callback/google`.
   * True if either normalized value equals/ends with `/callback/:id` **and **`paramsId === GOOGLE_OAUTH_PROVIDER` (`"google"`).
   * Keep `/sign-in/social` + `bodyProvider === "google"`.
   * False for empty inputs, other providers, credential/magic-link/reset.
   * Reuse `normalizePath` (query strip + trailing-slash strip). Do not parse `:id` through `new URL` without a base — keep `normalizePath`.
2. In `lib/auth.ts` `session.create.after`, still after the login audit:
   * Read `paramsId` from `context?.params` if it is an object with string `id`.
   * Read `requestPath` from `context?.request?.url` when present (`new URL(url).pathname` in try/catch).
   * Call `shouldClearMustChangePasswordOnSession({ path, bodyProvider, paramsId, requestPath })`.
   * Keep the same Drizzle update + `isNull(deletedAt)`.
   * Do not change `session.create.before`.
3. Tests (see Test plan). The **required** proof case is `{ path: "/callback/:id", paramsId: "google" } === true`. Existing `/callback/google` cases may stay as extra coverage; they are **not** sufficient.
4. Update `tests/source-invariants.test.ts` so the Google clearer pin requires `/callback/:id` and `params` / `paramsId` in the helper and that `lib/auth.ts` after-hook passes `paramsId` (and `requestPath` if you added it). A scan that only finds `/callback/google` or `bodyProvider` must not pass.
5. Do **not** rewrite `docs/FEATURE_FLAGS.md` unless a one-line clarification is needed that the clearer keys off Better Auth `/callback/:id` + `params.id`. The claimed user outcome (land in `/admin`) is unchanged; this ticket makes it true.
6. Run Verification commands.

## File-by-file changes

| Path | Action | What to change |
| -- | -- | -- |
| `lib/auth/google-oauth.ts` | edit | Extend `shouldClearMustChangePasswordOnSession` for `/callback/:id` + `paramsId === "google"` and optional `requestPath`; update JSDoc |
| `lib/auth.ts` | edit | Pass `paramsId` and `requestPath` into the helper from `session.create.after` |
| `tests/auth-oauth.test.ts` | edit test | **Required:** helper true for `{ path: "/callback/:id", paramsId: "google" }` (and trailing slash / `/api/auth/callback/:id` if `endsWith` is used). False for `/callback/:id` without id, `paramsId: "github"`. Mocked `session.create.after` must update on `/callback/:id` + `params.id: "google"` and must **not** update on `/callback/:id` alone. Do not treat `/callback/google` as the proof case. |
| `tests/source-invariants.test.ts` | edit test | Pin helper + after-hook mention `/callback/:id` and `paramsId` (or `params.id`). |
| `docs/FEATURE_FLAGS.md` | optional | One clarifying sentence max; skip if the manual check already matches |
| `lib/auth/must-change-password-pure.ts` | do not touch | Gate stays |
| `proxy.ts` | do not touch |  |
| `app/api/admin/users/route.ts` | do not touch | Invite still sets the flag |
| `app/api/admin/change-password/route.ts` | do not touch |  |
| `isGoogleOAuthAuthPath` / 404 helper | do not touch | Different path source (HTTP pathname) |

## Do not touch / out of scope

* Re-implementing [POR-429](https://linear.app/teton-web-ventures/issue/POR-429/auth-google-oauth-cannot-reach-admin-invite-mustchangepassword-trap)’s Drizzle update, audit log, or FEATURE_FLAGS “lands in `/admin`” sentence unless a one-liner is needed
* First-time set-password without `currentPassword`
* Stopping invite from inserting a credential / `mustChangePassword: true`
* Magic-link clearing `mustChangePassword`
* Enabling `session.cookieCache`
* Public signup, GitHub OAuth, `disableSignUp`
* Changing `isGoogleOAuthAuthPath` 404s (those use Next.js pathname, already `/callback/google`)
* Adding the last-login-method plugin
* Upgrading `better-auth` to “fix” path (stay on 1.7.2; detect the template)
* Drive-by renames, formatting-only sweeps

## Acceptance criteria

- [ ] `shouldClearMustChangePasswordOnSession({ path: "/callback/:id", paramsId: "google" }) === true`
- [ ] Same for `{ path: "/callback/:id/", paramsId: "google" }` (normalize trailing slash)
- [ ] `{ path: "/callback/:id" }` (no params) === false; `{ path: "/callback/:id", paramsId: "github" }` === false
- [ ] `{ requestPath: "/api/auth/callback/google" }` (or path = that pathname) === true as fallback
- [ ] Existing false cases remain false (`/sign-in/email`, magic-link, reset, `/link-social`)
- [ ] `/sign-in/social` + `bodyProvider: "google"` remains true (idToken branch)
- [ ] `lib/auth.ts` after-hook passes `paramsId` (and request pathname fallback) so the product GET callback actually clears the flag
- [ ] Tests that only feed `/callback/google` are **not** the sole proof; the template + `params.id` case exists and is asserted
- [ ] Credential first-login still redirects to `/admin/account`; change-password still requires `currentPassword`
- [ ] No schema/migration; no cookieCache; no `isGoogleOAuthAuthPath` behavior change
- [ ] Verification commands in this ticket pass

## Test plan

**Automated (prefer):**

* File: `tests/auth-oauth.test.ts` (`describe("google OAuth mustChangePassword clearer")`)
* Cases (required):
  * `{ path: "/callback/:id", paramsId: "google" }` → true
  * `{ path: "/callback/:id/", paramsId: "google" }` → true
  * `{ path: "/api/auth/callback/:id", paramsId: "google" }` → true if using `endsWith`
  * `{ path: "/callback/:id" }` → false
  * `{ path: "/callback/:id", paramsId: "github" }` → false
  * `{ requestPath: "/api/auth/callback/google" }` → true (if `requestPath` is implemented)
  * mocked after-hook: `{ path: "/callback/:id", params: { id: "google" } }` pushes the update; `{ path: "/callback/:id" }` does not
* Keep (extra, not proof): `/callback/google`, `/sign-in/social` + google, email/magic-link/github false cases
* File: `tests/source-invariants.test.ts` — helper source contains `/callback/:id`; after-hook call includes `paramsId`

**Manual:**

1. Preconditions: `oauth` on; Google keys in Doppler; invited/seed user with matching Gmail and `mustChangePassword: true`.
2. `/login` → Continue with Google (redirect flow, no idToken).
3. Expected: land on `/admin` (or safe callbackUrl) as that user; `users.must_change_password` is false.
4. Regression: email/password login with flag true still hits `/admin/account`.

## Verification

* `bun run typecheck`
* `bun test tests/auth-oauth.test.ts`
* `bun test tests/source-invariants.test.ts`
* Manual: Test plan (Google redirect for an invite/seed email)

### Runtime proof (`/solve` / `/prb` / `/yeet` drive this — not a new slash)

* Surface to drive: `GET /api/auth/callback/google` after `/login` Continue with Google (redirect, no idToken); resulting `/admin` HTML
* Project verify skill / feature map: none — do not invent a skill
* Visual reference (UI): `/admin` dashboard vs `/admin/account` change-password form (must **not** land on account)
* Blast-radius fact (shared/auth/schema): helper is true for `{ path: "/callback/:id", paramsId: "google" }` and false for `{ path: "/callback/:id" }` and `/sign-in/email` — prove by running `bun test tests/auth-oauth.test.ts` (imports the same module `lib/auth.ts` ships). Grep of `/callback/google` is **not** that fact.
* Observed end state that proves done: invite/seed Google user reaches `/admin`; `must_change_password` is false; credential login with the flag still bounces to `/admin/account`

## Drift check (before implementing)

Re-verify these anchors; if they still match, **skip full re-investigation** and implement:

- [ ] `lib/auth/google-oauth.ts` still exports `shouldClearMustChangePasswordOnSession` and still `endsWith(\`/callback/${GOOGLE_OAUTH_PROVIDER}`)`without`:id`
- [ ] `lib/auth.ts` `session.create.after` still calls the helper with `{ path, bodyProvider }` only (~L267–273)
- [ ] `better-auth` is still `1.7.2`; `dispatch.mjs` still sets `path: endpoint.path`; `callback.mjs` still `createAuthEndpoint("/callback/:id")`
- [ ] `signInGoogle` still has no `idToken`
- [ ] `tests/auth-oauth.test.ts` still has no `/callback/:id` / `params.id` assertion

Snapshot: investigated at 2026-08-29, branch `dev`, HEAD `65baafc` ([POR-429](https://linear.app/teton-web-ventures/issue/POR-429/auth-google-oauth-cannot-reach-admin-invite-mustchangepassword-trap) commit).

## Risks / blockers

* [POR-429](https://linear.app/teton-web-ventures/issue/POR-429/auth-google-oauth-cannot-reach-admin-invite-mustchangepassword-trap) is **In Review** and already contains the incomplete detector + tests that can go green while this bug remains. Do not reopen [POR-429](https://linear.app/teton-web-ventures/issue/POR-429/auth-google-oauth-cannot-reach-admin-invite-mustchangepassword-trap) to “just add a case” in a way that treats `/callback/google` as done. This ticket is the path-template fix.
* If a future Better Auth version stops overwriting `path` with the template, keeping the filled `/callback/google` match is still correct (belt and suspenders).
* `context.params` typing may be loose on the database hook — read defensively (string only), same as `body.provider`.
* Rollback: revert the helper/hook arg change; invite Google users remain stuck on `/admin/account` as today.

## Platform / stack

* Canonical targets: Next.js App Router, Better Auth 1.7.2, Neon + Drizzle (no new migration), Doppler env **names** only
* Must not use / abandoned for this work: none
* Migration dependency: none ([POR-429](https://linear.app/teton-web-ventures/issue/POR-429/auth-google-oauth-cannot-reach-admin-invite-mustchangepassword-trap)’s update already exists; this ticket makes it fire)

## Related

* Parent epic: [POR-379](https://linear.app/teton-web-ventures/issue/POR-379/gold-standard-kit-flags-galleries-stripe-and-half-wired-finish) (gold-standard kit) — do not implement the epic
* Related: [POR-429](https://linear.app/teton-web-ventures/issue/POR-429/auth-google-oauth-cannot-reach-admin-invite-mustchangepassword-trap) (In Review — original clearer; incomplete path match), [POR-394](https://linear.app/teton-web-ventures/issue/POR-394/add-optional-google-oauth-on-better-auth-behind-oauth-flag) (In Review — Google OAuth feature)
* blockedBy: none — [POR-429](https://linear.app/teton-web-ventures/issue/POR-429/auth-google-oauth-cannot-reach-admin-invite-mustchangepassword-trap)’s hook/update is already on `dev` (`65baafc`); this ticket only fixes detection
* Duplicate of: none — [POR-429](https://linear.app/teton-web-ventures/issue/POR-429/auth-google-oauth-cannot-reach-admin-invite-mustchangepassword-trap) is the parent outcome (clear flag on Google session), not this template bug

## Supersedes (required when this ticket replaces earlier work)

### Partial supersede

* **Mode:** partial
* **Issues: **[POR-429](https://linear.app/teton-web-ventures/issue/POR-429/auth-google-oauth-cannot-reach-admin-invite-mustchangepassword-trap)
* **Override scope:**
  * paths: `lib/auth/google-oauth.ts` `shouldClearMustChangePasswordOnSession`; `lib/auth.ts` after-hook helper args; `tests/auth-oauth.test.ts` clearer cases that assumed filled `/callback/google` is the ALS path
  * behaviors: detector must match Better Auth 1.7.2 ALS `path: "/callback/:id"` + `params.id === "google"` (and/or request pathname). `/callback/google` unit cases are extra, not proof.
* **Preserve: **[POR-429](https://linear.app/teton-web-ventures/issue/POR-429/auth-google-oauth-cannot-reach-admin-invite-mustchangepassword-trap) Drizzle update in `session.create.after`; login audit; `onPasswordReset` clearer; invite still sets `mustChangePassword: true`; change-password still requires `currentPassword`; FEATURE_FLAGS “land in `/admin`” outcome; no cookieCache
* **Do not preserve: **[POR-429](https://linear.app/teton-web-ventures/issue/POR-429/auth-google-oauth-cannot-reach-admin-invite-mustchangepassword-trap) assumption that `context.path` is `/callback/google`; [POR-429](https://linear.app/teton-web-ventures/issue/POR-429/auth-google-oauth-cannot-reach-admin-invite-mustchangepassword-trap) AC/tests that treat filled-path unit cases as proof the GET callback clears the flag
* **Board action:** left open — [POR-429](https://linear.app/teton-web-ventures/issue/POR-429/auth-google-oauth-cannot-reach-admin-invite-mustchangepassword-trap) is **In Review** (already coded). Do **not** cancel or mark Duplicate. This ticket is the follow-up fix.

## Assumptions / pre-decided

* Team/project: Portfolio / next-starter-template (same as [POR-429](https://linear.app/teton-web-ventures/issue/POR-429/auth-google-oauth-cannot-reach-admin-invite-mustchangepassword-trap) / [POR-394](https://linear.app/teton-web-ventures/issue/POR-394/add-optional-google-oauth-on-better-auth-behind-oauth-flag)). Prefix POR.
* Do not duplicate [POR-429](https://linear.app/teton-web-ventures/issue/POR-429/auth-google-oauth-cannot-reach-admin-invite-mustchangepassword-trap); file this as a related follow-up bug.
* Intensity stamped **standard** (user request; isolated helper + cheap tests; no schema). Proof stays on because this is auth/gating user-visible.
* Keep filled `/callback/google` as an additional true branch (if BA ever passes a filled path, or if `requestPath` is the HTTP URL) **and** require the template + `params.id` branch.
* Helper stays pure (no `ctx` object required); hook extracts `paramsId` / `requestPath`.
* Do not upgrade better-auth.
* Do not change `isGoogleOAuthAuthPath`.
* `/sign-in/social` + google remains true for the idToken branch, but `/login` does not use idToken; tests must cover the GET callback template.
