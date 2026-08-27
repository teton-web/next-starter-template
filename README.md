# Next.js Starter Template

A production-ready Next.js starter with authentication, Neon/Drizzle, Doppler-oriented secrets, and App Router hardening.

**License:** [MIT](LICENSE) © David Solheim. Public template: [github.com/davidsolheim/next-starter-template](https://github.com/davidsolheim/next-starter-template).

## Features

- **Next.js 16** with App Router
- **Drizzle ORM** with Neon PostgreSQL (migrations only)
- **Better Auth** — credentials + optional Resend magic link (no public signup)
- **Resend** + React Email templates
- **Tailwind CSS 4** + **shadcn/ui**
- **TypeScript** (build fails on type errors)
- Preview/production **site gate**
- CMS (pages/articles, draft → publish) and **media library**
- Contact form, privacy/terms, `llms.txt`, OG image
- Session-gated uploads with MIME/signature checks

## Getting started

### Prerequisites

- [Bun](https://bun.sh) (or Node.js 18+)
- [Doppler CLI](https://docs.doppler.com/docs/install-cli)
- A Neon PostgreSQL database
- Resend account (for email)

### Installation

```bash
git clone https://github.com/davidsolheim/next-starter-template.git
cd next-starter-template
bun install
doppler setup --project next-starter-template --config development
bun run env:verify:doppler
```

Create your own Doppler project (or copy `.env.example` into Doppler). Do not reuse someone else's Doppler/Vercel project.

See [docs/DOPPLER_ENV_SETUP.md](docs/DOPPLER_ENV_SETUP.md). Key names are in `.env.example`.

### Database

```bash
bun run db:migrate
bun run db:seed
```

Seed uses `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (defaults: `admin@example.com` / `changeme-admin-password`). Change the password after first login.

Schema policy: [docs/DATABASE_MIGRATIONS.md](docs/DATABASE_MIGRATIONS.md). Never use `db:push`.

### Develop

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in at `/login`.

## Authentication

- Credentials (email + password) via Better Auth with database sessions
- Public registration is disabled; admins are created by `bun run db:seed`
- Optional Resend magic-link when `RESEND_API_KEY` and `EMAIL_FROM` are set
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
│   └── db/schema/          # core identity / org / files
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

## Deployment

Import the repo in Vercel, sync Doppler configs to Preview/Production, run `db:migrate` against those databases, then deploy. Do not set `RESEND_API_KEY` in CI stubs — that enables the email provider at build time.

## License

[MIT](LICENSE) © David Solheim

## Security

See [SECURITY.md](SECURITY.md). Report vulnerabilities privately; do not file public issues for credential or auth bypasses.
