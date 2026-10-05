---
id: "0388"
title: "Add unpublished CMS preview that stays noindex and off the sitemap"
status: done
priority: normal
assignee:
lease_expires:
scope: "Imported from Linear POR-388. Stay inside that description."
acceptance: "Context"
files: []
commit:
reason:
created: "2026-08-28T19:00:43.475Z"
linear_id: "POR-388"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-388/add-unpublished-cms-preview-that-stays-noindex-and-off-the-sitemap"
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
linear_updated: "2026-08-30T02:08:10.511Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-388
- URL: https://linear.app/teton-web-ventures/issue/POR-388/add-unpublished-cms-preview-that-stays-noindex-and-off-the-sitemap
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
- Created: 2026-08-28T19:00:43.475Z
- Updated: 2026-08-30T02:08:10.511Z
- Completed: 2026-08-30T02:08:10.136Z
- Canceled: no
- Archived: no
- Branch: por-388-add-unpublished-cms-preview-that-stays-noindex-and-off-the

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

## Context

* Route / page / component / user flow: draft CMS entries, public pages, `app/robots.ts`, `app/sitemap.ts`
* Parent epic: POR-379

## Current behavior

Public CMS queries published entries only. No preview URL for draft / in_review. Plan listed unpublished preview as half-wired.

## Expected / intended behavior

Admins can preview an unpublished entry via either session-only `/admin/preview/...` or a short-lived signed token URL. Preview is `noindex`, omitted from sitemap, and does not become public if site gate is on unless the viewer already passed the gate or is an authed admin.

## Acceptance criteria

- [ ] Preview of draft and in_review entries works for `admin`/`moderate`
- [ ] Unauthenticated users cannot read draft body via the public route
- [ ] Preview URLs are absent from `sitemap.ts`
- [ ] Preview responses send noindex
- [ ] Token URLs expire and are single-purpose if tokens are used
- [ ] Verification: publish vs draft vs preview; curl sitemap and robots; `bun run typecheck`

## Out of scope / do not change

* Scheduled publish worker (separate issue, but preview must not list future `publish_at` entries as live)
* BlockNote

## Notes for implementer

Prefer session-only `/admin/preview/[id-or-slug]` first. Add signed token URLs only if sharing a draft outside a logged-in admin is required in this slice.

* Public queries stay in `lib/cms/queries.ts` — published only
* `app/sitemap.ts` and `app/robots.ts` / `lib/seo.ts` must never list drafts or token URLs
* Preview response: `X-Robots-Tag: noindex` + metadata robots noindex
* Site gate: authed admin may preview; anonymous token holder still hits the gate if `site_gate` is on
* Tokens if used: HMAC with `AUTH_SECRET`, short TTL, bind to entry id, single-purpose, no PII in the token
* Future `publish_at` rows (POR-392) are unpublished for public/sitemap even if status looks published
