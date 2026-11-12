import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../src/domain/errors.js";
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
    const created = await items.create({
      itemName: "Vitamin C",
      itemCode: "VITC-1",
    });
    expect(created.item_code).toBe("VITC-1");
    await expect(
      items.create({ itemName: "Vitamin C copy", itemCode: "VITC-1" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("validates name, prices, stock bounds, unit and type", async () => {
    await expect(items.create({ itemName: "   " })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      items.create({ itemName: "Bad price", purchasePrice: -1 }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      items.create({ itemName: "Bad max", minimumStock: 10, maximumStock: 5 }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      items.create({ itemName: "Bad unit", unit: "PACKET" }),
    ).rejects.toBeInstanceOf(ValidationError);
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
    expect(
      await items.list({ search: "Cough", activeOnly: false }),
    ).toHaveLength(1);

    await expect(items.deactivate(999_999)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("PartyService", () => {
  it("auto-generates CUST- / SUPP- codes", async () => {
    const customer = await parties.create({
      name: "Al-Noor Pharmacy",
      partyType: "CUSTOMER",
    });
    const supplier = await parties.create({
      name: "MediSupply Ltd",
      partyType: "SUPPLIER",
    });
    expect(customer.code).toMatch(/^CUST-\d{5}$/);
    expect(supplier.code).toMatch(/^SUPP-\d{5}$/);
  });

  it("rejects a blank name, a negative credit limit and a duplicate code", async () => {
    await expect(
      parties.create({ name: "  ", partyType: "CUSTOMER" }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      parties.create({ name: "X", partyType: "CUSTOMER", creditLimit: -1 }),
    ).rejects.toBeInstanceOf(ValidationError);

    await parties.create({
      name: "Duplicate Test",
      partyType: "CUSTOMER",
      code: "P-1",
    });
    await expect(
      parties.create({
        name: "Duplicate Test 2",
        partyType: "SUPPLIER",
        code: "P-1",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("gives every new party its own sub-account under A/R or A/P", async () => {
    const customer = await parties.create({
      name: "Ledger Customer",
      partyType: "CUSTOMER",
    });
    const supplier = await parties.create({
      name: "Ledger Supplier",
      partyType: "SUPPLIER",
    });

    const customerAccount = await accounts.get(customer.account_id as number);
    expect(customerAccount.account_name).toBe(
      `Ledger Customer (${customer.code})`,
    );
    expect(customerAccount.parent_account_id).toBe(
      await accountId(ctx.db, "1100"),
    );
    expect(customerAccount.account_type).toBe("ASSET");

    const supplierAccount = await accounts.get(supplier.account_id as number);
    expect(supplierAccount.parent_account_id).toBe(
      await accountId(ctx.db, "2000"),
    );
    expect(supplierAccount.account_type).toBe("LIABILITY");
  });

  it("enforces account linkage: customers need an ASSET, suppliers a LIABILITY", async () => {
    const ar = await accountId(ctx.db, "1100");
    const cash = await accountId(ctx.db, "1000"); // ASSET
    const ap = await accountId(ctx.db, "2000"); // LIABILITY

    // Customer + ASSET is fine, customer + LIABILITY is not.
    await parties.create({
      name: "Ok Customer",
      partyType: "CUSTOMER",
      accountId: ar,
    });
    await expect(
      parties.create({
        name: "Bad Customer",
        partyType: "CUSTOMER",
        accountId: ap,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      parties.create({
        name: "Bad Supplier",
        partyType: "SUPPLIER",
        accountId: cash,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await parties.create({
      name: "Ok Supplier",
      partyType: "SUPPLIER",
      accountId: ap,
    });
    await expect(
      parties.create({
        name: "Ghost Account",
        partyType: "CUSTOMER",
        accountId: 999_999,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("blocks deactivation while the party has open transactions", async () => {
    const sales = new SalesInvoiceService(ctx.db);
    const customer = await parties.create({
      name: "Credit Buyer",
      partyType: "CUSTOMER",
    });

    await sales.createSalesInvoice({
      customerId: customer.id,
      invoiceDate: "2026-10-08",
      paymentType: "CREDIT",
      items: [{ itemId: ctx.ids.itemId, quantity: 2, unitPrice: 150 }],
    });

    await expect(parties.deactivate(customer.id)).rejects.toBeInstanceOf(
      ValidationError,
    );

    // Deactivating through update() is guarded the same way.
    await expect(
      parties.update(customer.id, {
        name: customer.name,
        creditLimit: 0,
        isActive: false,
      }),
    ).rejects.toBeInstanceOf(ValidationError);

    // A party with no history deactivates cleanly.
    const clean = await parties.create({
      name: "Clean Party",
      partyType: "CUSTOMER",
    });
    await parties.deactivate(clean.id);
    expect((await parties.list()).some((p) => p.id === clean.id)).toBe(false);
  });

  it("posts party opening balances as one OPENING entry the ledger picks up", async () => {
    const reports = new ReportService(ctx.db);
    const customer = await parties.create({
      name: "Advance Customer",
      partyType: "CUSTOMER",
    });
    const supplier = await parties.create({
      name: "Advance Supplier",
      partyType: "SUPPLIER",
    });

    const result = await parties.postOpeningBalances([
      { partyId: customer.id, debit: 500 },
      { partyId: supplier.id, credit: 300 },
    ]);
    expect(result.partiesUpdated).toBe(2);
    expect(result.totalDebit).toBe(500);
    expect(result.totalCredit).toBe(300);

    const customerLedger = await reports.partyLedger(customer.id);
    expect(customerLedger).toHaveLength(1);
    expect(customerLedger[0]!.debit).toBe(500);
    expect(customerLedger[0]!.balance).toBe(500);
    const supplierLedger = await reports.partyLedger(supplier.id);
    expect(supplierLedger.at(-1)!.balance).toBe(-300);

    expect((await reports.trialBalance()).balanced).toBe(true);
    const retained = await accountId(ctx.db, "3100");
    const tb = await reports.trialBalance();
    // Openings post to each party's own sub-account under A/R / A/P.
    expect(
      tb.rows.find((r) => r.accountId === (customer.account_id as number))!
        .closingDebit,
    ).toBe(500);
    expect(
      tb.rows.find((r) => r.accountId === (supplier.account_id as number))!
        .closingCredit,
    ).toBe(300);
    expect(tb.rows.find((r) => r.accountId === retained)!.closingCredit).toBe(
      200,
    );

    // Re-saving the same value is a no-op, a new value replaces the old one.
    await parties.postOpeningBalances([{ partyId: customer.id, debit: 500 }]);
    expect((await reports.partyLedger(customer.id)).at(-1)!.balance).toBe(500);
    await parties.postOpeningBalances([{ partyId: customer.id, debit: 700 }]);
    expect((await reports.partyLedger(customer.id)).at(-1)!.balance).toBe(700);
  });

  it("carries the opening from its date and ignores earlier invoices", async () => {
    const reports = new ReportService(ctx.db);
    const sales = new SalesInvoiceService(ctx.db);
    const customer = await parties.create({
      name: "Dated Opening",
      partyType: "CUSTOMER",
    });

    await sales.createSalesInvoice({
      customerId: customer.id,
      invoiceDate: "2026-09-20",
      paymentType: "CREDIT",
      items: [{ itemId: ctx.ids.itemId, quantity: 1, unitPrice: 100 }],
    });
    await sales.createSalesInvoice({
      customerId: customer.id,
      invoiceDate: "2026-10-05",
      paymentType: "CREDIT",
      items: [{ itemId: ctx.ids.itemId, quantity: 2, unitPrice: 100 }],
    });

    const result = await parties.postOpeningBalances(
      [{ partyId: customer.id, debit: 500 }],
      "2026-10-01",
    );
    expect(result.openingDate).toBe("2026-10-01");

    const ledger = await reports.partyLedger(customer.id);
    // The pre-cutover invoice is listed but its amount is already in the opening.
    const before = ledger.find((row) => row.date === "2026-09-20")!;
    expect(before.beforeOpening).toBe(true);
    expect(before.balance).toBe(0);

    const opening = ledger.find(
      (row) => row.description === "Opening balance",
    )!;
    expect(opening.date).toBe("2026-10-01");
    expect(opening.balance).toBe(500);

    // On/after the opening date counts toward the party's credit.
    const after = ledger.find((row) => row.date === "2026-10-05")!;
    expect(after.balance).toBe(700);
    expect(ledger.at(-1)!.balance).toBe(700);
  });

  it("lists opening-balance changes and restores prior balances when the newest is deleted", async () => {
    const customer = await parties.create({
      name: "Change Log Customer",
      partyType: "CUSTOMER",
    });
    const first = await parties.postOpeningBalances(
      [{ partyId: customer.id, debit: 500 }],
      "2026-10-01",
    );
    const second = await parties.postOpeningBalances(
      [{ partyId: customer.id, debit: 700 }],
      "2026-10-02",
    );

    let changes = await parties.listOpeningBalanceChanges();
    expect(changes).toHaveLength(2);
    const newest = changes[0]!;
    const older = changes[1]!;
    expect(newest.journalEntryId).toBe(second.journalEntryId);
    expect(newest.entryDate).toBe("2026-10-02");
    expect(newest.deletable).toBe(true);
    expect(newest.parties[0]).toMatchObject({
      partyId: customer.id,
      debit: 700,
      credit: 0,
      cleared: false,
    });
    expect(older.journalEntryId).toBe(first.journalEntryId);
    expect(older.deletable).toBe(false);
    expect(older.blockedBy).toHaveLength(1);

    // An older change is protected while a newer one exists for the party.
    await expect(
      parties.deleteOpeningBalanceChange(first.journalEntryId),
    ).rejects.toBeInstanceOf(ValidationError);

    const deleted = await parties.deleteOpeningBalanceChange(
      second.journalEntryId,
    );
    expect(deleted.partiesUpdated).toBe(1);
    const restored = await parties.get(customer.id);
    expect(restored.opening_balance).toBe(500);
    expect(restored.opening_balance_date).toBe("2026-10-01");

    changes = await parties.listOpeningBalanceChanges();
    expect(changes).toHaveLength(1);
    expect(changes[0]!.deletable).toBe(true);
    expect(changes[0]!.parties[0]!.debit).toBe(500);

    const reports = new ReportService(ctx.db);
    expect((await reports.partyLedger(customer.id)).at(-1)!.balance).toBe(500);
    expect((await reports.trialBalance()).balanced).toBe(true);
  });

  it("restores a cleared balance, and zero with no prior change", async () => {
    const customer = await parties.create({
      name: "Cleared Customer",
      partyType: "CUSTOMER",
    });
    const fresh = await parties.create({
      name: "Only Change",
      partyType: "CUSTOMER",
    });

    await parties.postOpeningBalances(
      [{ partyId: customer.id, debit: 500 }],
      "2026-10-01",
    );
    // A zero entry clears the 500; the next change replaces the cleared state.
    await parties.postOpeningBalances([{ partyId: customer.id }], "2026-10-02");
    const replaced = await parties.postOpeningBalances(
      [{ partyId: customer.id, debit: 300 }],
      "2026-10-03",
    );

    await parties.deleteOpeningBalanceChange(replaced.journalEntryId);
    const cleared = await parties.get(customer.id);
    expect(cleared.opening_balance).toBe(0);
    expect(cleared.opening_balance_date).toBe("2026-10-02");
    expect(await parties.listOpeningBalanceChanges()).toHaveLength(2);
    expect(
      (await new ReportService(ctx.db).partyLedger(customer.id)).at(-1)!
        .balance,
    ).toBe(0);

    // Deleting the only change on a party with no history puts it back to unset.
    const only = await parties.postOpeningBalances(
      [{ partyId: fresh.id, credit: 250 }],
      "2026-10-04",
    );
    await parties.deleteOpeningBalanceChange(only.journalEntryId);
    const reset = await parties.get(fresh.id);
    expect(reset.opening_balance).toBe(0);
    expect(reset.opening_balance_date).toBeNull();
  });

  it("rejects both-sided, duplicate and unknown-party opening balances", async () => {
    const customer = await parties.create({
      name: "Bad Opening",
      partyType: "CUSTOMER",
    });
    await expect(
      parties.postOpeningBalances([
        { partyId: customer.id, debit: 5, credit: 5 },
      ]),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      parties.postOpeningBalances([
        { partyId: customer.id, debit: 5 },
        { partyId: customer.id, debit: 5 },
      ]),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      parties.postOpeningBalances([{ partyId: 999_999, debit: 5 }]),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("updates name, credit limit and status", async () => {
    const created = await parties.create({
      name: "Old Name",
      partyType: "CUSTOMER",
    });
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

describe("opening stock", () => {
  it("creates a batch and an OPENING stock movement without touching the books", async () => {
    const result = await items.addOpeningStock({
      itemId: ctx.ids.itemId,
      quantity: 40,
      unitCost: 75,
      batchNumber: "OPEN-1",
    });
    expect(result.batchNumber).toBe("OPEN-1");
    expect(result.totalValue).toBe(3_000);
    expect(result.journalEntryId).toBeNull();

    const batch = await ctx.db.get<{
      quantity_in_stock: number;
      purchase_price: number;
    }>(
      "SELECT quantity_in_stock, purchase_price FROM stock_batches WHERE id = ?",
      [result.batchId],
    );
    expect(Number(batch?.quantity_in_stock)).toBe(40);
    expect(Number(batch?.purchase_price)).toBe(75);

    const movement = await ctx.db.get<{
      movement_type: string;
      quantity: number;
    }>(
      "SELECT movement_type, quantity FROM stock_movements WHERE batch_id = ?",
      [result.batchId],
    );
    expect(movement?.movement_type).toBe("OPENING");
    expect(Number(movement?.quantity)).toBe(40);
  });

  it("posts Dr inventory / Cr A-P when a supplier is given", async () => {
    const reports = new ReportService(ctx.db);
    const result = await items.addOpeningStock({
      itemId: ctx.ids.itemId,
      quantity: 10,
      unitCost: 100,
      partyId: ctx.ids.supplierId,
    });
    expect(result.journalEntryId).toBeGreaterThan(0);

    const inventory = await accountId(ctx.db, "1220");
    const payable = await accountId(ctx.db, "2000");
    const lines = await ctx.db.all<{
      account_id: number;
      debit: number;
      credit: number;
      party_id: number | null;
    }>(
      "SELECT account_id, debit, credit, party_id FROM journal_entry_lines WHERE journal_entry_id = ?",
      [result.journalEntryId],
    );
    const dr = lines.find((l) => l.account_id === inventory)!;
    const cr = lines.find((l) => l.account_id === payable)!;
    expect(Number(dr.debit)).toBe(1_000);
    expect(Number(cr.credit)).toBe(1_000);
    expect(cr.party_id).toBe(ctx.ids.supplierId);
    expect((await reports.trialBalance()).balanced).toBe(true);
  });

  it("rejects a duplicate batch, a bad quantity and a missing item", async () => {
    await items.addOpeningStock({
      itemId: ctx.ids.itemId,
      quantity: 5,
      unitCost: 10,
      batchNumber: "DUP-1",
    });
    await expect(
      items.addOpeningStock({
        itemId: ctx.ids.itemId,
        quantity: 5,
        unitCost: 10,
        batchNumber: "DUP-1",
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      items.addOpeningStock({ itemId: ctx.ids.itemId, quantity: 0 }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      items.addOpeningStock({
        itemId: ctx.ids.itemId,
        quantity: 5,
        unitCost: -1,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      items.addOpeningStock({ itemId: 999_999, quantity: 5 }),
    ).rejects.toBeInstanceOf(ValidationError);
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

  it("auto-generates a code when blank and rejects bad input", async () => {
    const first = await accounts.create({
      accountName: "Auto One",
      accountType: "ASSET",
    });
    expect(first.account_code).toMatch(/^AC-\d{5}$/);
    const second = await accounts.create({
      accountCode: "  ",
      accountName: "Auto Two",
      accountType: "ASSET",
    });
    expect(second.account_code).toMatch(/^AC-\d{5}$/);
    expect(second.account_code).not.toBe(first.account_code);
    await expect(
      accounts.create({
        accountCode: "7000",
        accountName: "  ",
        accountType: "ASSET",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      accounts.create({
        accountCode: "1000",
        accountName: "Duplicate",
        accountType: "ASSET",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      accounts.create({
        accountCode: "7001",
        accountName: "Bad Type",
        accountType: "NOPE",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("allows nesting an account under any existing sub-account", async () => {
    const group = await accounts.create({
      accountCode: "1900",
      accountName: "Receivables Group",
      accountType: "ASSET",
    });
    const ledger = await accounts.create({
      accountCode: "1901",
      accountName: "Receivables Ledger",
      accountType: "ASSET",
      parentAccountId: group.id,
    });
    const detail = await accounts.create({
      accountCode: "1902",
      accountName: "Receivables Detail",
      accountType: "ASSET",
      parentAccountId: ledger.id,
    });
    const deeper = await accounts.create({
      accountCode: "1903",
      accountName: "Receivables Deeper",
      accountType: "ASSET",
      parentAccountId: detail.id,
    });
    expect(deeper.parent_account_id).toBe(detail.id);

    await expect(
      accounts.create({
        accountCode: "1904",
        accountName: "Wrong Type",
        accountType: "EXPENSE",
        parentAccountId: deeper.id,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects re-parenting an account under its own descendant", async () => {
    const group = await accounts.create({
      accountCode: "1900",
      accountName: "Group",
      accountType: "ASSET",
    });
    const child = await accounts.create({
      accountCode: "1901",
      accountName: "Child",
      accountType: "ASSET",
      parentAccountId: group.id,
    });
    await expect(
      accounts.update(group.id, {
        accountName: "Group",
        openingBalance: 0,
        parentAccountId: child.id,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      accounts.update(group.id, {
        accountName: "Group",
        openingBalance: 0,
        parentAccountId: group.id,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
  it("stores a non-zero opening balance on the account without posting an entry", async () => {
    const reports = new ReportService(ctx.db);
    const account = await accounts.create({
      accountCode: "1050",
      accountName: "Petty Cash",
      accountType: "ASSET",
      openingBalance: 250,
    });

    // Nothing is posted: the value lives on the account only.
    const entry = await ctx.db.get<{ id: number }>(
      `SELECT id FROM journal_entries
       WHERE source_table = 'accounts' AND source_id = ?`,
      [account.id],
    );
    expect(entry).toBeUndefined();
    expect((await accounts.get(account.id)).opening_balance).toBe(250);

    const tb = await reports.trialBalance();
    const row = tb.rows.find((r) => r.accountId === account.id)!;
    expect(row.closingDebit).toBe(250);
    // Nothing offsets an opening balance entered on one side only, and that
    // is reported instead of being hidden behind a Retained Earnings posting.
    expect(tb.balanced).toBe(false);
  });

  it("updates the stored opening balance without posting an entry", async () => {
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

    const lines = await ctx.db.get<{ count: number }>(
      "SELECT COUNT(*) AS count FROM journal_entry_lines WHERE account_id = ?",
      [account.id],
    );
    expect(Number(lines?.count)).toBe(0);
    expect((await accounts.get(account.id)).opening_balance).toBe(175);
    const tb = await reports.trialBalance();
    expect(tb.rows.find((r) => r.accountId === account.id)!.closingDebit).toBe(
      175,
    );
  });

  it("keeps a deactivated account with an opening balance in the trial balance", async () => {
    const reports = new ReportService(ctx.db);
    const account = await accounts.create({
      accountCode: "1053",
      accountName: "Short-lived Asset",
      accountType: "ASSET",
      openingBalance: 400,
    });

    await accounts.deactivate(account.id);

    const tb = await reports.trialBalance();
    // The deactivated account still shows up while it carries a balance.
    const row = tb.rows.find((r) => r.accountCode === "1053");
    expect(row).toBeDefined();
    expect(row!.closingDebit).toBe(400);
  });

  it("protects system accounts and accounts with active sub-accounts", async () => {
    const systemAccount = await accounts.list();
    const cash = systemAccount.find((a) => a.account_code === "1000")!;
    await expect(accounts.deactivate(cash.id)).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      accounts.update(cash.id, {
        accountName: "Cash",
        openingBalance: 0,
        isActive: false,
      }),
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
    await expect(accounts.deactivate(parent.id)).rejects.toBeInstanceOf(
      ValidationError,
    );

    // Deactivating the child first makes the parent eligible.
    const child = (await accounts.list()).find(
      (a) => a.account_code === "1601",
    )!;
    await accounts.deactivate(child.id);
    await accounts.deactivate(parent.id);
    expect((await accounts.list()).some((a) => a.id === parent.id)).toBe(false);
  });
});
