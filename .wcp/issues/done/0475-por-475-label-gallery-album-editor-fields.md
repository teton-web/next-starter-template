---
id: "0475"
title: "Label gallery album editor fields"
status: done
priority: normal
assignee:
lease_expires:
scope: "Imported from Linear POR-475. Stay inside that description."
acceptance: "Label gallery album editor fields"
files: []
commit:
reason:
created: "2026-08-31T20:30:21.768Z"
linear_id: "POR-475"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-475/label-gallery-album-editor-fields"
linear_status: "Done"
linear_status_type: "completed"
linear_team: "POR"
linear_project: "next-starter-template"
linear_assignee: "maintainer"
linear_labels: ["Bug"]
linear_priority: "Medium"
linear_parent: "POR-461"
linear_cycle: ""
linear_due: ""
linear_updated: "2026-09-01T15:04:11.467Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-475
- URL: https://linear.app/teton-web-ventures/issue/POR-475/label-gallery-album-editor-fields
- Linear status: Done (completed)
- Queue status: done
- Team: Portfolio (POR)
- Project: next-starter-template
- Assignee: maintainer
- Labels: Bug
- Parent: POR-461 — UI walk – next-starter-template – 2026-08-31
- Priority: Medium
- Estimate: none
- Cycle: none
- Due: none
- Created: 2026-08-31T20:30:21.768Z
- Updated: 2026-09-01T15:04:11.467Z
- Completed: 2026-09-01T15:04:11.434Z
- Canceled: no
- Archived: no
- Branch: por-475-label-gallery-album-editor-fields

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

# Label gallery album editor fields

## Implementer contract

* You are implementing **this ticket only**. Do not change publish/upload.
* Mirror `Label` usage on `/admin/users` Invite.
* Never commit secrets.

## Intensity

* Band: standard
* Why: isolated labels on album detail
* Proof: on

## Summary

Album manage page title/slug/description/sort inputs have no accessible names (same pattern as the CMS editor). Cover select has a name. Create-album list page does label Title / Slug / Description.

## User report

> `/admin/media/gallery/:id` for `walk-album`. Unlabeled textboxes for title and slug, unlabeled textarea, unlabeled spinbutton. Cover combobox named “Cover (first item if empty)”. Save/Publish/Delete present.

## Current behavior

* Evidence: `components/admin/gallery-album-detail.tsx` — raw `Input`/`Textarea` for title/slug/description/sort

## Expected behavior

* Visible labels: **Title**, **Slug**, **Description**, **Sort order**, plus existing cover select.
* `h1` can remain “Album” or include the title; not required in this ticket.

## Code map

| Path | Role | Symbols / notes |
| -- | -- | -- |
| `components/admin/gallery-album-detail.tsx` | Editor | unlabeled inputs |
| `components/admin/gallery-album-list.tsx` | Create form | already labeled Title/Slug |

Primary package/app: repo root Next.js app

## Pattern to mirror

* **Mirror:** labeled create form on the album list page

## Step-by-step implementation plan

1. Add `Label` + `id` on album detail fields.
2. Snapshot manage page.

## File-by-file changes

| Path | Action | What to change |
| -- | -- | -- |
| `components/admin/gallery-album-detail.tsx` | edit | Labels |

## Do not touch / out of scope

* CMS editor (separate ticket on this epic)
* Public gallery

## Acceptance criteria

- [ ] Title, slug, description, sort order have accessible names.
- [ ] Save/Publish still work.
- [ ] Verification commands pass.

## Test plan

**Manual:** open an album, inspect labels.

## Verification

* `bun run lint`
* `bun run typecheck`
* `bun test tests`
* Manual: see Test plan

### Runtime proof

* Surface to drive: /admin/media/gallery/[albumId]
* Project verify skill / feature map: none
* Visual reference (UI): album list create form labels
* Blast-radius fact: gallery album detail only
* Observed end state that proves done: album editor fields labeled

## Drift check (before implementing)

- [ ] `components/admin/gallery-album-detail.tsx` still exists and owns the behavior
- [ ] `unlabeled title/slug inputs` still named as described
- [ ] `gallery-album-list labeled Title` still is the right mirror
- [ ] `bun run typecheck` still exists
- [ ] Walk evidence still matches current UI

Snapshot: investigated at 2026-08-31, branch `dev`, HEAD `e46fea1`.

## Risks / blockers

* none
* Rollback note: revert the listed files

## Platform / stack

* Canonical targets: Next.js 16 App Router, Better Auth, Neon/Drizzle, Tailwind 4, shadcn/ui
* Must not use / abandoned for this work: Server Actions; `db:push`
* Migration dependency: none

## Related

* Parent epic: [POR-461](https://linear.app/teton-web-ventures/issue/POR-461/ui-walk-next-starter-template-2026-08-31)
* Related: none
* blockedBy: none
* Duplicate of: none

## Supersedes

* none

## Assumptions / pre-decided

* Same label words as the create form.

## Walk metadata

* Kind: bug
* Surface: /admin/media/gallery/[albumId]
* Viewport: 1280×800
* Auth: signed-in
* Drive path: Manage walk-album → unlabeled fields
* Observed: title/slug/description/sort have no names
* Screenshot: none
* Coverage unit: /admin/media/gallery/[albumId]
