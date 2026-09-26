---
id: "0483"
title: "Add an empty state on /admin/content when there are no entries"
status: done
priority: normal
assignee:
lease_expires:
scope: "Imported from Linear POR-483. Stay inside that description."
acceptance: "Add an empty state on /admin/content when there are no entries"
files: []
commit:
reason:
created: "2026-08-31T20:32:58.493Z"
linear_id: "POR-483"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-483/add-an-empty-state-on-admincontent-when-there-are-no-entries"
linear_status: "Done"
linear_status_type: "completed"
linear_team: "POR"
linear_project: "next-starter-template"
linear_assignee: "David Solheim <david@tetonweb.com>"
linear_labels: ["Improvement"]
linear_priority: "Low"
linear_parent: "POR-461"
linear_cycle: ""
linear_due: ""
linear_updated: "2026-09-01T15:04:27.175Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-483
- URL: https://linear.app/teton-web-ventures/issue/POR-483/add-an-empty-state-on-admincontent-when-there-are-no-entries
- Linear status: Done (completed)
- Queue status: done
- Team: Portfolio (POR)
- Project: next-starter-template
- Assignee: David Solheim <david@tetonweb.com>
- Labels: Improvement
- Parent: POR-461 — UI walk – next-starter-template – 2026-08-31
- Priority: Low
- Estimate: none
- Cycle: none
- Due: none
- Created: 2026-08-31T20:32:58.493Z
- Updated: 2026-09-01T15:04:27.175Z
- Completed: 2026-09-01T15:04:27.106Z
- Canceled: no
- Archived: no
- Branch: david/por-483-add-an-empty-state-on-admincontent-when-there-are-no-entries

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

# Add an empty state on /admin/content when there are no entries

## Implementer contract

* You are implementing **this ticket only**. Keep the create-draft form.
* Mirror dashboard “No drafts or entries in review.”
* Never commit secrets.

## Intensity

* Band: standard
* Why: one empty branch
* Proof: on

## Summary

`/admin/content` always renders an empty `<ul className="divide-y rounded-lg border">` when `entries` is []. Fresh clones see a blank bordered hole under Create draft. Dashboard already has a sentence for no drafts.

## User report

> Signed in, `/admin/content` before creating a draft: heading Content, Title field, Page/Article select, Create draft, then an empty list with no copy. Creating “Walk draft page” filled the list.

## Current behavior

* Evidence: `app/admin/content/page.tsx` ~L53–73 — `entries.map` into `ul` with no empty branch

## Expected behavior

* When `entries.length === 0`, show muted copy: **No content yet. Create a draft with the form above.**
* Do not render an empty bordered `ul`.
* When there are rows, keep today’s list + Preview/Edit.

## Code map

| Path | Role | Symbols / notes |
| -- | -- | -- |
| `app/admin/content/page.tsx` | List | `AdminContentPage` |
| `app/admin/page.tsx` | Mirror empty sentence | “No drafts or entries in review.” |

Primary package/app: repo root Next.js app

## Pattern to mirror

* **Mirror: **`app/admin/page.tsx` empty drafts paragraph

## Step-by-step implementation plan

1. Branch on `entries.length`.
2. Drive `/admin/content` with zero rows (or filter mentally after delete — do not delete published walk data if unsafe).

## File-by-file changes

| Path | Action | What to change |
| -- | -- | -- |
| `app/admin/content/page.tsx` | edit | Empty copy; hide empty ul |

## Do not touch / out of scope

* Create-draft API errors
* Filters/search

## Acceptance criteria

- [ ] Zero entries: sentence, no empty bordered list.
- [ ] ≥1 entry: list rows unchanged.
- [ ] Verification commands pass.

## Test plan

**Manual:** empty content list vs one draft.

## Verification

* `bun run lint`
* `bun run typecheck`
* `bun test tests`
* Manual: see Test plan

### Runtime proof

* Surface to drive: /admin/content
* Project verify skill / feature map: none
* Visual reference (UI): dashboard empty drafts sentence
* Blast-radius fact: /admin/content list only
* Observed end state that proves done: empty content page has copy, not a blank ul

## Drift check (before implementing)

- [ ] `app/admin/content/page.tsx` still exists and owns the behavior
- [ ] `entries.map ul` still named as described
- [ ] `app/admin/page.tsx empty drafts` still is the right mirror
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

* Exact copy: No content yet. Create a draft with the form above.

## Walk metadata

* Kind: improvement
* Surface: /admin/content
* Viewport: 1280×800
* Auth: signed-in
* Drive path: open /admin/content with empty list
* Observed: empty ul, no empty copy
* Screenshot: none
* Coverage unit: /admin/content
