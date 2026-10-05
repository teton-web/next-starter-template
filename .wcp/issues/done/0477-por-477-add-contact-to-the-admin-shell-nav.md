---
id: "0477"
title: "Add Contact to the admin shell nav"
status: done
priority: normal
assignee:
lease_expires:
scope: "Imported from Linear POR-477. Stay inside that description."
acceptance: "Add Contact to the admin shell nav"
files: []
commit:
reason:
created: "2026-08-31T20:31:54.459Z"
linear_id: "POR-477"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-477/add-contact-to-the-admin-shell-nav"
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
linear_updated: "2026-09-01T15:04:18.707Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-477
- URL: https://linear.app/teton-web-ventures/issue/POR-477/add-contact-to-the-admin-shell-nav
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
- Created: 2026-08-31T20:31:54.459Z
- Updated: 2026-09-01T15:04:18.707Z
- Completed: 2026-09-01T15:04:18.678Z
- Canceled: no
- Archived: no
- Branch: por-477-add-contact-to-the-admin-shell-nav

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

# Add Contact to the admin shell nav

## Implementer contract

* You are implementing **this ticket only**. Do not restyle the shell.
* Mirror the existing `Link` items (Content, Audit).
* Never commit secrets.

## Intensity

* Band: standard
* Why: one admin nav link
* Proof: on

## Summary

`/admin` dashboard has a Contact section with **View all** → `/admin/contact`, but `AdminShell` has no Contact link. Waitlist is in the shell for `canAdmin`. Operators cannot reach inquiries from other admin pages without returning to the dashboard.

## User report

> Signed in, `/admin` dashboard listed contact inquiries and **View all**. Header links: Content, Media, Users, Audit, Features, Waitlist, Account — no Contact. `/admin/contact` loaded the full list when opened directly.

## Current behavior

* Evidence: `app/admin/admin-shell.tsx` ~L42–61 — Waitlist when `canAdmin`; no Contact
* Evidence: `app/admin/page.tsx` ~L79–83 — Contact **View all**
* Evidence: `app/admin/contact/page.tsx` — full list for `admin` capability

## Expected behavior

* When `canAdmin` is true, shell shows **Contact** linking to `/admin/contact`, next to Audit or Waitlist.
* Same `text-sm hover:underline` as siblings.
* Non-admin users still omit it (dashboard already hides Contact without `admin`).

## Suspected root cause / scope

Confirmed: dashboard grew a Contact module; shell was not updated. Scope: `admin-shell.tsx` one link.

## Code map

| Path | Role | Symbols / notes |
| -- | -- | -- |
| `app/admin/admin-shell.tsx` | Nav | `canAdmin` Waitlist link ~L56–60 |
| `app/admin/page.tsx` | Dashboard Contact | ~L77–101 |
| `app/admin/contact/page.tsx` | Destination | `checkCapability(..., "admin")` |

Primary package/app: repo root Next.js app

## Pattern to mirror

* **Mirror:** Waitlist `canAdmin` link in `AdminShell`
* **Why:** same capability gate

## Step-by-step implementation plan

1. Add `<Link href="/admin/contact">Contact</Link>` inside the `canAdmin` cluster (beside Waitlist).
2. Click it from `/admin/content` and land on `/admin/contact`.

## File-by-file changes

| Path | Action | What to change |
| -- | -- | -- |
| `app/admin/admin-shell.tsx` | edit | Contact link when `canAdmin` |

## Do not touch / out of scope

* Inquiry detail pages
* Mobile wrap (admin header overflow ticket) except the new link must wrap with the rest

## Acceptance criteria

- [ ] Admin shell shows **Contact** for `canAdmin` and it goes to `/admin/contact`.
- [ ] Link is absent when `canAdmin` is false (if such a user exists).
- [ ] Dashboard **View all** still works.
- [ ] Verification commands pass.

## Test plan

**Manual:** sign in as admin, from `/admin/media` click Contact.

## Verification

* `bun run lint`
* `bun run typecheck`
* `bun test tests`
* Manual: see Test plan

### Runtime proof

* Surface to drive: /admin/contact
* Project verify skill / feature map: none
* Visual reference (UI): Waitlist link in the same header
* Blast-radius fact: admin-shell only
* Observed end state that proves done: Contact appears in admin nav and opens /admin/contact

## Drift check (before implementing)

- [ ] `app/admin/admin-shell.tsx` still exists and owns the behavior
- [ ] `canAdmin Waitlist link` still named as described
- [ ] `app/admin/page.tsx View all Contact` still is the right mirror
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

* Place Contact immediately before Waitlist.

## Walk metadata

* Kind: improvement
* Surface: /admin/contact
* Viewport: 1280×800
* Auth: signed-in
* Drive path: /admin dashboard View all vs missing header Contact
* Observed: Contact only on dashboard, not in shell
* Screenshot: none
* Coverage unit: /admin/contact
