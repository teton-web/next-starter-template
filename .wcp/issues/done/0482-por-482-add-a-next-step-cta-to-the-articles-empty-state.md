---
id: "0482"
title: "Add a next-step CTA to the articles empty state"
status: done
priority: normal
assignee:
lease_expires:
scope: "Imported from Linear POR-482. Stay inside that description."
acceptance: "Add a next-step CTA to the articles empty state"
files: []
commit:
reason:
created: "2026-08-31T20:32:56.271Z"
linear_id: "POR-482"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-482/add-a-next-step-cta-to-the-articles-empty-state"
linear_status: "Done"
linear_status_type: "completed"
linear_team: "POR"
linear_project: "next-starter-template"
linear_assignee: "maintainer"
linear_labels: ["Improvement"]
linear_priority: "Low"
linear_parent: "POR-461"
linear_cycle: ""
linear_due: ""
linear_updated: "2026-09-01T15:04:24.314Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-482
- URL: https://linear.app/teton-web-ventures/issue/POR-482/add-a-next-step-cta-to-the-articles-empty-state
- Linear status: Done (completed)
- Queue status: done
- Team: Portfolio (POR)
- Project: next-starter-template
- Assignee: maintainer
- Labels: Improvement
- Parent: POR-461 — UI walk – next-starter-template – 2026-08-31
- Priority: Low
- Estimate: none
- Cycle: none
- Due: none
- Created: 2026-08-31T20:32:56.271Z
- Updated: 2026-09-01T15:04:24.314Z
- Completed: 2026-09-01T15:04:24.263Z
- Canceled: no
- Archived: no
- Branch: por-482-add-a-next-step-cta-to-the-articles-empty-state

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

# Add a next-step CTA to the articles empty state

## Implementer contract

* You are implementing **this ticket only**. Do not seed CMS articles or change list-row markup.
* Mirror 404’s outline/default `Button asChild` links.
* Never commit secrets.

## Intensity

* Band: `standard`
* Why: isolated empty-state UI on one list page
* Proof: `on`

## Summary

`/articles` with zero published entries shows only `h1` “Articles” and muted “No published articles yet.” No next step. 404 (same public chrome) pairs explanation copy with **Back to home** + **Sign in**. On a freshly seeded starter this empty state is the default public list.

## User report

> Signed out, clicked header **Articles** → `/articles`. Title `Articles · Next.js Starter Template`. Main text: “Articles / No published articles yet.” No list rows, no buttons in `main`. Walk DB `cms_entries` had 0 rows. Same at 375×812. Console: no page `errors[]`; dev CSP `eval()` only.

## Current behavior

* Empty branch is a single paragraph.
* Evidence: `app/(public)/articles/page.tsx` (`ArticlesPage`, ~L17–18)
* Populated branch already links `article.routePath` (~L21–27) — leave it.

## Expected behavior

* Keep headline **Articles** and the sentence **No published articles yet.**
* Under that sentence add a button row matching 404 spacing (`flex flex-wrap … gap-3`, `mt-6` or similar):
  * **Back to home** — `Button` default → `/`
  * **Contact** — `Button variant="outline"` → `/contact` (public next step when there is nothing to read)
* Do not add “Create article” (that is admin).
* When `articles.length > 0`, do not show this CTA row.

## Suspected root cause / scope

Confirmed: empty branch is copy-only. Scope: empty `articles.length === 0` branch in `app/(public)/articles/page.tsx`.

## Code map

| Path | Role | Symbols / notes |
| -- | -- | -- |
| `app/(public)/articles/page.tsx` | List + empty | `ArticlesPage` ~L6–32 |
| `app/not-found.tsx` | Mirror empty/error actions | buttons ~L22–28 |
| `components/ui/button.tsx` | Button primitive | default + outline |

Primary package/app: repo root Next.js app

## Relevant contracts (types / APIs / data)

