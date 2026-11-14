import { test, expect } from "vitest";
import { formatDate } from "../src/lib/format";
import { defaultPackUnit, packsToBulk } from "../src/lib/units";
import type { CustomReport } from "../src/types";

test("PL notes subtotal each header to its nested accounts", async () => {
  const { headerTotals } = await import("../src/components/PLNotes");
  const rows = [
    { accountId: 1, code: "5100", name: "COGS", depth: 0, value: 0, selected: true, isHeader: true },
    { accountId: 2, code: "5110", name: "Raw Material", depth: 1, value: 0, selected: false, isHeader: true },
    { accountId: 3, code: "5111", name: "Raw A", depth: 2, value: 800, selected: false, isHeader: false },
    { accountId: 4, code: "5120", name: "Direct Labour", depth: 1, value: 600, selected: false, isHeader: false },
  ];
  const totals = headerTotals(rows);
  expect(totals.get(1)).toBe(1400);
  expect(totals.get(2)).toBe(800);
  expect(totals.has(3)).toBe(false);
});

test("dates always display day/month/year", () => {
  expect(formatDate("2026-10-25")).toBe("25/10/2026");
  expect(formatDate("2026-10-25T09:05:00Z", true)).toBe("25/10/2026 09:05");
  expect(formatDate("")).toBe("");
});

