import { test, expect } from "vitest";
import { formatDate } from "../src/lib/format";
import { defaultPackUnit, packsToBulk } from "../src/lib/units";

test("dates always display day/month/year", () => {
  expect(formatDate("2026-10-25")).toBe("25/10/2026");
  expect(formatDate("2026-10-25T09:05:00Z", true)).toBe("25/10/2026 09:05");
  expect(formatDate("")).toBe("");
});

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

test("trial balance rows nest under their CoA parent, siblings in code order", async () => {
  const { groupTbRows } = await import("../src/pages/TrialBalancePage");
  const rows = [
    { accountId: 12, accountCode: "1503", accountName: "Vehicles", accountType: "ASSET" as const, parentAccountId: 11, openingDebit: 0, openingCredit: 0, debit: 0, credit: 0, closingDebit: 30, closingCredit: 0 },
    { accountId: 11, accountCode: "1500", accountName: "Fixed Assets", accountType: "ASSET" as const, parentAccountId: null, openingDebit: 0, openingCredit: 0, debit: 0, credit: 0, closingDebit: 0, closingCredit: 0 },
    { accountId: 13, accountCode: "1501", accountName: "Machinery", accountType: "ASSET" as const, parentAccountId: 11, openingDebit: 0, openingCredit: 0, debit: 0, credit: 0, closingDebit: 20, closingCredit: 0 },
    // Its parent is hidden, so it surfaces as a root rather than disappearing.
    { accountId: 14, accountCode: "1100", accountName: "Receivable", accountType: "ASSET" as const, parentAccountId: 99, openingDebit: 0, openingCredit: 0, debit: 0, credit: 0, closingDebit: 5, closingCredit: 0 },
  ];
  const [assets] = groupTbRows(rows);
  expect(assets!.rows.map((r) => [r.accountCode, r.depth, r.hasChildren])).toEqual([
    ["1100", 0, false],
    ["1500", 0, true],
    ["1501", 1, false],
    ["1503", 1, false],
  ]);
  expect(assets!.closingDebit).toBe(55);
});

test("pack units default from the item unit's scale", () => {
  expect(defaultPackUnit("G")).toBe("G_ML");
  expect(defaultPackUnit("GRAM")).toBe("G_ML");
  expect(defaultPackUnit("ML")).toBe("G_ML");
  expect(defaultPackUnit("KG")).toBe("KG_LIT");
  expect(defaultPackUnit("LIT")).toBe("KG_LIT");
  expect(defaultPackUnit("TABLET")).toBe("UNIT");
});

test("20 items of 500 g/ml consume 10 kg", () => {
  expect(packsToBulk(20, "KG", 500, "G_ML").bulk).toBe(10);
});

test("g/ml works for a volume item too — 20 x 500 ml of a 5 lit batch uses 10 lit", () => {
  expect(packsToBulk(20, "LIT", 500, "G_ML").bulk).toBe(10);
});

test("10 items of 5 kg/lit consume 50 kg", () => {
  expect(packsToBulk(10, "KG", 5, "KG_LIT").bulk).toBe(50);
});

test("a kg/lit size converts down to a gram item (2 x 0.5 kg = 1000 g)", () => {
  expect(packsToBulk(2, "G", 0.5, "KG_LIT").bulk).toBe(1000);
});

test("counted items pack in unit, measured items in a pair", () => {
  expect(packsToBulk(10, "TABLET", 1, "UNIT").bulk).toBe(10);
  expect(packsToBulk(10, "KG", 5, "UNIT").error).toBeTruthy();
  expect(packsToBulk(10, "TABLET", 1, "G_ML").error).toBeTruthy();
});

test("packsToBulk rejects unknown units and non-positive inputs", () => {
  expect(packsToBulk(10, "KG", 500, "L").error).toBeTruthy();
  expect(packsToBulk(0, "KG", 5, "KG_LIT").error).toBeTruthy();
  expect(packsToBulk(10, "KG", 0, "KG_LIT").error).toBeTruthy();
});

// --- production raw materials (same pairs, no pack arithmetic) --------------

test("an amount typed in g/ml or kg/lit converts into the item's stock unit", async () => {
  const { amountToStockUnit } = await import("../src/lib/units");
  expect(amountToStockUnit(500, "KG", "G_ML").bulk).toBe(0.5);
  expect(amountToStockUnit(500, "LIT", "G_ML").bulk).toBe(0.5);
  expect(amountToStockUnit(2, "G", "KG_LIT").bulk).toBe(2000);
  expect(amountToStockUnit(2, "ML", "KG_LIT").bulk).toBe(2000);
  // Already in the item's unit: face value.
  expect(amountToStockUnit(7.5, "KG", "KG_LIT").bulk).toBe(7.5);
  expect(amountToStockUnit(10, "TABLET", "UNIT").bulk).toBe(10);
});

