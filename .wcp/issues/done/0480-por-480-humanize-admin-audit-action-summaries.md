---
id: "0480"
title: "Humanize admin audit action summaries"
status: done
priority: normal
assignee:
lease_expires:
scope: "Imported from Linear POR-480. Stay inside that description."
acceptance: "Humanize admin audit action summaries"
files: []
commit:
reason:
created: "2026-08-31T20:31:59.562Z"
linear_id: "POR-480"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-480/humanize-admin-audit-action-summaries"
linear_status: "Done"
linear_status_type: "completed"
linear_team: "POR"
linear_project: "next-starter-template"
linear_assignee: "maintainer"
linear_labels: ["Improvement"]
linear_priority: "Medium"
linear_parent: "POR-461"
linear_cycle: ""
linear_due: ""
linear_updated: "2026-09-01T15:04:22.470Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-480
- URL: https://linear.app/teton-web-ventures/issue/POR-480/humanize-admin-audit-action-summaries
- Linear status: Done (completed)
- Queue status: done
- Team: Portfolio (POR)
- Project: next-starter-template
- Assignee: maintainer
- Labels: Improvement
- Parent: POR-461 — UI walk – next-starter-template – 2026-08-31
- Priority: Medium
- Estimate: none
- Cycle: none
- Due: none
- Created: 2026-08-31T20:31:59.562Z
- Updated: 2026-09-01T15:04:22.470Z
- Completed: 2026-09-01T15:04:22.352Z
- Canceled: no
- Archived: no
- Branch: por-480-humanize-admin-audit-action-summaries

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

# Humanize admin audit action summaries

## Implementer contract

* You are implementing **this ticket only**. Do not add audit filters/export.
* Change `formatAuditSummary` so login/logout do not print user UUIDs.
* Never commit secrets.

## Intensity

* Band: standard
* Why: one formatter used by dashboard + audit table
* Proof: on

## Summary

Dashboard Recent activity and `/admin/audit` show `login user <uuid> · admin@example.com`. Actor is already in a separate column on the audit table, so the UUID is noise. `formatAuditSummary` concatenates `entityType` + `entityId`.

## User report

> `/admin` Recent activity: “login user 3be0c8e6-033d-4e1f-be5f-0e918c2a0118 · [admin@example.com](<mailto:admin@example.com>)”. `/admin/audit` Action column same string; Actor column already `admin@example.com`.

## Current behavior

* Evidence: `lib/admin/dashboard-pure.ts` (`formatAuditSummary`, ~L18–26)
* Evidence: `app/admin/page.tsx` ~L118
* Evidence: `app/admin/audit/page.tsx` action cell

## Expected behavior

* Login/logout (and similar user-entity actions) summarize as `login · admin@example.com` or `login` when the actor column already shows email.
* Dashboard (no actor column): keep actor email, drop UUID: `login · admin@example.com`.
* Do not change timestamps or IP column.

## Suspected root cause / scope

Confirmed: generic `${action} ${entityType} ${entityId}`. Scope: `formatAuditSummary` + tests in `tests/admin-dashboard.test.ts` / `tests/admin-audit.test.ts`.

## Code map

| Path | Role | Symbols / notes |
| -- | -- | -- |
| `lib/admin/dashboard-pure.ts` | Formatter | `formatAuditSummary` |
| `app/admin/page.tsx` | Dashboard list | uses formatter |
| `app/admin/audit/page.tsx` | Table | Action column |
| `tests/admin-dashboard.test.ts` | Unit | extend |

Primary package/app: repo root Next.js app

## Pattern to mirror

* **Mirror:** existing pure helper tests for `truncateMessage` / `formatDashboardDate`

## Step-by-step implementation plan

1. When `entityType === "user"` (or entityId looks like a UUID and actorEmail is present), omit entityId.
2. Update unit tests.
3. Reload `/admin/audit` after a login.

## File-by-file changes

| Path | Action | What to change |
| -- | -- | -- |
| `lib/admin/dashboard-pure.ts` | edit | `formatAuditSummary` |
| `tests/admin-dashboard.test.ts` | edit test | UUID omitted cases |
| `tests/admin-audit.test.ts` | edit test | if it asserts the old string |

## Do not touch / out of scope

* Writing new audit events
* IP redaction

## Acceptance criteria

- [ ] Login row Action/summary does not include a UUID.
- [ ] Actor email still visible (dashboard summary or Actor column).
- [ ] Unit tests cover user-entity summarization.
- [ ] Verification commands pass.

## Test plan

**Automated:** cases in `tests/admin-dashboard.test.ts`.

## Verification

* `bun run lint`
* `bun run typecheck`
* `bun test tests`
* Manual: see Test plan

### Runtime proof

* Surface to drive: /admin/audit
* Project verify skill / feature map: none
* Visual reference (UI): audit Actor column already shows email
* Blast-radius fact: formatAuditSummary used on dashboard and audit
* Observed end state that proves done: login summary has no UUID

## Drift check (before implementing)

- [ ] `lib/admin/dashboard-pure.ts` still exists and owns the behavior
- [ ] `formatAuditSummary` still named as described
- [ ] `tests/admin-dashboard.test.ts` still is the right mirror
- [ ] `bun run typecheck` still exists
- [ ] Walk evidence still matches current UI

Snapshot: investigated at 2026-08-31, branch `dev`, HEAD `e46fea1`.

## Risks / blockers

* none
* Rollback note: revert the listed files

## Platform / stack

* Canonical targets: Next.js 16 App Router, Better Auth, Neon/Drizzle, Tailwind 4, shadcn/ui
* Must not use / abandoned for this work: Server Actions; `db:push`
* Migration dependency: none

## Related

* Parent epic: [POR-461](https://linear.app/teton-web-ventures/issue/POR-461/ui-walk-next-starter-template-2026-08-31)
* Related: none
* blockedBy: none
* Duplicate of: none

## Supersedes

* none

## Assumptions / pre-decided

* Omit entityId for entityType user when actorEmail is present.

## Walk metadata

* Kind: improvement
* Surface: /admin/audit
* Viewport: 1280×800
* Auth: signed-in
* Drive path: open /admin and /admin/audit after login
* Observed: login user <uuid> · email
* Screenshot: none
* Coverage unit: /admin/audit
