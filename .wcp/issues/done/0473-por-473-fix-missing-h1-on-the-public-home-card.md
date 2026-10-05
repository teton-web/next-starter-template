---
id: "0473"
title: "Fix missing h1 on the public home card"
status: done
priority: normal
assignee:
lease_expires:
scope: "Imported from Linear POR-473. Stay inside that description."
acceptance: "Fix missing h1 on the public home card"
files: []
commit:
reason:
created: "2026-08-31T20:30:19.175Z"
linear_id: "POR-473"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-473/fix-missing-h1-on-the-public-home-card"
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
linear_updated: "2026-09-01T15:04:09.527Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-473
- URL: https://linear.app/teton-web-ventures/issue/POR-473/fix-missing-h1-on-the-public-home-card
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
- Created: 2026-08-31T20:30:19.175Z
- Updated: 2026-09-01T15:04:09.527Z
- Completed: 2026-09-01T15:04:09.499Z
- Canceled: no
- Archived: no
- Branch: por-473-fix-missing-h1-on-the-public-home-card

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

# Fix missing h1 on the public home card

## Implementer contract

* You are implementing **this ticket only**. Do not restyle the card, add CTAs, or change `CardTitle` globally (admin cards share it).
* Prefer the step-by-step plan below. Mirror `/articles` heading semantics.
* Never commit secrets.

## Intensity

* Band: `standard`
* Why: isolated UI; one public page heading
* Proof: `on`

## Summary

The public home hero title looks like a page heading but is a `div` (`CardTitle`), so `/` has **zero **`h1`/`h2` headings. Screen readers and outline tools skip the site name. Every other public surface in this walk (`/articles`, `/contact`, `/privacy`, `/terms`, 404) uses a real `h1`.

## User report

> On `/` at 1280×800 (signed out), the large text “Next.js Starter Template” is the only page title, but the accessibility tree shows `main` with StaticText and **no heading**. `document.querySelectorAll('h1').length === 0`. `/articles` exposes `heading "Articles" [level=1]`.

## Current behavior

* Home renders the site name through `CardTitle`, which is always a `div`.
* Evidence: `app/(public)/page.tsx` (`Home`, ~L13) — `<CardTitle className="text-4xl">{name}</CardTitle>`
* Evidence: `components/ui/card.tsx` (`CardTitle`, ~L31–38) — `React.ComponentProps<'div'>` → `<div data-slot="card-title">`
* Tab title is `Next.js Starter Template`; visual size is `text-4xl`, but there is no heading role.

## Expected behavior

* The visible site name on `/` is an `h1` (one per page).
* Keep the current type: `text-4xl` + `font-semibold` / `leading-none` so the card still matches today’s screenshot.
* Do not change `CardTitle` to always render `h1` (would affect admin cards).
* Non-goal: extra CTAs (home CTA ticket), header wrap.

## Suspected root cause / scope

Confirmed: `CardTitle` is a styled `div` and Home uses it as the page title. Scope: `app/(public)/page.tsx` only.

## Code map

| Path | Role | Symbols / notes |
| -- | -- | -- |
| `app/(public)/page.tsx` | Home route | `Home` ~L6–29 |
| `components/ui/card.tsx` | Shared card title (do not retarget to h1) | `CardTitle` ~L31–38 |
| `app/(public)/articles/page.tsx` | Mirror heading | `<h1 className="text-3xl font-bold">Articles</h1>` ~L16 |
| `app/not-found.tsx` | Mirror heading | `<h1 className="text-balance text-3xl font-bold …">` ~L15–17 |

Primary package/app: repo root Next.js app

## Relevant contracts (types / APIs / data)

* **Types / props / schema: **`CardTitle` stays `ComponentProps<'div'>`. Home may use a native `h1` instead of (or inside) `CardTitle`.
* **API / route: **`GET /` (no API change)
* **DB / storage:** N/A: no data model change
* **Env / flags:** none
* **Auth / tenancy:** public, signed-out

## Code anchors (excerpts)

### `app/(public)/page.tsx` — `Home` (~L12–16)

```tsx
<CardHeader>
  <CardTitle className="text-4xl">{name}</CardTitle>
  <CardDescription className="text-lg">
    A Next.js starter with authentication, a CMS, and a public site ready to customize.
```

