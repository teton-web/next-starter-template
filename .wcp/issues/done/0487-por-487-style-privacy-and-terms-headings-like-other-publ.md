---
id: "0487"
title: "Style privacy and terms headings like other public pages"
status: done
priority: normal
assignee:
lease_expires:
scope: "Imported from Linear POR-487. Stay inside that description."
acceptance: "Style privacy and terms headings like other public pages"
files: []
commit:
reason:
created: "2026-08-31T20:38:53.879Z"
linear_id: "POR-487"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-487/style-privacy-and-terms-headings-like-other-public-pages"
linear_status: "Done"
linear_status_type: "completed"
linear_team: "POR"
linear_project: "next-starter-template"
linear_assignee: "maintainer"
linear_labels: ["Improvement"]
linear_priority: "Medium"
linear_parent: "POR-461"
linear_cycle: ""
linear_due: ""
linear_updated: "2026-09-01T15:04:32.494Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-487
- URL: https://linear.app/teton-web-ventures/issue/POR-487/style-privacy-and-terms-headings-like-other-public-pages
- Linear status: Done (completed)
- Queue status: done
- Team: Portfolio (POR)
- Project: next-starter-template
- Assignee: maintainer
- Labels: Improvement
- Parent: POR-461 — UI walk – next-starter-template – 2026-08-31
- Priority: Medium
- Estimate: none
- Cycle: none
- Due: none
- Created: 2026-08-31T20:38:53.879Z
- Updated: 2026-09-01T15:04:32.494Z
- Completed: 2026-09-01T15:04:32.460Z
- Canceled: no
- Archived: no
- Branch: por-487-style-privacy-and-terms-headings-like-other-public-pages

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

# Style privacy and terms headings like other public pages

## Implementer contract

* You are implementing **this ticket only**. Do not rewrite legal copy.
* Add the same `h1` classes as Contact/Articles.
* Never commit secrets.

## Intensity

* Band: light
* Why: two className strings on existing h1s
* Proof: on

## Summary

`/privacy` and `/terms` use a bare `<h1>` while `/contact` and `/articles` use `text-3xl font-bold`. The legal pages look like unstyled HTML in the same public chrome.

## User report

> Signed out, footer **Privacy** → `/privacy`. Heading “Privacy policy” is small/unstyled vs Contact’s large bold h1. `/terms` matches. Screenshot: `screenshots/walk-20260831-full/privacy-unstyled-heading.png`.

## Current behavior

* Evidence: `app/(public)/privacy/page.tsx` ~L10 — `<h1>Privacy policy</h1>`
* Evidence: `app/(public)/terms/page.tsx` ~L10 — `<h1>Terms of use</h1>`
* Evidence: `app/(public)/contact/page.tsx` ~L38 — `<h1 className="text-3xl font-bold">Contact</h1>`

## Expected behavior

* Both legal h1s: `className="text-3xl font-bold"` (same as Contact).
* Body paragraphs unchanged (placeholder copy stays).

## Suspected root cause / scope

Confirmed: legal pages were scaffolded without the public heading token. Scope: those two h1s.

## Code map

| Path | Role | Symbols / notes |
| -- | -- | -- |
| `app/(public)/privacy/page.tsx` | Page | `PrivacyPage` |
| `app/(public)/terms/page.tsx` | Page | `TermsPage` |
| `app/(public)/contact/page.tsx` | Mirror | h1 classes |

Primary package/app: repo root Next.js app

## Pattern to mirror

* **Mirror:** Contact `h1 className="text-3xl font-bold"`

## Step-by-step implementation plan

1. Add the className on both legal h1s.
2. Open `/privacy` and `/terms` next to `/contact`.

## File-by-file changes

| Path | Action | What to change |
| -- | -- | -- |
| `app/(public)/privacy/page.tsx` | edit | h1 classes |
| `app/(public)/terms/page.tsx` | edit | h1 classes |

## Do not touch / out of scope

* Placeholder legal paragraphs (intentional starter stub)
* Footer links

## Acceptance criteria

- [ ] `/privacy` and `/terms` h1s match Contact’s type size/weight.
- [ ] Copy unchanged.
- [ ] Verification commands pass.

## Test plan

**Manual:** open the three routes and compare headings.

## Verification

* `bun run lint`
* `bun run typecheck`
* Manual: see Test plan

### Runtime proof

* Surface to drive: `/privacy`, `/terms`
* Visual reference: `/contact` h1; screenshot `privacy-unstyled-heading.png`
* Blast-radius fact: n/a
* Observed end state: legal titles are large bold

## Drift check (before implementing)

- [ ] Privacy/terms still have bare h1
- [ ] Contact still `text-3xl font-bold`
- [ ] Placeholder “Replace this placeholder…” still present
- [ ] metadata titles still Privacy / Terms
- [ ] `bun run typecheck` still exists

Snapshot: investigated at 2026-08-31, branch `dev`, HEAD `e46fea1`.

## Risks / blockers

* none
* Rollback note: remove the classes

## Platform / stack

* Canonical targets: Tailwind 4
* Must not use: none
* Migration dependency: none

## Related

* Parent epic: [POR-461](https://linear.app/teton-web-ventures/issue/POR-461/ui-walk-next-starter-template-2026-08-31)
* Related: none
* blockedBy: none
* Duplicate of: none

## Supersedes

* none

## Assumptions / pre-decided

* Do not add a kicker or extra layout; heading classes only.

## Walk metadata

* Kind: improvement
* Surface: /privacy, /terms
* Viewport: 1280×800
* Auth: signed-out
* Drive path: footer Privacy/Terms
* Observed: unstyled h1 vs Contact
* Screenshot: screenshots/walk-20260831-full/privacy-unstyled-heading.png
* Coverage unit: /privacy
