---
id: "0393"
title: "Add Stripe simple checkout and webhook behind stripe flag"
status: done
priority: normal
assignee:
lease_expires:
scope: "Imported from Linear POR-393. Stay inside that description."
acceptance: "Context"
files: []
commit:
reason:
created: "2026-08-28T19:01:29.565Z"
linear_id: "POR-393"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-393/add-stripe-simple-checkout-and-webhook-behind-stripe-flag"
linear_status: "Done"
linear_status_type: "completed"
linear_team: "POR"
linear_project: "next-starter-template"
linear_assignee: "maintainer"
linear_labels: []
linear_priority: "Medium"
linear_parent: "POR-379"
linear_cycle: ""
linear_due: ""
linear_updated: "2026-08-30T02:08:16.564Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-393
- URL: https://linear.app/teton-web-ventures/issue/POR-393/add-stripe-simple-checkout-and-webhook-behind-stripe-flag
- Linear status: Done (completed)
- Queue status: done
- Team: Portfolio (POR)
- Project: next-starter-template
- Assignee: maintainer
- Labels: none
- Parent: POR-379 — Gold standard kit — flags, galleries, Stripe, and half-wired finish
- Priority: Medium
- Estimate: none
- Cycle: none
- Due: none
- Created: 2026-08-28T19:01:29.565Z
- Updated: 2026-08-30T02:08:16.564Z
- Completed: 2026-08-30T02:08:16.545Z
- Canceled: no
- Archived: no
- Branch: por-393-add-stripe-simple-checkout-and-webhook-behind-stripe-flag

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

## Context

* Route / page / component / user flow: `/pay` or `/checkout`, `/api/stripe/webhook`
* Parent epic: POR-379
* Locked 2026-08-28: include in kit, flag off. No full product catalog.
* `417f717` has no `stripe` dependency. ADR 0001 currently excludes ecommerce — rewrite it in this issue.

## Current behavior

No Stripe package, routes, or env keys. Fireproof Photos is Shopify and is not this module.

## Expected / intended behavior

Built dark.

* Checkout Session for a single configured amount (Doppler price id or amount+currency)
* Webhook verifies signature, records payment, is idempotent on event id
* `isEnabled('stripe')` gates UI and session creation
* Flag cannot resolve ON without Stripe secret + webhook secret
* Success/cancel pages
* No subscriptions, no SKU catalog, no sponsors

Rewrite `docs/adr/0001-starter-boundaries.md`: ecommerce is now "simple pay flagged off," still no product globes/catalogs.

## Acceptance criteria

- [ ] `stripe` dependency pinned; webhook raw-body signature verify
- [ ] Flag off: checkout route hidden/404; webhook can still 400 unsigned but must not create products
- [ ] Flag on without keys stays dark
- [ ] Duplicate webhook delivery does not double-apply
- [ ] ADR 0001 updated
- [ ] `.env.example` documents `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, public key, price or amount
- [ ] `docs/API_AUTH_MATRIX.md` lists webhook as signature-auth, site-gate exempt if needed for Stripe servers
- [ ] Verification: Stripe CLI fixture or test-mode event; `bun run typecheck`

## Out of scope / do not change

* Subscriptions, customer portal, product catalog, Shopify

## Notes for implementer

* Add `stripe` dep; do not add a product catalog table
* Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, plus either `STRIPE_PRICE_ID` or amount+currency
* Routes: `/pay` (or `/checkout`) + `/pay/success` + `/pay/cancel` + `POST /api/stripe/webhook` with raw body
* Persist processed event ids so retries are idempotent (small `stripe_events` table is fine)
* Flag `stripe` default off; missing keys keep it dark even if DB says on
* Webhook is site-gate exempt (Stripe servers). Document in `docs/API_AUTH_MATRIX.md`
* Rewrite `docs/adr/0001-starter-boundaries.md`: simple pay flagged off is in-kit; catalogs/subscriptions/Shopify still out
* Fireproof Photos Shopify is not this module
