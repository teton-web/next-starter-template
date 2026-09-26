---
id: "0386"
title: "Wire trackEvent on contact submit, CMS publish, and media upload"
status: done
priority: normal
assignee:
lease_expires:
scope: "Imported from Linear POR-386. Stay inside that description."
acceptance: "Context"
files: []
commit:
reason:
created: "2026-08-28T19:00:27.265Z"
linear_id: "POR-386"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-386/wire-trackevent-on-contact-submit-cms-publish-and-media-upload"
linear_status: "Done"
linear_status_type: "completed"
linear_team: "POR"
linear_project: "next-starter-template"
linear_assignee: "David Solheim <david@tetonweb.com>"
linear_labels: []
linear_priority: "Low"
linear_parent: "POR-379"
linear_cycle: ""
linear_due: ""
linear_updated: "2026-08-30T02:08:07.647Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-386
- URL: https://linear.app/teton-web-ventures/issue/POR-386/wire-trackevent-on-contact-submit-cms-publish-and-media-upload
- Linear status: Done (completed)
- Queue status: done
- Team: Portfolio (POR)
- Project: next-starter-template
- Assignee: David Solheim <david@tetonweb.com>
- Labels: none
- Parent: POR-379 — Gold standard kit — flags, galleries, Stripe, and half-wired finish
- Priority: Low
- Estimate: none
- Cycle: none
- Due: none
- Created: 2026-08-28T19:00:27.265Z
- Updated: 2026-08-30T02:08:07.647Z
- Completed: 2026-08-30T02:08:07.615Z
- Canceled: no
- Archived: no
- Branch: david/por-386-wire-trackevent-on-contact-submit-cms-publish-and-media

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

## Context

* Route / page / component / user flow: `lib/analytics.ts`, contact API, CMS PATCH publish, upload API
* Parent epic: POR-379

## Current behavior

`ANALYTICS_EVENTS` lists `contact_submit`, `contact_submit_failed`, `cms_publish`, `media_upload`. `trackEvent()` exists and is never called from routes.

## Expected / intended behavior

Call `trackEvent` at those four moments with the existing allowlisted props only (`destination`, `status`, `entry_type`, `kind`, `error_code`). No PII.

## Acceptance criteria

- [ ] Contact success and failure fire the matching events
- [ ] CMS transition to `published` fires `cms_publish` with `entry_type`
- [ ] Successful upload fires `media_upload` with `kind`
- [ ] Props still pass `sanitizeAnalyticsProps`
- [ ] Verification: grep shows call sites outside `lib/analytics.ts`; `bun run typecheck`

## Out of scope / do not change

* GA4/GTM
* New event names beyond the existing allowlist unless required

## Notes for implementer

Call sites (add, do not expand the allowlist):

* Contact POST success / validation or provider failure — `contact_submit` / `contact_submit_failed`
* CMS PATCH/POST that transitions status to `published` — `cms_publish` + `entry_type`
* Upload success in `/api/upload` (and any admin media POST that writes `media_assets`) — `media_upload` + `kind`

Keep `lib/analytics.ts` as the only place event names live. Props must pass `sanitizeAnalyticsProps`. No email, name, IP, or body text in props.
