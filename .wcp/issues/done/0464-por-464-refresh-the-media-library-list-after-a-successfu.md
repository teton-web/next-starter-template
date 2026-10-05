---
id: "0464"
title: "Refresh the media library list after a successful upload"
status: done
priority: high
assignee:
lease_expires:
scope: "Imported from Linear POR-464. Stay inside that description."
acceptance: "Refresh the media library list after a successful upload"
files: []
commit:
reason:
created: "2026-08-31T20:26:30.863Z"
linear_id: "POR-464"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-464/refresh-the-media-library-list-after-a-successful-upload"
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
linear_updated: "2026-09-01T15:04:02.219Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-464
- URL: https://linear.app/teton-web-ventures/issue/POR-464/refresh-the-media-library-list-after-a-successful-upload
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
- Created: 2026-08-31T20:26:30.863Z
- Updated: 2026-09-01T15:04:02.219Z
- Completed: 2026-09-01T15:04:02.199Z
- Canceled: no
- Archived: no
- Branch: por-464-refresh-the-media-library-list-after-a-successful-upload

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

# Refresh the media library list after a successful upload

## Implementer contract

* You are implementing **this ticket only**. Do not change crop/archive/purge besides reusing `mutate`.
* Prefer fixing SWR revalidation (or appending the POST payload) over a full page reload.
* Never commit secrets.

## Intensity

* Band: heavy
* Why: interactive media library; upload success vs list mismatch
* Proof: on

## Summary

Uploading `placeholder.jpg` on `/admin/media` shows **Uploaded** but the grid stays empty until a full reload. POST `/api/admin/media` returns 200; GET `/api/admin/media?q=` is called; after reload the asset appears with Crop/Archive. Operators think the upload failed.

## User report

> Signed in, `/admin/media`. Chose `public/placeholder.jpg`, alt “Walk placeholder”, clicked **Upload**. Status “Uploaded”; list still empty (`ul` innerHTML empty). Reloaded the same URL: listitem `placeholder.jpg` / image · 0 uses / Crop / Archive.

## Current behavior

* Evidence: `app/admin/media/page.tsx` (`onUpload`, ~L25–34) — `setMessage("Uploaded"); reset(); await mutate()`
* Evidence: SWR key `/api/admin/media?q=` ~L22
* Empty `ul` is always rendered (~L63) even with zero assets

## Expected behavior

* After a 200 upload, the new asset appears in the grid without a full reload (filename + alt).
* “Uploaded” remains.
* Failed upload still shows the error string and does not add a row.

## Suspected root cause / scope

Likely SWR `mutate()` not revalidating the `?q=` key, or GET racing before persist. Scope: `onUpload` + SWR key in `app/admin/media/page.tsx`. Confirm POST response shape and merge if it returns the asset.

## Code map

| Path | Role | Symbols / notes |
| -- | -- | -- |
| `app/admin/media/page.tsx` | Library UI | `onUpload`, `mutate`, `assets` |
| `app/api/admin/media/route.ts` | POST/GET | response `{ asset? , assets? }` |

Primary package/app: repo root Next.js app

## Relevant contracts (types / APIs / data)

* **API: **`POST /api/admin/media` multipart `file` + `altText` → 200
* **API: **`GET /api/admin/media?q=` → `{ assets: Asset[] }`
* **Storage:** local disk in development

## Pattern to mirror

* **Mirror: **`archive()` / `purge()` in the same file already `await mutate()` after PATCH/DELETE

## Step-by-step implementation plan

1. Read POST handler return shape.
2. After 200, revalidate the exact SWR key (`mutate(undefined, { revalidate: true })`) or seed cache from the response.
3. Drive upload of a small image and confirm the row appears immediately.

## File-by-file changes

| Path | Action | What to change |
| -- | -- | -- |
| `app/admin/media/page.tsx` | edit | Fix post-upload list refresh |
| `app/api/admin/media/route.ts` | edit only if POST must return the created asset |  |

## Do not touch / out of scope

* Crop dialog 1×1 default
* Gallery attach
* Blob production driver

## Acceptance criteria

- [ ] Successful upload shows **Uploaded** and the new row without reload.
- [ ] Alt text from the form appears on the row.
- [ ] Failed upload does not add a row.
- [ ] Reload still shows the asset.
- [ ] Verification commands pass.

## Test plan

**Automated:** if a media test exists (`tests/media.test.ts`), add a handler contract for POST returning the asset.

**Manual:** upload `public/placeholder.jpg` on `/admin/media`; row visible before reload.

## Verification

* `bun run lint`
* `bun run typecheck`
* `bun test tests`
* Manual: see Test plan

### Runtime proof

* Surface to drive: /admin/media
* Project verify skill / feature map: none
* Visual reference (UI): reloaded media grid with placeholder.jpg
* Blast-radius fact: admin media list only
* Observed end state that proves done: new asset visible immediately after Uploaded

## Drift check (before implementing)

- [ ] `app/admin/media/page.tsx` still exists and owns the behavior
- [ ] `onUpload mutate after POST` still named as described
- [ ] `archive() mutate in the same file` still is the right mirror
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

* Prefer client revalidation; only change the API if the POST body has no asset.

## Walk metadata

* Kind: bug
* Surface: /admin/media
* Viewport: 1280×800
* Auth: signed-in
* Drive path: upload placeholder.jpg → Uploaded but empty list → reload shows item
* Observed: Uploaded with empty ul until full reload
* Screenshot: none
* Coverage unit: /admin/media
