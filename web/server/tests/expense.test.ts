import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConflictError, ValidationError } from "../src/domain/errors.js";
import { AccountingService } from "../src/services/accountingService.js";
import { ExpenseService } from "../src/services/expenseService.js";
import { accountId, freshDb, type TestContext } from "./helpers/db.js";

let ctx: TestContext;
let expenses: ExpenseService;
let accounting: AccountingService;
let categoryId: number;

beforeEach(async () => {
  ctx = await freshDb();
  expenses = new ExpenseService(ctx.db);
  accounting = new AccountingService(ctx.db);
  const category = await expenses.createCategory("Office Supplies");
  categoryId = category.id;
});
afterEach(async () => {
  await ctx.db.close();
});

describe("ExpenseService", () => {
  it("records an expense to the default expense account and posts to cash", async () => {
    const result = await expenses.createExpense({
      categoryId,
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

  it("uses the category's own expense account when linked", async () => {
    const sellingId = await accountId(ctx.db, "6100");
    const category = await expenses.createCategory("Selling", sellingId);
    const result = await expenses.createExpense({
      categoryId: category.id,
      expenseDate: "2026-10-08",
      amount: 100,
      paymentMethod: "BANK",
    });
    const je = await accounting.getJournalEntry("expenses", result.id);
    const lines = je!.lines as Array<{ account_code: string; debit: number }>;
    expect(lines.find((l) => l.account_code === "6100")?.debit).toBe(100);
  });

  it("rejects a category linked to a non-expense account", async () => {
    const cashId = await accountId(ctx.db, "1000");
    await expect(expenses.createCategory("Bad", cashId)).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a duplicate expense voucher number", async () => {
    const base = {
      categoryId,
      expenseDate: "2026-10-08",
      amount: 10,
      paymentMethod: "CASH" as const,
      voucherNumber: "EV-MANUAL-1",
    };
    await expenses.createExpense(base);
    await expect(expenses.createExpense(base)).rejects.toBeInstanceOf(ConflictError);
  });
});
