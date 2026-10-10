import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ValidationError } from "../src/domain/errors.js";
import { insertRow } from "../src/repositories/base.js";
import { PaymentService } from "../src/services/paymentService.js";
import { SalesInvoiceService } from "../src/services/salesInvoiceService.js";
import { freshDb, type TestContext } from "./helpers/db.js";

interface Line {
  account_code: string;
  debit: number;
  credit: number;
  party_id: number | null;
}

let ctx: TestContext;
let payments: PaymentService;
let sales: SalesInvoiceService;
let supplierId: number;

beforeEach(async () => {
  ctx = await freshDb();
  payments = new PaymentService(ctx.db);
  sales = new SalesInvoiceService(ctx.db);
  supplierId = await insertRow(ctx.db, "parties", {
    company_id: 1,
    code: "SUP-P1",
    name: "Payment Supplier",
    party_type: "SUPPLIER",
    opening_balance: 0,
    credit_limit: 0,
    is_active: 1,
  });
});
afterEach(async () => {
  await ctx.db.close();
});

async function linesForVoucher(voucherNumber: string): Promise<Line[]> {
  const entry = await ctx.db.get<{ id: number }>(
    "SELECT id FROM journal_entries WHERE voucher_number = ?",
    [voucherNumber],
  );
  if (!entry) return [];
  return ctx.db.all<Line>(
    `SELECT a.account_code, l.debit, l.credit, l.party_id
     FROM journal_entry_lines l JOIN accounts a ON a.id = l.account_id
     WHERE l.journal_entry_id = ? ORDER BY l.line_order`,
    [entry.id],
  );
}

describe("PaymentService", () => {
  it("pays a supplier: debits AP with the supplier, credits cash", async () => {
    const result = await payments.paySupplier({
      supplierId,
      amount: 200,
      paymentDate: "2026-10-08",
      paymentMethod: "CASH",
    });
    expect(result.voucherNumber).toMatch(/^PV-\d+$/);

    const lines = await linesForVoucher(result.voucherNumber);
    const ap = lines.find((l) => l.account_code === "2000")!;
    expect(ap.debit).toBe(200);
    expect(ap.party_id).toBe(supplierId);
    expect(lines.find((l) => l.account_code === "1000")?.credit).toBe(200);
  });

  it("receives from a customer: debits bank, credits AR with the customer", async () => {
    const result = await payments.receivePayment({
      customerId: ctx.ids.customerId,
      amount: 300,
      paymentDate: "2026-10-08",
      paymentMethod: "BANK",
    });
    expect(result.voucherNumber).toMatch(/^RV-\d+$/);
    const lines = await linesForVoucher(result.voucherNumber);
    expect(lines.find((l) => l.account_code === "1010")?.debit).toBe(300);
    const ar = lines.find((l) => l.account_code === "1100")!;
    expect(ar.credit).toBe(300);
    expect(ar.party_id).toBe(ctx.ids.customerId);
  });

  it("applies a receipt against a credit invoice and blocks over-collection", async () => {
    const invoice = await sales.createSalesInvoice({
      customerId: ctx.ids.customerId,
      invoiceDate: "2026-10-08",
      paymentType: "CREDIT",
      items: [{ itemId: ctx.ids.itemId, quantity: 2, unitPrice: 150 }],
    });
    expect(invoice.totalAmount).toBe(300);

    await payments.receivePayment({
      customerId: ctx.ids.customerId,
      amount: 300,
      paymentDate: "2026-10-08",
      paymentMethod: "CASH",
      salesInvoiceId: invoice.id,
    });
    const row = await ctx.db.get<{ paid_amount: number }>(
      "SELECT paid_amount FROM sales_invoices WHERE id = ?",
      [invoice.id],
    );
    expect(row?.paid_amount).toBe(300);

    await expect(
      payments.receivePayment({
        customerId: ctx.ids.customerId,
        amount: 50,
        paymentDate: "2026-10-08",
        paymentMethod: "CASH",
        salesInvoiceId: invoice.id,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuses to collect against a cash invoice", async () => {
    const invoice = await sales.createSalesInvoice({
      customerId: ctx.ids.customerId,
      invoiceDate: "2026-10-08",
      paymentType: "CASH",
      items: [{ itemId: ctx.ids.itemId, quantity: 1, unitPrice: 150 }],
    });
    await expect(
      payments.receivePayment({
        customerId: ctx.ids.customerId,
        amount: 10,
        paymentDate: "2026-10-08",
        paymentMethod: "CASH",
        salesInvoiceId: invoice.id,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