* **API / route: **`GET /articles` still lists published articles via `listPublishedEntries("article")`
* **DB / storage: **`cms_entries` empty is a valid public state
* **Env / flags:** none
* **Auth / tenancy:** public; do not link `/admin`

## Code anchors (excerpts)

### `app/(public)/articles/page.tsx` — empty branch (~L15–18)

```tsx
<main className="mx-auto max-w-2xl px-4 py-16">
  <h1 className="text-3xl font-bold">Articles</h1>
  {articles.length === 0 ? (
    <p className="mt-4 text-muted-foreground">No published articles yet.</p>
```

### Pattern to mirror

* **Mirror: **`app/not-found.tsx` — explanation + default **Back to home** + outline secondary link
* **Why:** same public visitor who landed somewhere with nothing to do

## Step-by-step implementation plan

1. Import `Link` (already) and `Button`.
2. In the empty branch, wrap copy + button row (keep the existing sentence).
3. Confirm a published list (when any exist) still renders titles only, no empty CTAs.

## File-by-file changes

| Path | Action | What to change |
| -- | -- | -- |
| `app/(public)/articles/page.tsx` | edit | Empty state buttons |
| `app/not-found.tsx` | do not touch | Mirror only |

## Do not touch / out of scope

* Seeding articles
* Article detail body (`CmsDocument`)
* Admin content UI
* Home CTA row (separate ticket)

## Acceptance criteria

- [ ] With zero published articles, `/articles` shows h1 **Articles**, **No published articles yet.**, **Back to home** (default button → `/`), **Contact** (outline → `/contact`).
- [ ] With ≥1 published article, those empty CTAs are absent and rows still link to `routePath`.
- [ ] 375×812: no horizontal overflow; buttons remain tappable.
- [ ] Verification commands pass.

## Test plan

**Automated:** optional unit around the empty JSX is not worth a snapshot lib. Manual is enough.

**Manual:**

1. Signed out, `/articles` on this walk DB (0 rows): see CTAs; click Back to home; click Contact.
2. If a published article is added later, reload `/articles` and confirm the CTA row is gone.

## Verification

* `bun run lint`
* `bun run typecheck`
* Manual: empty `/articles` as above

### Runtime proof

* Surface to drive: `GET /articles` with empty `cms_entries`
* Visual reference: 404 button row; screenshot `screenshots/walk-20260831-full/articles-empty.png`
* Blast-radius fact: n/a
* Observed end state: empty list has home + contact buttons; list-with-rows does not

## Drift check (before implementing)

- [ ] `app/(public)/articles/page.tsx` still has the empty paragraph
- [ ] `listPublishedEntries("article")` still feeds the page
- [ ] `app/not-found.tsx` still has Back to home + Sign in buttons
- [ ] `Button` still has default + outline
- [ ] `bun run typecheck` still exists

Snapshot: investigated at 2026-08-31, branch `dev`, HEAD `e46fea1`.

## Risks / blockers

* none
* Rollback note: remove the button row

## Platform / stack

* Canonical targets: Next.js App Router, shadcn Button
* Must not use: BlockNote, mock article data on the public path
* Migration dependency: none

## Related

* Parent epic: [POR-461](https://linear.app/teton-web-ventures/issue/POR-461/ui-walk-next-starter-template-2026-08-31)
* Related: home CTA ticket
* blockedBy: none
* Duplicate of: none

## Supersedes

* none

## Assumptions / pre-decided

* Secondary empty CTA is **Contact**, not **Sign in** (operators already have header Sign in; visitors need a public next step).
* Do not invent illustration/icon unless copying 404’s Compass; copy+buttons is enough.

## Walk metadata

* Kind: improvement
* Surface: `/articles`
* Viewport: both
* Auth: signed-out
* Drive path: header **Articles** → empty list; no row to click
* Observed: “No published articles yet.”; 0 `cms_entries`; HTTP 200
* Screenshot: `screenshots/walk-20260831-full/articles-empty.png`
* Coverage unit: `/articles`
