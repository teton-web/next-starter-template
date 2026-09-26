---
id: "0481"
title: "Add Articles and Contact CTAs on home to match hero copy"
status: done
priority: normal
assignee:
lease_expires:
scope: "Imported from Linear POR-481. Stay inside that description."
acceptance: "Add Articles and Contact CTAs on home to match hero copy"
files: []
commit:
reason:
created: "2026-08-31T20:32:00.879Z"
linear_id: "POR-481"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-481/add-articles-and-contact-ctas-on-home-to-match-hero-copy"
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
linear_updated: "2026-09-01T15:04:23.332Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-481
- URL: https://linear.app/teton-web-ventures/issue/POR-481/add-articles-and-contact-ctas-on-home-to-match-hero-copy
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
- Created: 2026-08-31T20:32:00.879Z
- Updated: 2026-09-01T15:04:23.332Z
- Completed: 2026-09-01T15:04:23.311Z
- Canceled: no
- Archived: no
- Branch: david/por-481-add-articles-and-contact-ctas-on-home-to-match-hero-copy

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

# Add Articles and Contact CTAs on home to match hero copy

## Implementer contract

* You are implementing **this ticket only**. Do not change the home heading element unless it is already an `h1`.
* Mirror the 404 button row: primary + outline `Button asChild` links.
* Never commit secrets.

## Intensity

* Band: `standard`
* Why: isolated UI; home CTA row only
* Proof: `on`

## Summary

The home card tells visitors to “Browse articles, send a message, or sign in if you operate this site,” but the only button is outline **Sign in**. Public visitors have to hunt the header for Articles/Contact. 404 already shows a two-button row (`Back to home` default + `Sign in` outline).

## User report

> On `/` at 1280×800 and 375×812 (signed out), the hero paragraph promises articles, contact, and sign-in. The only in-card control is outline **Sign in** → `/login`. Header already has Articles and Contact. Clicking the card Sign in correctly opens `/login`.

## Current behavior

* CTA row is a single outline Button → `/login`.
* Evidence: `app/(public)/page.tsx` (`Home`, ~L19–26) — copy lists three jobs; only Sign in is linked
* Header already exposes `/articles` and `/contact` (`components/site-header.tsx`)

## Expected behavior

* In the existing `flex flex-wrap gap-4` row, add:
  * **Articles** — `Button` default → `/articles`
  * **Contact** — `Button variant="outline"` → `/contact`
  * **Sign in** — keep `Button variant="outline"` → `/login`
* Match 404 control chrome: `Button asChild` + `Link` (`app/not-found.tsx` ~L22–28).
* Do not add Waitlist/Gallery (flag-off, not in this slice).
* Non-goal: heading semantics, header wrap.

## Suspected root cause / scope

Confirmed: home was scaffolded with operator Sign in only; copy was later expanded. Scope: the home CTA `div` in `app/(public)/page.tsx`.

## Code map

| Path | Role | Symbols / notes |
| -- | -- | -- |
| `app/(public)/page.tsx` | Home CTA row | `Home` ~L19–26 |
| `app/not-found.tsx` | Mirror button pair | `NotFound` ~L22–28 |
| `components/ui/button.tsx` | Button variants | `buttonVariants` default + outline, size default `h-9` |
| `components/site-header.tsx` | Destinations already in nav | `primaryNav` Articles `/articles`, Contact `/contact` |

Primary package/app: repo root Next.js app

## Relevant contracts (types / APIs / data)

* **Types / props / schema: **`Button` `variant`: `default` | `outline`; `asChild`
* **API / route:** links only — `GET /articles`, `GET /contact`, `GET /login`
* **DB / storage:** N/A
* **Env / flags:** do not surface `waitlist` / `galleries` here
* **Auth / tenancy:** public

## Code anchors (excerpts)

### `app/(public)/page.tsx` — `Home` (~L19–26)

