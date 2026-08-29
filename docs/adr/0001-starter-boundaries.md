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

It ships **simple pay flagged off**: a single Stripe Checkout Session plus a signed, idempotent webhook, gated by `isEnabled('stripe')` (default off; dark without `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`).

It does **not** ship: product globes/catalogs, SKUs, subscriptions, customer portal, Shopify, i18n URL prefixes, BotID, or BlockNote.

## Consequences

Forks add locale-prefixed routing (`/es/*`) later using `locales` + `cms_entries.localeId`. Object storage is required on Vercel; local disk is development-only.
