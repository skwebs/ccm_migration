# Card Ledger — React + TypeScript UI, Node API, Neon PostgreSQL

This is the migration build of the existing Card Ledger / Credit Card Manager. The original React screen components and styles are retained as the UI baseline. The server-side API is being moved from PHP/SQLite to a Vercel Node function backed by Neon PostgreSQL. The existing live SQLite database is not included or modified.

## Existing functionality retained in the baseline

- Responsive dark UI, dashboard, Transactions, Settings, Card details, Payments, and bottom navigation.
- First-run account setup, login/logout, CSRF token, remembered login, and server-side login throttling.
- Credit card create/edit/archive, bank, last four digits, credit limit, billing day/rule, and due days.
- Transaction create/edit/delete, integer-paise amounts, transaction timestamp, settlement date, UPI/online/swipe methods, UPI app snapshot, category, tags, notes, and optional receipt attachment.
- Calendar-month transaction history, date and settlement-date filters, search, card-specific billing cycles, and newest-first order.
- Automatic statement reconciliation, bank-amount confirmation, statement lock/unlock, bill payments, partial allocations, and unallocated advance credit.
- Editable UPI apps/categories, monthly budget, PWA shell, and private authenticated receipt access.

**Migration status:** this is an implementation build, not yet production-approved. It must be connected to a test Neon database and exercised against real export counts before cutover. No change to the visible UI is intended. Keep the current SQLite deployment intact until you approve the verified replacement.

## Stack

- React + TypeScript + Vite frontend; Tailwind CSS v4 browser CDN retained to preserve the current visual system.
- TypeScript serverless API under `api/`.
- Neon PostgreSQL, using server-only `DATABASE_URL`.
- Optional private Cloudflare R2 bucket for receipt images.
- Vercel deployment; a custom domain or the existing `/credit-card/` path can be routed through `vercel.json`.

## 1. Configure a test environment

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env.local`.
3. Create a **separate test project** in Neon and replace `DATABASE_URL` with its connection string. Never put this value in a `VITE_` variable.
4. Replace `SESSION_SECRET` with a long random secret (at least 32 characters). The example value is not a production secret.
5. Leave the R2 values empty until you create a private bucket and credentials. Receipt upload/viewing requires R2 to be configured.
6. Install dependencies with `npm install`.
7. Apply schema migrations using `npm run db:migrate`.
8. Run locally with `npx vercel dev` so Vercel's `/api` function is available along with the frontend.

The `.env.example` file contains demonstration placeholders only. It is not a working connection configuration. Do not commit `.env.local`, `.env`, a real connection string, secret, or R2 credentials.

## 2. Database migrations

Numbered SQL files in `db/migrations/` are applied in order and recorded in `schema_migrations`. They create the initial schema and add indexes, receipt keys, server-side sessions, and login throttling. Running migrations again is safe; already-recorded migration versions are skipped.

Money is stored as integer paise. Transaction and payment times are kept as local wall-clock timestamps (the application timezone defaults to `Asia/Kolkata`); settlement and cycle boundaries are date-only values. The backend is the authoritative source for cycle assignment.

## 3. Export SQLite data

Make a read-only backup of the live SQLite database and the complete `storage/attachments/` directory before exporting. Do not point the importer at production until you have reviewed the export.

```bash
python scripts/export-sqlite.py /path/to/storage/app.sqlite sqlite-export.json
```

On Windows PowerShell, use the corresponding full path, for example:

```powershell
python scripts/export-sqlite.py "C:\path\to\app.sqlite" sqlite-export.json
```

The export includes table rows, IDs, relationships, timestamps, statement confirmations/locks, and payment allocations. It does not contain the binary receipt images. Keep `sqlite-export.json` private because it contains account and financial records, including the password hash.

## 4. Import into an empty Neon database

**The importer refuses to run if any target business table already contains rows.** Use a fresh test Neon database for the first import; do not import over an existing dataset.

```bash
npm run db:import:neon -- sqlite-export.json
```

After importing, compare row counts and the printed transaction/payment/allocation totals with the SQLite export. Then sign in with the existing account password (the importer supports the legacy PHP bcrypt hash) and verify card settings, transactions, statements, payments, and categories.

If there are receipt attachments and you have configured R2, migrate them after the database import:

```bash
node scripts/migrate-receipts.mjs sqlite-export.json /path/to/legacy/storage
```

The storage path is the directory that contains the `attachments/` folder. On shared hosting, download that folder first. The receipt migrator reports missing files and fails rather than silently claiming they were migrated.

## 5. Build and deploy

```bash
npm run build
```

Deploy the project to Vercel and add `DATABASE_URL`, `SESSION_SECRET`, and (if using receipts) the R2 variables under Project Settings → Environment Variables. Run the numbered SQL migrations against the intended Neon database before testing the deployment.

`vite.config.ts` keeps the existing `/credit-card/` production base, and `vercel.json` contains rewrites for that path and the API. Verify the generated routes in a Vercel preview before connecting a custom domain or switching traffic. If deploying to a domain root instead of `/credit-card/`, adjust the Vite base and PWA manifest deliberately; do not mix the two configurations.

## 6. Pre-cutover checklist

- [ ] Frontend build and Vercel preview succeed.
- [ ] Setup/login/logout, CSRF rejection, remembered login, and throttling behave correctly.
- [ ] Card CRUD/archive and inactive UPI-app historical references behave correctly.
- [ ] Cycle boundary tests pass for both billing rules and month-end/leap-year dates.
- [ ] Transaction totals and calendar-month results match SQLite.
- [ ] Statement totals, bank-confirmed amounts, locks, payment allocations, and outstanding dues match SQLite.
- [ ] Partial payments, overpayments, payments made before a statement exists, and later statement generation are tested.
- [ ] Receipt images are migrated and remain private behind authenticated API access.
- [ ] PWA does not cache API responses or receipt data.
- [ ] A second independent verification of row counts and rupee totals is complete.
- [ ] You explicitly approve the cutover.

Until every relevant check is complete, retain the original app, SQLite database, and receipt directory as the rollback copy. Never use a production database or real credentials for development tests.

## Project layout

```text
api/index.ts                    Vercel API: auth, CRUD, statements, payments, receipts
api/billing.js                  Canonical billing-cycle rules
frontend/src/App.tsx            Existing React UI (preserved)
frontend/src/style.css          Existing visual refinements (preserved)
db/migrations/                  Versioned PostgreSQL schema
scripts/export-sqlite.py        Read-only SQLite export
scripts/import-neon.mjs         Guarded import into an empty Neon database
scripts/migrate-receipts.mjs    Private R2 receipt migration
scripts/test-billing.mjs        Billing-cycle boundary tests
vercel.json                     Function and subpath routing
.env.example                    Demo-only environment template
```
