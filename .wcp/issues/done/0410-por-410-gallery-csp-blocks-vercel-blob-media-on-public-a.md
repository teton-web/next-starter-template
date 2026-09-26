---
id: "0410"
title: "[Gallery] CSP blocks Vercel Blob media on public album pages"
status: done
priority: high
assignee:
lease_expires:
scope: "Imported from Linear POR-410. Stay inside that description."
acceptance: "Implementer contract"
files: []
commit:
reason:
created: "2026-08-29T16:30:51.679Z"
linear_id: "POR-410"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-410/gallery-csp-blocks-vercel-blob-media-on-public-album-pages"
linear_status: "Done"
linear_status_type: "completed"
linear_team: "POR"
linear_project: "next-starter-template"
linear_assignee: "David Solheim <david@tetonweb.com>"
linear_labels: ["Bug"]
linear_priority: "High"
linear_parent: "POR-379"
linear_cycle: ""
linear_due: ""
linear_updated: "2026-08-30T02:08:21.990Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-410
- URL: https://linear.app/teton-web-ventures/issue/POR-410/gallery-csp-blocks-vercel-blob-media-on-public-album-pages
- Linear status: Done (completed)
- Queue status: done
- Team: Portfolio (POR)
- Project: next-starter-template
- Assignee: David Solheim <david@tetonweb.com>
- Labels: Bug
- Parent: POR-379 — Gold standard kit — flags, galleries, Stripe, and half-wired finish
- Priority: High
- Estimate: none
- Cycle: none
- Due: none
- Created: 2026-08-29T16:30:51.679Z
- Updated: 2026-08-30T02:08:21.990Z
- Completed: 2026-08-30T02:08:21.970Z
- Canceled: no
- Archived: no
- Branch: david/por-410-gallery-csp-blocks-vercel-blob-media-on-public-album-pages

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

## Implementer contract

