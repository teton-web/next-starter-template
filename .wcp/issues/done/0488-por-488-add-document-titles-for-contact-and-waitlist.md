---
id: "0488"
title: "Add document titles for /contact and /waitlist"
status: done
priority: normal
assignee:
lease_expires:
scope: "Imported from Linear POR-488. Stay inside that description."
acceptance: "Add document titles for /contact and /waitlist"
files: []
commit:
reason:
created: "2026-08-31T20:38:55.774Z"
linear_id: "POR-488"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-488/add-document-titles-for-contact-and-waitlist"
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
linear_updated: "2026-09-01T15:04:33.315Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-488
- URL: https://linear.app/teton-web-ventures/issue/POR-488/add-document-titles-for-contact-and-waitlist
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
- Created: 2026-08-31T20:38:55.774Z
- Updated: 2026-09-01T15:04:33.315Z
- Completed: 2026-09-01T15:04:33.289Z
- Canceled: no
- Archived: no
- Branch: david/por-488-add-document-titles-for-contact-and-waitlist

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

# Add document titles for /contact and /waitlist

## Implementer contract

* You are implementing **this ticket only**. Do not restyle the forms.
* Mirror `export const metadata = { title: "Articles" }`.
* Never commit secrets.

## Intensity

* Band: standard
* Why: contact is a client page (needs a server wrapper); waitlist is already a server page
* Proof: on

## Summary

`/articles`, `/privacy`, `/terms`, `/pay` set `metadata.title`. `/contact` is a client component with no metadata; `/waitlist` is a server page with none. Tabs fall back to the site default instead of `Contact · {siteName}` / `Waitlist · {siteName}`.

## User report

> Signed out `/contact` and `/waitlist` (after enabling waitlist). Visible h1s are Contact / Waitlist. Document title did not use those words the way `/privacy` uses `Privacy · Next.js Starter Template`.

## Current behavior

* Evidence: `app/(public)/contact/page.tsx` — `"use client"` default export; no metadata
* Evidence: `app/(public)/waitlist/page.tsx` — server page, no metadata export
* Evidence: `app/layout.tsx` title template `` `%s · ${siteName}` ``
* Evidence: `app/(public)/articles/page.tsx` — `export const metadata = { title: "Articles" }`

## Expected behavior

* `/contact` title: **Contact** (template → `Contact · {siteName}`).
* `/waitlist` title: **Waitlist** when the flag is on (when flag-off 404, follow POR-472 not-found title once that lands; this ticket only sets the live waitlist page title).
* Forms unchanged.

## Suspected root cause / scope

Confirmed: missing metadata exports. Contact cannot export metadata from a client file — extract `ContactForm` like `WaitlistForm`.

## Code map

| Path | Role | Symbols / notes |
| -- | -- | -- |
| `app/(public)/contact/page.tsx` | Client page today | extract form |
| `app/(public)/waitlist/page.tsx` | Server page | add metadata |
| `app/(public)/waitlist/waitlist-form.tsx` | Mirror extract |  |
| `app/(public)/articles/page.tsx` | Mirror metadata |  |

Primary package/app: repo root Next.js app

## Pattern to mirror

* **Mirror:** waitlist split (server page + client form) + Articles `metadata.title`

## Step-by-step implementation plan

1. Move the contact form into `app/(public)/contact/contact-form.tsx` (`"use client"`).
2. Server `page.tsx`: `export const metadata = { title: "Contact" }` + render form.
3. `export const metadata = { title: "Waitlist" }` on waitlist page.
4. Confirm tab titles.

## File-by-file changes

| Path | Action | What to change |
| -- | -- | -- |
| `app/(public)/contact/contact-form.tsx` | create | current client form |
| `app/(public)/contact/page.tsx` | edit | server wrapper + metadata |
| `app/(public)/waitlist/page.tsx` | edit | metadata |

## Do not touch / out of scope

* 404 titles (POR-472)
* Pay titles (sibling ticket)
* Form validation copy

## Acceptance criteria

- [ ] `document.title` on `/contact` is `Contact ·` + site name.
- [ ] Flag-on `/waitlist` is `Waitlist ·` + site name.
- [ ] Submit still works (200 + “Message sent.” / “You're on the list.”).
- [ ] Verification commands pass.

## Test plan

**Manual:** open both routes and read `document.title`; submit once each if easy.

## Verification

* `bun run lint`
* `bun run typecheck`
* `bun test tests`
* Manual: titles

### Runtime proof

* Surface to drive: `/contact`, `/waitlist`
* Visual reference: `/privacy` title pattern
* Blast-radius fact: contact page module split only
* Observed end state: tab titles include Contact / Waitlist

## Drift check (before implementing)

- [ ] Contact page still `"use client"` with no metadata
- [ ] Waitlist page still has no metadata
- [ ] Articles still exports title Articles
- [ ] Root template still `%s · ${siteName}`
- [ ] `bun run typecheck` still exists

Snapshot: investigated at 2026-08-31, branch `dev`, HEAD `e46fea1`.

## Risks / blockers

* none
* Rollback note: revert extract

## Platform / stack

* Canonical targets: Next.js metadata
* Must not use: pages router
* Migration dependency: none

## Related

* Parent epic: [POR-461](https://linear.app/teton-web-ventures/issue/POR-461/ui-walk-next-starter-template-2026-08-31)
* Related: POR-472
* blockedBy: none
* Duplicate of: none

## Supersedes

* none

## Assumptions / pre-decided

* Title strings are **Contact** and **Waitlist** (match h1s).

## Walk metadata

* Kind: improvement
* Surface: /contact, /waitlist
* Viewport: 1280×800
* Auth: signed-out
* Drive path: open forms, read document.title
* Observed: no Contact/Waitlist in the title template
* Screenshot: none
* Coverage unit: /contact
