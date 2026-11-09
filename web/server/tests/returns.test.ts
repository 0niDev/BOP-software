import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InsufficientStockError, ValidationError } from "../src/domain/errors.js";
import { insertRow } from "../src/repositories/base.js";
import { AccountingService } from "../src/services/accountingService.js";
import { PurchaseInvoiceService } from "../src/services/purchaseInvoiceService.js";
import { ReportService } from "../src/services/reportService.js";
import { ReturnsService } from "../src/services/returnsService.js";
import { SalesInvoiceService } from "../src/services/salesInvoiceService.js";
import { freshDb, type TestContext } from "./helpers/db.js";

let ctx: TestContext;
let sales: SalesInvoiceService;
let purchases: PurchaseInvoiceService;
let returns: ReturnsService;
let accounting: AccountingService;
let supplierId: number;
let returnItemId: number;

beforeEach(async () => {
  ctx = await freshDb();
  sales = new SalesInvoiceService(ctx.db);
  purchases = new PurchaseInvoiceService(ctx.db);
  returns = new ReturnsService(ctx.db);
  accounting = new AccountingService(ctx.db);
  supplierId = await insertRow(ctx.db, "parties", {
    company_id: 1,
    code: "SUP-RET",
    name: "Return Supplier",
    party_type: "SUPPLIER",
    opening_balance: 0,
    credit_limit: 0,
    is_active: 1,
  });
  returnItemId = await insertRow(ctx.db, "items", {
    company_id: 1,
    item_code: "RET-ITEM",
    item_name: "Return Test Item",
    unit: "pcs",
    item_type: "FINISHED_GOOD",
    purchase_price: 50,
    selling_price: 70,
    is_active: 1,
  });
});
afterEach(async () => {
  await ctx.db.close();
});

describe("ReturnsService", () => {
  it("returns goods from a customer, restoring stock and reversing COGS", async () => {
    const result = await returns.createSalesReturn({
      partyId: ctx.ids.customerId,
      returnDate: "2026-10-09",
      items: [{ itemId: ctx.ids.itemId, quantity: 1, unitCost: 100 }],
    });
    expect(result.totalAmount).toBe(100);

    const je = await accounting.getJournalEntry("sales_returns", result.id);
    const lines = je!.lines as Array<{
      account_code: string;
      debit: number;
      credit: number;
      party_id: number | null;
    }>;
    expect(lines.find((l) => l.account_code === "4100")?.debit).toBe(100);
    expect(lines.find((l) => l.account_code === "1100")?.credit).toBe(100);
    expect(lines.find((l) => l.account_code === "1100")?.party_id).toBe(ctx.ids.customerId);
    expect(lines.find((l) => l.account_code === "1220")?.debit).toBe(100);
    expect(lines.find((l) => l.account_code === "5000")?.credit).toBe(100);
    expect(lines.reduce((a, l) => a + l.debit, 0)).toBe(
      lines.reduce((a, l) => a + l.credit, 0),
    );

    const batch = await ctx.db.get<{ qty: number; cost: number }>(
      "SELECT quantity_in_stock AS qty, purchase_price AS cost FROM stock_batches WHERE batch_number = ?",
      [`RET-${result.returnNumber}-1`],
    );
    expect(batch?.qty).toBe(1);
    expect(batch?.cost).toBe(100);

    // The party ledger shows the credit note.
    const ledger = await new ReportService(ctx.db).partyLedger(ctx.ids.customerId);
    expect(ledger.some((entry) => entry.voucherNumber === result.returnNumber)).toBe(true);
  });

  it("sends a wasted return to wastage expense without adding stock", async () => {
    const result = await returns.createSalesReturn({
      partyId: ctx.ids.customerId,
      returnDate: "2026-10-09",
      items: [
        { itemId: ctx.ids.itemId, quantity: 2, unitCost: 150, destination: "WASTE" },
      ],
    });
    expect(result.totalAmount).toBe(300);

    const je = await accounting.getJournalEntry("sales_returns", result.id);
    const lines = je!.lines as Array<{ account_code: string; debit: number; credit: number }>;
    expect(lines.find((l) => l.account_code === "5200")?.debit).toBe(300);
    expect(lines.find((l) => l.account_code === "5000")?.credit).toBe(300);
    expect(lines.find((l) => l.account_code === "1220")).toBeUndefined();

    const batch = await ctx.db.get(
      "SELECT id FROM stock_batches WHERE batch_number = ?",
      [`RET-${result.returnNumber}-1`],
    );
    expect(batch).toBeUndefined();
  });

  it("posts multiple lines with their own costs and destinations in one return", async () => {
    const result = await returns.createSalesReturn({
      partyId: ctx.ids.customerId,
      returnDate: "2026-10-09",
      items: [
        { itemId: ctx.ids.itemId, quantity: 2, unitCost: 100, destination: "INVENTORY" },
        { itemId: ctx.ids.itemId, quantity: 1, unitCost: 50, destination: "WASTE" },
      ],
    });
    expect(result.totalAmount).toBe(250);

    const detail = await returns.getSalesReturn(result.id);
    expect(detail.items).toHaveLength(2);
  });

  it("rejects a zero quantity line", async () => {
    await expect(
      returns.createSalesReturn({
        partyId: ctx.ids.customerId,
        returnDate: "2026-10-09",
        items: [{ itemId: ctx.ids.itemId, quantity: 0, unitCost: 100 }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("returns goods to a supplier, reducing stock and crediting AP", async () => {
    await purchases.createPurchaseInvoice({
      supplierId,
      invoiceDate: "2026-10-08",
      paymentType: "CREDIT",
      items: [{ itemId: returnItemId, quantity: 10, unitCost: 50, batchNumber: "RET-PUR" }],
    });
    const result = await returns.createPurchaseReturn({
      partyId: supplierId,
      returnDate: "2026-10-09",
      items: [{ itemId: returnItemId, quantity: 4, unitCost: 50 }],
    });
    expect(result.totalAmount).toBe(200);

    const je = await accounting.getJournalEntry("purchase_returns", result.id);
    const lines = je!.lines as Array<{
      account_code: string;
      debit: number;
      credit: number;
      party_id: number | null;
    }>;
    const ap = lines.find((l) => l.account_code === "2000")!;
    expect(ap.debit).toBe(200);
    expect(ap.party_id).toBe(supplierId);
    expect(lines.find((l) => l.account_code === "1220")?.credit).toBe(200);

    const batch = await ctx.db.get<{ qty: number }>(
      "SELECT quantity_in_stock AS qty FROM stock_batches WHERE batch_number = 'RET-PUR'",
    );
    expect(batch?.qty).toBe(6);
  });

  it("rejects a purchase return when there is not enough stock", async () => {
    await expect(
      returns.createPurchaseReturn({
        partyId: supplierId,
        returnDate: "2026-10-09",
        items: [{ itemId: returnItemId, quantity: 999, unitCost: 50 }],
      }),
    ).rejects.toBeInstanceOf(InsufficientStockError);
  });
});
