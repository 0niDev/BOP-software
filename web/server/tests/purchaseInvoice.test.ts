import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConflictError } from "../src/domain/errors.js";
import { AccountingService } from "../src/services/accountingService.js";
import { PurchaseInvoiceService } from "../src/services/purchaseInvoiceService.js";
import { insertRow } from "../src/repositories/base.js";
import { freshDb, type TestContext } from "./helpers/db.js";

let ctx: TestContext;
let purchases: PurchaseInvoiceService;
let accounting: AccountingService;
let supplierId: number;

beforeEach(async () => {
  ctx = await freshDb();
  purchases = new PurchaseInvoiceService(ctx.db);
  accounting = new AccountingService(ctx.db);
  supplierId = await insertRow(ctx.db, "parties", {
    company_id: 1,
    code: "SUP-1",
    name: "Test Supplier",
    party_type: "SUPPLIER",
    opening_balance: 0,
    credit_limit: 0,
    is_active: 1,
  });
});
afterEach(async () => {
  await ctx.db.close();
});

async function batchQty(batchNumber: string): Promise<number> {
  const row = await ctx.db.get<{ qty: number }>(
    "SELECT quantity_in_stock AS qty FROM stock_batches WHERE batch_number = ?",
    [batchNumber],
  );
  return row?.qty ?? 0;
}

describe("PurchaseInvoiceService.createPurchaseInvoice", () => {
  it("creates a cash purchase, increases stock and posts a balanced entry", async () => {
    const result = await purchases.createPurchaseInvoice({
      supplierId,
      invoiceDate: "2026-10-08",
      paymentType: "CASH",
      items: [{ itemId: ctx.ids.itemId, quantity: 10, unitCost: 50, batchNumber: "PUR-1" }],
    });

    expect(result.totalAmount).toBe(500);
    expect(result.invoiceNumber).toMatch(/^PI-\d+$/);
    expect(await batchQty("PUR-1")).toBe(10);

    const je = await accounting.getJournalEntry("purchase_invoices", result.id);
    const lines = je!.lines as Array<{ account_code: string; debit: number; credit: number }>;
    const debit = lines.reduce((a, l) => a + l.debit, 0);
    const credit = lines.reduce((a, l) => a + l.credit, 0);
    expect(debit).toBe(credit);
    // Demo item is FINISHED_GOOD -> inventory account 1220.
    expect(lines.find((l) => l.account_code === "1220")?.debit).toBe(500);
    expect(lines.find((l) => l.account_code === "1000")?.credit).toBe(500);
  });

  it("credits accounts payable (with the supplier) for a credit purchase", async () => {
    const result = await purchases.createPurchaseInvoice({
      supplierId,
      invoiceDate: "2026-10-08",
      paymentType: "CREDIT",
      items: [{ itemId: ctx.ids.itemId, quantity: 4, unitCost: 100, batchNumber: "PUR-2" }],
    });
    const je = await accounting.getJournalEntry("purchase_invoices", result.id);
    const lines = je!.lines as Array<{ account_code: string; credit: number; party_id: number | null }>;
    const ap = lines.find((l) => l.account_code === "2000")!;
    expect(ap.credit).toBe(400);
    expect(ap.party_id).toBe(supplierId);
  });

  it("spreads input tax as a separate credit line", async () => {
    const result = await purchases.createPurchaseInvoice({
      supplierId,
      invoiceDate: "2026-10-08",
      paymentType: "CASH",
      items: [
        { itemId: ctx.ids.itemId, quantity: 1, unitCost: 500, taxAmount: 50, batchNumber: "PUR-3" },
      ],
    });
    expect(result.totalAmount).toBe(550);
    const je = await accounting.getJournalEntry("purchase_invoices", result.id);
    const lines = je!.lines as Array<{ account_code: string; debit: number; credit: number }>;
    // Faithful to the Python code: line_total (incl. tax) is debited to
    // inventory, and the input tax is credited back separately.
    expect(lines.find((l) => l.account_code === "1220")?.debit).toBe(550);
    expect(lines.find((l) => l.account_code === "2100")?.credit).toBe(50);
    expect(lines.find((l) => l.account_code === "1000")?.credit).toBe(500);
    expect(lines.reduce((a, l) => a + l.debit, 0)).toBe(
      lines.reduce((a, l) => a + l.credit, 0),
    );
  });

  it("adds to an existing batch when the batch number is reused", async () => {
    await purchases.createPurchaseInvoice({
      supplierId,
      invoiceDate: "2026-10-08",
      paymentType: "CASH",
      items: [{ itemId: ctx.ids.itemId, quantity: 10, unitCost: 50, batchNumber: "PUR-4" }],
    });
    await purchases.createPurchaseInvoice({
      supplierId,
      invoiceDate: "2026-10-08",
      paymentType: "CASH",
      items: [{ itemId: ctx.ids.itemId, quantity: 5, unitCost: 50, batchNumber: "PUR-4" }],
    });
    expect(await batchQty("PUR-4")).toBe(15);
  });

  it("rejects a duplicate explicit invoice number", async () => {
    const base = {
      supplierId,
      invoiceDate: "2026-10-08",
      paymentType: "CASH" as const,
      invoiceNumber: "P-MANUAL-1",
      items: [{ itemId: ctx.ids.itemId, quantity: 1, unitCost: 10, batchNumber: "PUR-5" }],
    };
    await purchases.createPurchaseInvoice(base);
    await expect(purchases.createPurchaseInvoice(base)).rejects.toBeInstanceOf(ConflictError);
  });
});
