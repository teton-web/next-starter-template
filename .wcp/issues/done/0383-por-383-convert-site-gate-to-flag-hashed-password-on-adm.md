---
id: "0383"
title: "Convert site gate to flag + hashed password on /admin/features"
status: done
priority: high
assignee:
lease_expires:
scope: "Imported from Linear POR-383. Stay inside that description."
acceptance: "Context"
files: []
commit:
reason:
created: "2026-08-28T19:00:09.713Z"
linear_id: "POR-383"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-383/convert-site-gate-to-flag-hashed-password-on-adminfeatures"
linear_status: "Done"
linear_status_type: "completed"
linear_team: "POR"
linear_project: "next-starter-template"
linear_assignee: "maintainer"
linear_labels: []
linear_priority: "High"
linear_parent: "POR-379"
linear_cycle: ""
linear_due: ""
linear_updated: "2026-08-30T02:08:06.004Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-383
- URL: https://linear.app/teton-web-ventures/issue/POR-383/convert-site-gate-to-flag-hashed-password-on-adminfeatures
- Linear status: Done (completed)
- Queue status: done
- Team: Portfolio (POR)
- Project: next-starter-template
- Assignee: maintainer
- Labels: none
- Parent: POR-379 — Gold standard kit — flags, galleries, Stripe, and half-wired finish
- Priority: High
- Estimate: none
- Cycle: none
- Due: none
- Created: 2026-08-28T19:00:09.713Z
- Updated: 2026-08-30T02:08:06.004Z
- Completed: 2026-08-30T02:08:05.986Z
- Canceled: no
- Archived: no
- Branch: por-383-convert-site-gate-to-flag-hashed-password-on-adminfeatures

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

## Context

* Route / page / component / user flow: `proxy.ts`, `lib/site-gate.ts`, `/site-gate`, `/api/site-gate`, `/admin/features` site_gate row
* Parent epic: POR-379
* Locked 2026-08-28: flag-only; toggle + password on the same admin row; password lives in flag config, not Doppler; flag on + no password stays dark

## Current behavior

`isSiteGateEnabled()` is `VERCEL_ENV === preview | production`. If `SITE_GATE_PASSWORD` is set, the gate is on. HMAC cookie is signed with that password. Local `dev` is never gated. Default on Vercel is on-if-password-set.

## Expected / intended behavior

* Gate is `isEnabled('site_gate')` AND a password hash exists
* Password entered on `/admin/features` site_gate row, hashed at rest, never shown again
* Signing secret for the cookie stays in Doppler (`AUTH_SECRET` or dedicated). Do not HMAC with the typed password once it lives in DB
* New catalog default is OFF. Existing clones (existing clones) must not go public on pull — document a one-time migration: enable flag + set password (or temporarily keep reading `SITE_GATE_PASSWORD` if flag row empty)
* Local `dev` stays ungated
* `/api/health` and static assets stay exempt

## Acceptance criteria

- [ ] Gate off when flag off, even if a password hash exists
- [ ] Gate off when flag on and password empty
- [ ] Gate on in preview/prod only when flag on + password set + valid cookie missing → redirect `/site-gate`
- [ ] Password not in `.env.example` as the source of truth; Doppler signing secret documented
- [ ] Migration note in README/`docs/` for existing clones
- [ ] Constant-time compare on unlock remains
- [ ] Verification: preview with flag off is public; flag on + password blocks; wrong password 401 on `/api/site-gate`; health still 200

## Out of scope / do not change

* Galleries privacy (album status, not site gate)
* Putting plaintext password in Doppler as the product toggle

## Notes for implementer

Touch:

* `proxy.ts` — replace `isSiteGateEnabled()` env check with cached `isEnabled('site_gate')` AND hash-present
* `lib/site-gate.ts` — keep HMAC cookie + constant-time compare; change signing key source; stop treating `SITE_GATE_PASSWORD` as the product toggle
* `/site-gate` page + `/api/site-gate` — compare against hash from flag `config`, not env plaintext
* `/admin/features` site_gate row (POR-381) — password set/rotate; empty means gate stays dark
* `.env.example` — retire `SITE_GATE_PASSWORD` as source of truth; document signing secret + clone migration
* Existing clones (existing clones): one-time note — enable flag + set password, or temporarily read leftover `SITE_GATE_PASSWORD` only when the flag row has no hash so a pull does not go public

Exemptions stay: `/api/health`, static assets, auth routes as today. Local `VERCEL_ENV`/dev remains ungated.

Hash: scrypt or existing app hash helper if one exists; never store plaintext in `feature_flags.config`.
