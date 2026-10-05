---
id: "0485"
title: "Show human-readable 422 errors on contact and waitlist"
status: done
priority: high
assignee:
lease_expires:
scope: "Imported from Linear POR-485. Stay inside that description."
acceptance: "Show human-readable 422 errors on contact and waitlist"
files: []
commit:
reason:
created: "2026-08-31T20:38:48.669Z"
linear_id: "POR-485"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-485/show-human-readable-422-errors-on-contact-and-waitlist"
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
linear_updated: "2026-09-01T15:04:29.599Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-485
- URL: https://linear.app/teton-web-ventures/issue/POR-485/show-human-readable-422-errors-on-contact-and-waitlist
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
- Created: 2026-08-31T20:38:48.669Z
- Updated: 2026-09-01T15:04:29.599Z
- Completed: 2026-09-01T15:04:29.575Z
- Canceled: no
- Archived: no
- Branch: por-485-show-human-readable-422-errors-on-contact-and-waitlist

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

# Show human-readable 422 errors on contact and waitlist

## Implementer contract

* You are implementing **this ticket only**. Do not redesign the contact or waitlist forms.
* Change `parseJson` (and the matching Stripe checkout dump) so `error` is a short human string, not Zod’s JSON `message`.
* Never commit secrets.

## Intensity

* Band: standard
* Why: one shared API helper; public forms already display `body.error`
* Proof: on

## Summary

`parseJson` returns `jsonError(parsed.error.message, 422)`. Zod’s `.message` is a JSON array of issues. `/contact` and `/waitlist` put `body.error` in a red alert, so visitors see `[ { "origin": "string", "code": "too_small", ... } ]` instead of “Name is required” / “Invalid email”.

## User report

> Signed out, `/contact`: left Name empty, filled email + a long-enough message, submitted. Alert showed Zod JSON: `[ { "origin": "string", "code": "too_small", "minimum": 1, "inclusive": true, "path": [ "name" ], "message": "Too small: expected string to have >=1 characters" } ]`. `/waitlist` with email `a@b` showed the same JSON dump including the email regex. Screenshots: `screenshots/walk-20260831-full/contact-zod-422.png`, `waitlist-zod-422.png`.

## Current behavior

* Evidence: `lib/api/helpers.ts` (`parseJson`, ~L50–51) — `return jsonError(parsed.error.message, 422)`
* Evidence: `app/(public)/contact/page.tsx` ~L27–28 — `setError(body.error || "Could not send message")`
* Evidence: `app/(public)/waitlist/waitlist-form.tsx` ~L27–28 — same `body.error`
* Evidence: `lib/stripe/checkout.ts` (`maybeParseEmptyJson`, ~L54–55) — same Zod `.message` dump (out of primary UI path this walk; same one-line fix)

## Expected behavior

* 422 `error` is a single sentence from the first Zod issue (`issues[0].message`), e.g. `Too small: expected string to have >=1 characters` or a mapped `Name is required`.
* Do not stringify the whole Zod error object.
* Contact and waitlist alerts show that sentence, not JSON.
* Invalid JSON body still `Invalid JSON body` (400).

## Suspected root cause / scope

Confirmed: `ZodError.message` is JSON. Scope: `parseJson` plus the duplicate Stripe checkout `jsonError(parsed.error.message)` so the dump does not remain on that path.

## Code map

| Path | Role | Symbols / notes |
| -- | -- | -- |
| `lib/api/helpers.ts` | Shared parser | `parseJson` |
| `app/api/contact/route.ts` | Uses parseJson | contact schema |
| `lib/waitlist/signup.ts` | Uses parseJson | waitlist schema |
| `app/(public)/contact/page.tsx` | Displays `body.error` |  |
| `app/(public)/waitlist/waitlist-form.tsx` | Displays `body.error` |  |
| `lib/stripe/checkout.ts` | Duplicate dump | `maybeParseEmptyJson` |
| `tests/api-helpers.test.ts` | Unit | parseJson 422 case |

