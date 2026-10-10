import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ValidationError } from "../src/domain/errors.js";
import { AssetService } from "../src/services/assetService.js";
import { ReportService } from "../src/services/reportService.js";
import { accountId, closeDb, freshDb, type TestContext } from "./helpers/db.js";

let ctx: TestContext;
let assets: AssetService;
let reports: ReportService;

beforeEach(async () => {
  ctx = await freshDb();
  assets = new AssetService(ctx.db);
  reports = new ReportService(ctx.db);
});
afterEach(async () => {
  await closeDb(ctx.db);
});

describe("AssetService", () => {
  it("lists the seeded fixed-asset accounts at zero", async () => {
    const list = await assets.list();
    const codes = list.map((asset) => asset.account_code);
    for (const code of ["1500", "1501", "1502", "1503", "1504", "1505"]) {
      expect(codes).toContain(code);
    }
    expect(list.every((asset) => asset.current_balance === 0)).toBe(true);
    expect(assets.codes()).toHaveLength(6);
  });

  it("buys an asset on credit: Dr asset, Cr A/P with the supplier, details saved", async () => {
    const created = await assets.create({
      assetName: "Production Machinery",
      assetCode: "1503",
      amount: 250_000,
      purchaseDate: "2026-10-09",
      paymentType: "CREDIT",
      classification: "NON_CURRENT",
      supplierId: ctx.ids.supplierId,
    });

    expect(created.account_code).toBe("1503");
    // The account was reused as-is (it exists in the seeded chart).
    expect(created.account_name).toBe("Auto Vehicles");
    expect(created.purchase_amount).toBe(250_000);
    expect(created.current_balance).toBe(250_000);
    expect(created.supplier_id).toBe(ctx.ids.supplierId);
    expect(created.asset_type).toBe("NON_CURRENT");

    const assetAccount = await accountId(ctx.db, "1503");
    const payable = await accountId(ctx.db, "2000");
    const lines = await ctx.db.all<{
      account_id: number;
      debit: number;
      credit: number;
      party_id: number | null;
    }>(
      `SELECT account_id, debit, credit, party_id FROM journal_entry_lines
       WHERE journal_entry_id = (SELECT id FROM journal_entries WHERE source_table = 'asset_details' LIMIT 1)`,
    );
    expect(Number(lines.find((l) => l.account_id === assetAccount)!.debit)).toBe(250_000);
    const creditLine = lines.find((l) => l.account_id === payable)!;
    expect(Number(creditLine.credit)).toBe(250_000);
    expect(creditLine.party_id).toBe(ctx.ids.supplierId);

    expect((await reports.trialBalance()).balanced).toBe(true);
    // A liability of 250,000 now shows on the balance sheet.
    const sheet = await reports.balanceSheet();
    expect(sheet.liabilities).toBeGreaterThanOrEqual(250_000);
    expect(sheet.balanced).toBe(true);
  });

  it("buys an asset for cash and accumulates on an existing asset account", async () => {
    const first = await assets.create({
      assetName: "Office Desk",
      assetCode: "1502",
      amount: 40_000,
      purchaseDate: "2026-10-09",
      paymentType: "CASH",
    });
    expect(first.current_balance).toBe(40_000);

    // asset_details is UNIQUE(account_id), so a second purchase on the same
    // code reuses the account and overwrites the descriptive row.
    const second = await assets.create({
      assetName: "Office Chair",
      assetCode: "1502",
      amount: 15_000,
      purchaseDate: "2026-10-09",
      paymentType: "CASH",
    });
    expect(second.account_id).toBe(first.account_id);
    expect(second.purchase_amount).toBe(15_000);
    expect(second.current_balance).toBe(55_000);

    const cash = await accountId(ctx.db, "1000");
    const balance = await ctx.db.get<{ credit: number }>(
      `SELECT COALESCE(SUM(credit), 0) AS credit FROM journal_entry_lines WHERE account_id = ?`,
      [cash],
    );
    expect(Number(balance?.credit)).toBe(55_000);
    expect((await reports.trialBalance()).balanced).toBe(true);
  });

  it("creates a brand-new fixed-asset account for the 1506 code", async () => {
    const created = await assets.create({
      assetName: "Delivery Van",
      assetCode: "1506",
      amount: 1_200_000,
      purchaseDate: "2026-10-09",
      paymentType: "BANK",
      classification: "NON_CURRENT",
    });
    expect(created.account_name).toBe("Delivery Van (Asset)");
    expect(created.account_subtype).toBe("NON_CURRENT");
    const bank = await accountId(ctx.db, "1010");
    expect(await reports.trialBalance()).toBeDefined();
    const line = await ctx.db.get<{ credit: number }>(
      `SELECT COALESCE(SUM(credit), 0) AS credit FROM journal_entry_lines WHERE account_id = ?`,
      [bank],
    );
    expect(Number(line?.credit)).toBe(1_200_000);
  });

  it("validates name, amount, code, payment type and classification", async () => {
    const base = {
      assetName: "Valid Name",
      assetCode: "1502",
      amount: 100,
      purchaseDate: "2026-10-09",
    };
    await expect(assets.create({ ...base, assetName: "   " })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(assets.create({ ...base, amount: 0 })).rejects.toBeInstanceOf(ValidationError);
    await expect(assets.create({ ...base, amount: -5 })).rejects.toBeInstanceOf(ValidationError);
    await expect(assets.create({ ...base, assetCode: "9999" })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      assets.create({ ...base, paymentType: "BARTER" as never }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      assets.create({ ...base, classification: "MAYBE" as never }),
    ).rejects.toBeInstanceOf(ValidationError);
    // Nothing was written by the rejected calls.
    expect((await assets.list()).every((asset) => asset.current_balance === 0)).toBe(true);
  });
});
