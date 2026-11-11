// READ-ONLY inspector for a SQLite Cloud database. SELECT statements only.
//
//   node scripts/inspect-db.mjs "sqlitecloud://host:8860/fix?apikey=..."
//
// Never issues INSERT/UPDATE/DELETE/DDL. Safe against a live database.

import { Database } from "@sqlitecloud/drivers";

const url = process.argv[2];
if (!url) {
  console.error("usage: node scripts/inspect-db.mjs <sqlitecloud url>");
  process.exit(1);
}
const mask = (u) => u.replace(/apikey=[^&]+/, "apikey=***");
console.log(`inspecting ${mask(url)} (read-only)\n`);

const db = new Database(url);
const sql = async (query) => {
  const rows = await db.sql({ query, parameters: [] });
  return Array.isArray(rows) ? rows : [];
};

const fmt = (rows) => {
  if (!rows.length) return "  (none)";
  const cols = Object.keys(rows[0]);
  const widths = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? "").length)));
  const line = (vals) => "  " + vals.map((v, i) => String(v ?? "").padEnd(widths[i])).join("  ");
  return [line(cols), line(widths.map((w) => "-".repeat(w))), ...rows.map((r) => line(cols.map((c) => r[c])))].join("\n");
};

const show = async (title, query) => {
  try {
    const rows = await sql(query);
    console.log(`\n### ${title}  (${rows.length} row${rows.length === 1 ? "" : "s"})`);
    console.log(fmt(rows));
  } catch (err) {
    console.log(`\n### ${title}\n  ERROR: ${err.message}`);
  }
};

await show("row counts", `
  SELECT 'sales_invoices' t, COUNT(*) n FROM sales_invoices
  UNION ALL SELECT 'sales_invoice_items', COUNT(*) FROM sales_invoice_items
  UNION ALL SELECT 'purchase_invoices', COUNT(*) FROM purchase_invoices
  UNION ALL SELECT 'production_orders', COUNT(*) FROM production_orders
  UNION ALL SELECT 'production_consumption', COUNT(*) FROM production_consumption
  UNION ALL SELECT 'packing_orders', COUNT(*) FROM packing_orders
  UNION ALL SELECT 'packing_consumption', COUNT(*) FROM packing_consumption
  UNION ALL SELECT 'journal_entries', COUNT(*) FROM journal_entries
  UNION ALL SELECT 'journal_entry_lines', COUNT(*) FROM journal_entry_lines
  UNION ALL SELECT 'stock_batches', COUNT(*) FROM stock_batches
  UNION ALL SELECT 'stock_movements', COUNT(*) FROM stock_movements
  UNION ALL SELECT 'items', COUNT(*) FROM items
  UNION ALL SELECT 'returns', (SELECT COUNT(*) FROM sales_returns)`);

await show("date coverage", `
  SELECT 'sales' k, MIN(invoice_date) first, MAX(invoice_date) last FROM sales_invoices
  UNION ALL SELECT 'purchases', MIN(invoice_date), MAX(invoice_date) FROM purchase_invoices
  UNION ALL SELECT 'journal_entries', MIN(entry_date), MAX(entry_date) FROM journal_entries
  UNION ALL SELECT 'stock_movements', MIN(movement_date), MAX(movement_date) FROM stock_movements
  UNION ALL SELECT 'production(created)', MIN(created_at), MAX(created_at) FROM production_orders
  UNION ALL SELECT 'packing(created)', MIN(created_at), MAX(created_at) FROM packing_orders`);

await show("journal entries by voucher type", `
  SELECT voucher_type, COUNT(*) n, MIN(entry_date) first, MAX(entry_date) last
    FROM journal_entries GROUP BY voucher_type ORDER BY n DESC`);

await show("entries dated after 2026-10-31", `
  SELECT voucher_type, COUNT(*) n FROM journal_entries WHERE entry_date > '2026-10-31'
   GROUP BY voucher_type`);

