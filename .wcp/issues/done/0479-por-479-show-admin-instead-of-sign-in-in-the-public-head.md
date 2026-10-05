---
id: "0479"
title: "Show Admin instead of Sign in in the public header when already signed in"
status: done
priority: normal
assignee:
lease_expires:
scope: "Imported from Linear POR-479. Stay inside that description."
acceptance: "Show Admin instead of Sign in in the public header when already signed in"
files: []
commit:
reason:
created: "2026-08-31T20:31:58.281Z"
linear_id: "POR-479"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-479/show-admin-instead-of-sign-in-in-the-public-header-when-already-signed"
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
linear_updated: "2026-09-01T15:04:20.640Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-479
- URL: https://linear.app/teton-web-ventures/issue/POR-479/show-admin-instead-of-sign-in-in-the-public-header-when-already-signed
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
- Created: 2026-08-31T20:31:58.281Z
- Updated: 2026-09-01T15:04:20.640Z
- Completed: 2026-09-01T15:04:20.574Z
- Canceled: no
- Archived: no
- Branch: por-479-show-admin-instead-of-sign-in-in-the-public-header-when

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

# Show Admin instead of Sign in in the public header when already signed in

## Implementer contract

* You are implementing **this ticket only**. Do not restyle the public header beyond this control.
* Mirror the existing Sign in `Link` classes.
* Never commit secrets.

## Intensity

* Band: standard
* Why: isolated header session branch
* Proof: on

## Summary

After signing in, public pages (`/`, `/walk-draft-page`, `/articles`) still show **Sign in**. Clicking it hits `/login` while a session exists. Operators have **View Site** from admin but no way back to `/admin` from the public chrome.

## User report

> Signed in, published `/walk-draft-page`, opened the public URL. Header still **Sign in**. Same on `/` at 375×812 (`screenshots/walk-20260831-full/home-375.png`). Admin shell already has View Site → `/`.

## Current behavior

* Evidence: `components/site-header.tsx` ~L50–56 — always `Link href="/login"` Sign in
* Evidence: `app/(public)/layout.tsx` — header has no session prop

## Expected behavior

* Signed out: **Sign in** → `/login` (unchanged).
* Signed in: **Admin** → `/admin` (same text-sm muted classes).
* Do not show both. Do not add Sign Out to the public header (admin already has it).

## Suspected root cause / scope

Confirmed: header is static. Scope: pass session (or a boolean) from `PublicLayout` into `SiteHeader`.

## Code map

| Path | Role | Symbols / notes |
| -- | -- | -- |
| `components/site-header.tsx` | Public chrome | Sign in link ~L50–56 |
| `app/(public)/layout.tsx` | Server layout | `isEnabled` already; add `getSession` |
| `lib/auth.ts` | `getSession` | used by admin layout |

Primary package/app: repo root Next.js app

## Pattern to mirror

* **Mirror: **`app/admin/layout.tsx` calling `getSession()`
* **Why:** same session source

## Step-by-step implementation plan

1. In `PublicLayout`, `getSession()` and pass `signedIn={Boolean(session?.user)}`.
2. In `SiteHeader`, render Admin vs Sign in.
3. Drive `/` signed-out and signed-in.

## File-by-file changes

| Path | Action | What to change |
| -- | -- | -- |
| `app/(public)/layout.tsx` | edit | Session boolean |
| `components/site-header.tsx` | edit | Admin vs Sign in |

## Do not touch / out of scope

* Header wrap (separate ticket) except the control still pins top-right
* Auth shell `/login`

## Acceptance criteria

- [ ] Signed out `/`: **Sign in** → `/login`.
- [ ] Signed in `/`: **Admin** → `/admin`, no Sign in.
- [ ] 375×812 still no horizontal overflow.
- [ ] Verification commands pass.

## Test plan

**Manual:** signed-out `/` then after login visit `/` and click Admin.

## Verification

* `bun run lint`
* `bun run typecheck`
* `bun test tests`
* Manual: see Test plan

### Runtime proof

* Surface to drive: /
* Project verify skill / feature map: none
* Visual reference (UI): admin View Site button vs public Sign in
* Blast-radius fact: every public page header
* Observed end state that proves done: signed-in public header links to /admin

## Drift check (before implementing)

- [ ] `components/site-header.tsx` still exists and owns the behavior
- [ ] `Sign in always /login` still named as described
- [ ] `app/admin/layout.tsx getSession` still is the right mirror
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

* Label is Admin not Account; no Sign Out on public chrome.

## Walk metadata

* Kind: improvement
* Surface: /
* Viewport: both
* Auth: either
* Drive path: after login, open public /walk-draft-page — still Sign in
* Observed: public header ignores session
* Screenshot: screenshots/walk-20260831-full/home-375.png
* Coverage unit: /
