import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConflictError, InsufficientStockError } from "../src/domain/errors.js";
import { AccountingService } from "../src/services/accountingService.js";
import { SalesInvoiceService } from "../src/services/salesInvoiceService.js";
import { freshDb, type TestContext } from "./helpers/db.js";

let ctx: TestContext;
let sales: SalesInvoiceService;
let accounting: AccountingService;

beforeEach(async () => {
  ctx = await freshDb();
  sales = new SalesInvoiceService(ctx.db);
  accounting = new AccountingService(ctx.db);
});
afterEach(async () => {
  await ctx.db.close();
});

async function stockFor(itemId: number): Promise<number> {
  const row = await ctx.db.get<{ qty: number }>(
    "SELECT quantity_in_stock AS qty FROM stock_batches WHERE item_id = ? AND warehouse_id = 1",
    [itemId],
  );
  return row?.qty ?? 0;
}

describe("SalesInvoiceService.createSalesInvoice", () => {
  it("creates a cash invoice, reduces stock and posts a balanced entry", async () => {
    const result = await sales.createSalesInvoice({
      customerId: ctx.ids.customerId,
      invoiceDate: "2026-10-08",
      paymentType: "CASH",
      items: [{ itemId: ctx.ids.itemId, quantity: 5, unitPrice: 150 }],
    });

    expect(result.totalAmount).toBe(750);
    expect(result.invoiceNumber).toMatch(/^SI-\d+$/);
    expect(await stockFor(ctx.ids.itemId)).toBe(995);

    const je = await accounting.getJournalEntry("sales_invoices", result.id);
    const lines = je!.lines as Array<{ account_code: string; debit: number; credit: number; party_id: number | null }>;
    const debit = lines.reduce((a, l) => a + l.debit, 0);
    const credit = lines.reduce((a, l) => a + l.credit, 0);
    expect(debit).toBe(credit);

    const cash = lines.find((l) => l.account_code === "1000")!;
    expect(cash.debit).toBe(750);
    const revenue = lines.find((l) => l.account_code === "4000")!;
    expect(revenue.credit).toBe(750);
    const cogs = lines.find((l) => l.account_code === "5000")!;
    expect(cogs.debit).toBe(500); // 5 units x 100 cost
    const inventory = lines.find((l) => l.account_code === "1220")!;
    expect(inventory.credit).toBe(500);
  });

  it("posts to accounts receivable (with the customer) for a credit sale", async () => {
    const result = await sales.createSalesInvoice({
      customerId: ctx.ids.customerId,
      invoiceDate: "2026-10-08",
      paymentType: "CREDIT",
      items: [{ itemId: ctx.ids.itemId, quantity: 2, unitPrice: 150 }],
    });
    const je = await accounting.getJournalEntry("sales_invoices", result.id);
    const lines = je!.lines as Array<{ account_code: string; debit: number; party_id: number | null }>;
    const ar = lines.find((l) => l.account_code === "1100")!;
    expect(ar.debit).toBe(300);
    expect(ar.party_id).toBe(ctx.ids.customerId);

    const row = await ctx.db.get<{ paid_amount: number }>(
      "SELECT paid_amount FROM sales_invoices WHERE id = ?",
      [result.id],
    );
    expect(row?.paid_amount).toBe(0);
  });

  it("includes sales tax as its own credit line", async () => {
    const result = await sales.createSalesInvoice({
      customerId: ctx.ids.customerId,
      invoiceDate: "2026-10-08",
      paymentType: "CASH",
      items: [{ itemId: ctx.ids.itemId, quantity: 1, unitPrice: 100, taxAmount: 17 }],
    });
    expect(result.totalAmount).toBe(117);
    const je = await accounting.getJournalEntry("sales_invoices", result.id);
    const lines = je!.lines as Array<{ account_code: string; credit: number }>;
    expect(lines.find((l) => l.account_code === "2100")?.credit).toBe(17);
  });

  it("refuses to sell more than is in stock", async () => {
    await expect(
      sales.createSalesInvoice({
        customerId: ctx.ids.customerId,
        invoiceDate: "2026-10-08",
        paymentType: "CASH",
        items: [{ itemId: ctx.ids.itemId, quantity: 10_000, unitPrice: 150 }],
      }),
    ).rejects.toBeInstanceOf(InsufficientStockError);
    expect(await stockFor(ctx.ids.itemId)).toBe(1000); // unchanged (rolled back)
  });

  it("rejects a duplicate explicit invoice number", async () => {
    await sales.createSalesInvoice({
      customerId: ctx.ids.customerId,
      invoiceDate: "2026-10-08",
      paymentType: "CASH",
      invoiceNumber: "MANUAL-1",
      items: [{ itemId: ctx.ids.itemId, quantity: 1, unitPrice: 150 }],
    });
    await expect(
      sales.createSalesInvoice({
        customerId: ctx.ids.customerId,
        invoiceDate: "2026-10-08",
        paymentType: "CASH",
        invoiceNumber: "MANUAL-1",
        items: [{ itemId: ctx.ids.itemId, quantity: 1, unitPrice: 150 }],
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