```tsx
<p className="text-muted-foreground">
  Browse articles, send a message, or sign in if you operate this site.
</p>
<div className="flex flex-wrap gap-4 pt-2">
  <Button variant="outline" asChild>
    <Link href="/login">Sign in</Link>
  </Button>
</div>
```

### Pattern to mirror

* **Mirror: **`app/not-found.tsx` (`NotFound`) — default `Button` + outline `Button`, both `asChild` links
* **Why:** same public chrome, already used on 404

## Step-by-step implementation plan

1. In the home CTA `div`, insert Articles (default) and Contact (outline) links before existing Sign in.
2. Keep `flex flex-wrap gap-4` so 375px wraps cleanly (no horizontal scroll).
3. Click each CTA: `/articles`, `/contact`, `/login`.

## File-by-file changes

| Path | Action | What to change |
| -- | -- | -- |
| `app/(public)/page.tsx` | edit | Add Articles + Contact buttons; keep Sign in outline |
| `app/not-found.tsx` | do not touch | Mirror only |
| `components/site-header.tsx` | do not touch | Nav already correct |

## Do not touch / out of scope

* `CardTitle` / h1 (separate ticket)
* Feature-flagged Gallery/Waitlist
* Login page chrome
* Copy rewrite beyond the three existing jobs

## Acceptance criteria

- [ ] Home card shows three controls: **Articles** (default button) → `/articles`, **Contact** (outline) → `/contact`, **Sign in** (outline) → `/login`.
- [ ] At 375×812 the row wraps without horizontal scroll (`document.documentElement.scrollWidth === window.innerWidth`).
- [ ] Header nav still has Articles / Contact / Sign in (no duplicate product paths required in header).
- [ ] Verification commands pass.

## Test plan

**Automated (prefer):** none practical without Playwright on `/`. Skip new e2e unless extending an existing public smoke.

**Manual:**

1. Signed out, `/` at 1280×800: three buttons visible in the card.
2. Click Articles → `/articles`. Back. Contact → `/contact`. Back. Sign in → `/login`.
3. Repeat a 30s pass at 375×812; no horizontal overflow.

## Verification

* `bun run lint`
* `bun run typecheck`
* Manual: CTA clicks listed above

### Runtime proof

* Surface to drive: `GET /` then click **Articles**, **Contact**, **Sign in**
* Visual reference: 404 button row; screenshot `screenshots/walk-20260831-full/home-desktop-no-h1-cta.png`
* Blast-radius fact: n/a
* Observed end state: card contains those three labeled links with the specified variants

## Drift check (before implementing)

- [ ] `app/(public)/page.tsx` still has the three-job sentence and a single Sign in button
- [ ] `Button` still supports `variant="outline"` and `asChild`
- [ ] `app/not-found.tsx` still uses default + outline link buttons
- [ ] Header still links `/articles` and `/contact`
- [ ] `bun run typecheck` still exists

Snapshot: investigated at 2026-08-31, branch `dev`, HEAD `e46fea1`.

## Risks / blockers

* none
* Rollback note: remove the two added links

## Platform / stack

* Canonical targets: Next.js App Router, shadcn `Button`
* Must not use: new UI libraries
* Migration dependency: none

## Related

* Parent epic: [POR-461](https://linear.app/teton-web-ventures/issue/POR-461/ui-walk-next-starter-template-2026-08-31)
* Related: home h1 ticket; articles empty CTA ticket
* blockedBy: none
* Duplicate of: none

## Supersedes

* none

## Assumptions / pre-decided

* Button order follows the sentence: Articles, Contact, Sign in.
* Articles is the only default (primary) button; the other two stay outline so Sign in does not compete as the public default.

## Walk metadata

* Kind: improvement
* Surface: `/`
* Viewport: both
* Auth: signed-out
* Drive path: open `/` → click card **Sign in** → `/login`; header Articles/Contact already work
* Observed: only Sign in in the card; copy still lists articles + message
* Screenshot: `screenshots/walk-20260831-full/home-desktop-no-h1-cta.png`
* Coverage unit: `/`
