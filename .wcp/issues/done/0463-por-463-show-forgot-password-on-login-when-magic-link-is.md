---
id: "0463"
title: "Show Forgot password on /login when magic link is off"
status: done
priority: high
assignee:
lease_expires:
scope: "Imported from Linear POR-463. Stay inside that description."
acceptance: "Show Forgot password on /login when magic link is off"
files: []
commit:
reason:
created: "2026-08-31T20:26:29.517Z"
linear_id: "POR-463"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-463/show-forgot-password-on-login-when-magic-link-is-off"
linear_status: "Done"
linear_status_type: "completed"
linear_team: "POR"
linear_project: "next-starter-template"
linear_assignee: "David Solheim <david@tetonweb.com>"
linear_labels: ["Bug"]
linear_priority: "High"
linear_parent: "POR-461"
linear_cycle: ""
linear_due: ""
linear_updated: "2026-09-01T15:04:00.724Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-463
- URL: https://linear.app/teton-web-ventures/issue/POR-463/show-forgot-password-on-login-when-magic-link-is-off
- Linear status: Done (completed)
- Queue status: done
- Team: Portfolio (POR)
- Project: next-starter-template
- Assignee: David Solheim <david@tetonweb.com>
- Labels: Bug
- Parent: POR-461 — UI walk – next-starter-template – 2026-08-31
- Priority: High
- Estimate: none
- Cycle: none
- Due: none
- Created: 2026-08-31T20:26:29.517Z
- Updated: 2026-09-01T15:04:00.724Z
- Completed: 2026-09-01T15:04:00.687Z
- Canceled: no
- Archived: no
- Branch: david/por-463-show-forgot-password-on-login-when-magic-link-is-off

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

# Show Forgot password on /login when magic link is off

## Implementer contract

* You are implementing **this ticket only**. Do not enable Resend or public signup.
* Prefer the step-by-step plan. Mirror `/forgot-password` already in the repo.
* Never commit secrets.

## Intensity

* Band: critical
* Why: auth recovery control is missing from the only public login screen
* Proof: on

## Summary

The starter’s default login is credentials (public signup off; Resend optional). `/forgot-password` exists and already explains when email is not configured, but `/login` only renders **Forgot password?** when `magicLinkEnabled` is true. Clones without `RESEND_API_KEY` / `EMAIL_FROM` have no in-product path to recovery.

## User report

> Signed out at `/login?callbackUrl=/admin` (1280×800). Interactive snapshot: Email, Password, **Sign In** only — no Forgot password. Opening `/forgot-password` directly showed “Password recovery is not configured on this site” and **Back to login**. Invalid credentials showed “Invalid email or password” and kept `callbackUrl`.

## Current behavior

* Footer link is gated on magic link, not on the existence of `/forgot-password`.
* Evidence: `app/(auth)/login/login-form.tsx` (`LoginForm`, ~L128–134)
* Evidence: `app/(auth)/login/page.tsx` — `magicLinkEnabled = isResendConfigured()`
* Evidence: `lib/auth.ts` (`isResendConfigured`, ~L43–45)

## Expected behavior

* `/login` always shows **Forgot password?** → `/forgot-password` (same classes as today).
* Magic-link button stays behind `magicLinkEnabled`.
* Google button stays behind `googleEnabled`.
* Unconfigured `/forgot-password` copy stays as-is. Do not send email.

## Suspected root cause / scope

Confirmed: recovery link was bundled with magic-link UI. Scope: `AuthShell` footer in `login-form.tsx`.

## Code map

| Path | Role | Symbols / notes |
| -- | -- | -- |
| `app/(auth)/login/login-form.tsx` | Login UI | `LoginForm` footer ~L128–134 |
| `app/(auth)/login/page.tsx` | Flags | `isResendConfigured` |
| `app/(auth)/forgot-password/page.tsx` | Destination | already live |
| `lib/auth.ts` | `isResendConfigured` | ~L43–45 |

Primary package/app: repo root Next.js app

## Relevant contracts (types / APIs / data)

* **Props: **`LoginForm({ magicLinkEnabled, googleEnabled })`
* **Auth:** public signup remains `disableSignUp`
* **Env names only: **`RESEND_API_KEY`, `EMAIL_FROM` — not required for the link

## Code anchors (excerpts)

### `app/(auth)/login/login-form.tsx` — footer (~L128–134)

```tsx
footer={
  magicLinkEnabled ? (
    <Link href="/forgot-password" className="text-primary hover:underline">
      Forgot password?
    </Link>
  ) : null
}
```

### Pattern to mirror

* **Mirror:** the same `Link` already used when magic link is on
* **Why:** one recovery URL

## Step-by-step implementation plan

1. Always pass the Forgot password `Link` as `AuthShell` `footer`.
2. Keep the magic-link button behind `magicLinkEnabled`.
3. Drive `/login` with Resend unset and click through to `/forgot-password`.

## File-by-file changes

| Path | Action | What to change |
| -- | -- | -- |
| `app/(auth)/login/login-form.tsx` | edit | Ungate footer link |
| `app/(auth)/forgot-password/page.tsx` | do not touch | destination already correct |

## Do not touch / out of scope

* Enabling Resend, Google OAuth, or public signup
* Login error copy
* Reset-token form

## Acceptance criteria

- [ ] With Resend unset, `/login` shows **Forgot password?** and it navigates to `/forgot-password`.
- [ ] Unconfigured `/forgot-password` still explains email cannot be sent.
- [ ] Magic-link button remains absent when Resend is unset.
- [ ] `callbackUrl` on `/login` is preserved.
- [ ] Verification commands pass.

## Test plan

**Automated:** extend `tests/auth-config.test.ts` or a source assertion that the footer link is not behind `magicLinkEnabled`.

**Manual:**

1. Signed out, `/login` without Resend: see and click the link.
2. Invalid password still shows “Invalid email or password”.

## Verification

* `bun run lint`
* `bun run typecheck`
* `bun test tests`
* Manual: see Test plan

### Runtime proof

* Surface to drive: /login
* Project verify skill / feature map: none
* Visual reference (UI): `/forgot-password` unconfigured state
* Blast-radius fact: login is the only public credential entry
* Observed end state that proves done: Forgot password link visible and navigates

## Drift check (before implementing)

- [ ] `app/(auth)/login/login-form.tsx` still exists and owns the behavior
- [ ] `LoginForm footer gated on magicLinkEnabled` still named as described
- [ ] `app/(auth)/forgot-password/page.tsx` still is the right mirror
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

* Parent epic: [POR-461](https://linear.app/teton-web-ventures/issue/POR-461)
* Related: none
* blockedBy: none
* Duplicate of: none

## Supersedes

* none

## Assumptions / pre-decided

* Always show the link; do not invent a second recovery flow.

## Walk metadata

* Kind: bug
* Surface: /login
* Viewport: 1280×800
* Auth: signed-out
* Drive path: open /login → no footer link → open /forgot-password directly
* Observed: No Forgot password on login; destination page exists
* Screenshot: none
* Coverage unit: /login
