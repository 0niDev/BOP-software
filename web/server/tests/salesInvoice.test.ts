import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConflictError, InsufficientStockError } from "../src/domain/errors.js";
import { insertRow } from "../src/repositories/base.js";
import { AccountingService } from "../src/services/accountingService.js";
import { ReportService } from "../src/services/reportService.js";
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
    expect(cash.party_id).toBe(ctx.ids.customerId);
    const revenue = lines.find((l) => l.account_code === "4000")!;
    expect(revenue.credit).toBe(750);
    expect(revenue.party_id).toBeNull();
    const cogs = lines.find((l) => l.account_code === "5000")!;
    expect(cogs.debit).toBe(500); // 5 units x 100 cost
    const inventory = lines.find((l) => l.account_code === "1220")!;
    expect(inventory.credit).toBe(500);

    // The cash sale shows in the party ledger as a settled row and does not
    // move the balance (the party owes nothing).
    const ledger = await new ReportService(ctx.db).partyLedger(ctx.ids.customerId);
    expect(ledger).toHaveLength(1);
    expect(ledger[0]?.settled).toBe(true);
    expect(ledger[0]?.debit).toBe(750);
    expect(ledger[0]?.balance).toBe(0);
  });

  it("splits a line across batches without repeating the line total", async () => {
    // Two batches so one line has to be consumed in two shares.
    const demo = await ctx.db.get<{ id: number }>(
      "SELECT id FROM stock_batches WHERE item_id = ? AND warehouse_id = 1",
      [ctx.ids.itemId],
    );
    await ctx.db.run("UPDATE stock_batches SET quantity_in_stock = 2 WHERE id = ?", [demo!.id]);
    await insertRow(ctx.db, "stock_batches", {
      item_id: ctx.ids.itemId,
      warehouse_id: 1,
      batch_number: "SPLIT-B",
      purchase_price: 100,
      raw_unit_cost: 100,
      packing_unit_cost: 0,
      quantity_in_stock: 10,
      is_active: 1,
    });

    const result = await sales.createSalesInvoice({
      customerId: ctx.ids.customerId,
      invoiceDate: "2026-10-08",
      paymentType: "CASH",
      items: [
        { itemId: ctx.ids.itemId, quantity: 5, unitPrice: 150, discountAmount: 10, taxAmount: 5 },
      ],
    });
    expect(result.totalAmount).toBe(745);

    const rows = await ctx.db.all<{
      quantity: number;
      line_total: number;
      discount_amount: number;
      tax_amount: number;
    }>(
      "SELECT quantity, line_total, discount_amount, tax_amount FROM sales_invoice_items WHERE invoice_id = ? ORDER BY id",
      [result.id],
    );
    expect(rows.map((r) => Number(r.quantity))).toEqual([2, 3]);
    const sum = (key: "line_total" | "discount_amount" | "tax_amount") =>
      rows.reduce((acc, r) => acc + Number(r[key]), 0);
    expect(sum("line_total")).toBe(745);
    expect(sum("discount_amount")).toBe(10);
    expect(sum("tax_amount")).toBe(5);
    for (const row of rows) {
      expect(Number(row.line_total)).toBeCloseTo(
        Number(row.quantity) * 150 - Number(row.discount_amount) + Number(row.tax_amount),
        2,
      );
    }

    // The party product sales report sums these rows, so it must match the
    // invoice instead of counting the line once per batch.
    const report = await new ReportService(ctx.db).partyProductSales();
    expect(report.grandTotal).toBe(745);
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

  it("can ignore stock when it has not been entered yet", async () => {
    const result = await sales.createSalesInvoice({
      customerId: ctx.ids.customerId,
      invoiceDate: "2026-10-08",
      paymentType: "CASH",
      ignoreStock: true,
      items: [{ itemId: ctx.ids.itemId, quantity: 10_000, unitPrice: 150 }],
    });

    expect(result.totalAmount).toBe(1_500_000);
    expect(await stockFor(ctx.ids.itemId)).toBe(1000); // untouched

    const je = await accounting.getJournalEntry("sales_invoices", result.id);
    const lines = je!.lines as Array<{ account_code: string; debit: number; credit: number }>;
    expect(lines.reduce((a, l) => a + l.debit, 0)).toBe(
      lines.reduce((a, l) => a + l.credit, 0),
    );
    expect(lines.find((l) => l.account_code === "5000")).toBeUndefined();
    expect(lines.find((l) => l.account_code === "1220")).toBeUndefined();

    const line = await ctx.db.get<{ batch_id: number | null }>(
      "SELECT batch_id FROM sales_invoice_items WHERE invoice_id = ?",
      [result.id],
    );
    expect(line?.batch_id).toBeNull();
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

  it("edits an invoice: reverses the old stock/entry and keeps the same id", async () => {
    const created = await sales.createSalesInvoice({
      customerId: ctx.ids.customerId,
      invoiceDate: "2026-10-08",
      paymentType: "CASH",
      items: [{ itemId: ctx.ids.itemId, quantity: 5, unitPrice: 150 }],
    });
    expect(await stockFor(ctx.ids.itemId)).toBe(995);

    const updated = await sales.updateSalesInvoice(created.id, {
      customerId: ctx.ids.customerId,
      invoiceDate: "2026-10-08",
      paymentType: "CASH",
      items: [{ itemId: ctx.ids.itemId, quantity: 2, unitPrice: 150 }],
    });
    expect(updated.id).toBe(created.id);
    expect(updated.invoiceNumber).toBe(created.invoiceNumber);
    expect(updated.totalAmount).toBe(300);
    expect(await stockFor(ctx.ids.itemId)).toBe(998);

    const je = await accounting.getJournalEntry("sales_invoices", created.id);
    const lines = je!.lines as Array<{ debit: number; credit: number }>;
    expect(lines.reduce((a, l) => a + l.debit, 0)).toBe(lines.reduce((a, l) => a + l.credit, 0));
  });

  it("does not deduct stock twice on a note-only edit", async () => {
    const created = await sales.createSalesInvoice({
      customerId: ctx.ids.customerId,
      invoiceDate: "2026-10-08",
      paymentType: "CASH",
      items: [{ itemId: ctx.ids.itemId, quantity: 5, unitPrice: 150 }],
    });
    await sales.updateSalesInvoice(created.id, {
      customerId: ctx.ids.customerId,
      invoiceDate: "2026-10-08",
      paymentType: "CASH",
      notes: "delivered to the warehouse",
      items: [{ itemId: ctx.ids.itemId, quantity: 5, unitPrice: 150 }],
    });
    expect(await stockFor(ctx.ids.itemId)).toBe(995);

    const movements = await ctx.db.all<{ quantity: number }>(
      "SELECT quantity FROM stock_movements WHERE reference_table = 'sales_invoices' AND reference_id = ?",
      [created.id],
    );
    expect(movements).toHaveLength(1);
    expect(movements[0]?.quantity).toBe(-5);
  });

  it("restores an invoice whose lines lost their batch link, from its movements", async () => {
    const created = await sales.createSalesInvoice({
      customerId: ctx.ids.customerId,
      invoiceDate: "2026-10-08",
      paymentType: "CASH",
      items: [{ itemId: ctx.ids.itemId, quantity: 5, unitPrice: 150 }],
    });
    // An older invoice records the stock movement but not the line's batch.
    await ctx.db.run("UPDATE sales_invoice_items SET batch_id = NULL WHERE invoice_id = ?", [
      created.id,
    ]);

    await sales.updateSalesInvoice(created.id, {
      customerId: ctx.ids.customerId,
      invoiceDate: "2026-10-08",
      paymentType: "CASH",
      notes: "note only",
      items: [{ itemId: ctx.ids.itemId, quantity: 5, unitPrice: 150 }],
    });
    expect(await stockFor(ctx.ids.itemId)).toBe(995);
  });

  it("keeps an ignore-stock invoice out of stock when it is edited", async () => {
    const created = await sales.createSalesInvoice({
      customerId: ctx.ids.customerId,
      invoiceDate: "2026-10-08",
      paymentType: "CASH",
      ignoreStock: true,
      items: [{ itemId: ctx.ids.itemId, quantity: 5, unitPrice: 150 }],
    });
    expect((await sales.getById(created.id)).stockApplied).toBe(false);

    await sales.updateSalesInvoice(created.id, {
      customerId: ctx.ids.customerId,
      invoiceDate: "2026-10-08",
      paymentType: "CASH",
      ignoreStock: true,
      notes: "note only",
      items: [{ itemId: ctx.ids.itemId, quantity: 5, unitPrice: 150 }],
    });
    expect(await stockFor(ctx.ids.itemId)).toBe(1000);
  });

  it("cancels an invoice: restores stock and removes its journal entry", async () => {
    const created = await sales.createSalesInvoice({
      customerId: ctx.ids.customerId,
      invoiceDate: "2026-10-08",
      paymentType: "CASH",
      items: [{ itemId: ctx.ids.itemId, quantity: 5, unitPrice: 150 }],
    });
    await sales.deleteSalesInvoice(created.id);

    expect(await stockFor(ctx.ids.itemId)).toBe(1000);
    expect(await accounting.getJournalEntry("sales_invoices", created.id)).toBeNull();
    const row = await ctx.db.get<{ status: string }>(
      "SELECT status FROM sales_invoices WHERE id = ?",
      [created.id],
    );
    expect(row?.status).toBe("CANCELLED");
  });
});
