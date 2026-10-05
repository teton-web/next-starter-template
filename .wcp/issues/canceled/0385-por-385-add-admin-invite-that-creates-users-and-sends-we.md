---
id: "0385"
title: "Add admin invite that creates users and sends welcome.tsx"
status: canceled
priority: normal
assignee:
lease_expires:
scope: "Imported from Linear POR-385. Stay inside that description."
acceptance: "Context"
files: []
commit:
reason: "Imported from Linear status Duplicate."
created: "2026-08-28T19:00:21.857Z"
linear_id: "POR-385"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-385/add-admin-invite-that-creates-users-and-sends-welcometsx"
linear_status: "Duplicate"
linear_status_type: "duplicate"
linear_team: "POR"
linear_project: "next-starter-template"
linear_assignee: ""
linear_labels: []
linear_priority: "Medium"
linear_parent: "POR-379"
linear_cycle: ""
linear_due: ""
linear_updated: "2026-08-28T20:09:47.100Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-385
- URL: https://linear.app/teton-web-ventures/issue/POR-385/add-admin-invite-that-creates-users-and-sends-welcometsx
- Linear status: Duplicate (duplicate)
- Queue status: canceled
- Team: Portfolio (POR)
- Project: next-starter-template
- Assignee: unassigned
- Labels: none
- Parent: POR-379 — Gold standard kit — flags, galleries, Stripe, and half-wired finish
- Priority: Medium
- Estimate: none
- Cycle: none
- Due: none
- Created: 2026-08-28T19:00:21.857Z
- Updated: 2026-08-28T20:09:47.100Z
- Completed: no
- Canceled: 2026-08-28T20:09:46.538Z
- Archived: no
- Branch: por-385-add-admin-invite-that-creates-users-and-sends-welcometsx

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

## Context

* Route / page / component / user flow: `/admin` users/invite, `emails/welcome.tsx`, Better Auth `disableSignUp`
* Parent epic: POR-379
* `lib/auth.ts` never sends welcome. Public signup is off.

## Current behavior

Admins exist only via `bun run db:seed` (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`). `emails/welcome.tsx` exists. No invite API or UI. `mustChangePassword` exists on users.

## Expected / intended behavior

Admin with `admin` capability invites by email + capability (`admin` or `moderate`):

1. Create user (no public signup)
2. Set `mustChangePassword=true`
3. Send `welcome.tsx` with set-password / reset link when Resend is configured
4. If Resend is missing, show the reset URL once in admin (do not log it)
   Invited user cannot use the rest of `/admin` until password is changed (existing proxy rule).

## Acceptance criteria

- [ ] Invite UI + `POST /api/admin/users/invite` with Zod validation
- [ ] Duplicate email returns a safe error
- [ ] Welcome email sent when `RESEND_API_KEY` + `EMAIL_FROM` set; otherwise admin-visible one-time link
- [ ] New user cannot skip must-change-password
- [ ] Audit log on invite
- [ ] Verification: invite a second admin, complete reset, sign in; `bun run typecheck`

## Out of scope / do not change

* Public member signup
* OAuth
* a client product impersonation / third roles

## Notes for implementer

Reuse, do not invent a second user table:

* `lib/db/schema/users.ts` — `mustChangePassword` already exists
* `lib/auth.ts` — Better Auth `disableSignUp` stays on; create user via admin/server API not public sign-up
* `lib/auth/reset-password-token-pure.ts` + `reset-password-url-pure.ts` for the set-password link
* `emails/welcome.tsx` — send when `RESEND_API_KEY` + `EMAIL_FROM` present
* `proxy.ts` already blocks `/admin` until password change — keep that rule
* Seed path `bun run db:seed` remains how the first admin is born

UI: `/admin/users` or an invite dialog on the admin home. Capability picker: `admin` | `moderate` only. Duplicate email = 409 with generic copy. One-time reset URL shown in the admin UI only when Resend is missing; do not write it to logs or audit payload.
