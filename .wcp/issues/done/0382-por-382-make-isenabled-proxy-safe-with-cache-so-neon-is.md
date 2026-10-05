---
id: "0382"
title: "Make isEnabled proxy-safe with cache so Neon is not hit on every request"
status: done
priority: high
assignee:
lease_expires:
scope: "Imported from Linear POR-382. Stay inside that description."
acceptance: "Context"
files: []
commit:
reason:
created: "2026-08-28T18:59:49.772Z"
linear_id: "POR-382"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-382/make-isenabled-proxy-safe-with-cache-so-neon-is-not-hit-on-every"
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
linear_updated: "2026-08-30T02:08:05.183Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-382
- URL: https://linear.app/teton-web-ventures/issue/POR-382/make-isenabled-proxy-safe-with-cache-so-neon-is-not-hit-on-every
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
- Created: 2026-08-28T18:59:49.772Z
- Updated: 2026-08-30T02:08:05.183Z
- Completed: 2026-08-30T02:08:05.169Z
- Canceled: no
- Archived: no
- Branch: por-382-make-isenabled-proxy-safe-with-cache-so-neon-is-not-hit-on

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

## Context

* Route / page / component / user flow: `proxy.ts` (site gate and later flag-gated routes)
* Parent epic: POR-379
* Current gate: `lib/site-gate.ts` + `proxy.ts` read env only

## Current behavior

`proxy.ts` runs on the matcher for almost every request. It talks to Better Auth and env. It must not open a Neon connection per HTML/API request once flags live in DB.

## Expected / intended behavior

* Catalog defaults + Doppler `FEATURE_*=0` are readable in proxy with zero DB
* DB overrides are cached (short TTL memory and/or signed cookie). Invalidate on `/admin/features` save
* If Neon is down: optional flags fail closed; platform (auth/admin) stays up
* Cookie HMAC for site gate uses a Doppler signing secret (`AUTH_SECRET` or dedicated gate secret), never the admin-typed password once that password lives in DB

## Acceptance criteria

- [ ] Documented cache strategy in `docs/` or `AGENTS.md`
- [ ] Proxy path has no unbounded DB read per request
- [ ] Kill switch still works without DB
- [ ] Neon outage does not take down `/login` or `/admin`
- [ ] Unit or integration test for fail-closed optional flags
- [ ] Verification: `bun run typecheck`; load `/` and `/admin` with DB stopped after cache warm — optional features dark, admin still reachable when session exists

## Out of scope / do not change

* Site-gate product UX (separate issue)
* Adding Edge-incompatible Drizzle calls in proxy

## Notes for implementer

`proxy.ts` already runs on a wide matcher and talks to Better Auth + `lib/site-gate.ts`. It must stay Edge-safe.

Recommended approach:

1. In proxy, resolve flags from (a) catalog defaults and (b) Doppler `FEATURE_*=0` with zero I/O
2. Overlay a short-TTL in-memory cache of DB overrides populated by a Node route or a signed cookie written on `/admin/features` save
3. Do not import `lib/db` / Drizzle into `proxy.ts`
4. Fail closed for optional flags if cache is cold and DB cannot be reached from a Node helper; platform routes (`/login`, `/admin`, `/api/auth`) stay up

Reuse `lib/cache/public-cache.ts` only if it is actually usable from proxy; otherwise a dedicated `lib/flags/cache.ts` with TTL ≤ 60s and explicit invalidate on flag PATCH.

HMAC for site-gate cookie: `AUTH_SECRET` or `SITE_GATE_SIGNING_SECRET` in Doppler — never the admin-typed password after POR-383.

Document the strategy in `AGENTS.md` under flags so clones do not put Drizzle in proxy.