await show("sales invoices with NO stock movement (Ignore stock)", `
  SELECT si.id, si.invoice_number, si.invoice_date, si.payment_type, si.total_amount
    FROM sales_invoices si
   WHERE si.status <> 'CANCELLED'
     AND NOT EXISTS (SELECT 1 FROM stock_movements m
                      WHERE m.reference_table='sales_invoices' AND m.reference_id=si.id)
     AND NOT EXISTS (SELECT 1 FROM sales_invoice_items i
                      WHERE i.invoice_id=si.id AND i.batch_id IS NOT NULL)
   ORDER BY si.invoice_date`);

await show("sales invoice totals by month", `
  SELECT substr(invoice_date,1,7) ym, COUNT(*) n, ROUND(SUM(total_amount),2) total
    FROM sales_invoices WHERE status <> 'CANCELLED' GROUP BY ym ORDER BY ym`);

await show("GL balances (debit-credit) for key accounts", `
  SELECT a.account_code, a.account_name, a.account_type,
         ROUND(SUM(l.debit - l.credit), 2) AS balance
    FROM accounts a
    JOIN journal_entry_lines l ON l.account_id = a.id
    JOIN journal_entries je ON je.id = l.journal_entry_id AND je.is_posted = 1
   WHERE a.account_code IN ('1000','1010','1100','1200','1210','1220','2000','2100','3000','3100','4000','4100','5000','5001','5002','5100','5200','6100')
   GROUP BY a.id ORDER BY a.account_code`);

await show("stock ledger value by item type", `
  SELECT i.item_type,
         COUNT(*) batches,
         ROUND(SUM(sb.quantity_in_stock), 4) qty,
         ROUND(SUM(sb.quantity_in_stock *
                CASE WHEN (sb.raw_unit_cost + sb.packing_unit_cost) > 0
                     THEN sb.raw_unit_cost + sb.packing_unit_cost
                     ELSE sb.purchase_price END), 2) value
    FROM stock_batches sb JOIN items i ON i.id = sb.item_id
   WHERE sb.is_active = 1 GROUP BY i.item_type`);

await show("stock batches with qty but zero cost", `
  SELECT COUNT(*) n, ROUND(SUM(quantity_in_stock),4) qty
    FROM stock_batches
   WHERE is_active = 1 AND quantity_in_stock > 0
     AND COALESCE(raw_unit_cost,0) + COALESCE(packing_unit_cost,0) = 0
     AND COALESCE(purchase_price,0) = 0`);

await show("opening-stock batches", `
  SELECT COUNT(*) batches, ROUND(SUM(quantity_in_stock),4) qty,
         ROUND(SUM(quantity_in_stock * COALESCE(purchase_price,0)),2) value,
         MIN(received_date) first, MAX(received_date) last
    FROM stock_batches WHERE batch_number LIKE 'OPEN-%'`);

await show("production orders (status + ignore stock evidence)", `
  SELECT po.id, po.order_number, po.manufacturing_date, po.status,
         po.actual_quantity, po.production_cost,
         (SELECT COUNT(*) FROM production_consumption c WHERE c.production_order_id = po.id) consumptions
    FROM production_orders po ORDER BY po.manufacturing_date, po.id`);

await show("packing orders (status + ignore stock evidence)", `
  SELECT pk.id, pk.order_number, pk.manufacturing_date, pk.status,
         (SELECT COUNT(*) FROM packing_consumption c WHERE c.packing_order_id = pk.id) consumptions
    FROM packing_orders pk ORDER BY pk.manufacturing_date, pk.id`);

await show("stock movement types", `
  SELECT movement_type, COUNT(*) n, MIN(movement_date) first, MAX(movement_date) last
    FROM stock_movements GROUP BY movement_type ORDER BY n DESC`);

await show("trial balance footing", `
  SELECT ROUND(SUM(debit),2) total_debit, ROUND(SUM(credit),2) total_credit,
         ROUND(SUM(debit)-SUM(credit),2) difference
    FROM journal_entry_lines l JOIN journal_entries je ON je.id=l.journal_entry_id
   WHERE je.is_posted = 1`);

await new Promise((r) => db.close(r));
console.log("\ndone (no writes issued).");