Primary package/app: repo root Next.js app

## Pattern to mirror

* **Mirror: **`jsonError("Too many contact requests. Please try again later.", 429)` — short user-facing string
* **Why:** clients already treat `error` as display copy

## Step-by-step implementation plan

1. In `parseJson`, on `!parsed.success` use `parsed.error.issues[0]?.message ?? "Invalid request"` (not `.message`).
2. Same one-liner in `lib/stripe/checkout.ts` `maybeParseEmptyJson`.
3. Extend `tests/api-helpers.test.ts` to assert `body.error` is a string that does **not** start with `[`.
4. Drive `/contact` empty name (bypass HTML5 if needed via fetch or `minLength` already on message only) and `/waitlist` `a@b`.

## File-by-file changes

| Path | Action | What to change |
| -- | -- | -- |
| `lib/api/helpers.ts` | edit | Human 422 string |
| `lib/stripe/checkout.ts` | edit | Same for checkout JSON body |
| `tests/api-helpers.test.ts` | edit test | Assert no JSON-array dump |

## Do not touch / out of scope

* HTML5 `required` / `type=email` (those already work; this is the API fallback)
* Form layout / reset (reset already exists in the client)
* Mapping every Zod code to custom copy (first `issue.message` is enough)

## Acceptance criteria

- [ ] POST `/api/contact` with `{ name: "", email: "a@b.com", message: "ten chars!!" }` returns 422 whose `error` is a human sentence, not a JSON array string.
- [ ] `/contact` and `/waitlist` show that sentence in the red alert.
- [ ] Valid submits still 200 + existing success copy.
- [ ] `bun run lint`, `bun run typecheck`, `bun test tests` pass.

## Test plan

**Automated: **`tests/api-helpers.test.ts` — invalid body → `typeof error === "string"` and `!error.trim().startsWith("[")`.

**Manual:** reproduce the walk on `/contact` (empty name) and `/waitlist` (`a@b`).

## Verification

* `bun run lint`
* `bun run typecheck`
* `bun test tests`
* Manual: see Test plan

### Runtime proof

* Surface to drive: `/contact`, `/waitlist`
* Project verify skill / feature map: none
* Visual reference (UI): screenshots `contact-zod-422.png`, `waitlist-zod-422.png`
* Blast-radius fact: `parseJson` is used by many admin APIs too — they also get a cleaner `error` string
* Observed end state: red alert is a sentence, not JSON

## Drift check (before implementing)

- [ ] `parseJson` still uses `parsed.error.message`
- [ ] Contact/waitlist still display `body.error`
- [ ] `tests/api-helpers.test.ts` still covers parseJson 422
- [ ] `jsonError` still `{ error: message }`
- [ ] `bun run typecheck` still exists

Snapshot: investigated at 2026-08-31, branch `dev`, HEAD `e46fea1`.

## Risks / blockers

* Admin UIs that accidentally parsed the JSON-array string will now see a sentence — that is the intended fix.
* Rollback note: restore `.message`

## Platform / stack

* Canonical targets: Next.js Route Handlers, Zod
* Must not use: Server Actions
* Migration dependency: none

## Related

* Parent epic: [POR-461](https://linear.app/teton-web-ventures/issue/POR-461/ui-walk-next-starter-template-2026-08-31)
* Related: none
* blockedBy: none
* Duplicate of: none

## Supersedes

* none

## Assumptions / pre-decided

* Use the first Zod issue `message`; do not add a field-level error map in this ticket.

## Walk metadata

* Kind: bug
* Surface: /contact, /waitlist
* Viewport: 1280×800
* Auth: signed-out
* Drive path: submit invalid API-level payloads; read alert text
* Observed: Zod JSON in the red paragraph
* Screenshot: screenshots/walk-20260831-full/contact-zod-422.png
* Coverage unit: /contact
