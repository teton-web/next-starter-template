---
id: "0474"
title: "Keep Sign in on the first header row at 375px"
status: done
priority: normal
assignee:
lease_expires:
scope: "Imported from Linear POR-474. Stay inside that description."
acceptance: "Keep Sign in on the first header row at 375px"
files: []
commit:
reason:
created: "2026-08-31T20:30:20.322Z"
linear_id: "POR-474"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-474/keep-sign-in-on-the-first-header-row-at-375px"
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
linear_updated: "2026-09-01T15:04:10.489Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-474
- URL: https://linear.app/teton-web-ventures/issue/POR-474/keep-sign-in-on-the-first-header-row-at-375px
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
- Created: 2026-08-31T20:30:20.322Z
- Updated: 2026-09-01T15:04:10.489Z
- Completed: 2026-09-01T15:04:10.470Z
- Canceled: no
- Archived: no
- Branch: por-474-keep-sign-in-on-the-first-header-row-at-375px

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

# Keep Sign in on the first header row at 375px

## Implementer contract

* You are implementing **this ticket only**. Public header layout at small viewports.
* Do not add a hamburger unless this plan fails; prefer pinning Sign in top-right.
* Never commit secrets.

## Intensity

* Band: `standard`
* Why: isolated header CSS/layout
* Proof: `on`

## Summary

At 375×812 the public header wraps **Sign in** onto a second row under the brand, while Articles and Contact stay on the first row to the right of the logo. Desktop (1280×800) keeps brand + nav left and Sign in top-right. The same wrap appears on `/`, `/articles`, and 404. Header text links are also ~20px tall (below 24px minimum target).

## User report

> On `/` at 375×812 (signed out), measured header links: brand (16,8 177×24), Articles (217,10 48×20), Contact (282,10 51×20), Sign in (16,40 44×20) — Sign in dropped to y=40, left-aligned under the logo. No horizontal page scroll. Home link is `display:none` as designed (logo goes `/`).

## Current behavior

* Outer header is `flex flex-wrap … justify-between`. Left cluster (logo + nav) is too wide with Sign in, so Sign in wraps to a full next line.
* Evidence: `components/site-header.tsx` (`SiteHeader`, ~L28–56)
* Home nav item is `hidden … sm:inline` (~L40–41) — not the bug; logo remains the home control.

## Expected behavior

* At 375×812: **brand** stays top-left, **Sign in** stays top-right on the **same** first row (match 1280×800).
* Articles and Contact may wrap to a second row under the brand; they must remain tappable.
* Header nav + Sign in links use at least `h-9` / min 36px hit area, matching `Button` default size (`components/ui/button.tsx` `size.default`).
* No horizontal overflow at 375px.
* Do not introduce a mobile drawer in this ticket.

## Suspected root cause / scope

Confirmed: `flex-wrap` on the bar that also contains Sign in. Scope: `components/site-header.tsx` layout classes. Public layout already mounts this header (`app/(public)/layout.tsx`).

## Code map

| Path | Role | Symbols / notes |
| -- | -- | -- |
| `components/site-header.tsx` | Public header | `SiteHeader` ~L12–58 |
| `app/(public)/layout.tsx` | Mounts header | `PublicLayout` ~L5–18 |
| `components/ui/button.tsx` | Hit-area mirror | `size.default`: `h-9 px-4 py-2` ~L24 |

Primary package/app: repo root Next.js app

## Relevant contracts (types / APIs / data)

* **Types / props / schema: **`SiteHeader({ waitlistEnabled, galleriesEnabled })` — do not change flag filtering
* **API / route:** links `/`, `/articles`, `/contact`, `/login` unchanged
* **Env / flags:** Gallery/Waitlist still flag-gated
* **Auth / tenancy:** public

## Code anchors (excerpts)

### `components/site-header.tsx` — `SiteHeader` (~L28–55)

```tsx
<div className="mx-auto flex min-h-14 max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2">
  <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2">
    <Link href="/" className="truncate font-semibold tracking-tight">{name}</Link>
    <nav aria-label="Primary" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      {/* Home hidden on xs; Articles + Contact */}
    </nav>
  </div>
  <Link href="/login" className="shrink-0 text-sm text-muted-foreground …">Sign in</Link>
</div>
```

