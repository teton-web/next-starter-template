---
id: "0478"
title: "Gate admin Waitlist nav on the waitlist flag"
status: done
priority: normal
assignee:
lease_expires:
scope: "Imported from Linear POR-478. Stay inside that description."
acceptance: "Gate admin Waitlist nav on the waitlist flag"
files: []
commit:
reason:
created: "2026-08-31T20:31:56.066Z"
linear_id: "POR-478"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-478/gate-admin-waitlist-nav-on-the-waitlist-flag"
linear_status: "Done"
linear_status_type: "completed"
linear_team: "POR"
linear_project: "next-starter-template"
linear_assignee: "David Solheim <david@tetonweb.com>"
linear_labels: ["Improvement"]
linear_priority: "Medium"
linear_parent: "POR-461"
linear_cycle: ""
linear_due: ""
linear_updated: "2026-09-01T15:04:19.781Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-478
- URL: https://linear.app/teton-web-ventures/issue/POR-478/gate-admin-waitlist-nav-on-the-waitlist-flag
- Linear status: Done (completed)
- Queue status: done
- Team: Portfolio (POR)
- Project: next-starter-template
- Assignee: David Solheim <david@tetonweb.com>
- Labels: Improvement
- Parent: POR-461 — UI walk – next-starter-template – 2026-08-31
- Priority: Medium
- Estimate: none
- Cycle: none
- Due: none
- Created: 2026-08-31T20:31:56.066Z
- Updated: 2026-09-01T15:04:19.781Z
- Completed: 2026-09-01T15:04:19.754Z
- Canceled: no
- Archived: no
- Branch: david/por-478-gate-admin-waitlist-nav-on-the-waitlist-flag

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

# Gate admin Waitlist nav on the waitlist flag

## Implementer contract

* You are implementing **this ticket only**. Do not change `/admin/waitlist` auth.
* Mirror how Galleries is gated on `galleriesEnabled`.
* Never commit secrets.

## Intensity

* Band: standard
* Why: one nav flag gate
* Proof: on

## Summary

Galleries appears in `AdminShell` only when `galleriesEnabled`. Waitlist always shows for `canAdmin`, even when the waitlist flag is off and `/waitlist` 404s. Operators get a nav item for a dark module.

## User report

> Before enabling flags, admin header already had **Waitlist**. `/waitlist` public was 404. After enabling waitlist on `/admin/features`, public `/waitlist` worked. Galleries link appeared only after the galleries flag was on.

## Current behavior

* Evidence: `app/admin/admin-shell.tsx` ~L44–48 Galleries gated; ~L56–60 Waitlist only `canAdmin`
* Evidence: `app/admin/layout.tsx` passes `galleriesEnabled` only

## Expected behavior

* **Waitlist** shell link shows only when waitlist is enabled (`isEnabled("waitlist")`), same as Galleries.
* `/admin/waitlist` URL may still work for `canAdmin` (bookmark); this ticket is the nav item.
* Do not hide the Features toggle.

## Suspected root cause / scope

Confirmed: Waitlist nav was added without the flag prop. Scope: `layout.tsx` + `admin-shell.tsx`.

## Code map

| Path | Role | Symbols / notes |
| -- | -- | -- |
| `app/admin/layout.tsx` | Pass flags | `galleriesEnabled` today |
| `app/admin/admin-shell.tsx` | Nav | Galleries vs Waitlist |
| `lib/flags/resolve.ts` | `isEnabled` | `waitlist` |

Primary package/app: repo root Next.js app

## Pattern to mirror

* **Mirror:** Galleries `{galleriesEnabled ? <Link href="/admin/media/gallery">Galleries</Link> : null}`

## Step-by-step implementation plan

1. `isEnabled("waitlist")` in `app/admin/layout.tsx`; pass `waitlistEnabled`.
2. Gate the Waitlist link on that prop.
3. With flag off, header has no Waitlist; with flag on, it does.

## File-by-file changes

| Path | Action | What to change |
| -- | -- | -- |
| `app/admin/layout.tsx` | edit | Resolve waitlist flag |
| `app/admin/admin-shell.tsx` | edit | Gate Waitlist link |

## Do not touch / out of scope

* Public header waitlist (already flagged)
* Waitlist list page empty copy

## Acceptance criteria

- [ ] Waitlist flag off: admin chrome has no Waitlist link.
- [ ] Waitlist flag on: Waitlist link → `/admin/waitlist`.
- [ ] Galleries gating unchanged.
- [ ] Verification commands pass.

## Test plan

**Manual:** Features off → no Waitlist nav; toggle on → nav appears (may need a refresh if RSC cache).

## Verification

* `bun run lint`
* `bun run typecheck`
* `bun test tests`
* Manual: see Test plan

### Runtime proof

* Surface to drive: /admin/waitlist
* Project verify skill / feature map: none
* Visual reference (UI): Galleries link appearing only after flag on
* Blast-radius fact: admin-shell Waitlist item
* Observed end state that proves done: Waitlist nav tracks the waitlist flag

## Drift check (before implementing)

- [ ] `app/admin/admin-shell.tsx` still exists and owns the behavior
- [ ] `Waitlist canAdmin-only link` still named as described
- [ ] `Galleries galleriesEnabled link` still is the right mirror
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

* Gate the nav only; do not 404 /admin/waitlist in this ticket.

## Walk metadata

* Kind: improvement
* Surface: /admin/waitlist
* Viewport: 1280×800
* Auth: signed-in
* Drive path: admin header showed Waitlist while public /waitlist 404
* Observed: Waitlist always in admin nav; Galleries not
* Screenshot: none
* Coverage unit: /admin/waitlist
