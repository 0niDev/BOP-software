import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConflictError, NotFoundError, ValidationError } from "../src/domain/errors.js";
import { ExpenseItemService } from "../src/services/expenseItemService.js";
import { ExpenseService } from "../src/services/expenseService.js";
import { ReportService } from "../src/services/reportService.js";
import { closeDb, freshDb, type TestContext } from "./helpers/db.js";

let ctx: TestContext;
let items: ExpenseItemService;
let expenses: ExpenseService;
let reports: ReportService;
let utilitiesId: number;
let salariesId: number;

beforeEach(async () => {
  ctx = await freshDb();
  items = new ExpenseItemService(ctx.db);
  expenses = new ExpenseService(ctx.db);
  reports = new ReportService(ctx.db);
  utilitiesId = (await expenses.createCategory("Utilities")).id;
  salariesId = (await expenses.createCategory("Salaries")).id;
});
afterEach(async () => {
  await closeDb(ctx.db);
});

describe("ExpenseItemService", () => {
  it("creates, lists, updates and deactivates items per category", async () => {
    const electricity = await items.create({ categoryId: utilitiesId, name: "  Electricity  ", amount: 0 });
    const water = await items.create({ categoryId: utilitiesId, name: "Water" });
    await items.create({ categoryId: salariesId, name: "Editor" });

    expect(electricity.name).toBe("Electricity");
    expect(electricity.company_id).toBe(1);
    expect(await items.list({ categoryId: utilitiesId })).toHaveLength(2);
    expect(await items.list({ categoryId: salariesId })).toHaveLength(1);
    expect(await items.list()).toHaveLength(3);

    const updated = await items.update(water.id, { name: "Water Bill", amount: 1_200 });
    expect(updated.name).toBe("Water Bill");
    expect(updated.amount).toBe(1_200);
    expect(updated.updated_at).not.toBeNull();

    await items.deactivate(water.id);
    expect((await items.list({ categoryId: utilitiesId })).map((i) => i.id)).toEqual([
      electricity.id,
    ]);
    expect(await items.list({ categoryId: utilitiesId, activeOnly: false })).toHaveLength(2);

    // Empty patch returns the row unchanged; unknown id is a 404.
    expect((await items.update(water.id, {})).id).toBe(water.id);
    await expect(items.update(999_999, { amount: 1 })).rejects.toBeInstanceOf(NotFoundError);
    await expect(items.deactivate(999_999)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("validates name, amount, category and duplicates", async () => {
    await expect(items.create({ categoryId: utilitiesId, name: "   " })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      items.create({ categoryId: utilitiesId, name: "Bad", amount: -1 }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      items.create({ categoryId: 999_999, name: "Ghost Category" }),
    ).rejects.toBeInstanceOf(ValidationError);

    await items.create({ categoryId: utilitiesId, name: "Rent" });
    await expect(items.create({ categoryId: utilitiesId, name: "Rent" })).rejects.toBeInstanceOf(
      ConflictError,
    );
    // The same name in a different category is fine (UNIQUE is per category).
    await items.create({ categoryId: salariesId, name: "Rent" });
  });

  it("pays selected items with one expense voucher each and updates the item amounts", async () => {
    const electricity = await items.create({ categoryId: utilitiesId, name: "Electricity" });
    const rent = await items.create({ categoryId: utilitiesId, name: "Rent" });
    const internet = await items.create({ categoryId: utilitiesId, name: "Internet" });

    const result = await items.payItems({
      categoryId: utilitiesId,
      paymentMethod: "CASH",
      expenseDate: "2026-10-09",
      selections: [
        { itemId: electricity.id, amount: 1_500 },
        { itemId: rent.id, amount: 25_000 },
        { itemId: internet.id, amount: 0 }, // skipped: zero
      ],
    });

    expect(result.voucherNumbers).toHaveLength(2);
    expect(result.totalPaid).toBe(26_500);
    expect(result.voucherNumbers.every((v) => /^EV-\d{5}$/.test(v))).toBe(true);
    expect(new Set(result.voucherNumbers).size).toBe(2);

    // Each payment landed in the expenses ledger and the books still balance.
    expect((await expenses.listExpenses()).length).toBe(2);
    const tb = await reports.trialBalance();
    expect(tb.balanced).toBe(true);
    const cash = tb.rows.find((r) => r.accountCode === "1000")!;
    expect(cash.closingCredit).toBe(26_500);

    // The paid amount is remembered on the item for next time.
    expect((await items.get(electricity.id)).amount).toBe(1_500);
    expect((await items.get(rent.id)).amount).toBe(25_000);
    expect((await items.get(internet.id)).amount).toBeNull();
  });

  it("settles bank payments from the bank account and rejects bad input", async () => {
    const rent = await items.create({ categoryId: utilitiesId, name: "Rent" });
    await items.payItems({
      categoryId: utilitiesId,
      paymentMethod: "BANK",
      expenseDate: "2026-10-09",
      selections: [{ itemId: rent.id, amount: 5_000, description: "October rent" }],
    });
    const tb = await reports.trialBalance();
    expect(tb.rows.find((r) => r.accountCode === "1010")!.closingCredit).toBe(5_000);
    expect(tb.rows.find((r) => r.accountCode === "1000")!.closingCredit).toBe(0);

    await expect(
      items.payItems({
        categoryId: utilitiesId,
        paymentMethod: "CASH",
        expenseDate: "2026-10-09",
        selections: [],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      items.payItems({
        categoryId: utilitiesId,
        paymentMethod: "CASH",
        expenseDate: "2026-10-09",
        selections: [{ itemId: rent.id, amount: 0 }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    // An item from another category must not be paid under this one.
    const editor = await items.create({ categoryId: salariesId, name: "Editor" });
    await expect(
      items.payItems({
        categoryId: utilitiesId,
        paymentMethod: "CASH",
        expenseDate: "2026-10-09",
        selections: [{ itemId: editor.id, amount: 100 }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    // Nothing was written by the rejected calls.
    expect((await expenses.listExpenses()).length).toBe(1);
  });
});
