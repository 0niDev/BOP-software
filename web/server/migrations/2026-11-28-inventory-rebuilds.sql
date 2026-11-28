-- Inventory rebuilds: one row per rebuild, one row per batch it changed, plus
-- the JSON snapshot file that restores it. Mirrors src/db/schema.ts.
CREATE TABLE IF NOT EXISTS inventory_rebuilds (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id       INTEGER NOT NULL REFERENCES companies(id),
    from_date        TEXT NOT NULL,
    to_date          TEXT NOT NULL,
    journal_entry_id INTEGER REFERENCES journal_entries(id),
    item_count       INTEGER NOT NULL DEFAULT 0,
    total_quantity   REAL NOT NULL DEFAULT 0,
    total_value      REAL NOT NULL DEFAULT 0,
    snapshot_file    TEXT,
    reason           TEXT,
    created_by       INTEGER REFERENCES users(id),
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    restored_at      TEXT,
    restored_by      INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS inventory_rebuild_lines (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    rebuild_id      INTEGER NOT NULL REFERENCES inventory_rebuilds(id) ON DELETE CASCADE,
    item_id         INTEGER NOT NULL REFERENCES items(id),
    batch_id        INTEGER NOT NULL REFERENCES stock_batches(id),
    quantity_before REAL NOT NULL,
    quantity_after  REAL NOT NULL,
    unit_cost       REAL NOT NULL DEFAULT 0,
    value_before    REAL NOT NULL DEFAULT 0,
    value_after     REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_rebuild_lines_rebuild ON inventory_rebuild_lines(rebuild_id);
