<!-- first-run: starter-onboard -->

# Agent instructions

This file is two things: **platform rules** (keep forever) and a **first-run onboard** that clones must finish. After onboard, **replace this entire file** with the onboarded shape at the bottom. The `<!-- first-run: starter-onboard -->` marker must not survive a product onboard.

## Which repo is this?

| This tree is… | What to do |
|---------------|------------|
| **Public template** — `package.json` `name` is `next-starter-template`, or `origin` is `davidsolheim/next-starter-template` | You are editing the **starter**. Do **not** run product onboard. Do **not** replace this file with a product AGENTS.md. Keep the first-run marker so clones still onboard. |
| **A product clone** — any other package name, or `/start` just copied these files | If the first-run marker is still present: **onboard before any feature work**. |

`/start` (user Grok skill) scaffolds a copy, then **must execute this first-run protocol** as its onboard phase. Do not invent a second questionnaire. If `/start` is run **inside an existing product clone**, it validates starter bones + `AGENTS.md` / `VISION.md` / `README.md` and repairs gaps — it does not copy the template over the tree.

---

## First-run onboard (product clones only)

**Stop** implementing features, filing Linear issues, committing product UI, or deploying until this file no longer contains `first-run: starter-onboard` and `VISION.md` exists.

### 1. Collect answers

Prefill from the user’s message (including a `/start` brief and flags like `--slug`, `--team`). **Do not re-ask** fields they already gave. Show inferred values in one short list, then ask **only the gaps** in **one** message.

Required:

1. **Product name** — human title (`Customer Blacklist`)
2. **Slug** — repo / Doppler / `package.json` name (`cblacklist-com`)
3. **Job** — one sentence: who it is for and what it does
4. **V1** — 3–8 **user-visible** outcomes for the first ship (not “add Postgres”)
5. **Later / non-goals** — what V1 must not include
6. **Linear team** — `Teton Web` (default for new Teton products) / `inventRight` / `Kectil` / other exact team name
7. **Public vs gated** — starter default is public marketing + gated `/admin`, or describe the change
8. **Auth extras** — keep starter (Better Auth credentials, no public signup, optional magic link) or describe the change

Optional: canonical domain; brand/voice one-liner; GitHub visibility (default private).

Do **not** ask which framework, ORM, CSS library, or host to use. Stack is locked (see Platform).

If they refuse onboard and want template maintenance on a misnamed copy, stop and say this file still has the first-run marker.

### 2. Write product files

Use their answers. Do not leave starter identity as *this* product.

**`VISION.md`** (create):

```markdown
# <Product name>

## Intent

<one paragraph from Job>

## Users

- Primary: <from Job>
- Secondary: <or none>

## V1 (this onboard)

Must ship:

- <outcome>
- …

Must not ship (later / out of scope for this run):

- <from Later / non-goals>

## Later

- <rest of the backlog they named>

## Non-goals

- Ecommerce, i18n URL prefixes, BlockNote, BotID, catalogs — unless V1 explicitly demands one
- Rebuilding Better Auth / Neon / CMS / media / Doppler from scratch

## Brand / voice

- <one line or “match a calm professional marketing site”>

## Stack (locked)

Next.js 16 App Router, Better Auth, Neon + Drizzle **migrations only**, Doppler,
Resend, Tailwind 4, shadcn/ui, starter CMS + media library. Mutations = Route
Handlers + Zod, not Server Actions.

## Linear

- Team: <team>
- Project: <product name>
- Identifiers: pending until the Linear project exists

## Success

- <routes or jobs a user can complete when V1 is real>
```

