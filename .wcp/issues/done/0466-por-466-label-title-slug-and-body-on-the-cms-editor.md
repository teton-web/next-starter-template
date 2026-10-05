---
id: "0466"
title: "Label title, slug, and body on the CMS editor"
status: done
priority: high
assignee:
lease_expires:
scope: "Imported from Linear POR-466. Stay inside that description."
acceptance: "Label title, slug, and body on the CMS editor"
files: []
commit:
reason:
created: "2026-08-31T20:26:33.371Z"
linear_id: "POR-466"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-466/label-title-slug-and-body-on-the-cms-editor"
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
linear_updated: "2026-09-01T15:04:05.967Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-466
- URL: https://linear.app/teton-web-ventures/issue/POR-466/label-title-slug-and-body-on-the-cms-editor
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
- Created: 2026-08-31T20:26:33.371Z
- Updated: 2026-09-01T15:04:05.967Z
- Completed: 2026-09-01T15:04:05.952Z
- Canceled: no
- Archived: no
- Branch: por-466-label-title-slug-and-body-on-the-cms-editor

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

# Label title, slug, and body on the CMS editor

## Implementer contract

* You are implementing **this ticket only**. Do not add BlockNote or a media picker here.
* Mirror the existing `Label htmlFor="cms-publish-at"` on the same page.
* Never commit secrets.

## Intensity

* Band: standard
* Why: isolated a11y labels on one editor
* Proof: on

## Summary

`/admin/content/[id]` title, slug, and body controls have no `<label>`, `id`, or `aria-label`. Excerpt and hero id only have placeholders. The scheduled-publish field already uses `Label`. Screen readers announce empty “textbox”.

## User report

> Signed in, created draft “Walk draft page”, opened Edit. Interactive snapshot: unlabeled textboxes for title and slug, unlabeled textarea for body. Inputs had empty `id`/`name` and no labels. Excerpt placeholder “Excerpt”; hero “Hero media asset id”. Save draft still worked (“Saved (draft)”).

## Current behavior

* Evidence: `app/admin/content/[id]/page.tsx` (`EditCmsEntryPage`, ~L81–94) — raw `Input`/`Textarea` without labels
* Evidence: same file ~L97–98 — `Label htmlFor="cms-publish-at"` exists for publish-at

## Expected behavior

* Title, slug, excerpt, hero media id, and body each have a visible `Label` + matching `htmlFor`/`id`.
* Suggested names: **Title**, **Slug**, **Excerpt**, **Hero media asset id**, **Body**.
* Placeholders may remain; they are not a substitute for labels.
* Do not change save/publish behavior.

## Suspected root cause / scope

Confirmed: editor was built as unlabeled inputs. Scope: `app/admin/content/[id]/page.tsx` form fields.

## Code map

| Path | Role | Symbols / notes |
| -- | -- | -- |
| `app/admin/content/[id]/page.tsx` | Editor | `EditCmsEntryPage` ~L79–120 |
| `components/ui/label.tsx` | Label primitive | already imported |
| `components/admin/gallery-album-detail.tsx` | Sibling unlabeled editor | out of scope (own ticket) |

Primary package/app: repo root Next.js app

## Relevant contracts (types / APIs / data)

* **Types: **`Entry` title/slug/excerpt/body/heroMediaId
* **API: **`PATCH /api/admin/cms/:id` unchanged

## Code anchors (excerpts)

### `app/admin/content/[id]/page.tsx` (~L81–94)

```tsx
<h1 className="text-2xl font-bold">Edit {entry.routePath}</h1>
<Input value={entry.title} onChange={(e) => setDraft({ ...entry, title: e.target.value })} />
<Input value={entry.slug} onChange={(e) => setDraft({ ...entry, slug: e.target.value })} />
```

### Pattern to mirror

* **Mirror: **`Label htmlFor="cms-publish-at"` on the same page
* **Why:** already the labeled control pattern here

## Step-by-step implementation plan

1. Add `id` + `Label` for title, slug, excerpt, heroMediaId, body.
2. Keep existing `onChange` / save buttons.
3. Snapshot the editor: each field has an accessible name.

## File-by-file changes

| Path | Action | What to change |
| -- | -- | -- |
| `app/admin/content/[id]/page.tsx` | edit | Labels + ids on editor fields |

## Do not touch / out of scope

* Hero media picker (separate idea ticket)
* Gallery album editor labels (separate)
* Publish workflow

## Acceptance criteria

- [ ] Title, slug, excerpt, hero id, and body have visible labels and accessible names.
- [ ] Save draft / Publish still succeed.
- [ ] Scheduled-publish label still works when that flag is on.
- [ ] Verification commands pass.

## Test plan

**Manual:** open a draft, confirm labels in the a11y tree, save.

## Verification

* `bun run lint`
* `bun run typecheck`
* `bun test tests`
* Manual: see Test plan

### Runtime proof

* Surface to drive: /admin/content/[id]
* Project verify skill / feature map: none
* Visual reference (UI): admin users Invite form labels on `/admin/users`
* Blast-radius fact: only the CMS edit form
* Observed end state that proves done: each editor field has an accessible name

## Drift check (before implementing)

- [ ] `app/admin/content/[id]/page.tsx` still exists and owns the behavior
- [ ] Unlabeled Input/Textarea still present
- [ ] `Label htmlFor=cms-publish-at` still is the right mirror
- [ ] `bun run typecheck` still exists
- [ ] Walk evidence still matches current UI

Snapshot: investigated at 2026-08-31, branch `dev`, HEAD `e46fea1`.

## Risks / blockers

* none
* Rollback note: revert the listed files

## Platform / stack

* Canonical targets: Next.js 16 App Router, Better Auth, Neon/Drizzle, Tailwind 4, shadcn/ui
* Must not use / abandoned for this work: Server Actions; `db:push`; BlockNote
* Migration dependency: none

## Related

* Parent epic: [POR-461](https://linear.app/teton-web-ventures/issue/POR-461)
* Related: none
* blockedBy: none
* Duplicate of: none

## Supersedes

* none

## Assumptions / pre-decided

* Visible labels, not aria-label-only.

## Walk metadata

* Kind: bug
* Surface: /admin/content/[id]
* Viewport: 1280×800
* Auth: signed-in
* Drive path: create draft → Edit → inspect inputs
* Observed: title/slug/body have empty accessible names
* Screenshot: none
* Coverage unit: /admin/content/[id]
