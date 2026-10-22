import { test, expect } from "vitest";
import { defaultPackUnit, packCount } from "../src/lib/units";

test("trial balance rows group by COA type with closing subtotals", async () => {
  const { groupTbRows } = await import("../src/pages/TrialBalancePage");
  const rows = [
    { accountId: 1, accountCode: "4000", accountName: "Sales", accountType: "REVENUE" as const, openingDebit: 0, openingCredit: 0, debit: 5, credit: 0, closingDebit: 0, closingCredit: 5 },
    { accountId: 2, accountCode: "1000", accountName: "Cash", accountType: "ASSET" as const, openingDebit: 0, openingCredit: 0, debit: 10, credit: 0, closingDebit: 10, closingCredit: 0 },
    { accountId: 3, accountCode: "1100", accountName: "Bank", accountType: "ASSET" as const, openingDebit: 0, openingCredit: 0, debit: 0, credit: 3, closingDebit: 7, closingCredit: 0 },
  ];
  const groups = groupTbRows(rows);
  expect(groups.map((g) => g.type)).toEqual(["ASSET", "REVENUE"]);
  expect(groups[0].rows.map((r) => r.accountCode)).toEqual(["1000", "1100"]);
  expect(groups[0].closingDebit).toBe(17);
  expect(groups[0].closingCredit).toBe(0);
  expect(groups[1].closingCredit).toBe(5);
});

test("50 kg into 5 kg packs is 10 packs", () => {
  const result = packCount(50, "KG", 5, "KG");
  expect(result.packs).toBe(10);
  expect(result.packedBulk).toBe(50);
  expect(result.remainder).toBe(0);
});

test("50 kg into 500 g packs is 100 packs", () => {
  expect(packCount(50, "KG", 500, "G").packs).toBe(100);
});

test("5 L into 500 ml packs is 10 packs", () => {
  expect(packCount(5, "L", 500, "ML").packs).toBe(10);
});

test("51 kg into 5 kg packs leaves 1 kg", () => {
  const result = packCount(51, "KG", 5, "KG");
  expect(result.packs).toBe(10);
  expect(result.packedBulk).toBe(50);
  expect(result.remainder).toBe(1);
});

test("mismatched dimensions are rejected", () => {
  expect(packCount(50, "KG", 500, "ML").error).toBeTruthy();
});

test("a pack larger than the bulk is rejected", () => {
  expect(packCount(2, "KG", 5, "KG").error).toBeTruthy();
});

test("pack units default from the item unit", () => {
  expect(defaultPackUnit("GRAM")).toBe("G");
  expect(defaultPackUnit("KG")).toBe("KG");
  expect(defaultPackUnit("ML")).toBe("ML");
  expect(defaultPackUnit("TABLET")).toBe("UNIT");
});
