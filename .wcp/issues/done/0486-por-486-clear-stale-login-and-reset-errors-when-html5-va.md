---
id: "0486"
title: "Clear stale login and reset errors when HTML5 validation blocks submit"
status: done
priority: normal
assignee:
lease_expires:
scope: "Imported from Linear POR-486. Stay inside that description."
acceptance: "Clear stale login and reset errors when HTML5 validation blocks submit"
files: []
commit:
reason:
created: "2026-08-31T20:38:51.696Z"
linear_id: "POR-486"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-486/clear-stale-login-and-reset-errors-when-html5-validation-blocks-submit"
linear_status: "Done"
linear_status_type: "completed"
linear_team: "POR"
linear_project: "next-starter-template"
linear_assignee: "David Solheim <david@tetonweb.com>"
linear_labels: ["Bug"]
linear_priority: "Medium"
linear_parent: "POR-461"
linear_cycle: ""
linear_due: ""
linear_updated: "2026-09-01T15:04:30.693Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-486
- URL: https://linear.app/teton-web-ventures/issue/POR-486/clear-stale-login-and-reset-errors-when-html5-validation-blocks-submit
- Linear status: Done (completed)
- Queue status: done
- Team: Portfolio (POR)
- Project: next-starter-template
- Assignee: David Solheim <david@tetonweb.com>
- Labels: Bug
- Parent: POR-461 — UI walk – next-starter-template – 2026-08-31
- Priority: Medium
- Estimate: none
- Cycle: none
- Due: none
- Created: 2026-08-31T20:38:51.696Z
- Updated: 2026-09-01T15:04:30.693Z
- Completed: 2026-09-01T15:04:30.635Z
- Canceled: no
- Archived: no
- Branch: david/por-486-clear-stale-login-and-reset-errors-when-html5-validation

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

# Clear stale login and reset errors when HTML5 validation blocks submit

## Implementer contract

* You are implementing **this ticket only**. Do not change auth APIs.
* Clear the visible error when the user edits a field or when native validation prevents `onSubmit`.
* Never commit secrets.

## Intensity

* Band: standard
* Why: two auth forms, same stale-state pattern
* Proof: on

## Summary

`/login` and `/reset-password` only call `setError("")` inside `onSubmit`. Native `required` / `minLength` block submit, so a previous server/JS error stays on screen next to the browser tooltip.

## User report

> `/login`: invalid password showed “Invalid email or password”. Cleared the password and clicked Sign in. HTML5 “Please fill out this field.” appeared **and** the red invalid-credentials banner stayed. `/reset-password`: mismatch showed “Passwords do not match”; shortening the password then submit showed HTML5 minlength **and** the mismatch banner. Screenshots: `login-stale-error-empty-submit.png`, `reset-password-stale-mismatch.png`.

## Current behavior

* Evidence: `app/(auth)/login/login-form.tsx` (`handleLogin`, ~L58–60) — `setError("")` only after `preventDefault`
* Evidence: `app/(auth)/reset-password/page.tsx` (`handleSubmit`, ~L23–28) — same
* Native validation runs before the React handler, so the banner is never cleared.

## Expected behavior

* Editing email/password (or confirm) clears the banner.
* A blocked native submit does not show a previous API/JS error.
* Successful and failed submits still set the appropriate message.

## Suspected root cause / scope

Confirmed: error is React state; HTML5 constraint validation skips `onSubmit`. Scope: login + reset forms (and forgot-password if it has the same pattern).

## Code map

| Path | Role | Symbols / notes |
| -- | -- | -- |
| `app/(auth)/login/login-form.tsx` | Login | `error` state |
| `app/(auth)/reset-password/page.tsx` | Reset | `error` state |
| `app/(auth)/forgot-password/forgot-password-form.tsx` | Check same |  |

Primary package/app: repo root Next.js app

## Pattern to mirror

* **Mirror: **`handleLogin` already clears error at the start of a real submit — extend that to `onChange` / `onInput`

## Step-by-step implementation plan

1. On login, reset, and forgot-password inputs, `setError("")` when the user types (or `onInvalid` on the form).
2. Do not remove HTML5 `required` / `minLength`.
3. Drive: fail login → clear password → submit; fail reset mismatch → shorten password → submit.

## File-by-file changes

| Path | Action | What to change |
| -- | -- | -- |
| `app/(auth)/login/login-form.tsx` | edit | Clear error on field change |
| `app/(auth)/reset-password/page.tsx` | edit | Same |
| `app/(auth)/forgot-password/forgot-password-form.tsx` | edit | Same if it keeps a banner across a blocked submit |

## Do not touch / out of scope

* Forgot-password Resend copy
* Showing Forgot password link (POR-463)

## Acceptance criteria

- [ ] After a failed login, emptying password and clicking Sign in shows only the native required tooltip (no leftover “Invalid email or password”).
- [ ] After “Passwords do not match”, a minlength-blocked submit does not keep that banner.
- [ ] A real failed login still shows the generic invalid-credentials message.
- [ ] Verification commands pass.

## Test plan

**Manual:** the two walk sequences above.

## Verification

* `bun run lint`
* `bun run typecheck`
* `bun test tests`
* Manual: see Test plan

### Runtime proof

* Surface to drive: `/login`, `/reset-password?token=x`
* Project verify skill / feature map: none
* Visual reference: screenshots listed in User report
* Blast-radius fact: auth forms only
* Observed end state: only one error source visible at a time

## Drift check (before implementing)

- [ ] Login still clears error only in `handleLogin`
- [ ] Reset still clears error only in `handleSubmit`
- [ ] Password input still `required`
- [ ] Reset still has `minLength={8}`
- [ ] `bun run typecheck` still exists

Snapshot: investigated at 2026-08-31, branch `dev`, HEAD `e46fea1`.

## Risks / blockers

* none
* Rollback note: revert onChange clears

## Platform / stack

* Canonical targets: Next.js App Router, Better Auth client
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

* Clear on input change; do not switch the forms to `noValidate` in this ticket.

## Walk metadata

* Kind: bug
* Surface: /login, /reset-password
* Viewport: 1280×800
* Auth: signed-out
* Drive path: invalid submit then empty/short submit
* Observed: HTML5 tooltip + leftover banner
* Screenshot: screenshots/walk-20260831-full/login-stale-error-empty-submit.png
* Coverage unit: /login
