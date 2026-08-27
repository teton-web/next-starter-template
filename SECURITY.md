# Security

Do not open a public GitHub issue for vulnerabilities that could expose user data, credentials, or unauthenticated access.

Use [GitHub private vulnerability reporting](https://github.com/davidsolheim/next-starter-template/security/advisories/new) on this repository.

## Secrets

Never commit real environment values. This includes `.env`, Doppler tokens, database URLs, `AUTH_SECRET`, blob tokens, and API keys.

- `.env.example` lists **names only**
- Local and `db:*` scripts inject secrets through Doppler
- CI uses stub values and must not set `RESEND_API_KEY` (that enables the email provider at build time)

The seed admin password default (`changeme-admin-password`) is for empty local databases only. Change it after first login, and set `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in Doppler for anything shared.

## Dependency scanning

CI runs `bun audit --audit-level=high` after `bun install --frozen-lockfile` (`bun run audit`).

Bun 1.3 flags:

- `--audit-level=high` reports only **high** and **critical**, and exits `1` when any remain at that severity or higher. Low and moderate do not fail CI.
- `--json` prints the unfiltered registry response; `--audit-level` and `--ignore` still apply to the exit code.
- `--ignore <id>` silences a GHSA or numeric advisory (CVE IDs do not match). Do not ignore high/critical without documenting why.

Weekly Dependabot (`.github/dependabot.yml`: `bun` + `github-actions`) is a fallback for version updates. Those PRs are not auto-merged.
