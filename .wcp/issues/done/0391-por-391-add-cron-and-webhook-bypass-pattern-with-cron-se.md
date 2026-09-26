---
id: "0391"
title: "Add cron and webhook bypass pattern with CRON_SECRET"
status: done
priority: normal
assignee:
lease_expires:
scope: "Imported from Linear POR-391. Stay inside that description."
acceptance: "Context"
files: []
commit:
reason:
created: "2026-08-28T19:01:13.335Z"
linear_id: "POR-391"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-391/add-cron-and-webhook-bypass-pattern-with-cron-secret"
linear_status: "Done"
linear_status_type: "completed"
linear_team: "POR"
linear_project: "next-starter-template"
linear_assignee: "David Solheim <david@tetonweb.com>"
linear_labels: []
linear_priority: "Medium"
linear_parent: "POR-379"
linear_cycle: ""
linear_due: ""
linear_updated: "2026-08-30T02:08:14.736Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-391
- URL: https://linear.app/teton-web-ventures/issue/POR-391/add-cron-and-webhook-bypass-pattern-with-cron-secret
- Linear status: Done (completed)
- Queue status: done
- Team: Portfolio (POR)
- Project: next-starter-template
- Assignee: David Solheim <david@tetonweb.com>
- Labels: none
- Parent: POR-379 — Gold standard kit — flags, galleries, Stripe, and half-wired finish
- Priority: Medium
- Estimate: none
- Cycle: none
- Due: none
- Created: 2026-08-28T19:01:13.335Z
- Updated: 2026-08-30T02:08:14.736Z
- Completed: 2026-08-30T02:08:14.716Z
- Canceled: no
- Archived: no
- Branch: david/por-391-add-cron-and-webhook-bypass-pattern-with-cron_secret

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

## Context

* Route / page / component / user flow: `/api/cron/*`, `docs/API_AUTH_MATRIX.md`
* Parent epic: POR-379
* Matrix already says cron/webhook bypasses must be explicit

## Current behavior

No cron routes. No `CRON_SECRET`. Site gate and session auth wrap APIs. No bypass header pattern.

## Expected / intended behavior

Built dark behind `cron` flag.

* Doppler `CRON_SECRET` required or flag stays dark
* Cron routes check `Authorization: Bearer $CRON_SECRET` (or Vercel cron header + secret)
* Document the matrix row
* Flag off → routes 404 even with a valid secret
* Secret off → 401, never run the job

This is the worker spine for scheduled publish.

## Acceptance criteria

- [ ] Shared helper `requireCronSecret(request)` used by cron routes
- [ ] `docs/API_AUTH_MATRIX.md` updated
- [ ] `.env.example` documents `CRON_SECRET` as optional
- [ ] Flag off 404s; missing/wrong secret 401; correct secret 200 on a health-style cron ping
- [ ] Verification: `bun run typecheck`; curl three cases above

## Out of scope / do not change

* InventRight webhook product logic
* Implementing publish_at flip (next issue)

## Notes for implementer

* `lib/cron/require-cron-secret.ts` — Bearer `CRON_SECRET` and/or Vercel cron header + secret; constant-time compare
* `app/api/cron/health/route.ts` ping for the three cases (flag off 404, bad secret 401, ok 200)
* Flag `cron` default off; missing `CRON_SECRET` keeps flag dark
* Update `docs/API_AUTH_MATRIX.md` and `.env.example`
* Site-gate / session must not block cron when secret is valid and flag is on
* No job logic here except the health ping. Publish worker is POR-392.