test("a production amount must be positive and match the item's dimension", async () => {
  const { amountToStockUnit, hasKnownUnit } = await import("../src/lib/units");
  expect(amountToStockUnit(0, "KG", "KG_LIT").error).toBeTruthy();
  expect(amountToStockUnit(5, "TABLET", "G_ML").error).toBeTruthy();
  expect(amountToStockUnit(5, "KG", "UNIT").error).toBeTruthy();
  // A free-typed legacy unit is not a measure, so the page keeps the number as-is.
  expect(amountToStockUnit(5, "BOX", "G_ML").error).toBeTruthy();
  expect(hasKnownUnit("BOX")).toBe(false);
  expect(hasKnownUnit("KG")).toBe(true);
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

test("jv account labels are names only", async () => {
  const { accountLabel } = await import("../src/pages/JournalVouchersPage");
  const { filterOptions } = await import("../src/components/SearchableSelect");
  const kashif = {
    id: 3,
    account_code: "1111",
    account_name: "Kashif",
    account_type: "ASSET" as const,
    account_subtype: null,
    parent_account_id: 2,
    opening_balance: 0,
    is_system_account: 0,
    is_active: 1,
  };
  expect(accountLabel(kashif)).toBe("1111 — Kashif");
  expect(filterOptions([{ value: "3", label: accountLabel(kashif) }], "kashif")).toHaveLength(1);
});

test("picking a group narrows the account list to that branch", async () => {
  const { subtreeIds } = await import("../src/pages/JournalVouchersPage");
  const base = { account_type: "ASSET" as const, account_subtype: null, opening_balance: 0, is_system_account: 0, is_active: 1 };
  const accounts = [
    { ...base, id: 1, account_code: "1100", account_name: "Assets", parent_account_id: null },
    { ...base, id: 2, account_code: "1110", account_name: "Admin Salary", parent_account_id: 1 },
    { ...base, id: 3, account_code: "1111", account_name: "Kashif", parent_account_id: 2 },
    { ...base, id: 4, account_code: "1120", account_name: "Marketing", parent_account_id: 1 },
    { ...base, id: 5, account_code: "1121", account_name: "Kashif", parent_account_id: 4 },
  ];
  expect([...subtreeIds(accounts, 2)]).toEqual([3]);
  expect([...subtreeIds(accounts, 1)].sort()).toEqual([2, 3, 4, 5]);
  expect([...subtreeIds(accounts, 3)]).toEqual([]);
});

test("journal vouchers only offer COA accounts at level 3 or deeper", async () => {
  const { postableAccounts } = await import("../src/pages/JournalVouchersPage");
  const base = { account_type: "ASSET" as const, account_name: "x", account_subtype: null, opening_balance: 0, is_system_account: 0, is_active: 1 };
  const a = (id: number, parent: number | null) => ({ ...base, id, account_code: String(id), parent_account_id: parent });
  const accounts = [
    a(1, null), // L1 header
    a(2, 1), //    L2 header
    a(3, 2), //    L3 ledger — kept
    a(4, 2), //    L3 header
    a(5, 4), //    L4 header
    a(6, 5), //    L5 ledger — kept (level 3 and deeper)
    a(7, null), // L1 ledger — too shallow
    a(8, 9),
    a(9, 8), //    parent cycle: both are headers, and depth must not hang
  ];
  expect(postableAccounts(accounts).map((account) => account.id)).toEqual([3, 6]);
});

test("a blank account falls back to the group only at level 3 or deeper", async () => {
  const { journalLineAccountId, accountDepths } = await import("../src/pages/JournalVouchersPage");
  const base = { account_type: "ASSET" as const, account_name: "x", account_code: "x", account_subtype: null, opening_balance: 0, is_system_account: 0, is_active: 1 };
  const a = (id: number, parent: number | null) => ({ ...base, id, parent_account_id: parent });
  const depths = accountDepths([a(1, null), a(2, 1), a(3, 2), a(4, 3)]);

  expect(journalLineAccountId({ accountId: 4, parentId: 3 }, depths)).toBe(4);
  expect(journalLineAccountId({ accountId: 0, parentId: 3 }, depths)).toBe(3); // level 3 group
  expect(journalLineAccountId({ accountId: 0, parentId: 2 }, depths)).toBe(0); // too shallow to post
  expect(journalLineAccountId({ accountId: 0, parentId: 0 }, depths)).toBe(0);
});

test("a new journal line inherits the narration above it, still editable", async () => {
  const { withNewLine } = await import("../src/pages/JournalVouchersPage");
  const line = (description: string) => ({ accountId: 0, parentId: 0, description, debit: "", credit: "" });

  let lines = [line("hello")];
  for (let i = 0; i < 4; i++) lines = withNewLine(lines);
  expect(lines.map((l) => l.description)).toEqual(["hello", "hello", "hello", "hello", "hello"]);

  // Editing the copy leaves the row above untouched.
  lines[lines.length - 1] = { ...lines[lines.length - 1], description: "world" };
  expect(withNewLine(lines).at(-1)?.description).toBe("world");
  expect(lines[0].description).toBe("hello");
});

// --- list sorting and date filters (components/Sort) ---------------------

test("sortRows orders numbers and text, and invoice numbers naturally", async () => {
  const { sortRows } = await import("../src/components/Sort");
  const items = [
    { code: "INV-10", stock: 30 },
    { code: "INV-2", stock: 5 },
    { code: "INV-1", stock: 0 },
  ];
  const byCode = sortRows(items, { key: "code", dir: 1 }, (row, key) => row[key as "code"]);
  expect(byCode.map((row) => row.code)).toEqual(["INV-1", "INV-2", "INV-10"]);
  const byStock = sortRows(items, { key: "stock", dir: 1 }, (row, key) => row[key as "stock"]);
  expect(byStock.map((row) => row.stock)).toEqual([0, 5, 30]);
  expect(sortRows(items, null, () => "")).toBe(items);
});

test("inDateRange is inclusive and open-ended", async () => {
  const { inDateRange } = await import("../src/components/Sort");
  expect(inDateRange("2026-10-25", "", "")).toBe(true);
  expect(inDateRange("2026-10-25", "2026-10-25", "2026-10-25")).toBe(true);
  expect(inDateRange("2026-10-24", "2026-10-25", "")).toBe(false);
  expect(inDateRange("2026-10-26", "", "2026-10-25")).toBe(false);
  expect(inDateRange(null, "", "")).toBe(true);
  expect(inDateRange(null, "2026-10-25", "")).toBe(false);
});
