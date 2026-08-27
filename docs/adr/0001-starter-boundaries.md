# ADR 0001: Starter platform boundaries

## Status

Accepted

## Decision

`next-starter-template` ships:

- Better Auth credentials + optional magic link
- Core identity schema + locales
- Public marketing pages (contact, privacy, terms)
- CMS entries/revisions (page + article) with draft → review → publish
- A full media library with usage tracking, archive/purge, and a storage driver (local disk in development, Vercel Blob in preview/production)
- Doppler-first secrets, migrations-only Drizzle, and search indexing off until `SEARCH_INDEXING_ENABLED=true`

It does **not** ship: ecommerce, i18n URL prefixes, BotID, BlockNote, or product globes/catalogs.

## Consequences

Forks add locale-prefixed routing (`/es/*`) later using `locales` + `cms_entries.localeId`. Object storage is required on Vercel; local disk is development-only.
