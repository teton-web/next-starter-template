---
id: "0472"
title: "Fix 404 document title on unknown CMS and catch-all routes"
status: done
priority: normal
assignee:
lease_expires:
scope: "Imported from Linear POR-472. Stay inside that description."
acceptance: "Fix 404 document title on unknown CMS and catch-all routes"
files: []
commit:
reason:
created: "2026-08-31T20:30:17.250Z"
linear_id: "POR-472"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-472/fix-404-document-title-on-unknown-cms-and-catch-all-routes"
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
linear_updated: "2026-09-01T15:04:08.135Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-472
- URL: https://linear.app/teton-web-ventures/issue/POR-472/fix-404-document-title-on-unknown-cms-and-catch-all-routes
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
- Created: 2026-08-31T20:30:17.250Z
- Updated: 2026-09-01T15:04:08.135Z
- Completed: 2026-09-01T15:04:08.115Z
- Canceled: no
- Archived: no
- Branch: por-472-fix-404-document-title-on-unknown-cms-and-catch-all-routes

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

# Fix 404 document title on unknown CMS and catch-all routes

## Implementer contract

* You are implementing **this ticket only**. Do not redesign the 404 body (Compass, buttons already work).
* Call `notFound()` from `generateMetadata` when there is no published entry; give `app/not-found.tsx` a real title.
* Never commit secrets.

## Intensity

* Band: `standard`
* Why: isolated metadata on not-found / CMS catch-alls
* Proof: `on`

## Summary

Unknown public URLs still render the styled 404 (`We couldn't find that page.`), HTTP 404, but the **document title** is `Page · Next.js Starter Template` because `app/(public)/[slug]` `generateMetadata` returns `{ title: "Page" }` then the page calls `notFound()`. Missing articles use `Article · …`. `/privacy` correctly uses `Privacy · …`. Tabs and search snippets look like a real Page/Article exists.

## User report

> Signed out. `/articles` empty (0 published). Opened `/articles/hello` → 404 UI, title **Article · Next.js Starter Template**, HTTP 404. `/about` and `/this-page-does-not-exist-walk` → same 404 UI, title **Page · Next.js Starter Template**. Clicked **Back to home** → `/`. Clicked **Sign in** → `/login`. Console on these routes: `Encountered a script tag while rendering React component` (JSON-LD in root layout; out of scope) plus dev CSP `eval()`.

## Current behavior

* Catch-all CMS page always matches one-segment unknown paths, so `generateMetadata` runs and stamps “Page” / “Article” before `notFound()`.
* Evidence: `app/(public)/[slug]/page.tsx` (`generateMetadata`, ~L9–18) — `if (!row) return { title: "Page" }`
* Evidence: `app/(public)/articles/[slug]/page.tsx` (`generateMetadata`, ~L9–17) — `if (!row) return { title: "Article" }`
* Evidence: `app/not-found.tsx` — no `metadata` export; body h1 is “We couldn’t find that page.”
* Evidence: `app/layout.tsx` title template `` `%s · ${siteName}` `` ~L29–31
* HTTP: `curl` 404 for `/about`, `/articles/hello`, `/this-page-does-not-exist-walk`

## Expected behavior

* Document title on these 404s is **Page not found · {siteName}** (template already supplies  `· {siteName}`).
* `generateMetadata` for `[slug]` and `articles/[slug]` must `notFound()` (or return the not-found title) when there is no published row / reserved slug — **do not** advertise “Page” or “Article”.
* `app/not-found.tsx` exports `metadata.title = "Page not found"` (sibling of `app/(public)/privacy/page.tsx` `title: "Privacy"`).
* Visible 404 copy, Compass, **Back to home**, **Sign in** stay as they are.
* HTTP status remains 404.

## Suspected root cause / scope

Confirmed: dummy titles in `generateMetadata` plus no metadata on `not-found.tsx`. Unknown one-segment URLs are handled by `[slug]`, so the dedicated not-found metadata never wins.

## Code map

