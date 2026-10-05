---
id: 0493
title: Remove the private gold-standard link and purge it from git history
status: done
priority: high
assignee:
lease_expires:
scope: Drop the private gold-standard page link from the public README, flags doc, source invariant, and imported issue archive. Rewrite git history so that page id is not in any blob. Force-update origin/dev and origin/main. Delete other origin heads that still advertise the link. Do not republish skills. Do not bump dependencies. Keep the first-run onboard marker.
acceptance: README and docs/FEATURE_FLAGS.md do not link to a Notion page. No commit reachable from origin/main or origin/dev contains that page id. Other origin heads that contained it are deleted. Tests lock the public docs.
files:
  - README.md
  - docs/FEATURE_FLAGS.md
  - tests/source-invariants.test.ts
  - .wcp/issues/done/0379-por-379-gold-standard-kit-flags-galleries-stripe-and-hal.md
commit: 021fb6e45a461154f0ca45168dd74fa54129ccfa
pr:
reason:
created: 2026-10-05T17:46:37Z
session: 2026-10-05T17:46:37Z
notion_page_id: 3f01027c-242b-8181-83a9-f2ed7688c1e7
notion_url: https://app.notion.com/p/3f01027c242b818183a9f2ed7688c1e7
---

The public README, the flags doc, the source invariant, and one imported issue file link a private Notion inventory page. That page stays in Notion. The public repository stops linking it, and rewritten history stops carrying the URL.

Platform boundaries stay in ADR 0001. Flag rules stay in docs/FEATURE_FLAGS.md. Dependabot bun updates stay. No GitHub Actions workflow is added.
