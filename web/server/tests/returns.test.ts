import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ValidationError } from "../src/domain/errors.js";
import { insertRow } from "../src/repositories/base.js";
import { AccountingService } from "../src/services/accountingService.js";
import { PurchaseInvoiceService } from "../src/services/purchaseInvoiceService.js";
import { ReturnsService } from "../src/services/returnsService.js";
import { SalesInvoiceService } from "../src/services/salesInvoiceService.js";
import { freshDb, type TestContext } from "./helpers/db.js";

let ctx: TestContext;
let sales: SalesInvoiceService;
let purchases: PurchaseInvoiceService;
let returns: ReturnsService;
let accounting: AccountingService;
let supplierId: number;

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
});
afterEach(async () => {
  await ctx.db.close();
});

describe("ReturnsService", () => {
  it("returns goods against a credit sale, restoring stock and reversing COGS", async () => {
    const invoice = await sales.createSalesInvoice({
      customerId: ctx.ids.customerId,
      invoiceDate: "2026-10-08",
      paymentType: "CREDIT",
      items: [{ itemId: ctx.ids.itemId, quantity: 2, unitPrice: 150 }],
    });
    const items = await ctx.db.all<{ id: number }>(
      "SELECT id FROM sales_invoice_items WHERE invoice_id = ?",
      [invoice.id],
    );
    const result = await returns.createSalesReturn({
      invoiceId: invoice.id,
      returnDate: "2026-10-09",
      items: [{ invoiceItemId: items[0]!.id, quantity: 1 }],
    });
    expect(result.totalAmount).toBe(150);

    const je = await accounting.getJournalEntry("sales_returns", result.id);
    const lines = je!.lines as Array<{ account_code: string; debit: number; credit: number }>;
    expect(lines.find((l) => l.account_code === "4100")?.debit).toBe(150);
    expect(lines.find((l) => l.account_code === "1100")?.credit).toBe(150);
    expect(lines.find((l) => l.account_code === "1220")?.debit).toBe(100);
    expect(lines.find((l) => l.account_code === "5000")?.credit).toBe(100);
    expect(lines.reduce((a, l) => a + l.debit, 0)).toBe(
      lines.reduce((a, l) => a + l.credit, 0),
    );

    // Stock was 1000 - 2 = 998, then +1 restored = 999.
    const batch = await ctx.db.get<{ qty: number }>(
      "SELECT quantity_in_stock AS qty FROM stock_batches WHERE batch_number = 'DEMO-BATCH'",
    );
    expect(batch?.qty).toBe(999);
  });

  it("rejects returning more than was sold", async () => {
    const invoice = await sales.createSalesInvoice({
      customerId: ctx.ids.customerId,
      invoiceDate: "2026-10-08",
      paymentType: "CASH",
      items: [{ itemId: ctx.ids.itemId, quantity: 1, unitPrice: 150 }],
    });
    const items = await ctx.db.all<{ id: number }>(
      "SELECT id FROM sales_invoice_items WHERE invoice_id = ?",
      [invoice.id],
    );
    await expect(
      returns.createSalesReturn({
        invoiceId: invoice.id,
        returnDate: "2026-10-09",
        items: [{ invoiceItemId: items[0]!.id, quantity: 5 }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("returns goods to a supplier, reducing stock and crediting AP", async () => {
    const purchase = await purchases.createPurchaseInvoice({
      supplierId,
      invoiceDate: "2026-10-08",
      paymentType: "CREDIT",
      items: [{ itemId: ctx.ids.itemId, quantity: 10, unitCost: 50, batchNumber: "RET-PUR" }],
    });
    const items = await ctx.db.all<{ id: number }>(
      "SELECT id FROM purchase_invoice_items WHERE invoice_id = ?",
      [purchase.id],
    );
    const result = await returns.createPurchaseReturn({
      invoiceId: purchase.id,
      returnDate: "2026-10-09",
      items: [{ invoiceItemId: items[0]!.id, quantity: 4 }],
    });
    expect(result.totalAmount).toBe(200);

    const je = await accounting.getJournalEntry("purchase_returns", result.id);
    const lines = je!.lines as Array<{ account_code: string; debit: number; credit: number; party_id: number | null }>;
    const ap = lines.find((l) => l.account_code === "2000")!;
    expect(ap.debit).toBe(200);
    expect(ap.party_id).toBe(supplierId);
    expect(lines.find((l) => l.account_code === "1220")?.credit).toBe(200);

    const batch = await ctx.db.get<{ qty: number }>(
      "SELECT quantity_in_stock AS qty FROM stock_batches WHERE batch_number = 'RET-PUR'",
    );
    expect(batch?.qty).toBe(6);
  });
});
