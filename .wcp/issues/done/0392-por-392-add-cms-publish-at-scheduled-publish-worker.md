---
id: "0392"
title: "Add CMS publish_at scheduled publish worker"
status: done
priority: normal
assignee:
lease_expires:
scope: "Imported from Linear POR-392. Stay inside that description."
acceptance: "Context"
files: []
commit:
reason:
created: "2026-08-28T19:01:19.611Z"
linear_id: "POR-392"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-392/add-cms-publish-at-scheduled-publish-worker"
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
linear_updated: "2026-08-30T02:08:15.768Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-392
- URL: https://linear.app/teton-web-ventures/issue/POR-392/add-cms-publish-at-scheduled-publish-worker
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
- Created: 2026-08-28T19:01:19.611Z
- Updated: 2026-08-30T02:08:15.768Z
- Completed: 2026-08-30T02:08:15.749Z
- Canceled: no
- Archived: no
- Branch: david/por-392-add-cms-publish_at-scheduled-publish-worker

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

## Context

* Route / page / component / user flow: CMS edit, `cms_entries`, cron worker
* Parent epic: POR-379
* Pattern: dts-os `publishAt` / `publish_at` + `publishStatus` (`lib/cms-publish.ts`)
* Starter already has `publishedAt` (when it went live). Do not rename it.

## Current behavior

Publish is immediate via status `published`. No future date. No worker.

## Expected / intended behavior

* New nullable `publish_at` column
* Admin can set a future time while status stays draft/in_review/scheduled
* `scheduled_publish` flag off hides the date picker and worker no-ops
* Flag stays dark unless `cron` is enabled and `CRON_SECRET` works
* Cron job publishes rows where `publish_at <= now()` and status is scheduled; sets `publishedAt` to now
* Future-dated entries are not on the public site or sitemap
* Unpublished preview may show them to admins

## Acceptance criteria

- [ ] Migration adds `publish_at` only; `publishedAt` unchanged
- [ ] Public queries ignore future `publish_at`
- [ ] Worker is idempotent
- [ ] Failed worker run does not leave rows half-published
- [ ] Audit on scheduled → published
- [ ] Verification: schedule 1 minute ahead, run cron, confirm public; `bun run typecheck`

## Out of scope / do not change

* i18n
* Multi-timezone UI beyond storing UTC and displaying local in admin

## Notes for implementer

* Add nullable `publish_at` timestamptz on `cms_entries`. Do not rename `publishedAt`
* Status: keep existing enum; add `scheduled` only if it already fits. Otherwise leave status draft/in_review until the worker flips to published
* Admin date picker on `/admin/content/[id]` hidden when `scheduled_publish` is off
* Flag stays dark unless `cron` is on and `CRON_SECRET` is set
* Worker: `app/api/cron/publish/route.ts` using `requireCronSecret`. Select `publish_at <= now()` and not yet live. Set status published + `publishedAt = now()`. Idempotent. Audit each flip
* `lib/cms/queries.ts` public fetch: published AND (`publish_at` is null OR `publish_at <= now()`)
* Sitemap same rule. Preview (POR-388) may show scheduled rows to admins
* Store UTC; admin displays local. No extra timezone tables
