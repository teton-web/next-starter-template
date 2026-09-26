---
id: "0387"
title: "Add image crop flow to admin media using existing react-image-crop"
status: done
priority: normal
assignee:
lease_expires:
scope: "Imported from Linear POR-387. Stay inside that description."
acceptance: "Context"
files: []
commit:
reason:
created: "2026-08-28T19:00:36.955Z"
linear_id: "POR-387"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-387/add-image-crop-flow-to-admin-media-using-existing-react-image-crop"
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
linear_updated: "2026-08-30T02:08:09.125Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-387
- URL: https://linear.app/teton-web-ventures/issue/POR-387/add-image-crop-flow-to-admin-media-using-existing-react-image-crop
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
- Created: 2026-08-28T19:00:36.955Z
- Updated: 2026-08-30T02:08:09.125Z
- Completed: 2026-08-30T02:08:09.092Z
- Canceled: no
- Archived: no
- Branch: david/por-387-add-image-crop-flow-to-admin-media-using-existing-react

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

## Context

* Route / page / component / user flow: `/admin/media`
* Parent epic: POR-379
* `react-image-crop` is already in package.json; no crop UI

## Current behavior

Media library uploads via `/api/upload` with MIME/signature checks. Admin media page has no crop. Dependency is unused product-wise.

## Expected / intended behavior

After selecting an image asset, admin can crop, save a new derivative (or replace if unused), and keep original if the asset is referenced. Use existing storage drivers (local disk dev, Blob preview/prod).

## Acceptance criteria

- [ ] Crop UI on an image in `/admin/media`
- [ ] Saved crop writes a valid image through the existing upload validation path
- [ ] Non-image assets do not show crop
- [ ] Verification: crop a JPEG, confirm new dimensions in library; `bun run typecheck`

## Out of scope / do not change

* Video posters / Kectil gallery video thumbs
* Changing Blob vs local driver policy

## Notes for implementer

* Dependency already in `package.json`: `react-image-crop`
* Validate output through `lib/media/validate-upload.ts` (MIME + signature)
* Write via existing `lib/storage` drivers (`local-driver` dev, `blob-driver` preview/prod)
* If `media_usages` references the asset, save crop as a new asset; only replace in place when unused
* UI lives on `/admin/media` asset detail, not a new app section
* Do not crop video or non-image kinds