**`README.md`**: product title + job; credit [next-starter-template](https://github.com/davidsolheim/next-starter-template) (MIT © David Solheim), no starter git history; stack bullets; install uses **this** slug (`git clone` this repo, `doppler setup --project <slug>`). Must not say `cd next-starter-template`. PRs target `origin/dev`.

**`.linear-project`**: one line, Linear project name (usually the product name).

**Identity:** `package.json` `name` + `doppler:setup` + `doppler.yaml` `setup.project` → `<slug>`. Config stays `development`. Do not reuse the `next-starter-template` Doppler project.

### 3. Self-update this file

Overwrite **`AGENTS.md` in full** with [Onboarded AGENTS.md](#onboarded-agentsmd) below, slots filled. That write must:

- **Remove** `<!-- first-run: starter-onboard -->` and every first-run / questionnaire section
- **Keep** Linear, Product, Secrets (this slug), Database, Auth (plus extras they asked), Conventions
- Add product constraints from vision (what this app *is*) — do not paste all of `VISION.md`

Onboard is **not done** while this marker remains.

Then commit on `main` (`docs: onboard <product name>`), ensure lowercase `dev` exists and includes that commit. Do not push unless asked.

If the user ran `/start`, continue that skill (Linear project + V1 build). Otherwise stop and wait for the next instruction.

---

## Platform (keep after onboard)

Copy these rules into the onboarded file (Secrets retargeted to `<slug>`).

### Secrets

- Doppler is the source of truth for secrets (`doppler.yaml` project + `development`).
- Local `dev` and `db:*` scripts run through `doppler run`. Do not commit real `.env.local` values.
- Vercel `build` and `start` stay plain so Doppler→Vercel synced env vars work without the CLI on the platform.
- Never reuse another product’s Doppler project or `DATABASE_URL`.

### Database

- Schema changes use **migrations only**: `bun run db:generate` then `bun run db:migrate`.
- `db:push` / `db:push:force` are disabled and must stay disabled.
- First-time empty database: `bun run db:migrate` then `bun run db:seed`.

### Auth

- Better Auth with credentials; optional Resend magic-link when `RESEND_API_KEY` and `EMAIL_FROM` are set. Public signup is off (`disableSignUp`).
- Admin pages live at `/admin`. Login is `/login` (not `/admin/login`). Preserve `callbackUrl`.

### Conventions

- Mutations are Route Handlers + Zod, not Server Actions.
- Do not put mock data on production paths.
- Long-lived `dev` branch is the PR integration branch.
- CMS: pages/articles with draft → in_review → published. Do not add BlockNote.
- Media: `/admin/media` is the library; preview/production requires `BLOB_READ_WRITE_TOKEN`. Local disk is development-only.
- Search indexing stays off until `SEARCH_INDEXING_ENABLED=true`.
- Feature flags: Node `isEnabled` resolution is Doppler `FEATURE_<KEY>=0` (exact `"0"` only) → DB row (optional flags only) → catalog default → key-presence. Platform keys (`auth`, `admin`, `cms`, `media`, `contact`, `seo`, `analytics`, `theme`) stay on and are not UI-off. Optional flags default off. Node may read Neon through a ≤60s memory cache (invalidate on `setFeatureFlag`). `proxy.ts` must not open Neon per request: `lib/flags/proxy-resolve.ts` only — catalog + Doppler `FEATURE_<KEY>=0` + memory/cookie, never `lib/db`. Optional flags fail closed on cold cache / DB errors; platform (`/login`, `/admin`) stays up. Flag-cache cookies HMAC with `AUTH_SECRET`. Site-gate unlock cookies HMAC with `AUTH_SECRET` or `SITE_GATE_SIGNING_SECRET`, never the typed password; leftover `SITE_GATE_PASSWORD` is clone-only when the flag row has no hash. Cold preview/prod proxy fetches `GET /api/site-gate/public-state` (fail-closed). See `docs/FEATURE_FLAGS.md`.

---

## Onboarded AGENTS.md

Write **only** this (filled). No first-run marker. No questionnaire.

```markdown
## Linear

- **Project:** <product name>
- **Team:** <team> (`PREFIX` when known)
- **Repo binding:** Auto-resolved from `.linear-project` (`<project name>`).

## Product

- **Name:** <product name>
- **Slug:** <slug>
- **Job:** <one sentence>
- **V1 lock:** `VISION.md` — do not expand into Later/non-goals without the user.
- **Constraints:** <public vs gated; auth extras; other product rules>

## Secrets

- Doppler is the source of truth for secrets (`doppler.yaml` defaults to `<slug>` / `development`).
- Local `dev` and `db:*` scripts run through `doppler run`. Do not commit real `.env.local` values.
- Vercel `build` and `start` stay plain so Doppler→Vercel synced env vars work without the CLI on the platform.
- Do not reuse `next-starter-template` or another product’s Doppler project / `DATABASE_URL`.

## Database

- Schema changes use **migrations only**: `bun run db:generate` then `bun run db:migrate`.
- `db:push` / `db:push:force` are disabled and must stay disabled.
- First-time empty database: `bun run db:migrate` then `bun run db:seed`.

## Auth

- Better Auth with credentials; optional Resend magic-link when `RESEND_API_KEY` and `EMAIL_FROM` are set. Public signup is off (`disableSignUp`).
- Admin pages live at `/admin`. Login is `/login` (not `/admin/login`). Preserve `callbackUrl`.
- <auth extras from onboard, or omit this bullet>

## Conventions

- Mutations are Route Handlers + Zod, not Server Actions.
- Do not put mock data on production paths.
- Long-lived `dev` branch is the PR integration branch.
- CMS: pages/articles with draft → in_review → published. Do not add BlockNote.
- Media: `/admin/media` is the library; preview/production requires `BLOB_READ_WRITE_TOKEN`. Local disk is development-only.
- Search indexing stays off until `SEARCH_INDEXING_ENABLED=true`.
- Feature flags: Node `isEnabled` resolution is Doppler `FEATURE_<KEY>=0` (exact `"0"` only) → DB row (optional flags only) → catalog default → key-presence. Platform keys (`auth`, `admin`, `cms`, `media`, `contact`, `seo`, `analytics`, `theme`) stay on and are not UI-off. Optional flags default off. Node may read Neon through a ≤60s memory cache (invalidate on `setFeatureFlag`). `proxy.ts` must not open Neon per request: `lib/flags/proxy-resolve.ts` only — catalog + Doppler `FEATURE_<KEY>=0` + memory/cookie, never `lib/db`. Optional flags fail closed on cold cache / DB errors; platform (`/login`, `/admin`) stays up. Flag-cache cookies HMAC with `AUTH_SECRET`. Site-gate unlock cookies HMAC with `AUTH_SECRET` or `SITE_GATE_SIGNING_SECRET`, never the typed password; leftover `SITE_GATE_PASSWORD` is clone-only when the flag row has no hash. Cold preview/prod proxy fetches `GET /api/site-gate/public-state` (fail-closed). See `docs/FEATURE_FLAGS.md`.
```

---

## Template maintenance (public template only)

When changing the starter: keep `<!-- first-run: starter-onboard -->`, keep Platform accurate, do not add a client product name. First-run questions and the onboarded shape stay in this file so clones can self-update.
