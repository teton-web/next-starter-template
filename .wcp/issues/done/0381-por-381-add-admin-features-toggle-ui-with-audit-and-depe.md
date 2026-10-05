---
id: "0381"
title: "Add /admin/features toggle UI with audit and dependency messaging"
status: done
priority: high
assignee:
lease_expires:
scope: "Imported from Linear POR-381. Stay inside that description."
acceptance: "Context"
files: []
commit:
reason:
created: "2026-08-28T18:59:45.215Z"
linear_id: "POR-381"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-381/add-adminfeatures-toggle-ui-with-audit-and-dependency-messaging"
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
linear_updated: "2026-08-30T02:08:04.383Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-381
- URL: https://linear.app/teton-web-ventures/issue/POR-381/add-adminfeatures-toggle-ui-with-audit-and-dependency-messaging
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
- Created: 2026-08-28T18:59:45.215Z
- Updated: 2026-08-30T02:08:04.383Z
- Completed: 2026-08-30T02:08:04.369Z
- Canceled: no
- Archived: no
- Branch: por-381-add-adminfeatures-toggle-ui-with-audit-and-dependency

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

## Context

* Route / page / component / user flow: `/admin/features`
* Parent epic: POR-379
* Depends on: flag catalog + `isEnabled` + `feature_flags` table

## Current behavior

Admin nav is account, contact, content, media only. No features page. No way to toggle optional modules without Doppler.

## Expected / intended behavior

Admin-only page at `/admin/features` listing catalog flags.

* Platform rows (auth, admin, cms, media, contact, seo, analytics, theme) show as always-on and are not switchable
* Optional flags are switches. Off by default
* `site_gate` row includes a password field on the same row (locked 2026-08-28). Saving stores a hash. After save the UI never redisplays plaintext. Empty password + flag on stays dark
* If a flag requires keys that are missing, the switch cannot stay on; show why (e.g. "Stripe keys missing in Doppler")
* Show hard-off when `FEATURE_<KEY>=0` is set; admin cannot enable past the kill switch
* Show dependencies (`scheduled_publish` needs `cron`)
* Every save writes `audit_logs`
* Nav link only for users with `admin` capability

## Acceptance criteria

- [ ] `/admin/features` exists, session + `admin` capability required
- [ ] Optional flags persist to `feature_flags` and change `isEnabled` on the next resolved read
- [ ] Platform flags cannot be turned off
- [ ] Site-gate password hashed at rest; plaintext not returned by GET
- [ ] Flag on + empty site-gate password does not enable the gate
- [ ] Missing-key flags stay dark with an explicit reason
- [ ] `FEATURE_*=0` shown as locked off
- [ ] Audit row per change (actor, key, old, new)
- [ ] Verification: `bun run typecheck`; manual: seed admin, toggle waitlist on/off, confirm nav/API follow; set `FEATURE_WAITLIST=0` and confirm UI cannot enable

## Out of scope / do not change

* Proxy cache implementation details beyond calling `isEnabled`
* Building waitlist/stripe/gallery product UI

## Notes for implementer

Mirror existing admin surfaces:

* Nav: `app/admin` layout / sidebar that currently lists account, contact, content, media — add Features for `admin` capability only (`lib/auth/capabilities.ts`)
* Page: `app/admin/features/page.tsx`
* API: `app/api/admin/features/route.ts` GET list + PATCH toggle/config. Use `lib/api/helpers.ts`, `http-error.ts`, session + capability checks like other `/api/admin/*`
* UI: shadcn Switch + existing form primitives. Site-gate password is an input on that row only; never echo hash or plaintext on GET
* Audit: `lib/admin/audit.ts` — actor, action `flag.update`, key, old, new

Dependency copy to show on the row:

* `scheduled_publish` requires `cron`
* `stripe` requires Stripe secret + webhook secret
* `oauth` requires Google client id/secret
* `galleries` on Vercel preview/prod requires Blob token
* `cron` requires `CRON_SECRET`
* `site_gate` requires a stored password hash

Hard-off UI: when `FEATURE_<KEY>=0`, switch is disabled and helper text says Doppler kill switch. Do not write enabled=true that `isEnabled` would ignore without also showing it will stay dark.