* You are implementing **this ticket only** (not [POR-379](https://linear.app/teton-web-ventures/issue/POR-379/gold-standard-kit-flags-galleries-stripe-and-half-wired-finish), not [POR-390](https://linear.app/teton-web-ventures/issue/POR-390/add-galleries-from-kectil-alumni-subset-on-media-assets)). Do not expand scope.
* Prefer the **step-by-step plan** and **file-by-file changes** below over inventing a new design.
* Before coding: run the **Drift check**. If anchors still match, do **not** re-research the whole area — implement.
* If drift broke the plan (paths/symbols gone), stop and report; do not freestyle a rewrite.
* Smallest complete change that meets **Acceptance criteria**. Mirror existing patterns; do not introduce new libraries or architectural layers unless this ticket says so.
* Never commit secrets, `.env` values, or real credentials.

## Intensity

* Band: standard
* Why: isolated CSP allowlist + cheap source test; not auth/schema
* Proof: on

## Summary

Preview and production galleries store media on Vercel Blob (`BLOB_READ_WRITE_TOKEN`). Blob URLs are `https://<store>.public.blob.vercel-storage.com/…`. The public album page (`/gallery/[slug]`) and index (`/gallery`) render those URLs with raw `<img>` / `<video>` tags. Document CSP `img-src` / `media-src` do not allow `*.vercel-storage.com`, so browsers block the media on preview/prod only. Local disk URLs (`/media/…`) match `'self'` and still work. `images.remotePatterns` already allows `**.vercel-storage.com` for `next/image`, but these tags do not use `next/image`.

## User report

> Filed by `/prb` Phase 1.5 local review gate before push (thoroughness review of `origin/main...dev`). P1 / High / serious.
>
> Preview/production galleries require `BLOB_READ_WRITE_TOKEN`. The blob driver returns `*.vercel-storage.com` URLs, and the new public album page renders them with raw `<img>` / `<video>` tags. Document CSP is `img-src 'self' data: blob: https://*.vercel.com https://*.vercel-scripts.com` and `media-src 'self' blob:` — neither includes `*.vercel-storage.com` (and `*.vercel.com` does not match it). Browsers block the media; local disk URLs under `'self'` still work, so the failure is preview/prod-only. `next.config.mjs` `images.remotePatterns` already allows hostname `**.vercel-storage.com` for `next/image`, but these tags do not use it.
>
> Evidence:
>
> * `app/(public)/gallery/[slug]/page.tsx`:54-59 — raw `<video src={item.src}>` and `<img src={item.thumbnailSrc}>`
> * `next.config.mjs` lines 17, 20 (`img-src` / `media-src`) vs lines 51-56 (`remotePatterns` already allow vercel-storage)
> * Suggested fix: extend `img-src` and `media-src` to include `https://*.vercel-storage.com` (or proxy media same-origin)

## Current behavior

* On local/dev without Blob, `getStorageDriver` uses `createLocalDriver`, which returns `url: /${key}` (same-origin). Public gallery images/videos load under CSP `'self'`.
* On Vercel preview/production, `BLOB_READ_WRITE_TOKEN` is required (`isObjectStorageRequired`). `createBlobDriver().put` returns `result.url` from `@vercel/blob` — typically `https://<store-id>.public.blob.vercel-storage.com/<key>`.
* `persistMediaObject` writes that URL onto `media_assets.storage_url` / `thumbnail_url`. `assetToGallerySource` copies them to `src` / `thumbnailUrl`. `presentGalleryItem` exposes `src` and `thumbnailSrc` to the public pages.
* `GalleryAlbumPage` renders `<video src={item.src} poster={item.thumbnailSrc}>` and `<img src={item.thumbnailSrc}>`. `GalleryPage` renders `<img src={album.coverSrc}>`.
* Document CSP on every `/:path*`:
  * `img-src 'self' data: blob: https://*.vercel.com https://*.vercel-scripts.com` — no Blob host. `<img>` and `<video poster>` are blocked.
  * `media-src 'self' blob:` — no Blob host. `<video src>` is blocked.
* `https://*.vercel.com` does **not** match `*.vercel-storage.com`.
* Evidence: `next.config.mjs` (`DOCUMENT_SECURITY_HEADERS`, ~L12–26) — CSP strings
* Evidence: `app/(public)/gallery/[slug]/page.tsx` (`GalleryAlbumPage`, ~L54–59) — raw tags
* Evidence: `app/(public)/gallery/page.tsx` (`GalleryPage`, ~L30–32) — cover `<img>`
* Evidence: `lib/storage/blob-driver.ts` (`createBlobDriver`, ~L7–14) — returns Blob `result.url`
* Evidence: `lib/gallery/queries.ts` (`assetToGallerySource`, ~L13–27) — `src: asset.storageUrl`
* Console symptom (preview/prod): CSP violation for `img-src` / `media-src` against a `*.public.blob.vercel-storage.com` URL. Broken images / no video. Local looks fine.

## Expected behavior

* Preview/production published albums at `/gallery` and `/gallery/[slug]` display Blob-hosted images and play Blob-hosted videos (poster included) without CSP violations.
* Local disk URLs under `'self'` still load (no regression).
* CSP stays otherwise tight: do **not** add `'unsafe-eval'`, do **not** widen `script-src` / `connect-src` / `default-src`, do **not** add `https:`.
* `images.remotePatterns` already allows Blob; leave it. Do not rewrite gallery markup to `next/image` in this ticket.
* Non-goal: same-origin media proxy, storage-driver changes, gallery schema, or converting CMS/admin tags to `next/image`.

## Suspected root cause / scope

**Confirmed:** galleries ([POR-390](https://linear.app/teton-web-ventures/issue/POR-390/add-galleries-from-kectil-alumni-subset-on-media-assets)) store Blob URLs and render them with raw tags, but document CSP was written for `'self'` + Vercel app/scripts hosts only. `next/image` `remotePatterns` already knew about Blob; CSP `img-src` / `media-src` were never updated. Same CSP also applies to CMS heroes (`components/cms-document.tsx`) and admin thumbs — fixing CSP unblocks those too; do not change those files here.

**CSP wildcard pitfall (must handle):** CSP `https://*.vercel-storage.com` matches **one** DNS label (`foo.vercel-storage.com`), not `abc.public.blob.vercel-storage.com`. Real `@vercel/blob` public URLs use the nested host. Allow **both**:

* `https://*.vercel-storage.com`
* `https://*.public.blob.vercel-storage.com`

Scope: `DOCUMENT_SECURITY_HEADERS` in `next.config.mjs` + source assertions in `tests/security-headers.test.ts`. Nothing else.

## Code map

| Path | Role | Symbols / notes |
| -- | -- | -- |
| `next.config.mjs` | Document CSP + `images.remotePatterns` | `DOCUMENT_SECURITY_HEADERS` ~L3–28; `img-src` L17; `media-src` L20; `headers()` L59–79 applies to `/` and `/:path*`; `remotePatterns` hostname `**.vercel-storage.com` ~L51–56 |
| `app/(public)/gallery/[slug]/page.tsx` | Public album (do not rewrite tags) | `GalleryAlbumPage` ~L22–67; video/img ~L54–59 |
| `app/(public)/gallery/page.tsx` | Public index cover img | `GalleryPage` ~L30–32 |
| `lib/storage/blob-driver.ts` | Preview/prod URL source | `createBlobDriver` → `result.url` |
| `lib/storage/local-driver.ts` | Local `'self'` URL | `url: \`/${key}`` |
| `lib/storage/index.ts` | Driver pick | `getStorageDriver` — Blob if `BLOB_READ_WRITE_TOKEN` |
| `lib/storage/types.ts` | When Blob is required | `isObjectStorageRequired` — `VERCEL_ENV` preview|production |
| `lib/media/persist.ts` | Persists Blob URLs | `persistMediaObject` — `stored.url` / `thumbnailUrl` |
| `lib/gallery/queries.ts` | Maps assets → view src | `assetToGallerySource` — `src: asset.storageUrl` |
| `lib/gallery/presenters.ts` | `thumbnailSrc` fallback | `presentGalleryItem` ~L65–76 |
| `lib/db/schema/media-assets.ts` | URL columns | `storageUrl`, `thumbnailUrl` |
| `tests/security-headers.test.ts` | Test to extend | `describe("document security headers")` — does **not** yet pin img-src/media-src hosts |
| `tests/gallery.test.ts` | Regression; do not retarget | public route/flag source tests |

Primary package/app: repo root Next.js App Router (`next-starter-template`)
Owning monorepo path (if monorepo): N/A — single Next app

## Relevant contracts (types / APIs / data)

* **Types / props / schema: **`GalleryItemView` in `lib/gallery/presenters.ts` — `src`, `thumbnailSrc`, `kind: "image" \| "video" \| "document"`. `media_assets.storage_url` / `thumbnail_url` hold the Blob or local URL string.
* **API / route:** public GET `/gallery`, GET `/gallery/[slug]` (published only; flag `galleries`). No API change.
* **DB / storage:** table `media_assets` columns `storage_url`, `thumbnail_url`. Driver `vercel-blob` vs `local`. Do not migrate.
* **Env / flags (names only): **`BLOB_READ_WRITE_TOKEN` — Blob driver on preview/prod; `VERCEL_ENV`; optional flag `galleries`. Never paste values.
* **Auth / tenancy constraints:** public pages; CSP is document-wide (`/:path*`), including `/admin`.
* **CSP after fix (exact, keep other directives unchanged):**
  * `img-src 'self' data: blob: https://*.vercel.com https://*.vercel-scripts.com https://*.vercel-storage.com https://*.public.blob.vercel-storage.com`
  * `media-src 'self' blob: https://*.vercel-storage.com https://*.public.blob.vercel-storage.com`

`<video src>` is `media-src`. `<img src>` and `<video poster>` are `img-src`. Both directives must include the Blob hosts.

## Code anchors (excerpts)

### `next.config.mjs` — `DOCUMENT_SECURITY_HEADERS` (~L12–26)

```js
{
  key: "Content-Security-Policy",
  value: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://*.vercel-scripts.com https://vercel.live",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https://*.vercel.com https://*.vercel-scripts.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://*.vercel-scripts.com https://vitals.vercel-insights.com https://vercel.live wss://*.vercel.live",
    "media-src 'self' blob:",
    // …frame-src / frame-ancestors / base-uri / form-action / object-src unchanged
  ].join("; "),
}
```

### `app/(public)/gallery/[slug]/page.tsx` — `GalleryAlbumPage` (~L54–59)

```tsx
{item.kind === "video" ? (
  <video src={item.src} poster={item.thumbnailSrc} controls className="aspect-[4/3] w-full bg-muted" />
) : (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={item.thumbnailSrc} alt={item.alt ?? ""} className="aspect-[4/3] w-full object-cover" />
)}
```

Leave this markup as-is. CSP must allow `item.src` / `item.thumbnailSrc` when they are Blob URLs.

### Pattern to mirror

* **Mirror: **`/Users/davidsolheim/GitHub/cblacklist-com/next.config.mjs` (`DOCUMENT_SECURITY_HEADERS` img-src / media-src) **and **`cblacklist-com/tests/security-headers.test.ts` ~L24–25 — copy **only** the two Blob host tokens onto img-src and media-src, plus the two `toContain` asserts.
* **Why:** that clone already allowlisted Blob for raw `<img>`/`<video>`. Do **not** copy its leftover `'unsafe-eval'` (starter dropped it in [TW-1643](https://linear.app/teton-web-ventures/issue/TW-1643/starter-tighten-csp-remove-unsafe-eval); keep `expect(config).not.toContain("'unsafe-eval'")`).

## Step-by-step implementation plan

Recommended approach is **mandatory** unless drift proves the CSP strings moved.

1. In `next.config.mjs` `DOCUMENT_SECURITY_HEADERS` CSP array, append `https://*.vercel-storage.com https://*.public.blob.vercel-storage.com` to **both **`img-src` and `media-src` (exact strings under Contracts). Do not change any other directive.
2. In `tests/security-headers.test.ts`, keep existing header / `script-src` / `not.toContain("'unsafe-eval'")` asserts. Add:
   * `expect(config).toContain("https://*.vercel-storage.com")`
   * `expect(config).toContain("https://*.public.blob.vercel-storage.com")`
   * Assert the full post-change `img-src` and `media-src` strings from Contracts so a later edit cannot drop one host or one directive.
3. Do not edit gallery pages, storage drivers, schema, or `images.remotePatterns`.
4. Run Verification commands.
5. Runtime proof: confirm a document response `Content-Security-Policy` header includes both Blob hosts on `img-src` and `media-src`.

## File-by-file changes

| Path | Action | What to change |
| -- | -- | -- |
| `next.config.mjs` | edit | `img-src` and `media-src` as specified; leave `script-src`, `remotePatterns`, and other headers alone |
| `tests/security-headers.test.ts` | edit test | pin both Blob host tokens and the full `img-src` / `media-src` strings; keep unsafe-eval guard |
| `app/(public)/gallery/[slug]/page.tsx` | do not touch | raw tags stay; CSP is the fix |
| `app/(public)/gallery/page.tsx` | do not touch | cover img stays |

## Do not touch / out of scope

* Gallery queries/presenters/schema/migrations, `lib/storage/*` Blob-vs-local policy, `BLOB_READ_WRITE_TOKEN` wiring
* Rewriting `<img>`/`<video>` to `next/image` (this repo has **zero **`next/image` imports; `remotePatterns` is already correct; `next/image` would not cover `<video>`)
* Same-origin media proxy / rewrite
* `script-src`, `'unsafe-eval'`, `connect-src`, `frame-src`, Permissions-Policy
* CMS `components/cms-document.tsx`, admin media/gallery thumbs (same CSP will unblock them; do not convert those tags here)
* Feature flag `galleries`, `proxy.ts`, [POR-390](https://linear.app/teton-web-ventures/issue/POR-390/add-galleries-from-kectil-alumni-subset-on-media-assets) album CRUD
* No drive-by renames, dependency upgrades, or formatting-only sweeps

## Acceptance criteria

- [ ] `img-src` includes `https://*.vercel-storage.com` and `https://*.public.blob.vercel-storage.com` (in addition to existing `'self' data: blob: https://*.vercel.com https://*.vercel-scripts.com`)
- [ ] `media-src` includes those same two Blob hosts (in addition to `'self' blob:`)
- [ ] Other CSP directives are unchanged; `'unsafe-eval'` stays absent
- [ ] Public `/gallery` and `/gallery/[slug]` still use existing raw `<img>` / `<video>` (no markup rewrite required)
- [ ] Local `'self'` media still allowed (do not remove `'self'` from img-src/media-src)
- [ ] `images.remotePatterns` still includes hostname `**.vercel-storage.com`
- [ ] Verification commands in this ticket pass

## Test plan

**Automated (prefer):**

* File: `tests/security-headers.test.ts`
* Cases:
  * `next.config.mjs` source contains both Blob host tokens
  * full `img-src` string equals the Contracts value
  * full `media-src` string equals the Contracts value
  * still contains `frame-ancestors 'none'`, existing `script-src`, and `not.toContain("'unsafe-eval'")`
* Regression: `bun test tests/gallery.test.ts` still passes (flag/published-only source tests; do not retarget them at CSP)

**Manual:**

1. Preconditions: `galleries` flag on; a published album with an image and a video whose `storage_url` / `thumbnail_url` are `https://*.public.blob.vercel-storage.com/…` (preview/prod with `BLOB_READ_WRITE_TOKEN`). Local-only check: document CSP header after `next start`.
2. Open `/gallery` and `/gallery/[slug]`. DevTools → Console / Network: no CSP `img-src` or `media-src` violations for Blob hosts. Image tiles render; video plays; poster shows.
3. Local disk upload still previews under `'self'`.
4. Regression: login, CMS, `/admin/media` still load; no new CSP errors for scripts.

## Verification

* `bun run typecheck`
* `bun test tests/security-headers.test.ts`
* `bun test tests/gallery.test.ts`
* `bun test tests`
* Manual: Test plan (CSP header + gallery tiles)

### Runtime proof (`/solve` / `/prb` / `/yeet` drive this — not a new slash)

* Surface to drive: document `Content-Security-Policy` on `GET /gallery` (and `/gallery/[slug]` when a published album exists). Confirm `img-src` and `media-src` include both Blob hosts.
* Project verify skill / feature map: none — no `.grok/skills/verify-*` in this repo
* Visual reference (UI): local `/gallery/[slug]` with disk URLs still looks the same; preview/prod Blob tiles must actually paint (not broken-image icons)
* Blast-radius fact (shared/auth/schema): CSP is document-wide via `headers()` `source: "/:path*"`. Prove by reading the response header on `/gallery` **and** one non-gallery path (e.g. `/` or `/login`) — both must show the new img-src/media-src; `script-src` must still omit `'unsafe-eval'`.
* Observed end state that proves done: response CSP includes both Blob hosts on img-src and media-src; no browser CSP violation when loading a `https://<store>.public.blob.vercel-storage.com/…` image or video on `/gallery/[slug]`. If a live Blob album cannot be driven in this environment, header proof on `next start` plus the source tests is the minimum; record **unproven** for the live Blob paint if not driven.

## Drift check (before implementing)

Re-verify these anchors; if they still match, **skip full re-investigation** and implement:

- [ ] `next.config.mjs` still owns `DOCUMENT_SECURITY_HEADERS` with `img-src 'self' data: blob: https://*.vercel.com https://*.vercel-scripts.com` and `media-src 'self' blob:` (no Blob hosts yet)
- [ ] `headers()` still applies that CSP to `"/"` and `"/:path*"`
- [ ] `app/(public)/gallery/[slug]/page.tsx` still uses raw `<video src={item.src} poster={item.thumbnailSrc}>` and `<img src={item.thumbnailSrc}>`
- [ ] `lib/storage/blob-driver.ts` `createBlobDriver` still returns `url: result.url` from `@vercel/blob`
- [ ] `tests/security-headers.test.ts` still reads `next.config.mjs` and asserts `script-src` without `'unsafe-eval'`
- [ ] `images.remotePatterns` still has `hostname: "**.vercel-storage.com"`
- [ ] Mirror `cblacklist-com/next.config.mjs` still has both Blob hosts on img-src and media-src

Snapshot: investigated at 2026-08-29, branch `dev`, HEAD hint `6e1518d`.

## Risks / blockers

* Allowlisting only `https://*.vercel-storage.com` is a **false fix** — CSP `*` is one label; Blob URLs are `*.public.blob.vercel-storage.com`. Include both hosts.
* Do not reintroduce `'unsafe-eval'` from the cblacklist mirror.
* Related open ticket: [POR-390](https://linear.app/teton-web-ventures/issue/POR-390/add-galleries-from-kectil-alumni-subset-on-media-assets) (galleries, In Review) — compatible; this is the CSP follow-up, not a replacement.
* Rollback: revert the two CSP strings and the test asserts.

## Platform / stack

* Canonical targets: Next.js 16 App Router, Vercel, Vercel Blob (`@vercel/blob`), Doppler env names only, document CSP in `next.config.mjs` `headers()`
* Must not use / abandoned for this work: same-origin media proxy, `next/image` rewrite, Bill Lax galleries, ClickHouse/Convex
* Migration dependency: none

## Related

* Parent epic: [POR-379](https://linear.app/teton-web-ventures/issue/POR-379/gold-standard-kit-flags-galleries-stripe-and-half-wired-finish) Gold standard kit — flags, galleries, Stripe, and half-wired finish
* Related: [POR-390](https://linear.app/teton-web-ventures/issue/POR-390/add-galleries-from-kectil-alumni-subset-on-media-assets) Add galleries from Kectil Alumni subset on media_assets
* blockedBy: none
* Duplicate of: none — duplicates should not be filed

## Supersedes (required when this ticket replaces earlier work)

* none

## Assumptions / pre-decided

* **Mandatory approach:** extend document CSP. Do not proxy media same-origin. Do not convert gallery tags to `next/image`.
* Include **both **`https://*.vercel-storage.com` and `https://*.public.blob.vercel-storage.com` on **both **`img-src` and `media-src` (cblacklist-com mirror; nested Blob host is the one that matches real `put()` URLs).
* Keep starter `script-src` (no `'unsafe-eval'`) even though the cblacklist mirror still has `'unsafe-eval'`.
* Same document CSP unblocks CMS heroes and admin thumbs; do not edit those files in this ticket.
* Found by `/prb` Phase 1.5 thoroughness of `origin/main...dev` on the [POR-390](https://linear.app/teton-web-ventures/issue/POR-390/add-galleries-from-kectil-alumni-subset-on-media-assets) gallery ship; file as a [POR-379](https://linear.app/teton-web-ventures/issue/POR-379/gold-standard-kit-flags-galleries-stripe-and-half-wired-finish) child, relatedTo [POR-390](https://linear.app/teton-web-ventures/issue/POR-390/add-galleries-from-kectil-alumni-subset-on-media-assets), do not reopen [POR-390](https://linear.app/teton-web-ventures/issue/POR-390/add-galleries-from-kectil-alumni-subset-on-media-assets) for this fix.
