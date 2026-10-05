---
id: "0395"
title: "Fix Auth.js metadata and document clone path for flags"
status: done
priority: normal
assignee:
lease_expires:
scope: "Imported from Linear POR-395. Stay inside that description."
acceptance: "Context"
files: []
commit:
reason:
created: "2026-08-28T19:01:41.356Z"
linear_id: "POR-395"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-395/fix-authjs-metadata-and-document-clone-path-for-flags"
linear_status: "Done"
linear_status_type: "completed"
linear_team: "POR"
linear_project: "next-starter-template"
linear_assignee: "maintainer"
linear_labels: []
linear_priority: "Low"
linear_parent: "POR-379"
linear_cycle: ""
linear_due: ""
linear_updated: "2026-08-30T02:08:19.594Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-395
- URL: https://linear.app/teton-web-ventures/issue/POR-395/fix-authjs-metadata-and-document-clone-path-for-flags
- Linear status: Done (completed)
- Queue status: done
- Team: Portfolio (POR)
- Project: next-starter-template
- Assignee: maintainer
- Labels: none
- Parent: POR-379 — Gold standard kit — flags, galleries, Stripe, and half-wired finish
- Priority: Low
- Estimate: none
- Cycle: none
- Due: none
- Created: 2026-08-28T19:01:41.356Z
- Updated: 2026-08-30T02:08:19.594Z
- Completed: 2026-08-30T02:08:19.571Z
- Canceled: no
- Archived: no
- Branch: por-395-fix-authjs-metadata-and-document-clone-path-for-flags

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

## Context

* Route / page / component / user flow: GitHub repo metadata, README, AGENTS.md, `.env.example`
* Parent epic: POR-379

## Current behavior

README and AGENTS.md already say Better Auth. GitHub description and topics still say Auth.js. Clone docs do not mention flags, migrate-only, seed password change, or "do not set RESEND_API_KEY in CI stubs" together with the new `/admin/features` flow.

## Expected / intended behavior

* Description + topics: Better Auth, not Auth.js
* README clone path: own Doppler project → `db:migrate` → `db:seed` → change seed password → Doppler→Vercel → enable only needed flags
* Do not set `RESEND_API_KEY` in CI stubs
* Point at the gold-standard Notion page and ADR 0001

## Acceptance criteria

- [ ] GitHub description and `authjs` topic replaced
- [ ] README documents flags and site-gate migration for existing clones
- [ ] AGENTS.md mentions `isEnabled` and platform-vs-flag rule
- [ ] Verification: readme preview; no leftover Auth.js claims except historical ADR notes if any

## Out of scope / do not change

* Product features

## Notes for implementer

* GitHub repo description + topics: Better Auth, drop Auth.js / `authjs`
* README clone path: new Doppler project → `db:migrate` (never `db:push`) → `db:seed` → change seed password → Doppler→Vercel → `/admin/features` enable only needed flags
* Site-gate migration for existing clones (existing clones): enable `site_gate` + set password so a pull does not go public
* Do not set `RESEND_API_KEY` in CI stubs
* AGENTS.md: `isEnabled` resolution, platform vs flags, proxy must not open Neon per request, migrations-only
* Link Notion gold-standard page and ADR 0001
* This ticket can land early with a first docs pass, then get a follow-up once flags/site-gate exist — prefer one PR after POR-380 so the clone path is true
