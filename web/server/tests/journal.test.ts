import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UnbalancedJournalEntryError, ValidationError } from "../src/domain/errors.js";
import { AccountingService } from "../src/services/accountingService.js";
import { ExpenseService } from "../src/services/expenseService.js";
import { accountId, freshDb, type TestContext } from "./helpers/db.js";

let ctx: TestContext;
let accounting: AccountingService;
let cashId: number;
let revenueId: number;

beforeEach(async () => {
  ctx = await freshDb();
  accounting = new AccountingService(ctx.db);
  cashId = await accountId(ctx.db, "1000");
  revenueId = await accountId(ctx.db, "4000");
});
afterEach(async () => {
  await ctx.db.close();
});

type Line = { account_code: string; debit: number; credit: number };

describe("manual journal vouchers", () => {
  it("posts a balanced voucher, numbers it JV- and lists it", async () => {
    const created = await accounting.createManualJournal({
      entryDate: "2026-10-20",
      narration: "Owner adjustment",
      lines: [
        { accountId: cashId, debit: 150 },
        { accountId: revenueId, credit: 150 },
      ],
    });
    expect(created.voucherNumber).toMatch(/^JV-\d+$/);

    const je = await accounting.getJournalEntry("journal_entries", created.id);
    const lines = je!.lines as Line[];
    expect(lines.find((l) => l.account_code === "1000")?.debit).toBe(150);
    expect(lines.find((l) => l.account_code === "4000")?.credit).toBe(150);

    const list = await accounting.listManualJournals();
    expect(list).toHaveLength(1);
    expect(list[0]!.voucher_number).toBe(created.voucherNumber);
    expect(Number(list[0]!.total_debit)).toBe(150);
    expect(Number(list[0]!.line_count)).toBe(2);
  });

  it("rejects an unbalanced voucher", async () => {
    await expect(
      accounting.createManualJournal({
        entryDate: "2026-10-20",
        lines: [
          { accountId: cashId, debit: 100 },
          { accountId: revenueId, credit: 90 },
        ],
      }),
    ).rejects.toBeInstanceOf(UnbalancedJournalEntryError);
  });

  it("rejects a line with neither a debit nor a credit", async () => {
    await expect(
      accounting.createManualJournal({
        entryDate: "2026-10-20",
        lines: [
          { accountId: cashId, debit: 100 },
          { accountId: revenueId, credit: 100 },
          { accountId: revenueId },
        ],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("does not list entries posted by another document", async () => {
    const expenses = new ExpenseService(ctx.db);
    const category = await expenses.createCategory("Office");
    await expenses.createExpense({
      categoryId: category.id,
      expenseDate: "2026-10-20",
      amount: 40,
      paymentMethod: "CASH",
    });
    expect(await accounting.listManualJournals()).toHaveLength(0);
  });

  it("reverses a manual voucher by posting the opposite lines", async () => {
    const created = await accounting.createManualJournal({
      entryDate: "2026-10-20",
      narration: "Accrual",
      lines: [
        { accountId: cashId, debit: 200 },
        { accountId: revenueId, credit: 200 },
      ],
    });

    const reversal = await accounting.reverseManualJournal(created.id, {
      reversalDate: "2026-10-31",
    });
    expect(reversal.voucherNumber).toMatch(/^JV-\d+$/);
    expect(reversal.voucherNumber).not.toBe(created.voucherNumber);

    const je = await accounting.getJournalEntry("journal_entries", reversal.id);
    const lines = je!.lines as Line[];
    expect(lines.find((l) => l.account_code === "1000")?.credit).toBe(200);
    expect(lines.find((l) => l.account_code === "4000")?.debit).toBe(200);
    expect(je!.reference_no).toBe(created.voucherNumber);

    // Both entries stay in the ledger; their net effect is zero.
    expect(await accounting.listManualJournals()).toHaveLength(2);
    expect(await accounting.getAccountBalance(cashId)).toBe(0);
  });

  it("posts to a level-3 header account, and reverses it", async () => {
    const bankId = await accountId(ctx.db, "1010");
    // Turn 1000 into a header (the level-3 "group" a voucher may post to).
    await ctx.db.run("UPDATE accounts SET parent_account_id = ? WHERE id = ?", [cashId, bankId]);

    const created = await accounting.createManualJournal({
      entryDate: "2026-10-20",
      narration: "Transfer to the cash group",
      lines: [
        { accountId: cashId, debit: 90 },
        { accountId: revenueId, credit: 90 },
      ],
    });
    expect(await accounting.getAccountBalance(cashId)).toBe(90);

    const reversal = await accounting.reverseManualJournal(created.id, {
      reversalDate: "2026-10-21",
    });
    expect(reversal.voucherNumber).toMatch(/^JV-\d+$/);
    expect(await accounting.getAccountBalance(cashId)).toBe(0);
  });

  it("refuses to reverse an entry owned by another document", async () => {
    const expenses = new ExpenseService(ctx.db);
    const category = await expenses.createCategory("Office");
    const bill = await expenses.createExpense({
      categoryId: category.id,
      expenseDate: "2026-10-20",
      amount: 75,
      paymentMethod: "CASH",
    });
    const je = await accounting.getJournalEntry("expenses", bill.id);
    await expect(
      accounting.reverseManualJournal(Number(je!.id)),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a duplicate manual voucher number", async () => {
    const base = {
      entryDate: "2026-10-20",
      voucherNumber: "JV-MANUAL-1",
      lines: [
        { accountId: cashId, debit: 10 },
        { accountId: revenueId, credit: 10 },
      ],
    };
    await accounting.createManualJournal(base);
    await expect(accounting.createManualJournal(base)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});
