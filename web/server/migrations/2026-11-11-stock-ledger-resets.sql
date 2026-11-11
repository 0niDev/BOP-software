-- Reversible "zero out the stock ledger" runs (hosted SQLite Cloud migration).
-- Mirrors the stock_ledger_resets / stock_ledger_reset_lines tables in
-- server/src/db/schema.ts. Apply by hand; the app never runs DDL against the
-- hosted database.

CREATE TABLE IF NOT EXISTS stock_ledger_resets (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id     INTEGER NOT NULL REFERENCES companies(id),
    reason         TEXT,
    batch_count    INTEGER NOT NULL DEFAULT 0,
    total_quantity REAL NOT NULL DEFAULT 0,
    total_value    REAL NOT NULL DEFAULT 0,
    snapshot_file  TEXT,
    created_by     INTEGER REFERENCES users(id),
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    restored_at    TEXT,
    restored_by    INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS stock_ledger_reset_lines (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    reset_id  INTEGER NOT NULL REFERENCES stock_ledger_resets(id) ON DELETE CASCADE,
    batch_id  INTEGER NOT NULL REFERENCES stock_batches(id),
    item_id   INTEGER NOT NULL REFERENCES items(id),
    quantity  REAL NOT NULL,
    unit_cost REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_stock_ledger_lines_reset ON stock_ledger_reset_lines(reset_id);
