import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ValidationError } from "../src/domain/errors.js";
import { AccountService } from "../src/services/accountService.js";
import { freshDb, type TestContext } from "./helpers/db.js";

let ctx: TestContext;
let accounts: AccountService;

beforeEach(async () => {
  ctx = await freshDb();
  accounts = new AccountService(ctx.db);
});
afterEach(async () => {
  await ctx.db.close();
});

describe("AccountService.delete", () => {
  it("flags and deletes a clean item, and lists can_delete for it", async () => {
    const account = await accounts.create({ accountName: "Imported junk", accountType: "EXPENSE" });
    const listed = await accounts.listWithDeleteFlags(false);
    const row = listed.find((a) => a.id === account.id);
    expect(row?.can_delete).toBe(true);
    await accounts.delete(account.id);
    await expect(accounts.get(account.id)).rejects.toThrow();
  });

  it("refuses to delete a system account even when reference-free", async () => {
    const cash = await accounts.get(1); // 1000 Cash in Hand seed
    await expect(accounts.delete(cash.id)).rejects.toThrow(ValidationError);
  });

  it("refuses to delete an account that has journal entries", async () => {
    const account = await accounts.create({ accountName: "Posted", accountType: "EXPENSE" });
    await ctx.db.transaction(async () => {
      const entryId = await ctx.db.run(
        `INSERT INTO journal_entries (company_id, voucher_number, voucher_type, entry_date)
         VALUES (1, 'TEST-JV-1', 'JOURNAL', date('now'))`,
      );
      await ctx.db.run(
        "INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit) VALUES (?, ?, 10)",
        [Number(entryId.lastInsertRowid), account.id],
      );
    });
    const flags = await accounts.listWithDeleteFlags(false);
    expect(flags.find((a) => a.id === account.id)?.can_delete).toBe(false);
    await expect(accounts.delete(account.id)).rejects.toThrow(/journal entries/);
  });

  it("refuses to delete a header that has active sub-accounts", async () => {
    const parent = await accounts.create({ accountName: "Group", accountType: "EXPENSE" });
    await accounts.create({
      accountName: "Child",
      accountType: "EXPENSE",
      parentAccountId: parent.id,
    });
    const flags = await accounts.listWithDeleteFlags(false);
    expect(flags.find((a) => a.id === parent.id)?.can_delete).toBe(false);
    await expect(accounts.delete(parent.id)).rejects.toThrow(/sub-accounts/);
  });
});
