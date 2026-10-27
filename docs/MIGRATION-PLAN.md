# Migration plan: PHP/SQLite → Vercel + TypeScript + Neon

## Deployment shape

- **UI:** preserve `frontend/src/App.tsx`, CSS, assets, and existing navigation.
- **API:** Vercel serverless TypeScript endpoint that retains the current `action`-based API contract during the transition.
- **Database:** Neon PostgreSQL; all SQL runs server-side. `DATABASE_URL` is never exposed as a browser variable.
- **Receipts:** optional private Cloudflare R2 bucket, served through authenticated API endpoints. Until configured, receipt migration must be reported clearly rather than silently dropping files.
- **PWA:** preserve manifest and service worker behavior for static assets; never cache authenticated API responses or receipts.

## Environment setup

1. Copy `.env.example` to `.env.local` for local development.
2. Create a Neon project and replace the `DATABASE_URL` placeholder with the Neon connection string.
3. Generate a random `SESSION_SECRET` of at least 32 characters.
4. Apply the numbered SQL migrations.
5. Configure the same values in Vercel Project Settings → Environment Variables.
6. Configure R2 values only if private receipt storage is enabled.

Never commit `.env.local`, a real connection string, signing secret, or receipt credentials.

## Safe cutover

1. Make a read-only backup of the SQLite database and attachment directory.
2. Build and test the Neon version against a separate target database.
3. Run the importer in dry-run mode first; show per-table counts and amount totals.
4. Import explicit source IDs and preserve timestamps, archived flags, statement lock state, and allocation relationships.
5. Run the verification report and resolve any mismatch.
6. Test the deployed preview using synthetic/test records; do not point the existing live app at Neon during development.
7. Only after explicit owner verification, deploy the new app as the active version. Retain the original SQLite backup for rollback.

## Acceptance checks

- Existing UI screenshots/layouts are compared before/after; no intentional visual changes without approval.
- API actions and JSON response shapes are checked against the existing frontend contract.
- Monetary values remain integer paise end-to-end.
- Billing cycle and allocation test suites pass before data import is considered safe.
- Build, lint/type-check, schema migration, and import dry-run results are documented honestly.
