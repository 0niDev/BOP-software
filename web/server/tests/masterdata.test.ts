import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NotFoundError, ValidationError } from "../src/domain/errors.js";
import { AccountService } from "../src/services/accountService.js";
import { ItemService } from "../src/services/itemService.js";
import { PartyService } from "../src/services/partyService.js";
import { ReportService } from "../src/services/reportService.js";
import { SalesInvoiceService } from "../src/services/salesInvoiceService.js";
import { accountId, closeDb, freshDb, type TestContext } from "./helpers/db.js";

let ctx: TestContext;
let items: ItemService;
let parties: PartyService;
let accounts: AccountService;

beforeEach(async () => {
  ctx = await freshDb();
  items = new ItemService(ctx.db);
  parties = new PartyService(ctx.db);
  accounts = new AccountService(ctx.db);
});
afterEach(async () => {
  await closeDb(ctx.db);
});

describe("ItemService", () => {
  it("auto-generates an ITEM- code and defaults the type to FINISHED_GOOD", async () => {
    const item = await items.create({ itemName: "  Paracetamol 500mg  " });
    expect(item.item_code).toMatch(/^ITEM-\d{5}$/);
    expect(item.item_name).toBe("Paracetamol 500mg");
    expect(item.unit).toBe("UNIT");
    expect(item.item_type).toBe("FINISHED_GOOD");
    expect(item.is_active).toBe(1);

    const second = await items.create({ itemName: "Ibuprofen 400mg" });
    expect(second.item_code).not.toBe(item.item_code);
  });

  it("accepts a manual code and rejects a duplicate", async () => {
    const created = await items.create({ itemName: "Vitamin C", itemCode: "VITC-1" });
    expect(created.item_code).toBe("VITC-1");
    await expect(
      items.create({ itemName: "Vitamin C copy", itemCode: "VITC-1" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("validates name, prices, stock bounds, unit and type", async () => {
    await expect(items.create({ itemName: "   " })).rejects.toBeInstanceOf(ValidationError);
    await expect(
      items.create({ itemName: "Bad price", purchasePrice: -1 }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      items.create({ itemName: "Bad max", minimumStock: 10, maximumStock: 5 }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(items.create({ itemName: "Bad unit", unit: "PACKET" })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      items.create({ itemName: "Bad type", itemType: "SERVICE" as never }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects an unknown tax rate", async () => {
    await expect(
      items.create({ itemName: "Taxed", taxRateId: 999_999 }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await items.taxRates()).toEqual([]);
  });

  it("updates and deactivates, then filters the list", async () => {
    const created = await items.create({ itemName: "Cough Syrup", unit: "ML" });
    const updated = await items.update(created.id, {
      itemName: "Cough Syrup 100ml",
      unit: "ML",
      purchasePrice: 40,
      sellingPrice: 60,
      minimumStock: 5,
      maximumStock: 50,
      itemType: "FINISHED_GOOD",
    });
    expect(updated.item_name).toBe("Cough Syrup 100ml");
    expect(updated.selling_price).toBe(60);

    // Search matches name or code while the item is still active.
    const found = await items.list({ search: "Cough" });
    expect(found).toHaveLength(1);
    expect(found[0]!.id).toBe(created.id);
    expect(await items.list({ search: "no-such-item" })).toEqual([]);

    await items.deactivate(created.id);
    expect((await items.list()).some((i) => i.id === created.id)).toBe(false);
    const all = await items.list({ activeOnly: false });
    expect(all.some((i) => i.id === created.id)).toBe(true);
    // Search respects the active-only filter too.
    expect(await items.list({ search: "Cough" })).toEqual([]);
    expect(await items.list({ search: "Cough", activeOnly: false })).toHaveLength(1);

    await expect(items.deactivate(999_999)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("PartyService", () => {
  it("auto-generates CUST- / SUPP- codes", async () => {
    const customer = await parties.create({ name: "Al-Noor Pharmacy", partyType: "CUSTOMER" });
    const supplier = await parties.create({ name: "MediSupply Ltd", partyType: "SUPPLIER" });
    expect(customer.code).toMatch(/^CUST-\d{5}$/);
    expect(supplier.code).toMatch(/^SUPP-\d{5}$/);
  });

  it("rejects a blank name, a negative credit limit and a duplicate code", async () => {
    await expect(parties.create({ name: "  ", partyType: "CUSTOMER" })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      parties.create({ name: "X", partyType: "CUSTOMER", creditLimit: -1 }),
    ).rejects.toBeInstanceOf(ValidationError);

    await parties.create({ name: "Duplicate Test", partyType: "CUSTOMER", code: "P-1" });
    await expect(
      parties.create({ name: "Duplicate Test 2", partyType: "SUPPLIER", code: "P-1" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("enforces account linkage: customers need an ASSET, suppliers a LIABILITY", async () => {
    const ar = await accountId(ctx.db, "1100");
    const cash = await accountId(ctx.db, "1000"); // ASSET
    const ap = await accountId(ctx.db, "2000"); // LIABILITY

    // Customer + ASSET is fine, customer + LIABILITY is not.
    await parties.create({ name: "Ok Customer", partyType: "CUSTOMER", accountId: ar });
    await expect(
      parties.create({ name: "Bad Customer", partyType: "CUSTOMER", accountId: ap }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      parties.create({ name: "Bad Supplier", partyType: "SUPPLIER", accountId: cash }),
    ).rejects.toBeInstanceOf(ValidationError);
    await parties.create({ name: "Ok Supplier", partyType: "SUPPLIER", accountId: ap });
    await expect(
      parties.create({ name: "Ghost Account", partyType: "CUSTOMER", accountId: 999_999 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("blocks deactivation while the party has open transactions", async () => {
    const sales = new SalesInvoiceService(ctx.db);
    const customer = await parties.create({ name: "Credit Buyer", partyType: "CUSTOMER" });

    await sales.createSalesInvoice({
      customerId: customer.id,
      invoiceDate: "2026-10-08",
      paymentType: "CREDIT",
      items: [{ itemId: ctx.ids.itemId, quantity: 2, unitPrice: 150 }],
    });

    await expect(parties.deactivate(customer.id)).rejects.toBeInstanceOf(ValidationError);

    // Deactivating through update() is guarded the same way.
    await expect(
      parties.update(customer.id, { name: customer.name, creditLimit: 0, isActive: false }),
    ).rejects.toBeInstanceOf(ValidationError);

    // A party with no history deactivates cleanly.
    const clean = await parties.create({ name: "Clean Party", partyType: "CUSTOMER" });
    await parties.deactivate(clean.id);
    expect((await parties.list()).some((p) => p.id === clean.id)).toBe(false);
  });

  it("updates name, credit limit and status", async () => {
    const created = await parties.create({ name: "Old Name", partyType: "CUSTOMER" });
    const updated = await parties.update(created.id, {
      name: "New Name",
      creditLimit: 5000,
      isActive: true,
      phone: "0300-1234567",
    });
    expect(updated.name).toBe("New Name");
    expect(updated.credit_limit).toBe(5000);
    expect(updated.phone).toBe("0300-1234567");
  });
});

describe("AccountService", () => {
  it("creates a sub-account and rejects a mismatched parent type", async () => {
    const parent = await accountId(ctx.db, "1500"); // ASSET
    const child = await accounts.create({
      accountCode: "1506",
      accountName: "Delivery Van",
      accountType: "ASSET",
      parentAccountId: parent,
    });
    expect(child.parent_account_id).toBe(parent);

    await expect(
      accounts.create({
        accountCode: "6001",
        accountName: "Bad Child",
        accountType: "EXPENSE",
        parentAccountId: parent,
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      accounts.create({
        accountCode: "1507",
        accountName: "Ghost Parent",
        accountType: "ASSET",
        parentAccountId: 999_999,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects blanks and duplicate codes", async () => {
    await expect(
      accounts.create({ accountCode: "  ", accountName: "X", accountType: "ASSET" }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      accounts.create({ accountCode: "7000", accountName: "  ", accountType: "ASSET" }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      accounts.create({ accountCode: "1000", accountName: "Duplicate", accountType: "ASSET" }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      accounts.create({ accountCode: "7001", accountName: "Bad Type", accountType: "NOPE" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("posts a non-zero opening balance to Retained Earnings and stays balanced", async () => {
    const reports = new ReportService(ctx.db);
    const account = await accounts.create({
      accountCode: "1050",
      accountName: "Petty Cash",
      accountType: "ASSET",
      openingBalance: 250,
    });

    // The ledger must stay balanced: the opening balance is posted, not stored
    // as a bare column value.
    const tb = await reports.trialBalance();
    expect(tb.balanced).toBe(true);

    const entry = await ctx.db.get<{ id: number }>(
      `SELECT id FROM journal_entries
       WHERE source_table = 'accounts' AND source_id = ? AND voucher_type = 'OPENING'`,
      [account.id],
    );
    expect(entry).toBeDefined();

    const balance = await ctx.db.get<{ total_debit: number; total_credit: number }>(
      `SELECT COALESCE(SUM(debit),0) AS total_debit, COALESCE(SUM(credit),0) AS total_credit
       FROM journal_entry_lines WHERE account_id = ?`,
      [account.id],
    );
    expect(Number(balance?.total_debit)).toBe(250);

    // Zero opening balance posts nothing.
    const plain = await accounts.create({
      accountCode: "1051",
      accountName: "No Opening",
      accountType: "ASSET",
    });
    const none = await ctx.db.get<{ id: number }>(
      "SELECT id FROM journal_entries WHERE source_table = 'accounts' AND source_id = ?",
      [plain.id],
    );
    expect(none).toBeUndefined();
  });

  it("posts an adjusting entry when an opening balance changes", async () => {
    const reports = new ReportService(ctx.db);
    const account = await accounts.create({
      accountCode: "1052",
      accountName: "Advances",
      accountType: "ASSET",
      openingBalance: 100,
    });

    await accounts.update(account.id, {
      accountName: "Advances",
      openingBalance: 175,
      isActive: true,
    });

    const total = await ctx.db.get<{ total_debit: number }>(
      `SELECT COALESCE(SUM(debit),0) AS total_debit FROM journal_entry_lines WHERE account_id = ?`,
      [account.id],
    );
    expect(Number(total?.total_debit)).toBe(175);
    expect((await reports.trialBalance()).balanced).toBe(true);
  });

  it("keeps the trial balance balanced when a funded account is deactivated", async () => {
    // Regression: filtering the trial balance on is_active = 1 dropped the
    // deactivated account but left its journal lines behind, so the report
    // stopped balancing (the original Python app had this bug).
    const reports = new ReportService(ctx.db);
    const account = await accounts.create({
      accountCode: "1053",
      accountName: "Short-lived Asset",
      accountType: "ASSET",
      openingBalance: 400,
    });
    expect((await reports.trialBalance()).balanced).toBe(true);

    await accounts.deactivate(account.id);

    const tb = await reports.trialBalance();
    expect(tb.balanced).toBe(true);
    expect(tb.totalDebit).toBe(tb.totalCredit);
    // The deactivated account still shows up while it carries a balance.
    expect(tb.rows.some((r) => r.accountCode === "1053")).toBe(true);
    expect((await reports.balanceSheet()).balanced).toBe(true);
  });

  it("protects system accounts and accounts with active sub-accounts", async () => {
    const systemAccount = await accounts.list();
    const cash = systemAccount.find((a) => a.account_code === "1000")!;
    await expect(accounts.deactivate(cash.id)).rejects.toBeInstanceOf(ValidationError);
    await expect(
      accounts.update(cash.id, { accountName: "Cash", openingBalance: 0, isActive: false }),
    ).rejects.toBeInstanceOf(ValidationError);

    const parent = await accounts.create({
      accountCode: "1600",
      accountName: "Parent Asset",
      accountType: "ASSET",
    });
    await accounts.create({
      accountCode: "1601",
      accountName: "Child Asset",
      accountType: "ASSET",
      parentAccountId: parent.id,
    });
    await expect(accounts.deactivate(parent.id)).rejects.toBeInstanceOf(ValidationError);

    // Deactivating the child first makes the parent eligible.
    const child = (await accounts.list()).find((a) => a.account_code === "1601")!;
    await accounts.deactivate(child.id);
    await accounts.deactivate(parent.id);
    expect((await accounts.list()).some((a) => a.id === parent.id)).toBe(false);
  });
});
