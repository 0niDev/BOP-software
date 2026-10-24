import { test, expect } from "vitest";
import { defaultPackUnit, packCount, packsToBulk } from "../src/lib/units";

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

test("20 packs of 500 g consume 10 kg", () => {
  expect(packsToBulk(20, "KG", 500, "G").bulk).toBe(10);
});

test("10 packs of 5 kg consume the same 50 kg packCount derives", () => {
  expect(packsToBulk(10, "KG", 5, "KG").bulk).toBe(packCount(50, "KG", 5, "KG").packedBulk);
});

test("packsToBulk rejects mismatched dimensions and non-positive inputs", () => {
  expect(packsToBulk(10, "KG", 500, "ML").error).toBeTruthy();
  expect(packsToBulk(0, "KG", 5, "KG").error).toBeTruthy();
  expect(packsToBulk(10, "KG", 0, "KG").error).toBeTruthy();
});

// --- table arrow navigation (lib/gridKeys) -------------------------------

/** Minimal table DOM: spec[row][col] = 1 when the cell holds an input, 0 when empty. */
function makeTable(spec: (0 | 1)[][]) {
  const rows = spec.map(() => ({ children: [] as unknown[], parentElement: null as unknown, querySelector: () => null }));
  const body = { children: rows };
  rows.forEach((row) => (row.parentElement = body));
  const inputs: (object | null)[][] = [];
  spec.forEach((cols, r) => {
    inputs[r] = [];
    cols.forEach((present, c) => {
      let input: { tagName: string; closest: (s: string) => unknown } | null = null;
      const cell: { closest: (s: string) => unknown; querySelector: () => unknown } = {
        closest: (s) => (s === "tr" ? rows[r] : null),
        querySelector: () => input,
      };
      if (present) {
        input = { tagName: "INPUT", closest: (s) => (s === "td" ? cell : null) };
      }
      (rows[r].children as unknown[])[c] = cell;
      inputs[r][c] = input;
    });
  });
  return { rows, field: (r: number, c: number) => inputs[r][c] as never };
}

test("arrows move to the same column in the neighbouring row", async () => {
  const { nextRowField } = await import("../src/lib/gridKeys");
  const table = makeTable([
    [1, 1],
    [1, 1],
    [1, 1],
  ]);
  const middle = table.field(1, 1);
  expect(nextRowField(middle, 1)).toBe(table.field(2, 1));
  expect(nextRowField(middle, -1)).toBe(table.field(0, 1));
  // edge rows do not wrap
  expect(nextRowField(table.field(2, 1), 1)).toBeNull();
  expect(nextRowField(table.field(0, 1), -1)).toBeNull();
  // a column with no field falls through to the first field of the next row
  expect(nextRowField(table.field(1, 0), 1)).toBe(table.field(2, 0));
});
