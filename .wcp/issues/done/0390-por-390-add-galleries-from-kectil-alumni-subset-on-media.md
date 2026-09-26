---
id: "0390"
title: "Add galleries from Kectil Alumni subset on media_assets"
status: done
priority: high
assignee:
lease_expires:
scope: "Imported from Linear POR-390. Stay inside that description."
acceptance: "Context"
files: []
commit:
reason:
created: "2026-08-28T19:00:59.981Z"
linear_id: "POR-390"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-390/add-galleries-from-kectil-alumni-subset-on-media-assets"
linear_status: "Done"
linear_status_type: "completed"
linear_team: "POR"
linear_project: "next-starter-template"
linear_assignee: "David Solheim <david@tetonweb.com>"
linear_labels: []
linear_priority: "High"
linear_parent: "POR-379"
linear_cycle: ""
linear_due: ""
linear_updated: "2026-08-30T02:08:12.692Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-390
- URL: https://linear.app/teton-web-ventures/issue/POR-390/add-galleries-from-kectil-alumni-subset-on-media-assets
- Linear status: Done (completed)
- Queue status: done
- Team: Portfolio (POR)
- Project: next-starter-template
- Assignee: David Solheim <david@tetonweb.com>
- Labels: none
- Parent: POR-379 — Gold standard kit — flags, galleries, Stripe, and half-wired finish
- Priority: High
- Estimate: none
- Cycle: none
- Due: none
- Created: 2026-08-28T19:00:59.981Z
- Updated: 2026-08-30T02:08:12.692Z
- Completed: 2026-08-30T02:08:12.673Z
- Canceled: no
- Archived: no
- Branch: david/por-390-add-galleries-from-kectil-alumni-subset-on-media_assets

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

## Context

* Route / page / component / user flow: `/gallery`, `/gallery/[slug]`, `/admin/media/gallery`, `/admin/media/gallery/[albumId]`
* Parent epic: POR-379
* Source of truth: teton-web/kectil-alumni @ db9ab9ae (`lib/db/schema/gallery-albums.ts`, `drizzle/0014_gallery_albums.sql`, publish promote KEC-655 in `lib/gallery/mutations.ts`)
* Bill Lax is a consumer, not the model

## Current behavior

Starter has `media_assets` + usages. No albums. Bill Lax already invented `galleries` + `gallery_photos` on assets. Do not invent a third model.

## Expected / intended behavior

Kectil contract, mapped onto starter `media_assets` (do not add Kectil `media_items` unless captions/year/category are required later).

Ship:

* `gallery_albums`: slug, title, description, status `draft | published` default draft, cover media id, sort_order
* `gallery_album_items`: composite PK (album_id, media_asset_id), sort_order, cascade delete
* Public fetch published only; drafts admin-only; draft slug 404s on public
* `/gallery` + `/gallery/[slug]` published only
* Sitemap + cache tag only published slugs
* Admin under media: list + album detail
* Attach existing library assets + upload into album (MIME allowlist, presign PUT for large files)
* Publish is the public switch. No per-photo public flag
* Promote private blobs on publish only if storage is private; starter public blobs skip promote but keep the status gate
* `isEnabled('galleries')` gates proxy, nav, routes, APIs; schema may exist while UI is dark

## Acceptance criteria

- [ ] Migrations only
- [ ] Flag off: public `/gallery` 404 or not linked; admin gallery nav hidden; APIs 404
- [ ] Flag on: draft album not on `/gallery` or sitemap; publish makes it appear; unpublish 404s again
- [ ] Cover + sort order persist
- [ ] Duplicate asset in one album rejected
- [ ] Empty published album shows empty state, not 404
- [ ] Audit on create/update/publish/delete
- [ ] Verification: `bun run typecheck`; sitemap omits drafts; compare behavior to Kectil public published-only rule

## Out of scope / do not change

* Intake importer, starter fallback albums, video-poster special case, CMS `galleryAlbumId`, year/location/conference taxonomy, Ghana merge helper
* Copying Bill Lax `sourceKey` unless needed for a later import

## Notes for implementer

Copy contract from teton-web/kectil-alumni @ db9ab9ae, remap `media_items` → starter `media_assets`:

* `lib/db/schema/gallery-albums.ts` + `gallery-album-items.ts`
* Queries/presenters/mutations under `lib/gallery/` (published-only public fetch)
* Public: `app/(site)/gallery/page.tsx`, `app/(site)/gallery/[slug]/page.tsx`
* Admin: `app/admin/media/gallery/` list + `[albumId]`
* Publish promote: only if storage is private; starter Blob is public so keep status gate and skip KEC-655 promote unless a private driver appears
* Sitemap + `lib/cache/public-cache.ts` tag only published slugs
* Attach existing library assets; upload into album reuses `/api/upload` + MIME allowlist + presign PUT for large files
* Flag `galleries` gates proxy, nav, routes, APIs. Schema may exist while UI is dark

Do not invent Bill Lax `galleries` + `gallery_photos`. No year/conference taxonomy, no Ghana merge, no CMS `galleryAlbumId` in this slice.
