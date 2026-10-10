/**
 * Deterministic demo data used by `npm run seed` and the HTTP smoke test.
 * Idempotent: looks up by code and only inserts what is missing. Only ever
 * run against the local development database.
 */
import { bootstrapDatabase } from "./db/bootstrap.js";
import type { SqlDatabase } from "./db/types.js";
import { insertRow } from "./repositories/base.js";

export const DEMO_CUSTOMER_CODE = "DEMO-CUST";
export const DEMO_SUPPLIER_CODE = "DEMO-SUPP";
export const DEMO_ITEM_CODE = "DEMO-FG";

export interface DemoIds {
  customerId: number;
  supplierId: number;
  itemId: number;
  batchId: number;
}

export async function seedDemoData(db: SqlDatabase, companyId = 1): Promise<DemoIds> {
  await bootstrapDatabase(db);

  let customer = await db.get<{ id: number }>(
    "SELECT id FROM parties WHERE company_id = ? AND code = ?",
    [companyId, DEMO_CUSTOMER_CODE],
  );
  if (!customer) {
    const id = await insertRow(db, "parties", {
      company_id: companyId,
      code: DEMO_CUSTOMER_CODE,
      name: "Demo Customer",
      party_type: "CUSTOMER",
      opening_balance: 0,
      credit_limit: 0,
      is_active: 1,
    });
    customer = { id };
  }

  let supplier = await db.get<{ id: number }>(
    "SELECT id FROM parties WHERE company_id = ? AND code = ?",
    [companyId, DEMO_SUPPLIER_CODE],
  );
  if (!supplier) {
    const id = await insertRow(db, "parties", {
      company_id: companyId,
      code: DEMO_SUPPLIER_CODE,
      name: "Demo Supplier",
      party_type: "SUPPLIER",
      opening_balance: 0,
      credit_limit: 0,
      is_active: 1,
    });
    supplier = { id };
  }

  let item = await db.get<{ id: number }>(
    "SELECT id FROM items WHERE company_id = ? AND item_code = ?",
    [companyId, DEMO_ITEM_CODE],
  );
  if (!item) {
    const id = await insertRow(db, "items", {
      company_id: companyId,
      item_code: DEMO_ITEM_CODE,
      item_name: "Demo Finished Good",
      unit: "UNIT",
      item_type: "FINISHED_GOOD",
      purchase_price: 100,
      selling_price: 150,
      minimum_stock: 0,
      maximum_stock: 0,
      is_active: 1,
    });
    item = { id };
  }

  let batch = await db.get<{ id: number }>(
    "SELECT id FROM stock_batches WHERE item_id = ? AND warehouse_id = 1 AND batch_number = 'DEMO-BATCH'",
    [item.id],
  );
  if (!batch) {
    const id = await insertRow(db, "stock_batches", {
      item_id: item.id,
      warehouse_id: 1,
      batch_number: "DEMO-BATCH",
      raw_unit_cost: 60,
      packing_unit_cost: 40,
      purchase_price: 100,
      quantity_in_stock: 1000,
      is_active: 1,
    });
    batch = { id };
  }

  return { customerId: customer.id, supplierId: supplier.id, itemId: item.id, batchId: batch.id };
}
