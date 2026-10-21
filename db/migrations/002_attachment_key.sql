ALTER TABLE transactions ADD COLUMN IF NOT EXISTS attachment_key TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_payment_allocations_statement ON payment_allocations(statement_id);
CREATE INDEX IF NOT EXISTS idx_transactions_card_settlement ON transactions(card_id, settlement_date);
CREATE INDEX IF NOT EXISTS idx_transactions_txn_at ON transactions(txn_at DESC, id DESC);
