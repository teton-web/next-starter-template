---
id: "0490"
title: "Honor rows={6} on the contact message textarea"
status: done
priority: normal
assignee:
lease_expires:
scope: "Imported from Linear POR-490. Stay inside that description."
acceptance: "Honor rows={6} on the contact message textarea"
files: []
commit:
reason:
created: "2026-08-31T20:38:58.462Z"
linear_id: "POR-490"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-490/honor-rows6-on-the-contact-message-textarea"
linear_status: "Done"
linear_status_type: "completed"
linear_team: "POR"
linear_project: "next-starter-template"
linear_assignee: "David Solheim <david@tetonweb.com>"
linear_labels: ["Improvement"]
linear_priority: "Low"
linear_parent: "POR-461"
linear_cycle: ""
linear_due: ""
linear_updated: "2026-09-01T15:04:36.545Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-490
- URL: https://linear.app/teton-web-ventures/issue/POR-490/honor-rows6-on-the-contact-message-textarea
- Linear status: Done (completed)
- Queue status: done
- Team: Portfolio (POR)
- Project: next-starter-template
- Assignee: David Solheim <david@tetonweb.com>
- Labels: Improvement
- Parent: POR-461 — UI walk – next-starter-template – 2026-08-31
- Priority: Low
- Estimate: none
- Cycle: none
- Due: none
- Created: 2026-08-31T20:38:58.462Z
- Updated: 2026-09-01T15:04:36.545Z
- Completed: 2026-09-01T15:04:36.499Z
- Canceled: no
- Archived: no
- Branch: david/por-490-honor-rows6-on-the-contact-message-textarea

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

# Honor rows={6} on the contact message textarea

## Implementer contract

* You are implementing **this ticket only**. Do not restyle other inputs.
* Fix `Textarea` so `rows={6}` on `/contact` is actually tall.
* Never commit secrets.

## Intensity

* Band: light
* Why: one utility class on the shared Textarea primitive
* Proof: on

## Summary

Contact sets `<Textarea … rows={6} />` but `components/ui/textarea.tsx` uses `field-sizing-content min-h-16`, so the box is ~two lines on desktop and cramped at 375px. The `rows` attribute is ignored.

## User report

> `/contact` at 375×812: Message field is a short box (`min-h-16`) even with `rows={6}`. Screenshot: `screenshots/walk-20260831-full/contact-mobile-textarea.png`.

## Current behavior

* Evidence: `app/(public)/contact/page.tsx` ~L51 — `rows={6}`
* Evidence: `components/ui/textarea.tsx` ~L9–12 — `field-sizing-content min-h-16`

## Expected behavior

* Contact message area is about six lines tall at rest (`rows={6}` or equivalent `min-h` that matches).
* Auto-grow may still work **after** the content exceeds six rows, or drop `field-sizing-content` if it fights `rows`.
* Other Textarea usages (gallery description, CMS body if any) must not collapse.

## Suspected root cause / scope

Confirmed: Tailwind `field-sizing-content` sizes to content, ignoring `rows`. Scope: the Textarea primitive and/or a className override on contact only. Prefer fixing the primitive if `rows` is part of the public API.

## Code map

| Path | Role | Symbols / notes |
| -- | -- | -- |
| `components/ui/textarea.tsx` | Primitive | `field-sizing-content min-h-16` |
| `app/(public)/contact/page.tsx` | Caller | `rows={6}` |
| `components/admin/gallery-album-detail.tsx` | Other Textarea | do not shrink |

Primary package/app: repo root Next.js app

## Pattern to mirror

* **Mirror:** shadcn textarea without `field-sizing-content`, or `min-h-24` / `min-h-[9rem]` when rows is 6

## Step-by-step implementation plan

1. Remove `field-sizing-content` **or** add `field-sizing-fixed` when `rows` is set.
2. Keep a sensible `min-h` so empty textareas are not 1px.
3. Open `/contact` at 1280 and 375; Message is ~6 rows.

## File-by-file changes

| Path | Action | What to change |
| -- | -- | -- |
| `components/ui/textarea.tsx` | edit | Stop ignoring `rows` |
| `app/(public)/contact/page.tsx` | do not touch | already passes rows={6} |

## Do not touch / out of scope

* Contact validation (POR sibling for Zod 422)
* Input height

## Acceptance criteria

- [ ] Empty contact Message control is approximately six text rows tall (not `min-h-16` only).
- [ ] 375×812: no horizontal overflow; textarea still usable.
- [ ] Typing more than six lines still scrolls or grows without covering Send.
- [ ] Verification commands pass.

## Test plan

**Manual: **`/contact` desktop + 375; inspect computed height vs one-line Input.

## Verification

* `bun run lint`
* `bun run typecheck`
* Manual: see Test plan

### Runtime proof

* Surface to drive: `/contact`
* Visual reference: screenshot `contact-mobile-textarea.png`
* Blast-radius fact: shared Textarea primitive — check gallery album description
* Observed end state: Message box is clearly taller than Name/Email

## Drift check (before implementing)

- [ ] Textarea still has `field-sizing-content min-h-16`
- [ ] Contact still passes `rows={6}`
- [ ] Gallery album still uses Textarea
- [ ] `bun run typecheck` still exists
- [ ] Walk screenshot still matches

Snapshot: investigated at 2026-08-31, branch `dev`, HEAD `e46fea1`.

## Risks / blockers

* Changing the primitive affects every textarea; verify gallery description still looks fine.
* Rollback note: restore field-sizing-content

## Platform / stack

* Canonical targets: Tailwind 4, shadcn Textarea
* Must not use: new UI libraries
* Migration dependency: none

## Related

* Parent epic: [POR-461](https://linear.app/teton-web-ventures/issue/POR-461/ui-walk-next-starter-template-2026-08-31)
* Related: none
* blockedBy: none
* Duplicate of: none

## Supersedes

* none

## Assumptions / pre-decided

* Prefer primitive fix so `rows` works; contact-only min-height override is acceptable if primitive change is too broad.

## Walk metadata

* Kind: improvement
* Surface: /contact
* Viewport: 375×812 (also desktop)
* Auth: signed-out
* Drive path: open /contact, inspect Message height
* Observed: short textarea despite rows={6}
* Screenshot: screenshots/walk-20260831-full/contact-mobile-textarea.png
* Coverage unit: /contact
