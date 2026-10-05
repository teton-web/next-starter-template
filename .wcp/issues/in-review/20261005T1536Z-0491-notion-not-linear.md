---
id: 0491
title: Point starter onboard and README at Notion instead of Linear
status: in-review
priority: high
assignee: notion-tracker
lease_expires:
scope: AGENTS.md, README.md, and tests/source-invariants.test.ts. The /start skill copies the same Notion rules so a clone is not told to create a Linear project.
acceptance: The first-run onboard and the onboarded AGENTS.md shape tell a clone to track work in Notion. They do not ask for a Linear team, do not write .linear-project, do not keep a Linear section, and do not tell a clone to keep a Linear URL. README states the same rule. source-invariants expects ## Notion on both the template and a product clone.
files:
  - AGENTS.md
  - README.md
  - tests/source-invariants.test.ts
  - .gitignore
commit:
pr:
reason:
created: 2026-10-05T15:36:45Z
session: 2026-10-05T15:36:45Z
notion_page_id: 3f01027c-242b-81bf-b853-dac862297dbb
notion_url: https://app.notion.com/p/3f01027c242b81bfb853dac862297dbb
---

Work tracking for a clone is the committed `.wcp/issues/` queue plus one Notion issues database. The database title is the repo slug. Its description is the normalized origin URL. Do not create Linear issues. Do not write `.linear-project`.

The `/start` skill must follow that shape. It must not repair a checkout by adding `## Linear` or `.linear-project`. A clone is not told to keep a Linear URL.
