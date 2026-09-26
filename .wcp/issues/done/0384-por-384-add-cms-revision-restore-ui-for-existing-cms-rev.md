---
id: "0384"
title: "Add CMS revision restore UI for existing cms_revisions"
status: done
priority: normal
assignee:
lease_expires:
scope: "Imported from Linear POR-384. Stay inside that description."
acceptance: "Context"
files: []
commit:
reason:
created: "2026-08-28T19:00:13.883Z"
linear_id: "POR-384"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-384/add-cms-revision-restore-ui-for-existing-cms-revisions"
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
linear_updated: "2026-08-30T02:08:06.842Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-384
- URL: https://linear.app/teton-web-ventures/issue/POR-384/add-cms-revision-restore-ui-for-existing-cms-revisions
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
- Created: 2026-08-28T19:00:13.883Z
- Updated: 2026-08-30T02:08:06.842Z
- Completed: 2026-08-30T02:08:06.826Z
- Canceled: no
- Archived: no
- Branch: david/por-384-add-cms-revision-restore-ui-for-existing-cms_revisions

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

## Context

* Route / page / component / user flow: `/admin/content/[id]`
* Parent epic: POR-379
* Schema already exists: `lib/db/schema/cms-revisions.ts`

## Current behavior

Edit page can save draft / submit review / publish / unpublish. Revisions are written (or should be) but there is no restore control. Plan listed this as half-wired.

## Expected / intended behavior

On the CMS edit page, list revisions (timestamp, actor, status snapshot) and restore one into the current draft without deleting history. Restoring creates a new revision. Only `admin` or `moderate` as existing capabilities require.

## Acceptance criteria

- [ ] Revision list on `/admin/content/[id]`
- [ ] Restore copies title/slug/excerpt/body/hero into the working draft and sets status to draft unless already draft
- [ ] Restore is audited
- [ ] Empty revision list has a clear empty state
- [ ] Verification: edit an entry twice, restore first revision, confirm body matches and a new revision row exists; `bun run typecheck`

## Out of scope / do not change

* BlockNote
* Scheduled publish
* Public preview tokens (separate issue)

## Notes for implementer

Touch:

* `app/admin/content/[id]` edit page — revision list + Restore button
* `app/api/admin/cms/*` — POST restore; reuse existing PATCH draft/publish handlers
* `lib/db/schema/cms-revisions.ts` + `cms-entries.ts` (`publishedAt` is live-at, do not use it as restore target)
* `lib/admin/audit.ts`

Restore copies title, slug, excerpt, body, hero into the working row, forces status `draft` if it was published/in_review (do not silently republish), writes a new revision row with actor + timestamp. Never DELETE old revisions.

Capabilities: same as edit (`admin` or `moderate`).
