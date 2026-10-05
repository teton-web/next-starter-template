---
id: "0476"
title: "Add a text separator in the CMS preview “not indexed” banner"
status: done
priority: normal
assignee:
lease_expires:
scope: "Imported from Linear POR-476. Stay inside that description."
acceptance: "Add a text separator in the CMS preview “not indexed” banner"
files: []
commit:
reason:
created: "2026-08-31T20:30:24.588Z"
linear_id: "POR-476"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-476/add-a-text-separator-in-the-cms-preview-not-indexed-banner"
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
linear_updated: "2026-09-01T15:04:16.707Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-476
- URL: https://linear.app/teton-web-ventures/issue/POR-476/add-a-text-separator-in-the-cms-preview-not-indexed-banner
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
- Created: 2026-08-31T20:30:24.588Z
- Updated: 2026-09-01T15:04:16.707Z
- Completed: 2026-09-01T15:04:16.652Z
- Canceled: no
- Archived: no
- Branch: por-476-add-a-text-separator-in-the-cms-preview-not-indexed-banner

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

# Add a text separator in the CMS preview “not indexed” banner

## Implementer contract

* You are implementing **this ticket only**. Do not restyle preview.
* Insert a real space or middot in the DOM text, not only `ml-2`.
* Never commit secrets.

## Intensity

* Band: standard
* Why: one-line copy/a11y on preview chrome
* Proof: on

## Summary

Unpublished preview banner is “Unpublished preview” plus a muted span “not indexed” with `ml-2` but **no space character**. `document.body.innerText` and the a11y tree concatenate to `Unpublished previewnot indexed`.

## User report

> Opened Preview from the CMS editor. Banner innerText: “Unpublished previewnot indexed”. Status badge `draft` and Edit still worked. Title: `Preview: Walk draft page · Next.js Starter Template`.

## Current behavior

* Evidence: `app/admin/preview/[idOrSlug]/page.tsx` ~L65–68

```tsx
{unpublished ? "Unpublished preview" : "Preview"}
<span className="ml-2 font-normal text-muted-foreground">not indexed</span>
```

## Expected behavior

* Accessible/plain text is `Unpublished preview · not indexed` or `Unpublished preview not indexed` (space or middot in the text node).
* Visual muted styling may stay.
* Published preview: `Preview · not indexed` (same separator).

## Suspected root cause / scope

Confirmed: CSS margin is not a word separator for innerText/SR. Scope: that `<p>`.

## Code map

| Path | Role | Symbols / notes |
| -- | -- | -- |
| `app/admin/preview/[idOrSlug]/page.tsx` | Banner | ~L65–68 |

Primary package/app: repo root Next.js app

## Pattern to mirror

* **Mirror:** dashboard audit `·` separators in `formatAuditSummary`

## Step-by-step implementation plan

1. Put `{" · "}` (or a leading space) inside the span or between nodes.
2. Drive unpublished preview and read `innerText`.

## File-by-file changes

| Path | Action | What to change |
| -- | -- | -- |
| `app/admin/preview/[idOrSlug]/page.tsx` | edit | Text separator |

## Do not touch / out of scope

* Preview document body
* robots/noindex metadata (already set)

## Acceptance criteria

- [ ] Unpublished preview `innerText` contains a break between “preview” and “not indexed” (space or `·`).
- [ ] Edit button still goes to `/admin/content/:id`.
- [ ] Verification commands pass.

## Test plan

**Manual:** unpublished preview banner copy.

## Verification

* `bun run lint`
* `bun run typecheck`
* `bun test tests`
* Manual: see Test plan

### Runtime proof

* Surface to drive: /admin/preview/[idOrSlug]
* Project verify skill / feature map: none
* Visual reference (UI): draft badge next to the banner
* Blast-radius fact: preview chrome only
* Observed end state that proves done: innerText is not previewnot indexed

## Drift check (before implementing)

- [ ] `app/admin/preview/[idOrSlug]/page.tsx` still exists and owns the behavior
- [ ] `not indexed span with ml-2 only` still named as described
- [ ] `formatAuditSummary middot` still is the right mirror
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

* Use a middot with spaces:  `· not indexed`.

## Walk metadata

* Kind: bug
* Surface: /admin/preview/[idOrSlug]
* Viewport: 1280×800
* Auth: signed-in
* Drive path: Preview from CMS editor → innerText banner
* Observed: Unpublished previewnot indexed
* Screenshot: none
* Coverage unit: /admin/preview/[idOrSlug]
