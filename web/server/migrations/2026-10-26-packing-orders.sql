-- Packing stage: independent packing orders (unpacked bulk + packing materials -> finished goods).
-- Apply by hand to the hosted SQLite Cloud databases (the app never DDLs them).

CREATE TABLE IF NOT EXISTS packing_orders (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id          INTEGER NOT NULL REFERENCES companies(id),
    warehouse_id        INTEGER NOT NULL REFERENCES warehouses(id),
    order_number        TEXT NOT NULL,
    bom_id              INTEGER NOT NULL REFERENCES bill_of_materials(id),
    planned_quantity    REAL NOT NULL,
    actual_quantity     REAL NOT NULL DEFAULT 0,
    output_batch_number TEXT,
    manufacturing_date  TEXT NOT NULL,
    expiry_date         TEXT,
    production_cost     REAL NOT NULL DEFAULT 0,
    status              TEXT NOT NULL DEFAULT 'DRAFT'
                          CHECK (status IN ('DRAFT','IN_PROGRESS','COMPLETED','CANCELLED')),
    notes               TEXT,
    created_by          INTEGER REFERENCES users(id),
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT,
    completed_at        TEXT,
    UNIQUE (company_id, order_number)
);

CREATE TABLE IF NOT EXISTS packing_consumption (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    packing_order_id  INTEGER NOT NULL REFERENCES packing_orders(id) ON DELETE CASCADE,
    component_item_id INTEGER NOT NULL REFERENCES items(id),
    batch_id          INTEGER NOT NULL REFERENCES stock_batches(id),
    quantity_consumed REAL NOT NULL,
    unit_cost         REAL NOT NULL DEFAULT 0
);
