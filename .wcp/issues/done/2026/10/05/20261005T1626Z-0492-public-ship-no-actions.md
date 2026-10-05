---
id: 0492
title: Ship the public template without GitHub Actions or personal names
status: done
priority: high
assignee:
lease_expires:
scope: Remove the GitHub Actions workflow. Drop the Dependabot github-actions ecosystem. Scrub personal and client names from living docs, tests, and the imported issue archive. Keep local bun run audit, the bun Dependabot updates, and the Playwright e2e script.
acceptance: The tree has no file under .github/workflows. Dependabot updates bun only. Living docs and the imported issue archive name no person and no client product. Local audit and e2e scripts remain. Tests lock that. origin/main contains the commit.
files:
  - .github/workflows/ci.yml
  - .github/dependabot.yml
  - SECURITY.md
  - README.md
  - AGENTS.md
  - .env.example
  - docs/FEATURE_FLAGS.md
  - tests/e2e-ci.test.ts
  - tests/gallery.test.ts
  - tests/harvest-invariants.test.ts
  - tests/site-gate.test.ts
  - tests/source-invariants.test.ts
  - tests/waitlist.test.ts
  - .wcp/issues/
commit: eb7546c5e0bef350dd4690431470e32782689620
pr:
reason:
created: 2026-10-05T16:26:43Z
session: 2026-10-05T16:26:43Z
notion_page_id: 3f01027c-242b-814c-a3f2-d92c33039319
notion_url: https://app.notion.com/p/3f01027c242b814ca3f2d92c33039319
---

The template ships with no GitHub Actions workflow. `bun run audit` stays a local script (`bun audit --audit-level=high`). Playwright e2e stays a local script. Dependabot keeps weekly `bun` updates on `dev` and does not configure `github-actions`.

Living docs describe leftover `SITE_GATE_PASSWORD` for existing clones without naming those clones. The public template is identified by package name `next-starter-template` and origin `teton-web/next-starter-template`. Forgot-password placeholders stay on `example.com`.
