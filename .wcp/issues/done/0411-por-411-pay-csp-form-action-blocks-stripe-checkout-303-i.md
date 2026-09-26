---
id: "0411"
title: "[Pay] CSP form-action blocks Stripe Checkout 303 in Chrome/Safari"
status: done
priority: high
assignee:
lease_expires:
scope: "Imported from Linear POR-411. Stay inside that description."
acceptance: "Implementer contract"
files: []
commit:
reason:
created: "2026-08-29T16:37:21.698Z"
linear_id: "POR-411"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-411/pay-csp-form-action-blocks-stripe-checkout-303-in-chromesafari"
linear_status: "Done"
linear_status_type: "completed"
linear_team: "POR"
linear_project: "next-starter-template"
linear_assignee: "David Solheim <david@tetonweb.com>"
linear_labels: ["Bug"]
linear_priority: "High"
linear_parent: "POR-379"
linear_cycle: ""
linear_due: ""
linear_updated: "2026-08-30T02:08:23.768Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-411
- URL: https://linear.app/teton-web-ventures/issue/POR-411/pay-csp-form-action-blocks-stripe-checkout-303-in-chromesafari
- Linear status: Done (completed)
- Queue status: done
- Team: Portfolio (POR)
- Project: next-starter-template
- Assignee: David Solheim <david@tetonweb.com>
- Labels: Bug
- Parent: POR-379 — Gold standard kit — flags, galleries, Stripe, and half-wired finish
- Priority: High
- Estimate: none
- Cycle: none
- Due: none
- Created: 2026-08-29T16:37:21.698Z
- Updated: 2026-08-30T02:08:23.768Z
- Completed: 2026-08-30T02:08:23.748Z
- Canceled: no
- Archived: no
- Branch: david/por-411-pay-csp-form-action-blocks-stripe-checkout-303-in

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

## Implementer contract

