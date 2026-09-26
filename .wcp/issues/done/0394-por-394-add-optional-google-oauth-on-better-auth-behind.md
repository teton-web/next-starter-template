---
id: "0394"
title: "Add optional Google OAuth on Better Auth behind oauth flag"
status: done
priority: normal
assignee:
lease_expires:
scope: "Imported from Linear POR-394. Stay inside that description."
acceptance: "Context"
files: []
commit:
reason:
created: "2026-08-28T19:01:34.676Z"
linear_id: "POR-394"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-394/add-optional-google-oauth-on-better-auth-behind-oauth-flag"
linear_status: "Done"
linear_status_type: "completed"
linear_team: "POR"
linear_project: "next-starter-template"
linear_assignee: "David Solheim <david@tetonweb.com>"
linear_labels: []
linear_priority: "Low"
linear_parent: "POR-379"
linear_cycle: ""
linear_due: ""
linear_updated: "2026-08-30T02:08:17.471Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-394
- URL: https://linear.app/teton-web-ventures/issue/POR-394/add-optional-google-oauth-on-better-auth-behind-oauth-flag
- Linear status: Done (completed)
- Queue status: done
- Team: Portfolio (POR)
- Project: next-starter-template
- Assignee: David Solheim <david@tetonweb.com>
- Labels: none
- Parent: POR-379 — Gold standard kit — flags, galleries, Stripe, and half-wired finish
- Priority: Low
- Estimate: none
- Cycle: none
- Due: none
- Created: 2026-08-28T19:01:34.676Z
- Updated: 2026-08-30T02:08:17.471Z
- Completed: 2026-08-30T02:08:17.455Z
- Canceled: no
- Archived: no
- Branch: david/por-394-add-optional-google-oauth-on-better-auth-behind-oauth-flag

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

## Context

* Route / page / component / user flow: `/login`, Better Auth social, `lib/auth.ts`
* Parent epic: POR-379
* Starter already uses Better Auth credentials + optional magic link. Accounts table exists.

## Current behavior

No Google provider. Login is email/password and optional magic link when Resend is configured. `disableSignUp` is on.

## Expected / intended behavior

Built dark. Google button on `/login` only when `isEnabled('oauth')` and Google client id/secret exist.
OAuth must not open public signup. If the Google email is not an existing user, refuse (same as magic link `disableSignUp`). Link to existing user by email when found.
GitHub provider is later, not this issue.

## Acceptance criteria

- [ ] Better Auth Google provider configured when keys + flag on
- [ ] Flag off or missing keys: no Google button, social callback 404 or disabled
- [ ] Unknown Google email cannot create an account
- [ ] Existing invited/seeded user can sign in with Google and reuse the same user id
- [ ] Soft-deleted users still cannot authenticate
- [ ] `.env.example` documents Google client id/secret
- [ ] Verification: `bun run typecheck`; document a manual Google test path

## Out of scope / do not change

* GitHub OAuth
* InventRight multi-tenant SSO
* Enabling public signup

## Notes for implementer

* Configure Better Auth Google provider in `lib/auth.ts` only when flag + keys present
* `accounts` table already exists — link by email to an existing user; do not create users (`disableSignUp` stays on)
* Soft-deleted users still fail auth
* `/login` shows Google button only when `isEnabled('oauth')`
* Callback stays on Better Auth routes; 404/disabled when flag off
* `.env.example`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
* No GitHub provider in this issue
