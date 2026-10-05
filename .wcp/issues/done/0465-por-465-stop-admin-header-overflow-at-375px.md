---
id: "0465"
title: "Stop admin header overflow at 375px"
status: done
priority: high
assignee:
lease_expires:
scope: "Imported from Linear POR-465. Stay inside that description."
acceptance: "Stop admin header overflow at 375px"
files: []
commit:
reason:
created: "2026-08-31T20:26:31.987Z"
linear_id: "POR-465"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-465/stop-admin-header-overflow-at-375px"
linear_status: "Done"
linear_status_type: "completed"
linear_team: "POR"
linear_project: "next-starter-template"
linear_assignee: "maintainer"
linear_labels: ["Bug"]
linear_priority: "High"
linear_parent: "POR-461"
linear_cycle: ""
linear_due: ""
linear_updated: "2026-09-01T15:04:05.067Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-465
- URL: https://linear.app/teton-web-ventures/issue/POR-465/stop-admin-header-overflow-at-375px
- Linear status: Done (completed)
- Queue status: done
- Team: Portfolio (POR)
- Project: next-starter-template
- Assignee: maintainer
- Labels: Bug
- Parent: POR-461 — UI walk – next-starter-template – 2026-08-31
- Priority: High
- Estimate: none
- Cycle: none
- Due: none
- Created: 2026-08-31T20:26:31.987Z
- Updated: 2026-09-01T15:04:05.067Z
- Completed: 2026-09-01T15:04:04.985Z
- Canceled: no
- Archived: no
- Branch: por-465-stop-admin-header-overflow-at-375px

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

# Stop admin header overflow at 375px

## Implementer contract

* You are implementing **this ticket only**. Do not restyle admin pages.
* Prefer wrapping/stacking the existing links; do not add a new nav library.
* Never commit secrets.

## Intensity

* Band: standard
* Why: isolated admin chrome layout
* Proof: on

## Summary

The admin shell is a single horizontal row of links plus email and Sign Out. At 375×812 the header truncates (**Feat** instead of Features) and `documentElement.scrollWidth` is ~912px vs ~360px client width, so the dashboard scrolls sideways. Public header already wraps; admin does not.

## User report

> Signed in as seed admin, `/admin` at 375×812. Header: Admin, Content, Media, Users, Audit, **Feat** clipped. Horizontal scrollbar. Sign Out / email off-screen. Screenshot: `screenshots/walk-20260831-full/admin-375.png`. Same chrome on `/admin/content`.

## Current behavior

* Evidence: `app/admin/admin-shell.tsx` (`AdminShell`, ~L38–79) — `flex items-center justify-between` with an unwrapped link cluster
* Public mirror: `components/site-header.tsx` uses `flex-wrap`

## Expected behavior

* At 375×812, `/admin` has no horizontal page scroll (`scrollWidth === clientWidth`).
* Every admin destination remains reachable without sideways pan: Content, Media, Users, Audit, Features, Waitlist (if shown), Account, View Site, Sign Out.
* Prefer wrapping the link row under the “Admin” title, or a compact overflow menu that lists the same hrefs. Do not hide destinations.
* 1280×800 still shows the full row.

## Suspected root cause / scope

Confirmed: non-wrapping flex row. Scope: `admin-shell.tsx` header only.

## Code map

| Path | Role | Symbols / notes |
| -- | -- | -- |
| `app/admin/admin-shell.tsx` | Admin chrome | `AdminShell` ~L38–79 |
| `app/admin/layout.tsx` | Mounts shell | `galleriesEnabled` |
| `components/site-header.tsx` | Wrap pattern | `flex-wrap` |

Primary package/app: repo root Next.js app

## Relevant contracts (types / APIs / data)

* **Props: **`AdminShell({ canAdmin, galleriesEnabled, children })`
* **Auth:** signed-in admin only

## Code anchors (excerpts)

### `app/admin/admin-shell.tsx` — header (~L38–48)

```tsx
<header className="border-b bg-card">
  <div className="container mx-auto px-4 py-4 flex items-center justify-between">
    <div className="flex items-center gap-4">
      <h1 className="text-2xl font-bold">Admin</h1>
      <Link href="/admin/content" className="text-sm hover:underline">Content</Link>
```

### Pattern to mirror

* **Mirror: **`components/site-header.tsx` wrapping cluster
* **Why:** same product, already handles 375px

## Step-by-step implementation plan

1. Allow the admin link cluster to wrap (`flex-wrap`, smaller gap) or stack email/Sign Out under the links.
2. Keep `h1` “Admin” as chrome (do not turn it into the page title).
3. Verify `/admin` and `/admin/content` at 375×812 and 1280×800.

## File-by-file changes

| Path | Action | What to change |
| -- | -- | -- |
| `app/admin/admin-shell.tsx` | edit | Wrapping / stacking header |
| `components/site-header.tsx` | do not touch | public header is a separate ticket |

## Do not touch / out of scope

* Admin page bodies
* Adding Contact (separate ticket)
* Public header wrap (separate ticket)

## Acceptance criteria

- [ ] `/admin` at 375×812: no horizontal overflow; Features is fully readable or in a menu that opens.
- [ ] Content, Media, Account, Sign Out remain reachable.
- [ ] 1280×800 still shows the existing link set.
- [ ] Verification commands pass.

## Test plan

**Manual:**

1. Sign in, set viewport 375×812, open `/admin`.
2. Confirm no sideways scroll; click Features and Account.
3. Repeat at 1280×800.

## Verification

* `bun run lint`
* `bun run typecheck`
* `bun test tests`
* Manual: see Test plan

### Runtime proof

* Surface to drive: /admin
* Project verify skill / feature map: none
* Visual reference (UI): screenshots/walk-20260831-full/admin-375.png
* Blast-radius fact: admin-shell wraps every /admin/* page
* Observed end state that proves done: 375px /admin has no horizontal scroll; all nav items reachable

## Drift check (before implementing)

- [ ] `app/admin/admin-shell.tsx` still exists and owns the behavior
- [ ] `AdminShell header flex row` still named as described
- [ ] `components/site-header.tsx` still is the right mirror
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

* Parent epic: [POR-461](https://linear.app/teton-web-ventures/issue/POR-461)
* Related: none
* blockedBy: none
* Duplicate of: none

## Supersedes

* none

## Assumptions / pre-decided

* Wrapping is enough; a hamburger is allowed only if wrap still overflows.

## Walk metadata

* Kind: bug
* Surface: /admin
* Viewport: 375×812
* Auth: signed-in
* Drive path: set viewport 375 812 → /admin → measure scrollWidth
* Observed: scrollWidth 912 vs clientWidth 360; Features clipped
* Screenshot: screenshots/walk-20260831-full/admin-375.png
* Coverage unit: /admin
