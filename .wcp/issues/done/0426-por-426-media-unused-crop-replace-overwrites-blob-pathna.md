---
id: "0426"
title: "[Media] Unused crop replace overwrites Blob pathname; CDN hides crop"
status: done
priority: high
assignee:
lease_expires:
scope: "Imported from Linear POR-426. Stay inside that description."
acceptance: "Implementer contract"
files: []
commit:
reason:
created: "2026-08-29T17:27:21.799Z"
linear_id: "POR-426"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-426/media-unused-crop-replace-overwrites-blob-pathname-cdn-hides-crop"
linear_status: "Done"
linear_status_type: "completed"
linear_team: "POR"
linear_project: "next-starter-template"
linear_assignee: "maintainer"
linear_labels: ["Bug"]
linear_priority: "High"
linear_parent: ""
linear_cycle: ""
linear_due: ""
linear_updated: "2026-08-30T02:08:24.940Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-426
- URL: https://linear.app/teton-web-ventures/issue/POR-426/media-unused-crop-replace-overwrites-blob-pathname-cdn-hides-crop
- Linear status: Done (completed)
- Queue status: done
- Team: Portfolio (POR)
- Project: next-starter-template
- Assignee: maintainer
- Labels: Bug
- Parent: none
- Priority: High
- Estimate: none
- Cycle: none
- Due: none
- Created: 2026-08-29T17:27:21.799Z
- Updated: 2026-08-30T02:08:24.940Z
- Completed: 2026-08-30T02:08:24.925Z
- Canceled: no
- Archived: no
- Branch: por-426-media-unused-crop-replace-overwrites-blob-pathname-cdn-hides

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

## Implementer contract

* You are implementing **this ticket only**. Do not expand scope.
* Prefer the **step-by-step plan** and **file-by-file changes** below over inventing a new design.
* Before coding: run the **Drift check**. If anchors still match, do **not** re-research the whole area — implement.
* If drift broke the plan (paths/symbols gone), stop and report; do not freestyle a rewrite.
* Smallest complete change that meets **Acceptance criteria**. Mirror existing patterns; do not introduce new libraries or architectural layers unless this ticket says so.
* Never commit secrets, `.env.local` values, or real credentials.

## Intensity

* Band: **standard** (effort 2)
* Why: isolated crop-replace storage key/URL + cheap unit tests; not auth/schema/billing
* Proof: on

Intensity: standard

## Summary

On `/admin/media`, cropping an **unused** image (`cropSaveMode(0) === "replace"`) overwrites the existing Vercel Blob pathname and then writes the **old **`storageUrl` / `thumbnailUrl` back onto `media_assets`. `@vercel/blob` `put()` defaults `cacheControlMaxAge` to one month; overwrites of a public Blob are not immediately visible (CDN + browser cache). After SWR `mutate()`, the library still renders `<img src={asset.thumbnailUrl}>` with the unchanged URL, so the crop looks like a no-op. Create-mode (in-use assets) already inserts a new key/URL and is fine. Local disk has no Blob CDN, so current tests can lock the old URL and still pass.

## User report