* You are implementing **this ticket only** (not [POR-379](https://linear.app/teton-web-ventures/issue/POR-379/gold-standard-kit-flags-galleries-stripe-and-half-wired-finish), not [POR-393](https://linear.app/teton-web-ventures/issue/POR-393/add-stripe-simple-checkout-and-webhook-behind-stripe-flag), not [POR-410](https://linear.app/teton-web-ventures/issue/POR-410/gallery-csp-blocks-vercel-blob-media-on-public-album-pages)). Do not expand scope.
* If `blockedBy` is set and those issues are not Done, do not start this leaf.
* Prefer the **step-by-step plan** and **file-by-file changes** below over inventing a new design.
* Before coding: run the **Drift check**. If anchors still match, do **not** re-research the whole area — implement.
* If drift broke the plan (paths/symbols gone), stop and report; do not freestyle a rewrite.
* Smallest complete change that meets **Acceptance criteria**. Mirror existing patterns; do not introduce new libraries or architectural layers unless this ticket says so.
* Never commit secrets, `.env` values, or real credentials.

## Intensity

* Band: standard
* Why: isolated CSP `form-action` allowlist + source test; Checkout Session create / webhook unchanged
* Proof: on

## Summary

`/pay` posts an HTML form to `POST /api/stripe/checkout`, which 303s to Stripe hosted Checkout (`session.url` on `https://checkout.stripe.com/...`). Document CSP is `form-action 'self'`. Chrome and Safari apply `form-action` to the **entire redirect chain** after a form POST, so the 303 is refused and Checkout never opens. Firefox often allows the hop, so local smoke can pass. This is the production/preview path for the new `stripe` flag ([POR-393](https://linear.app/teton-web-ventures/issue/POR-393/add-stripe-simple-checkout-and-webhook-behind-stripe-flag)). Allow `https://checkout.stripe.com` on `form-action`; do not replace the form+303 flow.

## User report

> Filed by `/prb` Phase 1.5 local review gate before push (thoroughness review of `origin/main...dev`). P1 / High / serious.
>
> `/pay` posts an HTML form to `/api/stripe/checkout`, which 303s to Stripe hosted Checkout (`session.url` on `checkout.stripe.com`). Document CSP in `next.config.mjs` is `form-action 'self'`. Chrome and Safari apply `form-action` to the whole redirect chain after a form POST, so the 303 is refused and Checkout never opens. Firefox often allows the redirect, so local smoke can pass. This is the production/preview path for the new Stripe flag.
>
> Evidence:
>
> * `app/(public)/pay/page.tsx:19-21` — `<form action="/api/stripe/checkout" method="post">`
> * `app/api/stripe/checkout/route.ts` — POST delegates to `stripeCheckoutPostResponse`
> * `next.config.mjs` `DOCUMENT_SECURITY_HEADERS`: `form-action 'self'` (around line 24)
> * Suggested fix: list `https://checkout.stripe.com` on `form-action`, OR stop using form+303 (client fetch then `window.location`)

## Current behavior

* Flag `stripe` on + pay config present: `/pay` renders a server-component page with a native HTML form. Submit POSTs to `/api/stripe/checkout` (same origin). No client JS.
* `POST` handler calls `stripeCheckoutPostResponse`. Same-origin `Origin`/`Referer` required. Creates a payment-mode Checkout Session and returns `NextResponse.redirect(session.url, 303)`.
* Tests pin `session.url` as `https://checkout.stripe.com/c/pay/cs_test_created` and assert status 303 + that `Location`.
* Document CSP on `/` and `/:path*` includes `form-action 'self'` only. Chrome/Safari treat the 303 Location as a form navigation target, fail it, and stay on the app (console: CSP `form-action` violation for `https://checkout.stripe.com`). Firefox often still follows, so a Firefox-only smoke is a false pass.
* Evidence: `app/(public)/pay/page.tsx` (`PayPage`, ~L19–21) — form POST to `/api/stripe/checkout`
* Evidence: `lib/stripe/checkout.ts` (`stripeCheckoutPostResponse`, ~L104–108) — 303 to `session.url`
* Evidence: `next.config.mjs` (`DOCUMENT_SECURITY_HEADERS`, ~L24) — `form-action 'self'`
* Evidence: `tests/stripe.test.ts` (`creates a payment-mode Checkout Session and 303s to Stripe`, ~L452–464)

## Expected behavior

* After submitting **Continue to checkout** on `/pay` in Chrome and Safari (flag on, keys present), the browser navigates to Stripe hosted Checkout (`https://checkout.stripe.com/...`). No CSP `form-action` violation.
* Firefox continues to work.
* Other same-origin forms (login, waitlist, contact, site-gate) still allowed via `'self'`.
* Checkout Session create, same-origin check, rate limit, flag gating, 303 status, webhook, and `/pay` markup stay as they are.
* Non-goals: client `fetch` + `window.location`; JSON `{ url }` instead of 303; Stripe.js / embedded Checkout; `connect-src` / `frame-src` widening; `'unsafe-eval'`.

## Suspected root cause / scope

**Confirmed: **[POR-393](https://linear.app/teton-web-ventures/issue/POR-393/add-stripe-simple-checkout-and-webhook-behind-stripe-flag) added form POST + 303 to `checkout.stripe.com` but did not update CSP `form-action`. HTML `form-action` is not `connect-src`; a same-origin POST that then 303s cross-origin is still a form navigation. Chrome/Safari enforce the chain; unit tests call the handler directly and never see the browser CSP, so they stay green.

**Mandatory approach:** extend document CSP `form-action` to `'self' https://checkout.stripe.com`. Do **not** rewrite `/pay` to a client fetch. Fetch-then-assign would need `redirect: 'manual'` (or drop the 303 for JSON), a client component, and possibly `connect-src` — larger, and it contradicts existing source tests that pin `action="/api/stripe/checkout"` and 303.

Scope: `form-action` line in `DOCUMENT_SECURITY_HEADERS` + pin it in `tests/security-headers.test.ts`. Leave img-src / media-src to [POR-410](https://linear.app/teton-web-ventures/issue/POR-410/gallery-csp-blocks-vercel-blob-media-on-public-album-pages).

## Code map

| Path | Role | Symbols / notes |
| -- | -- | -- |
| `next.config.mjs` | Document CSP | `DOCUMENT_SECURITY_HEADERS` ~L3–28; `form-action 'self'` L24; `headers()` ~L59–79 applies to `"/"` and `"/:path*"` |
| `app/(public)/pay/page.tsx` | Public pay UI (do not rewrite) | `PayPage` ~L8–23; form ~L19–21; gated by `stripePayPageVisible(await isEnabled("stripe"), stripePayConfig())` |
| `app/api/stripe/checkout/route.ts` | POST entry | `POST` → `stripeCheckoutPostResponse(request, { enabled: await isEnabled("stripe") })` |
| `lib/stripe/checkout.ts` | Session create + 303 | `stripeCheckoutPostResponse` ~L63–112; `NextResponse.redirect(session.url, 303)` ~L108; `isSameOriginCheckoutRequest` ~L35–46 |
| `lib/stripe/config.ts` | Flag/page visibility + line items | `stripePayPageVisible`, `stripePayConfig`, `stripeCheckoutLineItems` |
| `lib/flags/catalog.ts` | Optional flag | `stripe` — `requiresEnv: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]`, default off |
| `tests/security-headers.test.ts` | Test to extend | `describe("document security headers")` — pins `script-src` / `frame-ancestors` / no `'unsafe-eval'`; does **not** yet pin `form-action` |
| `tests/stripe.test.ts` | Regression; keep 303 + form action | `POST /api/stripe/checkout` 303 to `https://checkout.stripe.com/c/pay/cs_test_created`; source test expects `action="/api/stripe/checkout"` ~L501 |
| `docs/API_AUTH_MATRIX.md` | Contract note | `POST /api/stripe/checkout` — public same-origin, 303 to Stripe |

Primary package/app: repo root Next.js App Router (`next-starter-template`)
Owning monorepo path (if monorepo): N/A — single Next app

## Relevant contracts (types / APIs / data)

* **Types / props / schema: **`CreateCheckoutSession` in `lib/stripe/checkout.ts` — returns `Pick<Stripe.Checkout.Session, "id" | "url">`. `url` is the hosted Checkout URL (tests: `https://checkout.stripe.com/c/pay/...`).
* **API / route: **`POST /api/stripe/checkout` — empty / omitted JSON body OK (HTML form is `application/x-www-form-urlencoded`; `maybeParseEmptyJson` skips non-JSON). Success: **303 **`Location: <session.url>`. Flag off: 404. Cross-origin: 403. Missing price/amount: 503. Rate limit: 5 / 60s per IP.
* **DB / storage:** N/A — no schema change. Do not touch `stripe_events` / webhook.
* **Env / flags (names only): **`stripe` flag; `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`; `STRIPE_PRICE_ID` or `STRIPE_AMOUNT` + `STRIPE_CURRENCY`; `NEXT_PUBLIC_SITE_URL` / `CANONICAL_SITE_URL` for success/cancel origin. Never paste values.
* **Auth / tenancy:** public, same-origin only. Not session-auth. CSP is document-wide (`/:path*`).
* **CSP after fix (exact** `form-action` **only; keep other directives as they are at implement time):**
  * `form-action 'self' https://checkout.stripe.com`
  * Do **not** add `https:`, `*.stripe.com`, `js.stripe.com`, `hooks.stripe.com`, or `billing.stripe.com`.
  * Do **not** change `script-src` / `connect-src` / `frame-src` / `img-src` / `media-src` in this ticket.

## Code anchors (excerpts)

### `next.config.mjs` — `DOCUMENT_SECURITY_HEADERS` (~L12–26)

```js
{
  key: "Content-Security-Policy",
  value: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://*.vercel-scripts.com https://vercel.live",
    // …style-src / img-src / font-src / connect-src / media-src / frame-src / frame-ancestors / base-uri…
    "form-action 'self'",
    "object-src 'none'",
  ].join("; "),
}
```

Change **only** the `form-action` entry to `form-action 'self' https://checkout.stripe.com`.

### `app/(public)/pay/page.tsx` — `PayPage` (~L19–21)

```tsx
<form action="/api/stripe/checkout" method="post" className="mt-8">
  <Button type="submit">Continue to checkout</Button>
</form>
```

Leave this markup as-is. CSP must allow the 303 hop to `checkout.stripe.com`.

### `lib/stripe/checkout.ts` — `stripeCheckoutPostResponse` (~L104–108)

```ts
if (!session.url) {
  throw new HttpError(502, "Checkout session is missing a redirect URL")
}

return NextResponse.redirect(session.url, 303)
```

Leave the 303. Do not switch this handler to JSON `{ url }` in this ticket.

### Pattern to mirror

* **Mirror: **`tests/security-headers.test.ts` (`headers() applies CSP, DENY, and nosniff`) — copy the style of pinning a full CSP directive string (`script-src …`) plus `expect(config).not.toContain("'unsafe-eval'")`. Pin the **full** post-change `form-action` string, not only a substring, so `'self'` cannot be dropped.
* **Same-ship sibling: **[POR-410](https://linear.app/teton-web-ventures/issue/POR-410/gallery-csp-blocks-vercel-blob-media-on-public-album-pages) edits `img-src` / `media-src` in the same array. If those hosts are already present, leave them. This ticket owns **only **`form-action`.
* **Why:** cheapest lock against a later edit reverting the Checkout host or dropping `'self'`.

## Step-by-step implementation plan

Recommended approach is **mandatory** unless drift proves the form+303 path is already gone.

1. In `next.config.mjs` `DOCUMENT_SECURITY_HEADERS` CSP array, change the `form-action` line from `form-action 'self'` to `form-action 'self' https://checkout.stripe.com`. Do not change any other directive. Do not add `'unsafe-eval'`.
2. In `tests/security-headers.test.ts`, keep existing header / `script-src` / `frame-ancestors` / `not.toContain("'unsafe-eval'")` asserts. Add:
   * `expect(config).toContain("form-action 'self' https://checkout.stripe.com")`
   * `expect(config).not.toContain("form-action 'self'")` is **wrong** (the new string still contains that prefix). Do not write that. Pin the full directive including the Stripe host instead.
3. Do not edit `app/(public)/pay/page.tsx`, `lib/stripe/checkout.ts`, or the webhook. `tests/stripe.test.ts` 303 + `action="/api/stripe/checkout"` asserts must still pass unchanged.
4. Run Verification commands.
5. Runtime proof: document `Content-Security-Policy` on `GET /pay` (or `/` if `/pay` 404s with flag off) includes the new `form-action`. If Stripe keys + flag are available, submit the form in a Chromium browser and confirm navigation to `checkout.stripe.com` with no CSP violation.

## File-by-file changes

| Path | Action | What to change |
| -- | -- | -- |
| `next.config.mjs` | edit | `form-action` only, as specified |
| `tests/security-headers.test.ts` | edit test | pin full `form-action 'self' https://checkout.stripe.com`; keep unsafe-eval guard |
| `app/(public)/pay/page.tsx` | do not touch | native form stays |
| `lib/stripe/checkout.ts` | do not touch | 303 stays |
| `tests/stripe.test.ts` | do not retarget | keep 303 + form-action source asserts; they already match the kept flow |

## Do not touch / out of scope

* Client fetch + `window.location`, converting `PayPage` to a client component, or changing 303 → JSON `{ url }`
* Stripe.js, embedded Checkout, Payment Element, Customer Portal, subscriptions, SKU catalog
* Webhook (`lib/stripe/webhook.ts`, `app/api/stripe/webhook/route.ts`), `stripe_events`, migrations
* `img-src` / `media-src` Blob hosts ([POR-410](https://linear.app/teton-web-ventures/issue/POR-410/gallery-csp-blocks-vercel-blob-media-on-public-album-pages)); `script-src`; `'unsafe-eval'`; `connect-src`; `frame-src`; Permissions-Policy
* `proxy.ts`, feature-flag resolution, `isSameOriginCheckoutRequest`, rate limits, success/cancel copy
* `docs/adr/0001-starter-boundaries.md`, `docs/API_AUTH_MATRIX.md` (matrix already says 303 to Stripe; no CSP column)
* No drive-by renames, dependency upgrades, or formatting-only sweeps

## Acceptance criteria

- [ ] Document CSP `form-action` is exactly `form-action 'self' https://checkout.stripe.com` (plus existing other directives unchanged by this ticket)
- [ ] `'self'` remains on `form-action` so login / waitlist / contact / site-gate forms still submit same-origin
- [ ] `/pay` still uses `<form action="/api/stripe/checkout" method="post">` (no client fetch rewrite)
- [ ] `POST /api/stripe/checkout` still 303s to `session.url` when the flag is on and config exists
- [ ] Chrome/Safari can follow that 303 to `https://checkout.stripe.com` without a `form-action` CSP violation (or header proof + unit 303 if live Stripe cannot be driven)
- [ ] `'unsafe-eval'` stays absent from CSP; `script-src` string from `tests/security-headers.test.ts` still matches
- [ ] Flag-off `/pay` still 404s; checkout flag-off still 404; cross-origin checkout still 403
- [ ] Verification commands in this ticket pass

## Test plan

**Automated (prefer):**

* File: `tests/security-headers.test.ts`
* Cases:
  * `next.config.mjs` source contains `form-action 'self' https://checkout.stripe.com`
  * still contains existing `script-src …`, `frame-ancestors 'none'`, and `not.toContain("'unsafe-eval'")`
* Regression: `bun test tests/stripe.test.ts`
  * still 303s to `https://checkout.stripe.com/c/pay/cs_test_created`
  * pay page source still contains `action="/api/stripe/checkout"`
  * flag off 404; missing origin 403

**Manual:**

1. Preconditions: `bun run dev` (Doppler). If `stripe` is on and `STRIPE_SECRET_KEY` + price/amount are set, `/pay` renders. If not, skip to header-only proof.
2. `curl -sD - -o /dev/null http://localhost:3000/pay` (or `/` if 404) and confirm `Content-Security-Policy` includes `form-action 'self' https://checkout.stripe.com`.
3. Chromium: open `/pay`, click **Continue to checkout**. Expected: navigate to Stripe Checkout hosted page. DevTools Console: no `form-action` violation. (Safari same if available.)
4. Regression: `/login` submit still posts same-origin; `/contact` or waitlist still works; no new script CSP errors.

## Verification

* `bun run typecheck`
* `bun test tests/security-headers.test.ts`
* `bun test tests/stripe.test.ts`
* `bun test tests`
* Manual: Test plan (CSP header + `/pay` submit in Chromium when flag/keys allow)

### Runtime proof (`/solve` / `/prb` / `/yeet` drive this — not a new slash)

* Surface to drive: document `Content-Security-Policy` on `GET /pay` (fallback `GET /` if flag off 404s `/pay`). If flag+keys available: submit **Continue to checkout** on `/pay` in Chromium.
* Project verify skill / feature map: none — no `.grok/skills/verify-*` in this repo
* Visual reference (UI): Stripe hosted Checkout (`checkout.stripe.com`), not an in-app card form. `/pay` page layout stays the existing heading + one button.
* Blast-radius fact (shared/auth/schema): CSP is document-wide via `headers()` `source: "/:path*"`. Prove by reading the response header on `/pay` **and **`/login` — both must show the new `form-action`; `script-src` must still omit `'unsafe-eval'`. Login form must still be able to POST to same origin (`'self'` kept).
* Observed end state that proves done: CSP header includes `form-action 'self' https://checkout.stripe.com`; Chromium form POST from `/pay` reaches `https://checkout.stripe.com` with no `form-action` violation. If live Stripe cannot be driven in this environment, header proof on `next start`/`next dev` plus `tests/stripe.test.ts` 303 is the minimum; record **unproven** for the live Checkout navigation if not driven.

## Drift check (before implementing)

Re-verify these anchors; if they still match, **skip full re-investigation** and implement:

- [ ] `next.config.mjs` still owns `DOCUMENT_SECURITY_HEADERS` with `form-action 'self'` (no `checkout.stripe.com` yet)
- [ ] `headers()` still applies that CSP to `"/"` and `"/:path*"`
- [ ] `app/(public)/pay/page.tsx` still has `<form action="/api/stripe/checkout" method="post">`
- [ ] `lib/stripe/checkout.ts` `stripeCheckoutPostResponse` still `NextResponse.redirect(session.url, 303)`
- [ ] `tests/stripe.test.ts` still expects Location `https://checkout.stripe.com/c/pay/cs_test_created` and source `action="/api/stripe/checkout"`
- [ ] `tests/security-headers.test.ts` still reads `next.config.mjs` and asserts `script-src` without `'unsafe-eval'`
- [ ] If [POR-410](https://linear.app/teton-web-ventures/issue/POR-410/gallery-csp-blocks-vercel-blob-media-on-public-album-pages) already landed Blob hosts on `img-src`/`media-src`, leave those lines; only edit `form-action`

Snapshot: investigated at 2026-08-29, branch `dev`, HEAD hint `6e1518d`. Found by `/prb` Phase 1.5 thoroughness review of `origin/main...dev` ([POR-393](https://linear.app/teton-web-ventures/issue/POR-393/add-stripe-simple-checkout-and-webhook-behind-stripe-flag) Stripe ship).

## Risks / blockers

* Merge conflict with [POR-410](https://linear.app/teton-web-ventures/issue/POR-410/gallery-csp-blocks-vercel-blob-media-on-public-album-pages) (Backlog): same `DOCUMENT_SECURITY_HEADERS` array, different directives. Rebase; do not revert Blob `img-src`/`media-src` if present.
* Allowlisting `https://*.stripe.com` or `https:` is a **false/over-wide fix**. Hosted Checkout URLs in this kit are `https://checkout.stripe.com/...` only (see stripe unit test).
* Do not reintroduce `'unsafe-eval'` ([TW-1643](https://linear.app/teton-web-ventures/issue/TW-1643/starter-tighten-csp-remove-unsafe-eval)).
* Related In Review: [POR-393](https://linear.app/teton-web-ventures/issue/POR-393/add-stripe-simple-checkout-and-webhook-behind-stripe-flag) (Stripe module) — compatible follow-up, not a replacement. Do not reopen session-create work.
* Live Checkout navigation needs Doppler Stripe keys; header proof is always available.
* Rollback: revert the one CSP string and the test assert.

## Platform / stack

* Canonical targets: Next.js 16 App Router, document CSP in `next.config.mjs` `headers()`, Stripe Checkout Sessions (hosted, `checkout.stripe.com`), Doppler env names only, Bun tests
* Must not use / abandoned for this work: Stripe.js embedded Checkout, Shopify, Customer Portal, Server Actions, `db:push`
* Migration dependency: none

## Related

* Parent epic: [POR-379](https://linear.app/teton-web-ventures/issue/POR-379/gold-standard-kit-flags-galleries-stripe-and-half-wired-finish) Gold standard kit — flags, galleries, Stripe, and half-wired finish
* Related: [POR-393](https://linear.app/teton-web-ventures/issue/POR-393/add-stripe-simple-checkout-and-webhook-behind-stripe-flag) Add Stripe simple checkout and webhook behind stripe flag (In Review — this is the CSP follow-up for that 303)
* Related: [POR-410](https://linear.app/teton-web-ventures/issue/POR-410/gallery-csp-blocks-vercel-blob-media-on-public-album-pages) [Gallery] CSP blocks Vercel Blob media on public album pages (same `DOCUMENT_SECURITY_HEADERS`, `img-src`/`media-src` only)
* blockedBy: none
* Duplicate of: none — duplicates should not be filed

## Supersedes (required when this ticket replaces earlier work)

* none — does not replace [POR-393](https://linear.app/teton-web-ventures/issue/POR-393/add-stripe-simple-checkout-and-webhook-behind-stripe-flag) (keep form+303). Direction-conflict search on Portfolio / next-starter-template actionable states (Backlog, Todo, In Progress, In Review) for `form-action`, CSP, `/pay`, checkout, stripe: no unstarted ticket specifies fetch+location or a competing `form-action` change.

## Assumptions / pre-decided

* **Mandatory approach:** extend `form-action` with `https://checkout.stripe.com`. Do **not** implement the alternate (client fetch then `window.location`) listed in the `/prb` finding.
* Intensity **standard** (not critical): this is a CSP allowlist, not payment-processing / webhook / schema logic — same band as sibling [POR-410](https://linear.app/teton-web-ventures/issue/POR-410/gallery-csp-blocks-vercel-blob-media-on-public-album-pages). Proof stays **on** for the `/pay` path.
* Stripe hosted Checkout `session.url` origin is `https://checkout.stripe.com` (already asserted). No custom Checkout domain in this starter.
* HTML form POST (no JSON) remains valid; do not require `Content-Type: application/json`.
* Do not file on Teton Web / content-only projects; this is the public starter (`package.json` name `next-starter-template`), same team/project as [POR-393](https://linear.app/teton-web-ventures/issue/POR-393/add-stripe-simple-checkout-and-webhook-behind-stripe-flag) (Portfolio / next-starter-template).
