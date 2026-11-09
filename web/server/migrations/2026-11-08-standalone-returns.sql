-- Returns are now standalone party documents. They no longer reference an
-- invoice; the party and item are stored directly. Old rows are backfilled
-- from their invoice links before those columns are dropped.
--
-- Run once against the hosted SQLite Cloud database (the app never runs DDL
-- there). The local engine applies the same shape automatically via
-- bootstrapDatabase() -> ensureStandaloneReturnsSchema().
--
-- Take a backup before running. This rebuilds four tables, so stop writes
-- while it executes.

PRAGMA foreign_keys = OFF;

BEGIN;

CREATE TABLE sales_returns_new (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id          INTEGER NOT NULL REFERENCES companies(id),
  return_number       TEXT NOT NULL,
  party_id            INTEGER NOT NULL REFERENCES parties(id),
  return_date         TEXT NOT NULL,
  total_amount        REAL NOT NULL DEFAULT 0,
  notes               TEXT,
  created_by          INTEGER REFERENCES users(id),
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, return_number)
);

INSERT INTO sales_returns_new
  (id, company_id, return_number, party_id, return_date, total_amount,
   notes, created_by, created_at)
SELECT r.id, r.company_id, r.return_number, si.customer_id, r.return_date,
       r.total_amount, r.notes, r.created_by, r.created_at
  FROM sales_returns r
  JOIN sales_invoices si ON si.id = r.invoice_id;

CREATE TABLE sales_return_items_new (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id           INTEGER NOT NULL REFERENCES sales_returns_new(id) ON DELETE CASCADE,
  item_id             INTEGER NOT NULL REFERENCES items(id),
  batch_id            INTEGER REFERENCES stock_batches(id),
  quantity            REAL NOT NULL,
  unit_cost           REAL NOT NULL DEFAULT 0,
  destination         TEXT NOT NULL DEFAULT 'INVENTORY'
                        CHECK (destination IN ('INVENTORY','WASTE')),
  line_total          REAL NOT NULL
);

INSERT INTO sales_return_items_new
  (id, return_id, item_id, batch_id, quantity, unit_cost, destination, line_total)
SELECT ri.id, ri.return_id, ii.item_id, ii.batch_id, ri.quantity,
       CASE WHEN ri.quantity <> 0 THEN ri.line_total / ri.quantity ELSE 0 END,
       'INVENTORY', ri.line_total
  FROM sales_return_items ri
  JOIN sales_invoice_items ii ON ii.id = ri.invoice_item_id;

CREATE TABLE purchase_returns_new (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id          INTEGER NOT NULL REFERENCES companies(id),
  return_number       TEXT NOT NULL,
  party_id            INTEGER NOT NULL REFERENCES parties(id),
  return_date         TEXT NOT NULL,
  total_amount        REAL NOT NULL DEFAULT 0,
  notes               TEXT,
  created_by          INTEGER REFERENCES users(id),
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, return_number)
);

INSERT INTO purchase_returns_new
  (id, company_id, return_number, party_id, return_date, total_amount,
   notes, created_by, created_at)
SELECT r.id, r.company_id, r.return_number, pi.supplier_id, r.return_date,
       r.total_amount, r.notes, r.created_by, r.created_at
  FROM purchase_returns r
  JOIN purchase_invoices pi ON pi.id = r.invoice_id;

CREATE TABLE purchase_return_items_new (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id           INTEGER NOT NULL REFERENCES purchase_returns_new(id) ON DELETE CASCADE,
  item_id             INTEGER NOT NULL REFERENCES items(id),
  batch_id            INTEGER REFERENCES stock_batches(id),
  quantity            REAL NOT NULL,
  unit_cost           REAL NOT NULL DEFAULT 0,
  line_total          REAL NOT NULL
);

INSERT INTO purchase_return_items_new
  (id, return_id, item_id, batch_id, quantity, unit_cost, line_total)
SELECT ri.id, ri.return_id, ii.item_id, ii.batch_id, ri.quantity,
       CASE WHEN ri.quantity <> 0 THEN ri.line_total / ri.quantity ELSE 0 END,
       ri.line_total
  FROM purchase_return_items ri
  JOIN purchase_invoice_items ii ON ii.id = ri.invoice_item_id;

DROP TABLE sales_return_items;
DROP TABLE sales_returns;
DROP TABLE purchase_return_items;
DROP TABLE purchase_returns;

ALTER TABLE sales_returns_new RENAME TO sales_returns;
ALTER TABLE sales_return_items_new RENAME TO sales_return_items;
ALTER TABLE purchase_returns_new RENAME TO purchase_returns;
ALTER TABLE purchase_return_items_new RENAME TO purchase_return_items;

COMMIT;

PRAGMA foreign_keys = ON;
