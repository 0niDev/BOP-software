/**
 * Chart-of-accounts layout for the trial balance.
 *
 * The CoA page is the reference: sections in CoA order (assets → expenses),
 * sub-accounts indented under their parent, and a subtotal per type. The Trial
 * Balance tab, the Excel workbook and the trial-balance section of the
 * "all reports" bundle all render from this one helper, so the printed report
 * always reads the same way as the screen and can never disagree with it.
 */
import type { AccountType } from "../domain/enums.js";
import type { TrialBalanceRow } from "./accountingService.js";

/** Chart-of-accounts order: assets, liabilities, equity, revenue, expenses. */
export const COA_TYPE_ORDER: readonly AccountType[] = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
];

export const TYPE_LABELS: Record<AccountType, string> = {
  ASSET: "Assets",
  LIABILITY: "Liabilities",
  EQUITY: "Equity",
  REVENUE: "Revenue",
  EXPENSE: "Expenses",
};

/** One account as it appears in the report: how deep it sits, and whether it
 * has sub-accounts printed beneath it (a CoA "header"). */
export interface TrialBalanceTreeRow extends TrialBalanceRow {
  depth: number;
  hasChildren: boolean;
}

export interface TrialBalanceSection {
  type: AccountType;
  label: string;
  rows: TrialBalanceTreeRow[];
  /** Closing-column subtotal for the section. */
  closingDebit: number;
  closingCredit: number;
}

/** Account codes sort naturally ("999" before "1000", "AC-9" before "AC-10"). */
export function compareAccountCode(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
}

/**
 * Group the trial balance the way the CoA page presents it: type sections in
 * CoA order, each a tree of accounts by parent, siblings in code order, with a
 * closing subtotal per section.
 *
 * A sub-account whose parent is not in the rows (filtered out, deactivated, or
 * of another type) prints as a root of its own section rather than vanishing,
 * and rows caught in a parent cycle are appended as roots so no account can
 * drop out of the report.
 */
export function layoutTrialBalance(
  rows: readonly TrialBalanceRow[],
): TrialBalanceSection[] {
  const rowsByType = new Map<AccountType, TrialBalanceRow[]>();
  for (const row of rows) {
    const list = rowsByType.get(row.accountType);
    if (list) list.push(row);
    else rowsByType.set(row.accountType, [row]);
  }

  const sections: TrialBalanceSection[] = [];
  for (const type of COA_TYPE_ORDER) {
    const typeRows = rowsByType.get(type) ?? [];
    if (typeRows.length === 0) continue;

    const byId = new Map(typeRows.map((row) => [row.accountId, row]));
    const childrenByParent = new Map<number, TrialBalanceRow[]>();
    for (const row of typeRows) {
      const parentId = row.parentAccountId;
      if (parentId == null || parentId === row.accountId) continue;
      if (!byId.has(parentId)) continue;
      const siblings = childrenByParent.get(parentId) ?? [];
      siblings.push(row);
      childrenByParent.set(parentId, siblings);
    }
    for (const siblings of childrenByParent.values()) {
      siblings.sort((a, b) => compareAccountCode(a.accountCode, b.accountCode));
    }

    const isRoot = (row: TrialBalanceRow): boolean => {
      const parentId = row.parentAccountId;
      return parentId == null || parentId === row.accountId || !byId.has(parentId);
    };
    const roots = typeRows
      .filter(isRoot)
      .sort((a, b) => compareAccountCode(a.accountCode, b.accountCode));

    const laidOut: TrialBalanceTreeRow[] = [];
    const placed = new Set<number>();
    const walk = (row: TrialBalanceRow, depth: number): void => {
      if (placed.has(row.accountId)) return;
      placed.add(row.accountId);
      const children = childrenByParent.get(row.accountId) ?? [];
      laidOut.push({ ...row, depth, hasChildren: children.length > 0 });
      for (const child of children) walk(child, depth + 1);
    };
    for (const root of roots) walk(root, 0);

    // Defensive: a parent cycle leaves rows unreachable from any root.
    const byCode = [...typeRows].sort((a, b) => compareAccountCode(a.accountCode, b.accountCode));
    for (const row of byCode) {
      if (!placed.has(row.accountId)) walk(row, 0);
    }

    sections.push({
      type,
      label: TYPE_LABELS[type],
      rows: laidOut,
      closingDebit: laidOut.reduce((sum, row) => sum + row.closingDebit, 0),
      closingCredit: laidOut.reduce((sum, row) => sum + row.closingCredit, 0),
    });
  }
  return sections;
}
