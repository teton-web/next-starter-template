---
id: "0389"
title: "Add waitlist module behind waitlist flag"
status: done
priority: normal
assignee:
lease_expires:
scope: "Imported from Linear POR-389. Stay inside that description."
acceptance: "Context"
files: []
commit:
reason:
created: "2026-08-28T19:00:50.658Z"
linear_id: "POR-389"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-389/add-waitlist-module-behind-waitlist-flag"
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
linear_updated: "2026-08-30T02:08:11.761Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-389
- URL: https://linear.app/teton-web-ventures/issue/POR-389/add-waitlist-module-behind-waitlist-flag
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
- Created: 2026-08-28T19:00:50.658Z
- Updated: 2026-08-30T02:08:11.761Z
- Completed: 2026-08-30T02:08:11.741Z
- Canceled: no
- Archived: no
- Branch: david/por-389-add-waitlist-module-behind-waitlist-flag

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

## Context

* Route / page / component / user flow: `/waitlist`, admin waitlist list, Resend optional
* Parent epic: POR-379
* Pattern sources: bass-clown; [designs.sh](<http://designs.sh>) is Vite and is not copied

## Current behavior

No waitlist schema, route, or admin list. Contact form is separate.

## Expected / intended behavior

Built dark. `isEnabled('waitlist')` gates nav, page, and APIs. Public form collects email (+ optional name). Store in DB. Dedup on email. Optional Resend confirmation when configured. Admin list at `/admin/waitlist`. Rate-limit the public POST with existing `lib/services/rate-limit.ts`.

## Acceptance criteria

- [ ] Migration for waitlist table
- [ ] Public `/waitlist` 404 or hidden when flag off; works when on
- [ ] API returns 404 when flag off
- [ ] Duplicate email is idempotent success (no email enumeration)
- [ ] Admin can list entries
- [ ] Resend send is optional and must not fail the insert if email provider is down — record and continue
- [ ] Verification: flag off hides route; flag on accepts signup; `bun run typecheck`

## Out of scope / do not change

* Marketing sequences / drip beyond one confirmation
* [designs.sh](<http://designs.sh>) leaderboard

## Notes for implementer

* Schema: `waitlist_entries` email unique, optional name, createdAt, source optional. Migrations only
* Public: `app/(site)/waitlist/page.tsx` + `POST /api/waitlist`
* Rate limit with `lib/services/rate-limit.ts` + `rate_limit_buckets`
* Admin: `app/admin/waitlist/page.tsx` list only (export CSV optional, not required)
* Flag `waitlist` default off; proxy/nav/API all 404 or hidden when off
* Resend confirmation is best-effort; insert commits first
* Duplicate email: 200 + generic success, no enumeration
* Do not copy [designs.sh](<http://designs.sh>) or bass-clown visual system; reuse starter form primitives
