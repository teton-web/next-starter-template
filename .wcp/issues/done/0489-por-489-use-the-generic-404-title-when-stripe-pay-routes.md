---
id: "0489"
title: "Use the generic 404 title when Stripe pay routes call notFound()"
status: done
priority: normal
assignee:
lease_expires:
scope: "Imported from Linear POR-489. Stay inside that description."
acceptance: "Use the generic 404 title when Stripe pay routes call notFound()"
files: []
commit:
reason:
created: "2026-08-31T20:38:56.861Z"
linear_id: "POR-489"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-489/use-the-generic-404-title-when-stripe-pay-routes-call-notfound"
linear_status: "Done"
linear_status_type: "completed"
linear_team: "POR"
linear_project: "next-starter-template"
linear_assignee: "maintainer"
linear_labels: ["Bug"]
linear_priority: "Medium"
linear_parent: "POR-461"
linear_cycle: ""
linear_due: ""
linear_updated: "2026-09-01T15:04:34.967Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-489
- URL: https://linear.app/teton-web-ventures/issue/POR-489/use-the-generic-404-title-when-stripe-pay-routes-call-notfound
- Linear status: Done (completed)
- Queue status: done
- Team: Portfolio (POR)
- Project: next-starter-template
- Assignee: maintainer
- Labels: Bug
- Parent: POR-461 — UI walk – next-starter-template – 2026-08-31
- Priority: Medium
- Estimate: none
- Cycle: none
- Due: none
- Created: 2026-08-31T20:38:56.861Z
- Updated: 2026-09-01T15:04:34.967Z
- Completed: 2026-09-01T15:04:34.949Z
- Canceled: no
- Archived: no
- Branch: por-489-use-the-generic-404-title-when-stripe-pay-routes-call

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

# Use the generic 404 title when Stripe pay routes call notFound()

## Implementer contract

* You are implementing **this ticket only**. Do not enable Stripe or change checkout.
* Same metadata/`notFound()` rule as POR-472, for `/pay`, `/pay/success`, `/pay/cancel` only.
* Never commit secrets.

## Intensity

* Band: standard
* Why: three page modules already call `notFound()` after exporting a real title
* Proof: on

## Summary

When Stripe is off (or pay page not visible), `/pay*` render the generic 404 UI but the tab title stays `Pay · …` / `Checkout · …` / `Payment canceled · …` because `export const metadata` runs before `notFound()`.

## User report

> Flag-off `/pay` showed the Compass 404 (“We couldn't find that page.”) but the document title was still **Pay**. `/pay/success` title **Checkout**; `/pay/cancel` **Payment canceled**. Screenshot: `screenshots/walk-20260831-full/pay-flag-off-404.png`.

## Current behavior

* Evidence: `app/(public)/pay/page.tsx` — `export const metadata = { title: "Pay" }` then `notFound()` when `stripePayPageVisible` is false
* Evidence: `app/(public)/pay/success/page.tsx` — title `Checkout` then `notFound()` if stripe flag off
* Evidence: `app/(public)/pay/cancel/page.tsx` — title `Payment canceled` then `notFound()`

## Expected behavior

* Flag-off / config-off pay routes: HTTP 404, same 404 UI, document title **Page not found · {siteName}** (once POR-472 sets not-found metadata; until then at least do not advertise Pay/Checkout).
* Flag-on with Stripe configured: keep Pay / Checkout / Payment canceled titles.

## Suspected root cause / scope

Confirmed: static `metadata` export wins over the 404 body. Scope: the three pay page files. Do not hide Stripe when it is on.

## Code map

| Path | Role | Symbols / notes |
| -- | -- | -- |
| `app/(public)/pay/page.tsx` | Pay | `stripePayPageVisible` |
| `app/(public)/pay/success/page.tsx` | Success | `isEnabled("stripe")` |
| `app/(public)/pay/cancel/page.tsx` | Cancel | `isEnabled("stripe")` |
| `app/not-found.tsx` | 404 UI + title after POR-472 |  |

Primary package/app: repo root Next.js app

## Pattern to mirror

* **Mirror:** POR-472 plan — `generateMetadata` / skip dummy titles when calling `notFound()`
* For these files, prefer `generateMetadata` that returns `{ title: "Pay" }` only when the page will render, else `notFound()`.

## Step-by-step implementation plan

1. Replace static `metadata` with `generateMetadata` that checks the same flag/config as the page; call `notFound()` when hidden.
2. Keep success/cancel titles when stripe is on.
3. With stripe off, open `/pay` — title is Page not found (or empty template, not Pay).

## File-by-file changes

| Path | Action | What to change |
| -- | -- | -- |
| `app/(public)/pay/page.tsx` | edit | Conditional metadata |
| `app/(public)/pay/success/page.tsx` | edit | Conditional metadata |
| `app/(public)/pay/cancel/page.tsx` | edit | Conditional metadata |

## Do not touch / out of scope

* Checkout session creation
* CMS catch-all titles (POR-472)

## Acceptance criteria

- [ ] Stripe/pay hidden: `/pay`, `/pay/success`, `/pay/cancel` are HTTP 404 and `document.title` does not start with Pay / Checkout / Payment canceled.
- [ ] Stripe/pay visible: `/pay` title still Pay.
- [ ] 404 **Back to home** still works.
- [ ] Verification commands pass.

## Test plan

**Manual:** with stripe flag off, curl/open the three URLs and read titles.

## Verification

* `bun run lint`
* `bun run typecheck`
* `bun test tests`
* Manual: titles

### Runtime proof

* Surface to drive: `/pay` with stripe off
* Visual reference: 404 UI; screenshot `pay-flag-off-404.png`
* Blast-radius fact: pay routes only
* Observed end state: 404 tab is not labeled Pay

## Drift check (before implementing)

- [ ] Pay pages still export static titles then `notFound()`
- [ ] `stripePayPageVisible` still gates `/pay`
- [ ] Success/cancel still gate on `isEnabled("stripe")`
- [ ] POR-472 still owns CMS/not-found.tsx
- [ ] `bun run typecheck` still exists

Snapshot: investigated at 2026-08-31, branch `dev`, HEAD `e46fea1`.

## Risks / blockers

* If POR-472 has not landed, still must not emit Pay/Checkout titles on 404; returning `{ title: "Page not found" }` from generateMetadata is the fallback.
* Rollback note: restore static metadata

## Platform / stack

* Canonical targets: Next.js metadata, feature flag `stripe`
* Must not use: none
* Migration dependency: none

## Related

* Parent epic: [POR-461](https://linear.app/teton-web-ventures/issue/POR-461/ui-walk-next-starter-template-2026-08-31)
* Related: POR-472
* blockedBy: none
* Duplicate of: none

## Supersedes

* none

## Assumptions / pre-decided

* Do not 404 `/pay` when stripe is on but keys are missing if current `stripePayPageVisible` already encodes that — keep the same visibility helper.

## Walk metadata

* Kind: bug
* Surface: /pay, /pay/success, /pay/cancel
* Viewport: 1280×800
* Auth: signed-out
* Drive path: open pay routes with stripe unset
* Observed: 404 UI + Pay/Checkout titles
* Screenshot: screenshots/walk-20260831-full/pay-flag-off-404.png
* Coverage unit: /pay