test("P&L summary mirrors the edited custom headings", async () => {
  const { plSummaryRows } = await import("../src/components/ProfitLossSummary");
  const headings = [
    { id: "sales-net", name: "Sales - Net", note: "20", kind: "accounts" as const, value: 1000 },
    { id: "my-extra", name: "My Extra Heading", note: "21", kind: "accounts" as const, value: 25 },
    { id: "cost-of-sales", name: "Cost Total", note: "21", kind: "subtotal" as const, value: 300 },
    { id: "gross-profit", name: "Gross Profit/(Loss)", kind: "subtotal" as const, value: 700 },
  ];
  const report: CustomReport = {
    kind: "PL",
    headings: headings.map((heading) => ({
      ...heading,
      accountIds: [],
      parts: [],
      rows: [],
    })),
    unassigned: { value: 0, rows: [] },
    footer: [],
    balanced: null,
  };
  const rows = plSummaryRows(report);

  // Order, names, notes and values all come straight from the saved headings.
  expect(rows.map((row) => row.name)).toEqual([
    "Sales - Net",
    "My Extra Heading",
    "Cost Total",
    "Gross Profit/(Loss)",
  ]);
  expect(rows.map((row) => row.note ?? "")).toEqual(["20", "21", "21", ""]);
  expect(rows.map((row) => row.value)).toEqual([1000, 25, 300, 700]);
  // Subtotals print bold, account headings do not.
  expect(rows.map((row) => row.bold)).toEqual([false, false, true, true]);
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

test("jv option labels include the account level", async () => {
  const { accountLevelLabel, accountDepths } = await import("../src/pages/JournalVouchersPage");
  const base = { account_type: "ASSET" as const, account_name: "x", account_subtype: null, opening_balance: 0, is_system_account: 0, is_active: 1 };
  const a = (id: number, parent: number | null, name: string) => ({ ...base, id, account_code: String(id), account_name: name, parent_account_id: parent });
  const accounts = [a(1, null, "Assets"), a(2, 1, "Current Assets"), a(3, 2, "Cash")];
  const depths = accountDepths(accounts);
  expect(accountLevelLabel(accounts[0], depths)).toBe("[L1] 1 — Assets");
  expect(accountLevelLabel(accounts[1], depths)).toBe("[L2] 2 — Current Assets");
  expect(accountLevelLabel(accounts[2], depths)).toBe("[L3] 3 — Cash");
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

test("journal groups are level-3 categories with their level-4 accounts", async () => {
  const { journalGroups } = await import("../src/pages/JournalVouchersPage");
  const base = { account_type: "ASSET" as const, account_name: "x", account_subtype: null, opening_balance: 0, is_system_account: 0, is_active: 1 };
  const a = (id: number, parent: number | null, code = String(id)) => ({ ...base, id, account_code: code, parent_account_id: parent });
  const accounts = [
    a(1, null), // L1 header
    a(2, 1), //    L2 header
    a(3, 2), //    L3 Cash and Bank — a group
    a(4, 3), //      L4 Cash at Head Office
    a(5, 3), //      L4 Cash at Mills
    a(6, 2), //    L3 Rent, no children — posts on its own
    a(7, null, "4000"), // a flat, childless L1 account — its own group too
  ];
  const groups = journalGroups(accounts);

  expect(groups.map(({ group }) => group.id)).toEqual([3, 6, 7]);
  expect(groups[0].items.map((item) => item.id)).toEqual([4, 5]);
  expect(groups[1].items.map((item) => item.id)).toEqual([6]);
  expect(groups[2].items.map((item) => item.id)).toEqual([7]);
});

test("a journal group skips a level-4 header for the accounts beneath it", async () => {
  const { journalGroups } = await import("../src/pages/JournalVouchersPage");
  const base = { account_type: "ASSET" as const, account_name: "x", account_subtype: null, opening_balance: 0, is_system_account: 0, is_active: 1 };
  const a = (id: number, parent: number | null) => ({ ...base, id, account_code: String(id), parent_account_id: parent });
  const accounts = [a(1, null), a(2, 1), a(3, 2), a(4, 3), a(5, 4)];

  // 3 (L3) > 4 (L4 header) > 5 (L5 ledger): only the ledger account is offered.
  expect(journalGroups(accounts)[0].items.map((item) => item.id)).toEqual([5]);
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
  const line = (description: string) => ({ accountId: 0, parentId: 0, partyId: 0, description, debit: "", credit: "" });

  let lines = [line("hello")];
  for (let i = 0; i < 4; i++) lines = withNewLine(lines);
  expect(lines.map((l) => l.description)).toEqual(["hello", "hello", "hello", "hello", "hello"]);

  // Editing the copy leaves the row above untouched.
  lines[lines.length - 1] = { ...lines[lines.length - 1], description: "world" };
  expect(withNewLine(lines).at(-1)?.description).toBe("world");
  expect(lines[0].description).toBe("hello");
});

test("journal lines offer the parties that sit under the chosen account", async () => {
  const { partiesForAccount } = await import("../src/pages/JournalVouchersPage");
  const party = (id: number, accountId: number | null, partyType: "CUSTOMER" | "SUPPLIER") => ({
    id,
    code: `P-${id}`,
    name: `Party ${id}`,
    party_type: partyType,
    customer_category: null,
    phone: null,
    address: null,
    email: null,
    opening_balance: 0,
    opening_balance_date: null,
    credit_limit: 0,
    account_id: accountId,
    is_active: 1,
  });
  const parties = [
    party(1, 3, "CUSTOMER"), // linked to A/R
    party(2, null, "CUSTOMER"), // unlinked → A/R
    party(3, null, "SUPPLIER"), // unlinked → A/P
    party(4, 14, "SUPPLIER"), // linked to A/P
  ];

  const idsUnder = (accountId: number) =>
    partiesForAccount(parties, accountId, 3, 14).map((p) => p.id);
  expect(idsUnder(3)).toEqual([1, 2]);
  expect(idsUnder(14)).toEqual([3, 4]);
  expect(idsUnder(0)).toEqual([]);
  expect(idsUnder(1000)).toEqual([]);
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

// --- expense form tree (pages/ExpensesPage) ------------------------------

test("expense form posts level-4 items, or the level-3 itself when it has none", async () => {
  const { expenseCategories } = await import("../src/pages/ExpensesPage");
  const account = (id: number, code: string, parent: number | null) => ({
    id,
    account_code: code,
    account_name: code,
    account_type: "EXPENSE" as const,
    account_subtype: null,
    parent_account_id: parent,
    opening_balance: 0,
    is_system_account: 0,
    is_active: 1,
  });
  const groups = expenseCategories([
    account(1, "5", null), // level 1
    account(2, "52", 1), // level 2
    account(3, "5201", 2), // level 3 category
    account(4, "52011", 3), // level 4 item
    account(5, "52012", 3), // level 4 item
    account(6, "520111", 4), // level 5, never offered
    account(7, "5207", 2), // level 3 with no level 4
    account(8, "6000", null), // flat bootstrap root
  ]);
  const items = Object.fromEntries(
    groups.map((group) => [group.account.account_code, group.items.map((item) => item.account_code)]),
  );
  expect(items["5201"]).toEqual(["52011", "52012"]);
  expect(items["5207"]).toEqual(["5207"]);
  expect(items["6000"]).toEqual(["6000"]);
  expect(items["5"]).toBeUndefined();
  expect(items["52"]).toBeUndefined();
  expect(Object.values(items).flat()).not.toContain("520111");
});

test("new categories go under a level-2 head, new items under a level-3 category", async () => {
  const { expenseHeads, categoryHead, itemCategory } = await import("../src/pages/ExpensesPage");
  const account = (id: number, code: string, parent: number | null) => ({
    id,
    account_code: code,
    account_name: code,
    account_type: "EXPENSE" as const,
    account_subtype: null,
    parent_account_id: parent,
    opening_balance: 0,
    is_system_account: 0,
    is_active: 1,
  });
  const accounts = [
    account(1, "5", null), // level 1
    account(2, "52", 1), // level 2 head with categories
    account(3, "5201", 2), // level 3 category
    account(4, "52011", 3), // level 4 item
    account(5, "520111", 4), // level 5, walks up to the category
    account(6, "5207", 2), // level 3 with no level 4
    account(7, "6000", null), // flat bootstrap root
    account(8, "53", 1), // childless level 2 = its own category
  ];
  // Only heads that already hold categories may take new categories.
  expect(expenseHeads(accounts).map((head) => head.id)).toEqual([2]);
  // The head above a category, for pre-filling the "Under" choice.
  expect(categoryHead(accounts, 3)).toBe(2);
  expect(categoryHead(accounts, 6)).toBe(2);
  expect(categoryHead(accounts, 7)).toBe(0);
  // Items always resolve to a real level-3 category; roots take none.
  expect(itemCategory(accounts, 3)).toBe(3);
  expect(itemCategory(accounts, 4)).toBe(3);
  expect(itemCategory(accounts, 5)).toBe(3);
  expect(itemCategory(accounts, 6)).toBe(6);
  expect(itemCategory(accounts, 7)).toBe(0);
  expect(itemCategory(accounts, 8)).toBe(0);
});

test("category picker offers level-4 items whose value is the item's own id", async () => {
  const { categoryOptions, expenseCategories } = await import("../src/pages/ExpensesPage");
  const account = (id: number, code: string, parent: number | null) => ({
    id,
    account_code: code,
    account_name: code,
    account_type: "EXPENSE" as const,
    account_subtype: null,
    parent_account_id: parent,
    opening_balance: 0,
    is_system_account: 0,
    is_active: 1,
  });
  const groups = expenseCategories([
    account(1, "5", null),
    account(2, "52", 1),
    account(3, "5201", 2), // level 3 category
    account(4, "52011", 3), // level 4 item
    account(7, "5207", 2), // level 3 with no level 4
  ]);
  const options = categoryOptions(groups);
  expect(options).toEqual([
    { value: "3", label: "5201 - 5201" },
    { value: "4", label: "52011 - 52011 (5201)" },
    { value: "7", label: "5207 - 5207" },
  ]);
});