### Pattern to mirror

* **Mirror:** desktop header in the same file — brand left, Sign in right, one row
* **Why:** 375px should preserve that chrome; only the middle nav may wrap
* Hit area: `Button` `h-9` (36px)

## Step-by-step implementation plan

1. Restructure the header so Sign in is not in the wrapping left cluster: e.g. `grid`/`flex` with `justify-between` **without** wrapping the brand+Sign in pair; allow `nav` to wrap below.
2. Add `inline-flex h-9 items-center` (or equivalent) to nav links and Sign in.
3. Keep Home `hidden sm:inline`.
4. Verify `/` and `/articles` at 375×812 and 1280×800.

## File-by-file changes

| Path | Action | What to change |
| -- | -- | -- |
| `components/site-header.tsx` | edit | Pin Sign in on first row; enlarge tap targets |
| `app/(public)/layout.tsx` | do not touch | already passes flags |
| `components/ui/button.tsx` | do not touch | token mirror only |

## Do not touch / out of scope

* Footer
* Auth layout (`/login` has no this header)
* New mobile menu component
* Home card CTAs

## Acceptance criteria

- [ ] At 375×812 on `/`, Sign in’s bounding box is on the first header row (same y-band as the brand), right-aligned.
- [ ] Articles and Contact remain visible and navigate correctly at 375×812.
- [ ] Brand still navigates to `/`.
- [ ] Header interactive links are ≥24px tall (prefer 36px / `h-9`).
- [ ] `document.documentElement.scrollWidth === 375` on `/` and `/articles`.
- [ ] 1280×800 header still single-row: brand, Home, Articles, Contact, Sign in.
- [ ] Verification commands pass.

## Test plan

**Automated:** none required (layout). Optional Playwright later.

**Manual:**

1. Signed out, set viewport 375×812, open `/`.
2. Confirm Sign in top-right, same row as brand; click it → `/login`.
3. Click Articles → `/articles`; Contact → `/contact`.
4. Viewport 1280×800: Sign in still top-right; Home visible.

## Verification

* `bun run lint`
* `bun run typecheck`
* Manual: 375×812 header geometry as in AC

### Runtime proof

* Surface to drive: `GET /` at 375×812
* Visual reference: desktop header on `/`; screenshot `screenshots/walk-20260831-full/home-mobile-header-wrap.png`
* Blast-radius fact: header is on every public page including 404
* Observed end state: Sign in top-right on row 1 at 375px

## Drift check (before implementing)

- [ ] `components/site-header.tsx` still owns public nav
- [ ] Outer header still `flex-wrap` + Sign in sibling
- [ ] Home still `hidden sm:inline`
- [ ] `Button` default size still `h-9`
- [ ] `bun run typecheck` still exists

Snapshot: investigated at 2026-08-31, branch `dev`, HEAD `e46fea1`.

## Risks / blockers

* none
* Rollback note: revert header className structure

## Platform / stack

* Canonical targets: Tailwind 4 utility layout
* Must not use: new nav libraries
* Migration dependency: none

## Related

* Parent epic: [POR-461](https://linear.app/teton-web-ventures/issue/POR-461/ui-walk-next-starter-template-2026-08-31)
* Related: none
* blockedBy: none
* Duplicate of: none

## Supersedes

* none

## Assumptions / pre-decided

* No hamburger. Pin Sign in; allow Articles/Contact to wrap.
* Include 36px tap targets in this same header change (same file, same walk).

## Walk metadata

* Kind: bug
* Surface: `/` (header also on `/articles` and 404)
* Viewport: 375×812 (regression vs 1280×800)
* Auth: signed-out
* Drive path: set viewport 375 812 → open `/` → measure link rects → screenshot
* Observed: Sign in at y=40 under brand; Articles/Contact on row 1
* Screenshot: `screenshots/walk-20260831-full/home-mobile-header-wrap.png`
* Coverage unit: `/`
