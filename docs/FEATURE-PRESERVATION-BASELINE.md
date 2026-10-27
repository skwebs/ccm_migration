# Credit Card Manager — Feature Preservation Baseline

This document is the acceptance baseline for the PHP/SQLite → TypeScript/Vercel/Neon migration. The existing app is the source of truth. Changes to UI, workflows, or user-visible behavior require explicit approval.

## Existing UI and workflows to preserve

- Dark, responsive React UI with Dashboard, Transactions, Settings, Card detail, and Payments tabs.
- Initial setup and login, session/CSRF handling, optional remembered login, logout.
- Dashboard overview: active cards, current billing-cycle expenses, previous outstanding dues, and five newest transactions.
- Credit card create/edit/archive, bank, last four digits, credit limit, billing day/rule, and due days.
- Transaction create/edit/delete; amount in integer paise; transaction date/time; independent settlement date; payment method (UPI, online, swipe); UPI app; category, tags, notes, and optional image attachment.
- Transaction search and filtering by card, calendar month, method, date range, settlement range, UPI app, and query; newest-first ordering.
- Card-specific billing cycles, statement generation, statement confirmation against bank amount, manual lock/unlock, and protection of locked-cycle transactions.
- Bill payments, payment allocations, partial payments, unallocated/advance credit, and outstanding balances.
- Editable/archivable UPI apps and categories; monthly budget setting.
- PWA manifest, service worker, installable shell, and offline-safe static assets.

## Existing API contract to replace without UI redesign

The frontend currently calls a single PHP endpoint with an `action` query parameter. Keep the same action names and response shapes where practical so the UI can be switched with a minimal request-helper change:

`status`, `setup`, `login`, `logout`, `bootstrap`, `dashboard`, `cards`, `transactions`, `transaction-attachment`, `statements`, `statement-action`, `payments`, `upi-apps`, `settings`.

HTTP methods currently used include GET, POST, PUT, and DELETE. The new API must not expose database credentials to the browser.

## Data model discovered in SQLite API

- `app_user`
- `remember_tokens`
- `app_settings`
- `credit_cards`
- `upi_apps`
- `transactions`
- `statements`
- `bill_payments`
- `payment_allocations`

Amounts are stored as integer minor units (paise), not floating-point rupees. `txn_at` and `paid_at` represent local date/time; `settlement_date`, cycle boundaries, statement date, and due date are date-only concepts. UPI app name is snapshotted on each transaction so history remains understandable after an app is renamed or archived.

## Migration gates

1. New schema applies cleanly to an empty Neon database.
2. Import is idempotent or refuses to overwrite existing target data; it must never silently duplicate financial records.
3. Compare per-table row counts, IDs/relationships, total transaction paise, total payment paise, statement totals, allocated payment totals, and unallocated payment totals.
4. Test billing-cycle boundaries for both `billing_rule='end'` and `billing_rule='start'`, including month-end clamping and leap years.
5. Test partial payment, payment made before a statement exists, overpayment/advance credit, later statement creation, payment deletion, and statement locking.
6. Keep the existing SQLite file and current deployment unchanged until the owner verifies the new deployment.

## Known risks to resolve during implementation

- Existing `bootstrap` and transaction listing use a 2,000-transaction cap. The new backend should paginate/filter without truncating aggregates or historical totals.
- `cycleFor` exists in both TypeScript UI and PHP API. API must be authoritative for persisted billing logic; UI calculation may remain for display only if parity tests pass.
- `ensureStatements` mutates data on GET requests. Replace with explicit, idempotent statement reconciliation/service logic while preserving when the UI expects statements to appear.
- Existing payment allocation logic needs regression tests around advance credit and future statements.
- Existing login lacks rate limiting. Add server-side throttling without changing the login UI.
- Attachments must migrate or be handled explicitly. The original local filesystem paths cannot simply be reused on Vercel; use private object storage (Cloudflare R2) with authenticated access, or provide a documented export/import path.
- Keep historical records attached to archived cards and inactive UPI apps editable where existing behavior permits; active-only validation must not accidentally block historical edits.

## UI changes

No UI redesign, feature removal, new mandatory workflow, or change to billing/payment semantics is authorized by this migration baseline. Ask before making any such change. Backend security and correctness fixes are allowed when they preserve the visible workflow; document any unavoidable behavior difference for approval before switching production.