### Pattern to mirror

* **Mirror: **`app/(public)/articles/page.tsx` (`ArticlesPage`) — real `<h1>` for the page title
* **Why:** public pages already use `h1`; home should too without restyling Card primitives

## Step-by-step implementation plan

1. In `app/(public)/page.tsx`, replace the home `CardTitle` usage with a single `<h1>` that keeps `text-4xl font-semibold leading-none` (or `CardTitle` + inner `h1` only if the visual wrapper is required).
2. Do not edit `components/ui/card.tsx`.
3. Manually confirm `/` exposes one `h1` whose text is the site name; `/articles` unchanged.

## File-by-file changes

| Path | Action | What to change |
| -- | -- | -- |
| `app/(public)/page.tsx` | edit | Render site name as `h1`; keep `CardDescription` and Sign in CTA |
| `components/ui/card.tsx` | do not touch | Shared admin/public card primitive |
| `app/(public)/articles/page.tsx` | do not touch | Mirror only |

## Do not touch / out of scope

* Home CTA row
* Header mobile wrap
* Admin cards / `CardTitle` element type
* Brand copy

## Acceptance criteria

- [ ] Signed-out `GET /` has exactly one `h1` whose accessible name is the site name (`siteName()` / “Next.js Starter Template” in this walk).
- [ ] The home card still shows the large title + description + Sign in control (no layout regression).
- [ ] `/articles` still has `h1` “Articles”.
- [ ] Verification commands in this ticket pass.

## Test plan

**Automated (prefer):**

* File: `tests/source-invariants.test.ts` (extend) or a tiny page-level assertion if one exists
* Cases:
  * `app/(public)/page.tsx` source contains an `<h1` (or compiled home renders heading role)
  * Do not assert `CardTitle` is an h1 globally

**Manual:**

1. Signed out, open `/` at 1280×800.
2. Confirm the large card title is still the site name.
3. In the accessibility tree / `document.querySelector('h1')`, see that heading.

## Verification

* `bun run lint`
* `bun run typecheck`
* Manual: `/` has one `h1` matching the card title

### Runtime proof

* Surface to drive: `GET /`
* Project verify skill / feature map: none
* Visual reference (UI): `/articles` h1; screenshot `screenshots/walk-20260831-full/home-desktop-no-h1-cta.png`
* Blast-radius fact: `CardTitle` is shared — do not change the primitive
* Observed end state that proves done: accessibility tree on `/` shows `heading` level 1 with the site name

## Drift check (before implementing)

- [ ] `app/(public)/page.tsx` still owns the public home card
- [ ] `CardTitle` in `components/ui/card.tsx` is still a `div`
- [ ] `/articles` still uses `<h1 className="text-3xl font-bold">`
- [ ] Home copy still uses `siteName()`
- [ ] `bun run typecheck` still is the typecheck entrypoint

Snapshot: investigated at 2026-08-31, branch `dev`, HEAD `e46fea1`.

## Risks / blockers

* none
* Rollback note: revert the home heading markup

## Platform / stack

* Canonical targets: Next.js 16 App Router, Tailwind 4, shadcn Card
* Must not use / abandoned for this work: none
* Migration dependency: none

## Related

* Parent epic: [POR-461](https://linear.app/teton-web-ventures/issue/POR-461/ui-walk-next-starter-template-2026-08-31)
* Related: home CTA ticket (same epic)
* blockedBy: none
* Duplicate of: none

## Supersedes

* none

## Assumptions / pre-decided

* Use a native `h1` on Home; do not add `asChild` to `CardTitle` unless needed for the same visual.
* Do not introduce a new heading component.

## Walk metadata

* Kind: bug
* Surface: `/`
* Viewport: both (1280×800 and 375×812; zero headings at both)
* Auth: signed-out
* Drive path: open `/` → snapshot → heading count
* Observed: `h1Count: 0`; card title tag `DIV.data-slot=card-title`; console: React CSP `eval()` in dev (ignored)
* Screenshot: `screenshots/walk-20260831-full/home-desktop-no-h1-cta.png`
* Coverage unit: `/`
