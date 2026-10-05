---
id: "0484"
title: "Replace CMS hero media id text field with a library picker"
status: done
priority: normal
assignee:
lease_expires:
scope: "Imported from Linear POR-484. Stay inside that description."
acceptance: "Replace CMS hero media id text field with a library picker"
files: []
commit:
reason:
created: "2026-08-31T20:33:01.353Z"
linear_id: "POR-484"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-484/replace-cms-hero-media-id-text-field-with-a-library-picker"
linear_status: "Done"
linear_status_type: "completed"
linear_team: "POR"
linear_project: "next-starter-template"
linear_assignee: "maintainer"
linear_labels: ["Feature"]
linear_priority: "Low"
linear_parent: "POR-461"
linear_cycle: ""
linear_due: ""
linear_updated: "2026-09-01T15:04:28.650Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-484
- URL: https://linear.app/teton-web-ventures/issue/POR-484/replace-cms-hero-media-id-text-field-with-a-library-picker
- Linear status: Done (completed)
- Queue status: done
- Team: Portfolio (POR)
- Project: next-starter-template
- Assignee: maintainer
- Labels: Feature
- Parent: POR-461 — UI walk – next-starter-template – 2026-08-31
- Priority: Low
- Estimate: none
- Cycle: none
- Due: none
- Created: 2026-08-31T20:33:01.353Z
- Updated: 2026-09-01T15:04:28.650Z
- Completed: 2026-09-01T15:04:28.629Z
- Canceled: no
- Archived: no
- Branch: por-484-replace-cms-hero-media-id-text-field-with-a-library-picker

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

# Replace CMS hero media id text field with a library picker

## Implementer contract

* You are implementing **this ticket only**. Reuse existing media list API / cover select pattern.
* Do not add a new media library.
* Never commit secrets.

## Intensity

* Band: heavy
* Why: new editor control wired to existing media API
* Proof: on

## Summary

CMS editor “Hero media asset id” is a raw UUID text field. Gallery album detail already offers a **Cover **`<select>` of library filenames. Operators cannot reasonably paste ids.

## User report

> CMS edit for Walk draft page showed placeholder “Hero media asset id” with no picker. Gallery album cover combobox listed `placeholder-user.jpg` by filename. Media library had `placeholder.jpg` after upload.

## Current behavior

* Evidence: `app/admin/content/[id]/page.tsx` hero `Input` ~L89–93
* Evidence: `components/admin/gallery-album-detail.tsx` cover `<select>` of assets

## Expected behavior

* Hero control is a select (or combobox) of current media assets: empty option **No hero** plus filename labels, value = asset id.
* Saving still PATCHes `heroMediaId`.
* If the library is empty, helper text: **Upload a file in Media first.**
* Keep the field labeled (CMS editor labels ticket may land first; if labels exist, keep them).

## Suspected root cause / scope

Confirmed: leftover id field. Scope: CMS editor hero control; GET `/api/admin/media` already lists assets.

## Code map

| Path | Role | Symbols / notes |
| -- | -- | -- |
| `app/admin/content/[id]/page.tsx` | Editor | `heroMediaId` |
| `components/admin/gallery-album-detail.tsx` | Mirror select | cover options |
| `app/api/admin/media/route.ts` | GET assets |  |

Primary package/app: repo root Next.js app

## Pattern to mirror

* **Mirror:** album cover `<select>` of filenames with asset ids as values

## Step-by-step implementation plan

1. Fetch `/api/admin/media?q=` (SWR) on the editor.
2. Replace the text input with a select of `id`/`filename`.
3. Publish/preview still shows hero if one is chosen (existing `CmsDocument` heroUrl).

## File-by-file changes

| Path | Action | What to change |
| -- | -- | -- |
| `app/admin/content/[id]/page.tsx` | edit | Hero select from media list |

## Do not touch / out of scope

* Crop UI
* New upload on the CMS page (link to Media is enough)

## Acceptance criteria

- [ ] Hero control lists filenames, not a free-typed UUID.
- [ ] Empty library: No hero + helper text.
- [ ] Saving a selected image persists `heroMediaId`.
- [ ] Verification commands pass.

## Test plan

**Manual:** upload in Media, edit CMS, pick file, save, preview.

## Verification

* `bun run lint`
* `bun run typecheck`
* `bun test tests`
* Manual: see Test plan

### Runtime proof

* Surface to drive: /admin/content/[id]
* Project verify skill / feature map: none
* Visual reference (UI): gallery album Cover select
* Blast-radius fact: CMS editor hero field only
* Observed end state that proves done: hero is chosen from media filenames

## Drift check (before implementing)

- [ ] `app/admin/content/[id]/page.tsx` still exists and owns the behavior
- [ ] `heroMediaId text Input` still named as described
- [ ] `gallery-album-detail cover select` still is the right mirror
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
* Related: CMS editor labels ticket (POR-466)
* blockedBy: none
* Duplicate of: none

## Supersedes

* none

## Assumptions / pre-decided

* Select is enough; no modal picker in this ticket.

## Walk metadata

* Kind: idea
* Surface: /admin/content/[id]
* Viewport: 1280×800
* Auth: signed-in
* Drive path: CMS editor hero id vs album cover select
* Observed: raw UUID field next to a filename picker elsewhere
* Screenshot: none
* Coverage unit: /admin/content/[id]
