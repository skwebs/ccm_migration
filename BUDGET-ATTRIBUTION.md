# Monthly budget attribution (Migration 04 baseline)

Transactions are assigned to the budget month in which their card statement is generated.
Settlement date selects the card's billing cycle. The cycle boundaries from the existing
application are preserved exactly:
- `end`: day after the previous billing day through the billing day (e.g. 16 Oct–15 Nov).
- `start`: billing day through the day before the next billing day (e.g. 15 Oct–14 Nov).

Statement generation occurs the day after `cycle_end`. If a generated statement exists for
the card and exact cycle, its stored `statement_date` is used. Otherwise the expected
generation date from `cycleFor()` is used.

Dashboard totals:
- Current budget expenses: transaction amounts assigned to statements generated in the
  current calendar month (billed and not-yet-generated cycles alike).
- Next month expenses: transaction amounts assigned to statements generated next month.
- Unpaid Bill: existing statement outstanding total after allocated payments.
- Calendar-month purchases: existing frontend total based on transaction date.

No schema migration is required. Migration 04's transaction-detail grouping and UI tweaks
are retained because this archive is the implementation baseline.