> Filed by `/prb` Phase 1.5 local review gate before push (exhaustive second panel after [POR-410](https://linear.app/teton-web-ventures/issue/POR-410/gallery-csp-blocks-vercel-blob-media-on-public-album-pages)/[POR-411](https://linear.app/teton-web-ventures/issue/POR-411/pay-csp-form-action-blocks-stripe-checkout-303-in-chromesafari) CSP fixes). P1 / High / serious.
>
> Unused-image crop (`cropSaveMode(0) === "replace"`) overwrites the existing Vercel Blob pathname (`allowOverwrite: true`, `addRandomSuffix: false` in `lib/storage/blob-driver.ts`) and then writes `storageUrl: asset.storageUrl` / `thumbnailUrl: asset.thumbnailUrl` — the same URLs already in `media_assets`. `@vercel/blob` `put()` defaults `cacheControlMaxAge` to one month; overwrites are not immediately visible (CDN lag; browsers keep cached bytes). Admin `/admin/media` re-renders `<img src={asset.thumbnailUrl}>` after SWR mutate with that unchanged URL, so the crop looks like a no-op. Local disk (`public/` + `'self'`) has no Blob CDN, so `tests/media-crop.test.ts` can lock the old URL and still pass. Create-mode (in-use assets) is fine because it inserts a new key/URL.
>
> Evidence:
>
> * `lib/media/crop.ts:33-55` replace branch persists `asset.storageUrl` / `asset.storageKey`
> * `lib/storage/blob-driver.ts:7-13` `put` with `allowOverwrite: true`, `addRandomSuffix: false`
> * `lib/media/crop-save.ts` `cropSaveMode(0) === "replace"`
> * Suggested fix: treat cropped object as immutable (new `storageKey` even on replace, persist `persisted.stored.url`) OR cache-buster on stored URL. Do not rely on overwrite of a long-cached public Blob.

## Current behavior

1. Admin opens `/admin/media`, clicks Crop on an unused image (`usageCount === 0`).
2. `MediaCropDialog` POSTs FormData `file` to `POST /api/admin/media/:id/crop`.
3. `saveCroppedMedia` loads the row `FOR UPDATE`, counts `media_usages`, and because count is 0 takes `mode === "replace"`.
4. Replace branch calls `persistMediaObject(driver, asset.storageKey, …, { thumbnailKey: asset.thumbnailKey })` — **same object keys** as the original upload.
5. Blob driver `put(key, …, { access: "public", addRandomSuffix: false, allowOverwrite: true })`. `@vercel/blob` default `cacheControlMaxAge` is **one month**. Overwritten bytes sit behind the same public URL.
6. The `media_assets` update **explicitly** sets `storageUrl: asset.storageUrl`, `storageKey: asset.storageKey`, `thumbnailUrl: asset.thumbnailUrl ?? persisted.thumbnailUrl` — even if `put()` returned a URL, it is discarded.
7. Handler returns `{ id, url: asset.storageUrl, mode: "replace", width, height }`. Dialog closes and `mutate()` refetches GET `/api/admin/media`.
8. Grid `<img src={asset.thumbnailUrl}>` still points at the cached Blob URL → crop looks like a no-op on preview/prod.

* Evidence: `lib/media/crop.ts` (`saveCroppedMedia` replace branch, ~L33–76) — persists old URLs/keys; return `url: asset.storageUrl`.
* Evidence: `lib/storage/blob-driver.ts` (`createBlobDriver.put`, ~L7–14) — overwrite same pathname, no random suffix, no cache-control override.
* Evidence: `lib/media/persist.ts` (`persistMediaObject`, ~L12–29) — when `options.thumbnailKey` is set and `!== key`, thumb is also overwritten in place.
* Evidence: `lib/media/crop-save.ts` (`cropSaveMode`, ~L3–4) — unused → `"replace"`.
* Evidence: `app/admin/media/page.tsx` (~L66–68, ~L98) — `<img src={asset.thumbnailUrl}>` then `onSaved={() => mutate()}`.
* Evidence: `tests/media-crop.test.ts` (~L237–247) — **locks **`storageKey` / `storageUrl` to the source asset and asserts `storagePut` was called with those same keys.

Create branch (~L79–124) already does the right thing: `mediaObjectKey("image", newId, filename)` + `storageUrl: persisted.stored.url`.

## Expected behavior

* Unused-image crop still **replaces the same** `media_assets` **row** (same `id`, no extra library card, audit `action: "update"`, `mode: "replace"`). Product rule from [POR-387](https://linear.app/teton-web-ventures/issue/POR-387/add-image-crop-flow-to-admin-media-using-existing-react-image-crop) does not change.
* The stored object is **immutable**: replace writes a **new **`storageKey` (and new thumbnail key), then persists `persisted.stored.url` / `persisted.thumbnailUrl` onto the row.
* GET `/api/admin/media` after save returns different `storageUrl` and `thumbnailUrl` than before the crop. `/admin/media` thumbs update immediately (SWR mutate + new `src`).
* POST body `url` is the new stored URL, not the pre-crop URL.
* In-use crop (`mode === "create"`) stays a new row with a new key (no behavior change).
* Do **not** rely on overwriting a long-cached public Blob pathname, query-string cache-busters as the primary fix, or lowering `cacheControlMaxAge` on the existing key.
* Local disk must also get a new key so tests cannot pass by locking the old URL.

## Suspected root cause / scope

**Confirmed (two stacked bugs in the replace branch):**

1. **Same pathname overwrite** on Vercel Blob (`allowOverwrite: true`, `addRandomSuffix: false`) against a public object whose default Cache-Control is ~1 month. CDN/browser keep serving the old bytes.
2. **DB writes the old URLs anyway** (`storageUrl: asset.storageUrl`, `thumbnailUrl: asset.thumbnailUrl ?? …`), so even a hypothetical new `put()` URL is thrown away. Admin SWR re-renders the same `src`.

Unit tests mock `getStorageDriver` as `name: "local"` and **assert the old URL is kept**, so CI cannot catch the Blob CDN failure.

Scope: `saveCroppedMedia` replace branch + `tests/media-crop.test.ts` (and any source-lock in `tests/media.test.ts` that would regress). Do not change `cropSaveMode`, create-mode, Blob-vs-local driver policy, or CSP.

## Code map

| Path | Role | Symbols / notes |
| -- | -- | -- |
| `lib/media/crop.ts` | **Primary fix** | `saveCroppedMedia` replace ~L33–76; create ~L79–124 is the mirror |
| `lib/media/persist.ts` | Persist + thumbs | `persistMediaObject(driver, key, bytes, contentType, kind, options?)` — omit `thumbnailKey` so thumb is new |
| `lib/media/crop-save.ts` | Mode helper (do not change semantics) | `cropSaveMode(usageCount)`, `cropDerivativeFilename` |
| `lib/media/validate-upload.ts` | New object key | `mediaObjectKey(kind, assetId, safeFilename)` → `media/{kind}/{yyyy}/{mm}/{id}-{filename}` |
| `lib/storage/blob-driver.ts` | Why overwrite is invisible | `put({ access: "public", addRandomSuffix: false, allowOverwrite: true })` — **do not retarget this ticket at driver defaults** |
| `lib/storage/local-driver.ts` | Dev disk | `writeFile` under `public/` + `url: /${key}` — no CDN, which is why local looks fine |
| `lib/storage/index.ts` | Driver pick | Blob if `BLOB_READ_WRITE_TOKEN`; else local unless preview/prod |
| `app/api/admin/media/[id]/crop/route.ts` | Route Handler | `POST` → `validateUploadFile` → `saveCroppedMedia` → `jsonOk(result)` |
| `app/admin/media/page.tsx` | Admin grid | `<img src={asset.thumbnailUrl}>` ~L66–68; `onSaved={() => mutate()}` ~L98 |
| `components/admin/media-crop-dialog.tsx` | Crop UI | POST crop; uses `body.mode` only for toast; grid refresh is SWR |
| `lib/db/schema/media-assets.ts` | Columns + unique | `storageUrl`, `storageKey` (**unique **`uq_media_assets_storage_key`), `thumbnailUrl`, `thumbnailKey` |
| `tests/media-crop.test.ts` | **Must change** | `"replaces an unused image in place…"` currently asserts old URL/key |
| `tests/media.test.ts` | Source invariant | `describe("media crop source")` — still expects `asset.storageKey` string present; keep if still true |

Primary package/app: repo-root Next.js 16 App Router (`next-starter-template`)
Owning monorepo path: N/A — single Next app

## Relevant contracts (types / APIs / data)

* **Types: **`CropSaveMode = "replace" | "create"`. `StoragePutResult = { key: string; url: string }`. Replace must keep the same `media_assets.id`.
* **API: **`POST /api/admin/media/:id/crop` (session + `admin` or `moderate`). FormData `{ file }`. Success `200` `{ id, url, kind: "image", mode, width, height }`. Auth unchanged.
* **DB:** table `media_assets`. Unique on `storage_key` — new replace keys must be unique (use a new id fragment in `mediaObjectKey`, not the old pathname). No migration.
* **Env / flags (names only): **`BLOB_READ_WRITE_TOKEN` selects Blob vs local. `VERCEL_ENV` preview/production requires object storage. Never paste values.
* **Auth:** Route Handler + Zod/helpers; no Server Actions.

## Code anchors (excerpts)

### `lib/media/crop.ts` — `saveCroppedMedia` replace (~L33–55)

```ts
if (mode === "replace") {
  const persisted = await persistMediaObject(
    input.driver,
    asset.storageKey,
    input.bytes,
    input.validated.contentType,
    "image",
    { thumbnailKey: asset.thumbnailKey },
  )
  await tx.update(mediaAssets).set({
    storageUrl: asset.storageUrl,
    storageKey: asset.storageKey,
    thumbnailUrl: asset.thumbnailUrl ?? persisted.thumbnailUrl,
    thumbnailKey: asset.thumbnailKey ?? persisted.thumbnailKey,
    // contentType / sizeBytes / width / height / updatedAt…
  })
}
```

### `lib/media/crop.ts` — create branch to **mirror** (~L79–88)

```ts
const newId = crypto.randomUUID()
const filename = cropDerivativeFilename(input.validated.safeFilename)
const key = mediaObjectKey("image", newId, filename)
const persisted = await persistMediaObject(input.driver, key, input.bytes, input.validated.contentType, "image")
await tx.insert(mediaAssets).values({
  storageUrl: persisted.stored.url,
  storageKey: persisted.stored.key,
  thumbnailUrl: persisted.thumbnailUrl,
  thumbnailKey: persisted.thumbnailKey,
  // …
})
```

Mirror **how** create persists URLs/keys from `persisted`, not the extra row. Replace must keep `asset.id` and audit `action: "update"`.

### `lib/storage/blob-driver.ts` — `createBlobDriver.put` (~L7–14)

```ts
const result = await put(key, body, {
  access: "public",
  addRandomSuffix: false,
  allowOverwrite: true,
  contentType,
})
return { key: result.pathname || key, url: result.url }
```

Do not make overwrite + long cache the crop strategy. Leave driver defaults alone unless drift forces a one-line comment; the crop path must stop calling `put` on the live public key.

## Step-by-step implementation plan

Recommended approach is **mandatory**: immutable new object on replace. Cache-buster query params or `cacheControlMaxAge` tweaks are **not** the fix.

1. In `saveCroppedMedia` replace branch, capture `previousStorageKey` / `previousThumbnailKey` from `asset`.
2. Build a **new** key with `mediaObjectKey("image", crypto.randomUUID(), input.validated.safeFilename)` (or equivalent unique suffix). Do **not** reuse `asset.storageKey`. Do **not** pass `{ thumbnailKey: asset.thumbnailKey }` — let `persistMediaObject` derive a new thumb key from the new object key.
3. `tx.update(mediaAssets)` set:
   * `storageUrl: persisted.stored.url`
   * `storageKey: persisted.stored.key`
   * `thumbnailUrl: persisted.thumbnailUrl`
   * `thumbnailKey: persisted.thumbnailKey`
   * keep existing `contentType` / `sizeBytes` / `width` / `height` / `updatedAt` updates
   * do **not** change `id` or (unless you have a reason) `filename`
4. Return `url: persisted.stored.url` (not `asset.storageUrl`). Keep `id: asset.id`, `mode: "replace"`.
5. After the transaction **succeeds**, best-effort `driver.delete` the previous storage key and previous thumbnail key when they differ from the new keys. Do not fail the request if delete throws (orphan Blob is acceptable). Do not delete inside the txn in a way that rolls back a successful persist.
6. Leave create-mode, `cropSaveMode`, route auth, dialog, and Blob driver options unchanged.
7. Update `tests/media-crop.test.ts` replace case (see Test plan). Keep create-mode and auth tests.
8. Run Verification commands.

## File-by-file changes

| Path | Action | What to change |
| -- | -- | -- |
| `lib/media/crop.ts` | edit | Replace branch: new key, persist `persisted.stored.*` + thumb URLs, return new `url`, best-effort delete old keys after commit |
| `tests/media-crop.test.ts` | edit test | Replace case must **forbid** locking old URL/key; assert new key/url, `storagePut` not called with `sourceAsset.storageKey` as the live object (new key only), `id` unchanged, `mode: "replace"` |
| `tests/media.test.ts` | edit only if it breaks | Source test currently `expect(save).toContain("asset.storageKey")` — still valid if you read old keys for delete. Do not re-lock `storageUrl: asset.storageUrl` |
| `lib/storage/blob-driver.ts` | do not touch | Overwrite flags stay; crop must not use them |
| `lib/media/crop-save.ts` | do not touch | `replace` vs `create` product rule stays |
| `app/admin/media/page.tsx` | do not touch | New URLs from GET are enough for `<img src>` |
| `components/admin/media-crop-dialog.tsx` | do not touch |  |

## Do not touch / out of scope

* `cropSaveMode` / creating a new library asset for unused images ([POR-387](https://linear.app/teton-web-ventures/issue/POR-387/add-image-crop-flow-to-admin-media-using-existing-react-image-crop) rule stands: unused → same row)
* Blob driver `allowOverwrite` / `addRandomSuffix` / adding `cacheControlMaxAge` as the crop fix
* Query-string cache-busters on `<img src>` as the primary fix
* CSP (`POR-410` / `POR-411`), galleries, CMS heroes, `next/image` rewrite
* Schema/migrations, `uq_media_assets_storage_key` (honor it with new keys; do not drop it)
* Auth, flags, Doppler, Server Actions
* No drive-by renames, dependency upgrades, or formatting-only sweeps

## Acceptance criteria

- [ ] Unused crop (`media_usages` count 0) still updates the **same **`media_assets.id` with `mode: "replace"` and audit `action: "update"`
- [ ] After replace, `storageKey` and `storageUrl` are **not** the pre-crop values; `thumbnailKey` / `thumbnailUrl` are new when a thumb is written
- [ ] `persistMediaObject` / `driver.put` for replace is **not** called with the previous live `storageKey` (new immutable key)
- [ ] POST `200` `url` equals the new `storageUrl`
- [ ] In-use crop still `mode: "create"` with a new row and does not mutate the source row
- [ ] Unique `storage_key` is preserved (no insert/update collision)
- [ ] Admin `/admin/media` grid thumb changes after save without a hard reload once GET returns the new `thumbnailUrl` (SWR mutate already in place)
- [ ] Existing 401/403/non-image crop tests still pass
- [ ] Verification commands in this ticket pass

## Test plan

**Automated (prefer):**

* File: `tests/media-crop.test.ts`
* Cases:
  * Unused replace → `200`, `id === "asset-1"`, `mode: "replace"`, `width`/`height` from the crop file
  * `updates[0].values.storageKey !== sourceAsset.storageKey`
  * `updates[0].values.storageUrl !== sourceAsset.storageUrl`
  * `updates[0].values.storageUrl` equals `storagePut` result URL for the **new** key (mock already returns `https://cdn.test/${key}`)
  * `storagePut` was **not** called with `sourceAsset.storageKey` as the original-object overwrite (new key + new thumb key only)
  * No `media_assets` insert on replace; audit still `update` / `{ crop: true, mode: "replace" }`
  * Used asset still `mode: "create"` (unchanged)
* File: `tests/media.test.ts` — existing `cropSaveMode(0) === "replace"` stays; do not invert product rule

**Manual:**

1. Preview/prod (or any env with `BLOB_READ_WRITE_TOKEN`): upload an unused JPEG on `/admin/media`, crop it, save.
2. Library tile shows the cropped pixels immediately (no hard refresh). Network: thumb request hits a **new** Blob pathname, not the original.
3. Crop the same unused asset again — second crop also visible (new key again; unique index holds).
4. Attach the asset to a gallery/CMS usage, crop again — new asset is created; original unchanged.
5. Local without Blob: crop still replaces the same row; new file under `public/media/…`.

## Verification

* `bun run typecheck`
* `bun test tests/media-crop.test.ts`
* `bun test tests/media.test.ts`
* `bun test tests`
* Manual: Test plan (Blob unused crop on `/admin/media`)

### Runtime proof (`/solve` / `/prb` drive this — not a new slash)

* Surface: `POST /api/admin/media/:id/crop` on an unused image, then GET `/api/admin/media` and the grid `<img>`.
* Observed end state: response `url` and row `storage_url` / `thumbnail_url` differ from pre-crop; admin thumb paints the crop without waiting for CDN TTL. If live Blob cannot be driven, unit asserts that replace persists a **new** key/url (not `asset.storageUrl`) are the minimum; record **unproven** for live Blob paint if not driven.

## Drift check (before implementing)

Re-verify these anchors; if they still match, **skip full re-investigation** and implement:

- [ ] `lib/media/crop.ts` `saveCroppedMedia` replace still `persistMediaObject(…, asset.storageKey, …, { thumbnailKey: asset.thumbnailKey })` and `storageUrl: asset.storageUrl`
- [ ] Create branch still uses `mediaObjectKey` + `persisted.stored.url`
- [ ] `lib/media/crop-save.ts` `cropSaveMode(0) === "replace"`
- [ ] `lib/storage/blob-driver.ts` still `addRandomSuffix: false`, `allowOverwrite: true`
- [ ] `app/admin/media/page.tsx` still `<img src={asset.thumbnailUrl}>` + `mutate()` on save
- [ ] `tests/media-crop.test.ts` replace case still expects `storageKey: sourceAsset.storageKey` and `storageUrl: sourceAsset.storageUrl`
- [ ] `media_assets.storage_key` unique index still exists

Snapshot: investigated at 2026-08-29, branch `dev`, HEAD hint `3e130d6` (crop introduced in `83667d6` [POR-387](https://linear.app/teton-web-ventures/issue/POR-387/add-image-crop-flow-to-admin-media-using-existing-react-image-crop)).

## Risks / blockers

* Leaving old Blob objects after a new-key replace leaks storage. Best-effort `delete` after commit; do not fail the crop if delete fails.
* Do not overwrite-in-place even with a shorter `cacheControlMaxAge` — browsers and CDN edges can still serve stale bytes; [POR-387](https://linear.app/teton-web-ventures/issue/POR-387/add-image-crop-flow-to-admin-media-using-existing-react-image-crop) create-mode already shows the immutable-object pattern.
* Related: [POR-387](https://linear.app/teton-web-ventures/issue/POR-387/add-image-crop-flow-to-admin-media-using-existing-react-image-crop) (crop feature, In Review) — this is a follow-up correctness bug, not a duplicate and not a product-rule change.
* [POR-410](https://linear.app/teton-web-ventures/issue/POR-410/gallery-csp-blocks-vercel-blob-media-on-public-album-pages) / [POR-411](https://linear.app/teton-web-ventures/issue/POR-411/pay-csp-form-action-blocks-stripe-checkout-303-in-chromesafari) are CSP allowlists from the same `/prb` pass; they do **not** fix cache/overwrite.
* Rollback: revert the replace-branch key/URL change and tests.

## Platform / stack

* Canonical targets: Next.js 16 App Router, Vercel Blob (`@vercel/blob`), Neon + Drizzle `media_assets` (no new migration), Route Handlers + Zod, admin `/admin/media`
* Must not use / abandoned for this work: Server Actions, `db:push`, BlockNote, query-string cache-bust as the primary fix, same-origin media proxy
* Migration dependency: none

## Related

* Related: [POR-387](https://linear.app/teton-web-ventures/issue/POR-387/add-image-crop-flow-to-admin-media-using-existing-react-image-crop) Add image crop flow to admin media using existing react-image-crop
* Parent epic (context only): [POR-379](https://linear.app/teton-web-ventures/issue/POR-379/gold-standard-kit-flags-galleries-stripe-and-half-wired-finish) Gold standard kit
* Same `/prb` pass (not this bug): [POR-410](https://linear.app/teton-web-ventures/issue/POR-410/gallery-csp-blocks-vercel-blob-media-on-public-album-pages), [POR-411](https://linear.app/teton-web-ventures/issue/POR-411/pay-csp-form-action-blocks-stripe-checkout-303-in-chromesafari) CSP
* blockedBy: none
* Duplicate of: none — searched Portfolio / next-starter-template for crop + Blob overwrite/cacheControl; only [POR-387](https://linear.app/teton-web-ventures/issue/POR-387/add-image-crop-flow-to-admin-media-using-existing-react-image-crop) (feature) and [POR-379](https://linear.app/teton-web-ventures/issue/POR-379/gold-standard-kit-flags-galleries-stripe-and-half-wired-finish) (epic) matched crop. [POR-410](https://linear.app/teton-web-ventures/issue/POR-410/gallery-csp-blocks-vercel-blob-media-on-public-album-pages) is gallery CSP, not object-cache.

## Supersedes (required when this ticket replaces earlier work)

* none — does not replace [POR-387](https://linear.app/teton-web-ventures/issue/POR-387/add-image-crop-flow-to-admin-media-using-existing-react-image-crop); unused still replace-in-row, used still create-new-row

## Assumptions / pre-decided

* **Mandatory approach:** new immutable `storageKey` + persist `persisted.stored.url` (and new thumb URL) on replace. Cache-buster / TTL change / driver-flag tweak is out of scope.
* Product rule from [POR-387](https://linear.app/teton-web-ventures/issue/POR-387/add-image-crop-flow-to-admin-media-using-existing-react-image-crop) stays: unused → same asset id; used → new asset.
* `filename` column may stay; uniqueness lives in the object key (UUID fragment via `mediaObjectKey`).
* Best-effort delete of previous keys after successful commit is in scope; failing delete must not 500 the crop.
* Filed by `/prb` Phase 1.5; no code/commit/push/PR in this intake.
* Team **Portfolio** (`POR`), project **next-starter-template** — same home as [POR-387](https://linear.app/teton-web-ventures/issue/POR-387/add-image-crop-flow-to-admin-media-using-existing-react-image-crop) / [POR-410](https://linear.app/teton-web-ventures/issue/POR-410/gallery-csp-blocks-vercel-blob-media-on-public-album-pages).
