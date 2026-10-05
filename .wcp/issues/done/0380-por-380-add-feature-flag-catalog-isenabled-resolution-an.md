---
id: "0380"
title: "Add feature flag catalog, isEnabled resolution, and Doppler kill switch"
status: done
priority: high
assignee:
lease_expires:
scope: "Imported from Linear POR-380. Stay inside that description."
acceptance: "Context"
files: []
commit:
reason:
created: "2026-08-28T18:59:36.645Z"
linear_id: "POR-380"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-380/add-feature-flag-catalog-isenabled-resolution-and-doppler-kill-switch"
linear_status: "Done"
linear_status_type: "completed"
linear_team: "POR"
linear_project: "next-starter-template"
linear_assignee: "maintainer"
linear_labels: []
linear_priority: "High"
linear_parent: "POR-379"
linear_cycle: ""
linear_due: ""
linear_updated: "2026-08-30T02:08:03.546Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-380
- URL: https://linear.app/teton-web-ventures/issue/POR-380/add-feature-flag-catalog-isenabled-resolution-and-doppler-kill-switch
- Linear status: Done (completed)
- Queue status: done
- Team: Portfolio (POR)
- Project: next-starter-template
- Assignee: maintainer
- Labels: none
- Parent: POR-379 — Gold standard kit — flags, galleries, Stripe, and half-wired finish
- Priority: High
- Estimate: none
- Cycle: none
- Due: none
- Created: 2026-08-28T18:59:36.645Z
- Updated: 2026-08-30T02:08:03.546Z
- Completed: 2026-08-30T02:08:03.528Z
- Canceled: no
- Archived: no
- Branch: por-380-add-feature-flag-catalog-isenabled-resolution-and-doppler

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

## Context

* Route / page / component / user flow: `lib/flags/*`, Drizzle `feature_flags`, Doppler `FEATURE_<KEY>`
* Parent epic: POR-379
* Repo: teton-web/next-starter-template @ 417f717

## Current behavior

No flag framework. Features switch only via env (`SITE_GATE_PASSWORD`, `SEARCH_INDEXING_ENABLED`, `RESEND_API_KEY`, `BLOB_READ_WRITE_TOKEN`). No `feature_flags` table. No `isEnabled()`.

## Expected / intended behavior

A typed catalog and resolver that every later feature uses.

**Resolution order (highest wins):**

1. Doppler `FEATURE_<KEY>=0` — hard off, cannot be overridden in admin
2. DB `feature_flags` row (admin override)
3. Catalog default

**Catalog defaults:**

* Platform always-on (listed in admin as always-on, not togglable off): auth, admin, cms, media, contact, seo, analytics, theme
* Default OFF: `site_gate`, `waitlist`, `stripe`, `galleries`, `scheduled_publish`, `oauth`, `cron`
* No `rbac`, `theme`, or `analytics` flags

Key-backed flags cannot resolve ON without their keys (Stripe keys + webhook secret, Google OAuth client id/secret, `CRON_SECRET`, Blob token on Vercel preview/prod for media-gated features).

Flags are site-global. Do not add `org_id`. Unused `organizations` table stays unused.

## Acceptance criteria

- [ ] `feature_flags` table + Drizzle migration only (`db:generate` then `db:migrate`). No `db:push`.
- [ ] Catalog module exports keys, defaults, labels, dependency metadata, and required-env lists
- [ ] `isEnabled(key)` implements the three-step resolution and key-presence checks
- [ ] `FEATURE_<KEY>=0` in Doppler keeps the flag off even if the DB row is on
- [ ] Missing keys keep Stripe/OAuth/cron/galleries-on-Vercel dark even if DB says on
- [ ] Flag mutations write `audit_logs`
- [ ] Unit tests cover: default off, DB on, Doppler hard-off beats DB, missing keys stay dark, unknown key is off
- [ ] Verification: `bun run typecheck` and `bun test` pass; migrate a fresh DB and confirm seed does not enable optional flags

## Out of scope / do not change

* `/admin/features` UI (separate issue)
* Proxy cache (separate issue)
* Product features themselves
* Turning platform modules off in UI

## Notes for implementer

Preferred files (create; do not dump this into `lib/site-gate.ts`):

* `lib/flags/catalog.ts` — typed keys, labels, defaults, `requiresEnv`, `dependsOn`, `platform: true` for always-on rows
* `lib/flags/resolve.ts` — `isEnabled(key)` three-step resolution + key-presence
* `lib/flags/env.ts` — read `FEATURE_<KEY>` only (Doppler). Treat any value other than exact `0` as not-hard-off
* `lib/db/schema/feature-flags.ts` + export from `lib/db/schema/index.ts`
* `drizzle/<nnnn>_feature_flags.sql` via `bun run db:generate` then `db:migrate` only
* `lib/admin/audit.ts` already exists — reuse for flag mutations
* Tests next to the module (`lib/flags/*.test.ts` or `tests/flags/`)

Schema sketch (site-global, no `org_id`):

* `key` text PK matching catalog
* `enabled` boolean
* `config` jsonb (site-gate password hash lives here later)
* `updatedAt`, `updatedByUserId` nullable FK to users

Do not seed optional flags on. Seed may insert platform rows as documentation only.

Existing env that is NOT a flag: `SEARCH_INDEXING_ENABLED`, `RESEND_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `SITE_GATE_PASSWORD` (retired in POR-383).
