import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UnbalancedJournalEntryError, ValidationError } from "../src/domain/errors.js";
import { AccountingService } from "../src/services/accountingService.js";
import { accountId, freshDb, type TestContext } from "./helpers/db.js";

let ctx: TestContext;
beforeEach(async () => {
  ctx = await freshDb();
});
afterEach(async () => {
  await ctx.db.close();
});

describe("AccountingService", () => {
  it("posts a balanced entry and reflects it in the trial balance", async () => {
    const cash = await accountId(ctx.db, "1000");
    const revenue = await accountId(ctx.db, "4000");
    const svc = new AccountingService(ctx.db);

    const id = await svc.postJournalEntry({
      voucherType: "JOURNAL",
      entryDate: "2026-10-08",
      lines: [
        { accountId: cash, debit: "100.00" },
        { accountId: revenue, credit: "100.00" },
      ],
    });
    expect(id).toBeGreaterThan(0);

    const tb = await svc.getTrialBalance();
    expect(tb.find((r) => r.accountCode === "1000")?.debit).toBe(100);
    expect(tb.find((r) => r.accountCode === "4000")?.credit).toBe(100);
    const debits = tb.reduce((a, r) => a + r.debit, 0);
    const credits = tb.reduce((a, r) => a + r.credit, 0);
    expect(debits).toBe(credits);
  });

  it("rejects an unbalanced entry", async () => {
    const cash = await accountId(ctx.db, "1000");
    const revenue = await accountId(ctx.db, "4000");
    const svc = new AccountingService(ctx.db);
    await expect(
      svc.postJournalEntry({
        voucherType: "JOURNAL",
        entryDate: "2026-10-08",
        lines: [
          { accountId: cash, debit: 100 },
          { accountId: revenue, credit: 90 },
        ],
      }),
    ).rejects.toBeInstanceOf(UnbalancedJournalEntryError);
  });

  it("rejects an entry with fewer than two lines", async () => {
    const cash = await accountId(ctx.db, "1000");
    const svc = new AccountingService(ctx.db);
    await expect(
      svc.postJournalEntry({
        voucherType: "JOURNAL",
        entryDate: "2026-10-08",
        lines: [{ accountId: cash, debit: 100 }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a line with both a debit and a credit", async () => {
    const cash = await accountId(ctx.db, "1000");
    const revenue = await accountId(ctx.db, "4000");
    const svc = new AccountingService(ctx.db);
    await expect(
      svc.postJournalEntry({
        voucherType: "JOURNAL",
        entryDate: "2026-10-08",
        lines: [
          { accountId: cash, debit: 100, credit: 100 },
          { accountId: revenue, credit: 0, debit: 0 },
        ],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("allocates sequential voucher numbers", async () => {
    const cash = await accountId(ctx.db, "1000");
    const revenue = await accountId(ctx.db, "4000");
    const svc = new AccountingService(ctx.db);
    const post = () =>
      svc.postJournalEntry({
        voucherType: "JOURNAL",
        entryDate: "2026-10-08",
        lines: [
          { accountId: cash, debit: 1 },
          { accountId: revenue, credit: 1 },
        ],
      });
    const first = await post();
    const second = await post();
    const rows = await ctx.db.all<{ id: number; voucher_number: string }>(
      "SELECT id, voucher_number FROM journal_entries WHERE id IN (?, ?) ORDER BY id",
      [first, second],
    );
    expect(rows[0]!.voucher_number).toMatch(/^JV-\d+$/);
    expect(rows[1]!.voucher_number).not.toBe(rows[0]!.voucher_number);
    const n1 = Number(rows[0]!.voucher_number.split("-")[1]);
    const n2 = Number(rows[1]!.voucher_number.split("-")[1]);
    expect(n2).toBe(n1 + 1);
  });
});
