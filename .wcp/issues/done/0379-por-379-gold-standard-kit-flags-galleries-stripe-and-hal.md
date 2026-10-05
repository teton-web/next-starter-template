---
id: "0379"
title: "Gold standard kit — flags, galleries, Stripe, and half-wired finish"
status: done
priority: high
assignee:
lease_expires:
scope: "Imported from Linear POR-379. Stay inside that description."
acceptance: "Context"
files: []
commit:
reason:
created: "2026-08-28T18:59:14.198Z"
linear_id: "POR-379"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-379/gold-standard-kit-flags-galleries-stripe-and-half-wired-finish"
linear_status: "Done"
linear_status_type: "completed"
linear_team: "POR"
linear_project: "next-starter-template"
linear_assignee: ""
linear_labels: []
linear_priority: "High"
linear_parent: ""
linear_cycle: ""
linear_due: ""
linear_updated: "2026-08-31T18:00:06.316Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-379
- URL: https://linear.app/teton-web-ventures/issue/POR-379/gold-standard-kit-flags-galleries-stripe-and-half-wired-finish
- Linear status: Done (completed)
- Queue status: done
- Team: Portfolio (POR)
- Project: next-starter-template
- Assignee: unassigned
- Labels: none
- Parent: none
- Priority: High
- Estimate: none
- Cycle: none
- Due: none
- Created: 2026-08-28T18:59:14.198Z
- Updated: 2026-08-31T18:00:06.316Z
- Completed: 2026-08-31T18:00:06.277Z
- Canceled: no
- Archived: no
- Branch: por-379-gold-standard-kit-flags-galleries-stripe-and-half-wired

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

## Context

* Repo: [teton-web/next-starter-template](<https://github.com/teton-web/next-starter-template>) (`main` `417f717`)
* Gallery source of truth: the reference app (`db9ab9ae`)
* Team: Portfolio (`POR`)

Parent for the gold-standard kit work. Implement **leaf children**, not this shell.

## Current behavior

Starter is gated marketing + CMS + media + Better Auth. No flag framework. Env switches only. Schema ahead of product (orgs, memberships, notifications, files). Several pieces half-wired. Stripe is not a dependency on `417f717`. ADR 0001 still excludes ecommerce.

## Expected / intended behavior

Unused features stay built and dark. Toggle in `/admin/features`. Doppler `FEATURE_<KEY>=0` is the hard kill switch. New clones: migrate + seed + turn on only the flags that site needs.

## Build order (children)

1. Feature flag module (catalog, resolution, admin UI, proxy cache, tests)
2. Convert site gate to flag + password-on-row
3. Wire half-built pieces (invite/welcome, restore, trackEvent, crop, unpublished preview)
4. `publish_at` + cron worker as one slice
5. Galleries (the reference app subset on `media_assets`)
6. Waitlist
7. Stripe simple pay + webhook + ADR 0001 rewrite
8. Optional Google OAuth
9. Repo housekeeping (Auth.js metadata, clone docs)

## Platform vs flags

Always on (not UI-off): auth, admin, cms, media, contact, seo, analytics, theme.
Default OFF: `site_gate`, `waitlist`, `stripe`, `galleries`, `scheduled_publish`, `oauth`, `cron`.
No `rbac` / `theme` / `analytics` flags.

## Out of scope / do not change

* a client product CRM/Keap/Studio/xAI, an internal app skins, puppy poll, BBQ check-in, Payload shops, Shopify, an internal site
* i18n URL prefixes, BotID, BlockNote, full product catalog, subscriptions, impersonation
* Deleting unused orgs/notifications/files tables

## Filed children (solve these, not this shell)

High

* POR-380 flag catalog + `isEnabled` + Doppler kill switch
* POR-381 `/admin/features` UI
* POR-382 proxy-safe flag cache
* POR-383 site gate → flag + hashed password
* POR-390 galleries (the reference app subset on `media_assets`)

Medium

* POR-384 CMS revision restore
* POR-385 admin invite + `welcome.tsx`
* POR-387 image crop (`react-image-crop`)
* POR-388 unpublished preview noindex / off sitemap
* POR-389 waitlist behind flag
* POR-391 `CRON_SECRET` bypass pattern
* POR-392 `publish_at` worker
* POR-393 Stripe simple checkout + webhook

Low

* POR-386 wire `trackEvent`
* POR-394 Google OAuth behind flag
* POR-395 Auth.js metadata + clone docs

Suggested first `/solve`: POR-380, then POR-381 + POR-382, then POR-383.