| Path | Role | Symbols / notes |
| -- | -- | -- |
| `app/(public)/[slug]/page.tsx` | CMS page + metadata | `generateMetadata`, `CmsPage` `notFound()` ~L21–30 |
| `app/(public)/articles/[slug]/page.tsx` | Article + metadata | `generateMetadata` ~L9–17, `ArticlePage` `notFound()` ~L20–28 |
| `app/not-found.tsx` | 404 UI | `NotFound`; add metadata |
| `app/(public)/privacy/page.tsx` | Mirror metadata export | `metadata.title = "Privacy"` |
| `app/layout.tsx` | Title template | `template: \`%s · ${siteName}`` |

Primary package/app: repo root Next.js app

## Relevant contracts (types / APIs / data)

* **Types: **`Metadata` from `next`
* **API / route: **`GET /:slug`, `GET /articles/:slug` → 404 when unpublished/missing
* **DB: **`getPublishedEntryByPath` — no row means not found
* **Auth:** public
* **Flags:** none for these routes

## Code anchors (excerpts)

### `app/(public)/[slug]/page.tsx` — `generateMetadata` (~L9–18)

```ts
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  if (isReservedSlug(slug)) return {}
  try {
    const row = await getPublishedEntryByPath(routeForEntry("page", slug))
    if (!row) return { title: "Page" }
    return { title: row.entry.title, description: row.entry.excerpt ?? undefined }
  } catch {
    return { title: "Page" }
  }
}
```

### Pattern to mirror

* **Mirror: **`app/(public)/privacy/page.tsx` — `export const metadata = { title: "Privacy" }`
* **Why:** static public titles go through the same `%s · siteName` template
* Next.js: calling `notFound()` inside `generateMetadata` is the usual way to avoid a fake title

## Step-by-step implementation plan

1. Add `export const metadata = { title: "Page not found" }` (or `Metadata` object) to `app/not-found.tsx`.
2. In both CMS `generateMetadata` functions, replace dummy `{ title: "Page"|"Article" }` (and catch fallbacks that 404) with `notFound()`.
3. Keep successful published titles as they are.
4. Verify `/this-page-does-not-exist-walk`, `/about`, `/articles/hello` titles; verify a published page (e2e smoke) still uses the entry title.

## File-by-file changes

| Path | Action | What to change |
| -- | -- | -- |
| `app/not-found.tsx` | edit | Export `title: "Page not found"` |
| `app/(public)/[slug]/page.tsx` | edit | `notFound()` in metadata when missing |
| `app/(public)/articles/[slug]/page.tsx` | edit | same for articles |
| `app/(public)/privacy/page.tsx` | do not touch | mirror only |

## Do not touch / out of scope

* 404 visual design / Sign in button
* JSON-LD script-tag React warning on 404 (dev overlay “2 Issues”)
* Gallery slug metadata (flag-off this slice)
* Seeding an about page

## Acceptance criteria

- [ ] `GET /this-page-does-not-exist-walk` is HTTP 404, shows existing 404 UI, document title is `Page not found ·` + site name.
- [ ] `GET /about` with no published page: same title (not `Page · …`).
- [ ] `GET /articles/hello` with no published article: same not-found title (not `Article · …`).
- [ ] A published CMS page/article still uses `row.entry.title` in the document title (e2e `auth-cms.spec.ts` still 200 + title in body).
- [ ] **Back to home** and **Sign in** on 404 still navigate.
- [ ] Verification commands pass.

## Test plan

**Automated (prefer):**

* File: extend `tests/cms-preview.test.ts` or add a focused metadata helper test if generateMetadata is extractable; otherwise rely on manual + existing e2e publish smoke.
* Cases:
  * missing page path → notFound / no dummy "Page" title in the metadata return
  * published path still returns entry title

**Manual:**

1. Signed out, open `/this-page-does-not-exist-walk` — tab title Page not found · …
2. Open `/articles/hello` — same, not Article.
3. Click Back to home.

## Verification

* `bun run lint`
* `bun run typecheck`
* `bun test tests` (cms slug/preview tests if extended)
* Manual: titles on the three URLs above

### Runtime proof

* Surface to drive: `GET /this-page-does-not-exist-walk`, `GET /about`, `GET /articles/hello`
* Visual reference: 404 h1; screenshot `screenshots/walk-20260831-full/not-found-page-title.png`
* Blast-radius fact: `[slug]` is the public catch-all — every unknown one-segment URL
* Observed end state: `document.title` starts with `Page not found`; UI unchanged

## Drift check (before implementing)

- [ ] `generateMetadata` in `[slug]/page.tsx` still returns `{ title: "Page" }` on miss
- [ ] `generateMetadata` in `articles/[slug]/page.tsx` still returns `{ title: "Article" }` on miss
- [ ] `app/not-found.tsx` still has no metadata export
- [ ] Root title template still `%s · ${siteName}`
- [ ] `notFound` from `next/navigation` still used in the page components

Snapshot: investigated at 2026-08-31, branch `dev`, HEAD `e46fea1`.

## Risks / blockers

* Next.js version may still apply the nearest `generateMetadata` if `notFound()` in metadata is ignored — then returning `{ title: "Page not found" }` from those functions is the fallback (state that in the PR if needed).
* Rollback note: restore dummy titles

## Platform / stack

* Canonical targets: Next.js 16 App Router metadata
* Must not use: pages router
* Migration dependency: none

## Related

* Parent epic: [POR-461](https://linear.app/teton-web-ventures/issue/POR-461/ui-walk-next-starter-template-2026-08-31)
* Related: none
* blockedBy: none
* Duplicate of: none

## Supersedes

* none

## Assumptions / pre-decided

* Title string is **Page not found** (matches the 404 kicker “404 — Page not found”, not the longer h1).
* Do not fix the JSON-LD `<script>` client warning in this ticket.

## Walk metadata

* Kind: bug
* Surface: `/this-page-does-not-exist-walk` (also `/about`, `/articles/hello`)
* Viewport: 1280×800 and 375×812 (title bug on both; UI fine)
* Auth: signed-out
* Drive path: open `/articles/hello`, `/about`, `/this-page-does-not-exist-walk` → read `document.title` → click Back to home / Sign in
* Observed: titles `Article · …` / `Page · …`; HTTP 404; 404 UI OK
* Screenshot: `screenshots/walk-20260831-full/not-found-page-title.png`
* Coverage unit: `/this-page-does-not-exist-walk`
