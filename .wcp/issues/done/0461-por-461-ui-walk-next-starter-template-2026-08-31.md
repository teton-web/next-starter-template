---
id: "0461"
title: "UI walk – next-starter-template – 2026-08-31"
status: done
priority: normal
assignee:
lease_expires:
scope: "Imported from Linear POR-461. Stay inside that description."
acceptance: "UI walk"
files: []
commit:
reason:
created: "2026-08-31T20:24:46.464Z"
linear_id: "POR-461"
linear_url: "https://linear.app/teton-web-ventures/issue/POR-461/ui-walk-next-starter-template-2026-08-31"
linear_status: "Done"
linear_status_type: "completed"
linear_team: "POR"
linear_project: "next-starter-template"
linear_assignee: ""
linear_labels: ["Improvement"]
linear_priority: "Medium"
linear_parent: ""
linear_cycle: ""
linear_due: ""
linear_updated: "2026-09-02T13:38:28.820Z"
linear_archived: false
notion_page_id:
notion_url:
---

## Linear import

- Identifier: POR-461
- URL: https://linear.app/teton-web-ventures/issue/POR-461/ui-walk-next-starter-template-2026-08-31
- Linear status: Done (completed)
- Queue status: done
- Team: Portfolio (POR)
- Project: next-starter-template
- Assignee: unassigned
- Labels: Improvement
- Parent: none
- Priority: Medium
- Estimate: none
- Cycle: none
- Due: none
- Created: 2026-08-31T20:24:46.464Z
- Updated: 2026-09-02T13:38:28.820Z
- Completed: 2026-09-02T13:38:28.807Z
- Canceled: no
- Archived: no
- Branch: david/por-461-ui-walk-next-starter-template-2026-08-31

Queue status follows Water Cooler Protocol. Todo, In Progress, In Review, Triage, and Backlog are `open` so the import does not take a ticket lease or start a review. Done, Canceled, and Blocked use those folders. `linear_status` is the Linear status at import.

## Description

## UI walk

* Date: 2026-08-31
* Live URL: local `http://127.0.0.1:3003` (Doppler project `next-starter-template` was missing; walk used a dedicated local Postgres)
* Surface: all front-facing public + admin routes
* Intent: Package solve-ready leaves from a live front-facing UI walk.
* **Do not implement this epic shell. **`/solve` expands to eligible children.

## Leaves

High bugs:

* [POR-463](https://linear.app/teton-web-ventures/issue/POR-463/show-forgot-password-on-login-when-magic-link-is-off) — Show Forgot password on /login when magic link is off
* [POR-464](https://linear.app/teton-web-ventures/issue/POR-464/refresh-the-media-library-list-after-a-successful-upload) — Refresh the media library list after a successful upload
* [POR-465](https://linear.app/teton-web-ventures/issue/POR-465/stop-admin-header-overflow-at-375px) — Stop admin header overflow at 375px
* [POR-466](https://linear.app/teton-web-ventures/issue/POR-466/label-title-slug-and-body-on-the-cms-editor) — Label title, slug, and body on the CMS editor
* [POR-485](https://linear.app/teton-web-ventures/issue/POR-485/show-human-readable-422-errors-on-contact-and-waitlist) — Show human-readable 422 errors on contact and waitlist

Medium bugs:

* [POR-472](https://linear.app/teton-web-ventures/issue/POR-472/fix-404-document-title-on-unknown-cms-and-catch-all-routes) — Fix 404 document title on unknown CMS and catch-all routes
* [POR-473](https://linear.app/teton-web-ventures/issue/POR-473/fix-missing-h1-on-the-public-home-card) — Fix missing h1 on the public home card
* [POR-474](https://linear.app/teton-web-ventures/issue/POR-474/keep-sign-in-on-the-first-header-row-at-375px) — Keep Sign in on the first header row at 375px
* [POR-475](https://linear.app/teton-web-ventures/issue/POR-475/label-gallery-album-editor-fields) — Label gallery album editor fields
* [POR-476](https://linear.app/teton-web-ventures/issue/POR-476/add-a-text-separator-in-the-cms-preview-not-indexed-banner) — Add a text separator in the CMS preview “not indexed” banner
* [POR-486](https://linear.app/teton-web-ventures/issue/POR-486/clear-stale-login-and-reset-errors-when-html5-validation-blocks-submit) — Clear stale login and reset errors when HTML5 validation blocks submit
* [POR-489](https://linear.app/teton-web-ventures/issue/POR-489/use-the-generic-404-title-when-stripe-pay-routes-call-notfound) — Use the generic 404 title when Stripe pay routes call notFound()

Medium improvements:

* [POR-477](https://linear.app/teton-web-ventures/issue/POR-477/add-contact-to-the-admin-shell-nav) — Add Contact to the admin shell nav
* [POR-478](https://linear.app/teton-web-ventures/issue/POR-478/gate-admin-waitlist-nav-on-the-waitlist-flag) — Gate admin Waitlist nav on the waitlist flag
* [POR-479](https://linear.app/teton-web-ventures/issue/POR-479/show-admin-instead-of-sign-in-in-the-public-header-when-already-signed) — Show Admin instead of Sign in in the public header when already signed in
* [POR-480](https://linear.app/teton-web-ventures/issue/POR-480/humanize-admin-audit-action-summaries) — Humanize admin audit action summaries
* [POR-481](https://linear.app/teton-web-ventures/issue/POR-481/add-articles-and-contact-ctas-on-home-to-match-hero-copy) — Add Articles and Contact CTAs on home to match hero copy
* [POR-487](https://linear.app/teton-web-ventures/issue/POR-487/style-privacy-and-terms-headings-like-other-public-pages) — Style privacy and terms headings like other public pages
* [POR-488](https://linear.app/teton-web-ventures/issue/POR-488/add-document-titles-for-contact-and-waitlist) — Add document titles for /contact and /waitlist

Low:

* [POR-482](https://linear.app/teton-web-ventures/issue/POR-482/add-a-next-step-cta-to-the-articles-empty-state) — Add a next-step CTA to the articles empty state
* [POR-483](https://linear.app/teton-web-ventures/issue/POR-483/add-an-empty-state-on-admincontent-when-there-are-no-entries) — Add an empty state on /admin/content when there are no entries
* [POR-484](https://linear.app/teton-web-ventures/issue/POR-484/replace-cms-hero-media-id-text-field-with-a-library-picker) — Replace CMS hero media id text field with a library picker
* [POR-490](https://linear.app/teton-web-ventures/issue/POR-490/honor-rows6-on-the-contact-message-textarea) — Honor rows={6} on the contact message textarea

## Notes

* Filed unassigned in Backlog/Todo for `/solve`.
* Kind mix: bugs, ideas, and improvements from the walk.
* Pay/Stripe left `blocked_flag` (keys unset). Privacy/terms placeholders are intentional starter copy and were not filed.
