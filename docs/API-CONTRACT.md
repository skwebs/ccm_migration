# Existing frontend API contract

The legacy frontend originally called `/api/index.php?action=<action>`. The migration build changes only the central request helper to `/api?action=<action>` and retains same-origin credentials plus `X-CSRF-Token`. Vercel rewrites preserve the existing `/credit-card/` subpath. Action names and response fields remain stable.

| Action | Methods | Main responsibility |
|---|---|---|
| `status` | GET | Setup/authentication state and CSRF token |
| `setup` | POST | First-user setup; one-time only |
| `login` | POST | Authenticate and issue secure session cookie |
| `logout` | POST | Revoke session/remember token |
| `bootstrap` | GET | Initial app payload (cards, transactions, apps, dashboard, payments, statements, settings) |
| `dashboard` | GET | Current cycle and previous dues summary |
| `cards` | GET, POST, PUT, DELETE | List/create/update/archive cards |
| `transactions` | GET, POST, PUT, DELETE | Filtered transaction history and CRUD |
| `transaction-attachment` | GET, POST, DELETE | Authenticated receipt access/upload/removal |
| `statements` | GET | Cycle statements and computed paid/outstanding values |
| `statement-action` | POST | Confirm, lock, or unlock statement |
| `payments` | GET, POST, DELETE | Bill payments and allocations |
| `upi-apps` | GET, POST, PUT, DELETE | UPI app management |
| `settings` | GET, POST | Monthly budget and categories |

## Compatibility notes

- The frontend currently expects money fields suffixed with `_minor` to be integer paise.
- Boolean database values must be serialized as `0`/`1` or the UI must be updated centrally without changing its appearance.
- The UI's `Txn` type expects `card_id`, `card_name`, `particular`, `amount_minor`, `txn_at`, `settlement_date`, `payment_method`, `upi_app_id`, `upi_app_name`, `notes`, `category`, `tags`, and `has_attachment`.
- Statement rows expose `amount_minor`, `bill_amount_minor`, `bank_amount_minor`, `confirmed_at`, `is_locked`, `paid_minor`, `outstanding_minor`, and `status`.
- Do not send private receipt keys or database connection details to the client.
