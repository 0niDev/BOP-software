/**
 * Chart-of-accounts layout for the trial balance: the same organization the
 * CoA page shows (type sections in CoA order, sub-accounts nested under their
 * parent, a closing subtotal per section), as consumed by the Excel workbook
 * and the "all reports" bundle.
 */
import { describe, expect, it } from "vitest";
import type { TrialBalanceRow } from "../src/services/accountingService.js";
import { compareAccountCode, layoutTrialBalance } from "../src/services/trialBalanceLayout.js";

/** A row with only the fields the layout cares about, plus a closing balance. */
function row(
  accountId: number,
  accountCode: string,
  accountType: TrialBalanceRow["accountType"],
  closingDebit: number,
  parentAccountId: number | null = null,
): TrialBalanceRow {
  return {
    accountId,
    accountCode,
    displayCode: accountCode,
    accountName: `Account ${accountCode}`,
    accountType,
    parentAccountId,
    openingDebit: 0,
    openingCredit: 0,
    debit: 0,
    credit: 0,
    closingDebit,
    closingCredit: 0,
  };
}

describe("layoutTrialBalance", () => {
  it("orders sections like the CoA, whatever order the rows arrive in", () => {
    const sections = layoutTrialBalance([
      row(1, "4000", "REVENUE", 0),
      row(2, "1000", "ASSET", 0),
      row(3, "3000", "EQUITY", 0),
      row(4, "2000", "LIABILITY", 0),
      row(5, "5000", "EXPENSE", 0),
    ]);
    expect(sections.map((section) => section.type)).toEqual([
      "ASSET",
      "LIABILITY",
      "EQUITY",
      "REVENUE",
      "EXPENSE",
    ]);
    expect(sections.map((section) => section.label)).toEqual([
      "Assets",
      "Liabilities",
      "Equity",
      "Revenue",
      "Expenses",
    ]);
    // A type with no accounts gets no section.
    expect(layoutTrialBalance([row(1, "1000", "ASSET", 0)]).map((s) => s.type)).toEqual(["ASSET"]);
  });

  it("nests sub-accounts under their parent, siblings in account-code order", () => {
    const [assets] = layoutTrialBalance([
      row(3, "1503", "ASSET", 3, 1),
      row(2, "1501", "ASSET", 1, 1),
      row(1, "1500", "ASSET", 0),
    ]);
    expect(assets!.rows.map((r) => [r.accountCode, r.depth, r.hasChildren])).toEqual([
      ["1500", 0, true],
      ["1501", 1, false],
      ["1503", 1, false],
    ]);
  });

  it("subtotals the closing columns per section", () => {
    const sections = layoutTrialBalance([
      row(1, "1000", "ASSET", 10),
      row(2, "1100", "ASSET", 7.5),
      row(3, "4000", "REVENUE", 0),
    ]);
    expect(sections[0]!.closingDebit).toBe(17.5);
    expect(sections[0]!.closingCredit).toBe(0);
    expect(sections[1]!.rows).toHaveLength(1);
  });

  it("prints a sub-account whose parent is missing as a root, not a lost row", () => {
    const [assets] = layoutTrialBalance([row(2, "1100", "ASSET", 5, 999)]);
    expect(assets!.rows.map((r) => [r.accountCode, r.depth])).toEqual([["1100", 0]]);
  });

  it("keeps every account even if the parent links form a cycle", () => {
    const [assets] = layoutTrialBalance([
      row(1, "1000", "ASSET", 1, 2),
      row(2, "1100", "ASSET", 2, 1),
    ]);
    expect(assets!.rows.map((r) => r.accountCode).sort()).toEqual(["1000", "1100"]);
  });
});

describe("compareAccountCode", () => {
  it("sorts numerically rather than as text", () => {
    expect(["1000", "900", "AC-10", "AC-9"].sort(compareAccountCode)).toEqual([
      "900",
      "1000",
      "AC-9",
      "AC-10",
    ]);
  });
});
