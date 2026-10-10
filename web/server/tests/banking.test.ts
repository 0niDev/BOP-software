import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConflictError, ValidationError } from "../src/domain/errors.js";
import { BankingService } from "../src/services/bankingService.js";
import { freshDb, type TestContext } from "./helpers/db.js";

let ctx: TestContext;
let banking: BankingService;

beforeEach(async () => {
  ctx = await freshDb();
  banking = new BankingService(ctx.db);
});
afterEach(async () => {
  await ctx.db.close();
});

async function voucherLines(voucherNumber: string) {
  const entry = await ctx.db.get<{ id: number }>(
    "SELECT id FROM journal_entries WHERE voucher_number = ?",
    [voucherNumber],
  );
  if (!entry) return [];
  return ctx.db.all<{ account_code: string; debit: number; credit: number; party_id: number | null }>(
    `SELECT a.account_code, l.debit, l.credit, l.party_id
     FROM journal_entry_lines l JOIN accounts a ON a.id = l.account_id
     WHERE l.journal_entry_id = ? ORDER BY l.line_order`,
    [entry.id],
  );
}

describe("BankingService", () => {
  it("creates a bank account and posts its opening balance to equity", async () => {
    const account = await banking.createBankAccount({
      bankName: "HBL",
      accountTitle: "Main",
      accountNumber: "1234567890",
      openingBalance: 1000,
    });
    expect(account.id).toBeGreaterThan(0);
    expect(await banking.getBalance(account.id)).toBe(1000);

    const entry = await ctx.db.get<{ voucher_type: string }>(
      "SELECT voucher_type FROM journal_entries ORDER BY id LIMIT 1",
    );
    expect(entry?.voucher_type).toBe("OPENING");
  });

  it("rejects a duplicate bank account number", async () => {
    const base = { bankName: "HBL", accountTitle: "Main", accountNumber: "999" };
    await banking.createBankAccount(base);
    await expect(banking.createBankAccount(base)).rejects.toBeInstanceOf(ConflictError);
  });

  it("deposits and withdraws, keeping the balance correct", async () => {
    const account = await banking.createBankAccount({
      bankName: "HBL",
      accountTitle: "Main",
      accountNumber: "1",
    });
    await banking.deposit({ bankAccountId: account.id, amount: 500, date: "2026-10-08" });
    expect(await banking.getBalance(account.id)).toBe(500);
    await banking.withdraw({ bankAccountId: account.id, amount: 200, date: "2026-10-08" });
    expect(await banking.getBalance(account.id)).toBe(300);
  });

  it("clears an issued cheque against accounts payable", async () => {
    const account = await banking.createBankAccount({
      bankName: "HBL",
      accountTitle: "Main",
      accountNumber: "2",
    });
    const cheque = await banking.issueCheque({
      bankAccountId: account.id,
      chequeNumber: "CHQ-1",
      amount: 100,
      chequeDate: "2026-10-08",
      partyId: ctx.ids.supplierId,
    });
    expect(cheque.status).toBe("UNCLEARED");

    await banking.clearCheque(cheque.id);
    const updated = await banking.listCheques();
    expect(updated.find((c) => c.id === cheque.id)?.status).toBe("CLEARED");

    const lines = await ctx.db.all<{ account_code: string; debit: number; credit: number; party_id: number | null }>(
      `SELECT a.account_code, l.debit, l.credit, l.party_id
       FROM journal_entry_lines l JOIN accounts a ON a.id = l.account_id
       WHERE l.credit > 0 ORDER BY l.id DESC LIMIT 1`,
    );
    expect(lines[0]?.account_code).toBe("1010");
  });

  it("refuses to clear an already-cleared cheque", async () => {
    const account = await banking.createBankAccount({
      bankName: "HBL",
      accountTitle: "Main",
      accountNumber: "3",
    });
    const cheque = await banking.issueCheque({
      bankAccountId: account.id,
      chequeNumber: "CHQ-2",
      amount: 50,
      chequeDate: "2026-10-08",
    });
    await banking.clearCheque(cheque.id);
    await expect(banking.clearCheque(cheque.id)).rejects.toBeInstanceOf(ValidationError);
  });

  it("bounces a cheque by updating its status", async () => {
    const account = await banking.createBankAccount({
      bankName: "HBL",
      accountTitle: "Main",
      accountNumber: "4",
    });
    const cheque = await banking.issueCheque({
      bankAccountId: account.id,
      chequeNumber: "CHQ-3",
      amount: 75,
      chequeDate: "2026-10-08",
    });
    await banking.bounceCheque(cheque.id);
    const updated = await banking.listCheques("BOUNCED");
    expect(updated.map((c) => c.id)).toContain(cheque.id);
  });
});
