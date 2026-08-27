## Secrets

- Doppler is the source of truth for secrets (`doppler.yaml` defaults to `next-starter-template` / `development`).
- Local `dev` and `db:*` scripts run through `doppler run`. Do not commit real `.env.local` values.
- Vercel `build` and `start` stay plain so Doppler→Vercel synced env vars work without the CLI on the platform.

## Database

- Schema changes use **migrations only**: `bun run db:generate` then `bun run db:migrate`.
- `db:push` / `db:push:force` are disabled and must stay disabled.
- First-time empty database: `bun run db:migrate` then `bun run db:seed`.

## Auth

- Better Auth with credentials; optional Resend magic-link when `RESEND_API_KEY` and `EMAIL_FROM` are set. Public signup is off (`disableSignUp`).
- Admin pages live at `/admin`. Login is `/login` (not `/admin/login`). Preserve `callbackUrl`.

## Conventions

- Mutations are Route Handlers + Zod, not Server Actions.
- Do not put mock data on production paths.
- Long-lived `dev` branch is the PR integration branch.
- CMS: pages/articles with draft → in_review → published. Do not add BlockNote.
- Media: `/admin/media` is the library; preview/production requires `BLOB_READ_WRITE_TOKEN`. Local disk is development-only.
- Search indexing stays off until `SEARCH_INDEXING_ENABLED=true`.
