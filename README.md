# Next.js Starter Template

A production-ready Next.js starter with **Better Auth**, Neon/Drizzle **migrations only**, Doppler-oriented secrets, App Router hardening, and optional product surfaces behind `isEnabled`.

**License:** [MIT](LICENSE) © David Solheim. Public template: [github.com/davidsolheim/next-starter-template](https://github.com/davidsolheim/next-starter-template). GitHub **About** and topics: Better Auth (`better-auth`), not Auth.js.

Design source: [Next Starter gold standard](docs/adr/0001-starter-boundaries.md) · platform boundaries: [ADR 0001](docs/adr/0001-starter-boundaries.md) · flags: [docs/FEATURE_FLAGS.md](docs/FEATURE_FLAGS.md).

Pull requests target **`origin/dev`**.

## Features

- **Next.js 16** with App Router
- **Drizzle ORM** with Neon PostgreSQL (migrations only — never `db:push`)
- **Better Auth** — credentials + optional Resend magic link + optional Google OAuth behind flag `oauth` (no public signup)
- **Feature flags** — Node `isEnabled`; Doppler `FEATURE_<KEY>=0` hard-off; `/admin/features` for optional modules
- **Resend** + React Email templates
- **Tailwind CSS 4** + **shadcn/ui**
- **TypeScript** (build fails on type errors)
- Preview/production **site gate** (flag + hashed password on `/admin/features`; local `dev` ungated)
- CMS (pages/articles, draft → publish) and **media library**
- Contact form, privacy/terms, `llms.txt`, OG image
- Session-gated uploads with MIME/signature checks

## Getting started

A clone that will become a **product** must run the first-run onboard in [`AGENTS.md`](AGENTS.md) (agent asks, then **rewrites** `AGENTS.md`, `VISION.md`, and `README.md`). Do not leave the `first-run: starter-onboard` marker in a product repo.

### Prerequisites

- [Bun](https://bun.sh) (or Node.js 18+)
- [Doppler CLI](https://docs.doppler.com/docs/install-cli)
- A Neon PostgreSQL database
- Resend account (for email)

### Clone path (new product)

Use a **new** Doppler project named after the product slug. Do not reuse `next-starter-template` or another product’s Doppler/`DATABASE_URL`. Copy names from `.env.example`. See [docs/DOPPLER_ENV_SETUP.md](docs/DOPPLER_ENV_SETUP.md).

```bash
git clone https://github.com/davidsolheim/next-starter-template.git <slug>
cd <slug>
bun install
doppler setup --project <slug> --config development
bun run env:verify:doppler
bun run db:migrate
bun run db:seed
```

1. `bun run db:migrate` on an empty Neon database. Never `db:push` / `db:push:force` ([docs/DATABASE_MIGRATIONS.md](docs/DATABASE_MIGRATIONS.md)).
2. `bun run db:seed` (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`; defaults `admin@example.com` / `changeme-admin-password`).
3. Sign in at `/login` and **change the seed password** (seed users start with `mustChangePassword`).
4. Import the repo in Vercel. Sync Doppler configs to Preview/Production, then run `db:migrate` against those databases before (or immediately after) deploy.
5. At `/admin/features`, enable **only** the optional flags this site needs. Platform modules stay on; optional flags default off.

### This template (maintainers)

Work on **this** public template (package name `next-starter-template`) uses the starter Doppler project:

```bash
git clone https://github.com/davidsolheim/next-starter-template.git
cd next-starter-template
bun install
doppler setup --project next-starter-template --config development
bun run env:verify:doppler
bun run db:migrate
bun run db:seed
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in at `/login`.

## Authentication

- Credentials (email + password) via Better Auth with database sessions
- Public registration is disabled; admins are created by `bun run db:seed`
- Optional Resend magic-link when `RESEND_API_KEY` and `EMAIL_FROM` are set
- Optional Google OAuth when flag `oauth` is on and `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are set (invite/seed emails only; does not create users)
- Soft-deleted users (`users.deleted_at`) cannot authenticate
- Admin UI is at `/admin`; unauthenticated users are sent to `/login?callbackUrl=...`

## Project structure

```
├── app/                    # App Router
│   ├── (auth)/             # login, forgot, reset
│   ├── admin/              # protected admin
│   ├── api/                # Route Handlers
│   ├── error.tsx
│   ├── global-error.tsx
│   └── not-found.tsx
├── components/ui/          # shadcn/ui
├── emails/                 # React Email templates
├── lib/
│   ├── auth.ts
│   ├── api/                # json helpers, pagination, rate limit
│   └── db/schema/          # Better Auth identity, CMS, media
├── drizzle/                # versioned SQL migrations
└── scripts/                # env verify, seed admin
```

## Environment variables

See `.env.example`. Required: `DATABASE_URL`, `AUTH_SECRET`.

## Scripts

```bash
bun run lint
bun run test
bun run audit
bun run env:verify
bun run db:generate
bun run db:migrate
bun run db:seed
```

`bun run audit` is `bun audit --audit-level=high` (Bun 1.3: fail CI on high/critical only). See [SECURITY.md](SECURITY.md).

## Feature flags

Node `isEnabled(key)` (Route Handlers / server): Doppler kill switch `FEATURE_<KEY>=0` (exact `"0"` only) → optional DB row → catalog default → required-env checks. Platform keys (`auth`, `admin`, `cms`, `media`, `contact`, `seo`, `analytics`, `theme`) stay on and are not UI-off. Optional keys default **off** (`site_gate`, `waitlist`, `stripe`, `galleries`, `scheduled_publish`, `oauth`, `cron`). `proxy.ts` must not open Neon per request.

Enable only what the clone needs on `/admin/features`. Full rules: [docs/FEATURE_FLAGS.md](docs/FEATURE_FLAGS.md). Boundaries: [ADR 0001](docs/adr/0001-starter-boundaries.md). Inventory: [gold-standard Notion page](docs/adr/0001-starter-boundaries.md).

## Deployment

Import the repo in Vercel, sync Doppler configs to Preview/Production, run `db:migrate` against those databases, then deploy. Do not set `RESEND_API_KEY` in CI stubs — that enables the email provider at build time.

## Site gate (clones)

The gate is **off** by default. Preview/production turn it on only when the `site_gate` flag is on **and** a password is stored (scrypt `passwordHash` on `/admin/features`). HMAC cookies use `AUTH_SECRET` or `SITE_GATE_SIGNING_SECRET`, not the typed password. `/api/health` stays public. Local `dev` stays ungated.

Existing clones (**Bill Lax**, **MKFF**, **gateway-match**, **inventRight**) that still have Doppler `SITE_GATE_PASSWORD` must not go public on pull: leftover env is used **only** while the flag row has no hash. Before or with the pull: enable `site_gate` and set a password in `/admin/features`, then remove `SITE_GATE_PASSWORD` from Doppler. After that, preview/prod gating for anonymous visitors comes from `GET /api/site-gate/public-state`, not leftover env and not an admin cookie.

## Contributing

PRs target **`origin/dev`**. GitHub **About** and topics stay Better Auth (`better-auth`).

## License

[MIT](LICENSE) © David Solheim

## Security

See [SECURITY.md](SECURITY.md). Report vulnerabilities privately; do not file public issues for credential or auth bypasses.
