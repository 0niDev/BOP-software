-- Saved, reversible stock-value corrections (hosted SQLite Cloud migration).
-- Mirrors stock_value_entries / stock_value_entry_lines in
-- server/src/db/schema.ts. Apply by hand; the app never runs DDL against the
-- hosted database.

CREATE TABLE IF NOT EXISTS stock_value_entries (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id       INTEGER NOT NULL REFERENCES companies(id),
    entry_date       TEXT NOT NULL,
    journal_entry_id INTEGER REFERENCES journal_entries(id),
    total_value      REAL NOT NULL DEFAULT 0,
    created_by       INTEGER REFERENCES users(id),
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    reversed_at      TEXT,
    reversed_by      INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS stock_value_entry_lines (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id         INTEGER NOT NULL REFERENCES stock_value_entries(id) ON DELETE CASCADE,
    item_id          INTEGER NOT NULL REFERENCES items(id),
    batch_id         INTEGER NOT NULL REFERENCES stock_batches(id),
    quantity         REAL NOT NULL,
    quantity_on_hand REAL NOT NULL DEFAULT 0,
    unit_cost        REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_stock_value_lines_entry ON stock_value_entry_lines(entry_id);
