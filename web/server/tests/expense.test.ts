import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConflictError, NotFoundError, ValidationError } from "../src/domain/errors.js";
import { insertRow } from "../src/repositories/base.js";
import { AccountingService } from "../src/services/accountingService.js";
import { ExpenseService } from "../src/services/expenseService.js";
import { accountId, freshDb, type TestContext } from "./helpers/db.js";

let ctx: TestContext;
let expenses: ExpenseService;
let accounting: AccountingService;
let generalId: number;

beforeEach(async () => {
  ctx = await freshDb();
  expenses = new ExpenseService(ctx.db);
  accounting = new AccountingService(ctx.db);
  generalId = await accountId(ctx.db, "6000");
});
afterEach(async () => {
  await ctx.db.close();
});

describe("ExpenseService", () => {
  it("records an expense to the chosen account and posts to cash", async () => {
    const result = await expenses.createExpense({
      accountId: generalId,
      expenseDate: "2026-10-08",
      amount: 250,
      paymentMethod: "CASH",
    });
    expect(result.voucherNumber).toMatch(/^EV-\d+$/);

    const je = await accounting.getJournalEntry("expenses", result.id);
    const lines = je!.lines as Array<{ account_code: string; debit: number; credit: number }>;
    expect(lines.find((l) => l.account_code === "6000")?.debit).toBe(250);
    expect(lines.find((l) => l.account_code === "1000")?.credit).toBe(250);
    expect(lines.reduce((a, l) => a + l.debit, 0)).toBe(
      lines.reduce((a, l) => a + l.credit, 0),
    );
  });

  it("falls back to General & Administrative (6000) when no account is chosen", async () => {
    const result = await expenses.createExpense({
      expenseDate: "2026-10-08",
      amount: 75,
      paymentMethod: "CASH",
    });
    const je = await accounting.getJournalEntry("expenses", result.id);
    const lines = je!.lines as Array<{ account_code: string; debit: number }>;
    expect(lines.find((l) => l.account_code === "6000")?.debit).toBe(75);
  });

  it("allows posting to an account that has sub-accounts", async () => {
    const sellingId = await accountId(ctx.db, "6100");
    await insertRow(ctx.db, "accounts", {
      company_id: 1,
      account_code: "6101",
      account_name: "Salesman Salary",
      parent_account_id: sellingId,
      account_type: "EXPENSE",
      opening_balance: 0,
      is_active: 1,
    });

    // 6100 is now a header (has sub-accounts) and must still accept postings.
    const result = await expenses.createExpense({
      accountId: sellingId,
      expenseDate: "2026-10-08",
      amount: 100,
      paymentMethod: "BANK",
    });
    const je = await accounting.getJournalEntry("expenses", result.id);
    const lines = je!.lines as Array<{ account_code: string; debit: number }>;
    expect(lines.find((l) => l.account_code === "6100")?.debit).toBe(100);
  });

  it("rejects a non-expense account", async () => {
    const cashId = await accountId(ctx.db, "1000");
    await expect(
      expenses.createExpense({
        accountId: cashId,
        expenseDate: "2026-10-08",
        amount: 10,
        paymentMethod: "CASH",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a duplicate expense voucher number", async () => {
    const base = {
      accountId: generalId,
      expenseDate: "2026-10-08",
      amount: 10,
      paymentMethod: "CASH" as const,
      voucherNumber: "EV-MANUAL-1",
    };
    await expenses.createExpense(base);
    await expect(expenses.createExpense(base)).rejects.toBeInstanceOf(ConflictError);
  });

  it("resolves a legacy categoryId (pre-account audit payload) to the category account", async () => {
    const sellingId = await accountId(ctx.db, "6100");
    const category = await insertRow(ctx.db, "expense_categories", {
      company_id: 1,
      name: "Legacy Selling",
      account_id: sellingId,
      is_active: 1,
    });

    const result = await expenses.createExpense({
      categoryId: category,
      expenseDate: "2026-10-08",
      amount: 40,
      paymentMethod: "CASH",
    });
    const je = await accounting.getJournalEntry("expenses", result.id);
    const lines = je!.lines as Array<{ account_code: string; debit: number }>;
    expect(lines.find((l) => l.account_code === "6100")?.debit).toBe(40);
  });

  it("records a pay-later bill on accounts payable and settles it exactly once", async () => {
    const bill = await expenses.createExpense({
      accountId: generalId,
      expenseDate: "2026-10-01",
      amount: 500,
      paymentMethod: "BANK",
      payLater: true,
      dueDate: "2026-10-31",
    });

    const [row] = await expenses.listExpenses();
    expect(row.status).toBe("UNPAID");
    expect(row.due_date).toBe("2026-10-31");
    expect(row.settlement_journal_entry_id).toBeNull();
    expect(row.ledger_code).toBe("6000");

    const billJe = await accounting.getJournalEntry("expenses", bill.id);
    const billLines = billJe!.lines as Array<{ account_code: string; debit: number; credit: number }>;
    expect(billLines.find((l) => l.account_code === "6000")?.debit).toBe(500);
    expect(billLines.find((l) => l.account_code === "2000")?.credit).toBe(500);
    expect(billLines.find((l) => l.account_code === "1010")).toBeUndefined();

    const settled = await expenses.payExpense(bill.id, {
      paymentMethod: "BANK",
      paymentDate: "2026-10-05",
    });
    const settleJe = await accounting.getJournalEntry("expense_settlements", bill.id);
    const settleLines = settleJe!.lines as Array<{
      account_code: string;
      debit: number;
      credit: number;
    }>;
    expect(settleLines.find((l) => l.account_code === "2000")?.debit).toBe(500);
    expect(settleLines.find((l) => l.account_code === "1010")?.credit).toBe(500);

    const [paid] = await expenses.listExpenses();
    expect(paid.status).toBe("PAID");
    expect(paid.settlement_journal_entry_id).toBe(settled.journalEntryId);

    // One full payment per bill: a second attempt is refused.
    await expect(expenses.payExpense(bill.id, { paymentMethod: "CASH" })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("refuses to settle an unknown expense", async () => {
    await expect(
      expenses.payExpense(999_999, { paymentMethod: "CASH" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
