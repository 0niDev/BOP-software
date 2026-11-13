/**
 * Editable Profit & Loss / Balance Sheet headings.
 *
 * A template is a list of headings. An "accounts" heading sums the
 * chart-of-accounts nodes the user picked — picking a parent covers its whole
 * subtree — and a "subtotal" heading is a signed sum of other account headings.
 * Values come from AccountingService.getTrialBalance: period movement for the
 * P&L, closing balances as at a date for the balance sheet, so a custom report
 * can never disagree with the standard one.
 *
 * Templates are stored as JSON in `settings` (group REPORTS, one key per
 * statement), so this feature needs no schema migration.
 */
import type { AccountType } from "../domain/enums.js";
import { ValidationError } from "../domain/errors.js";
import { formatDayMonthYear } from "../domain/dateValidation.js";
import { Decimal, toStorage } from "../domain/money.js";
import type { SqlDatabase } from "../db/types.js";
import { AccountRepository, type AccountRow } from "../repositories/accountRepository.js";
import { SettingsRepository } from "../repositories/settingsRepository.js";
import {
  AccountingService,
  type TrialBalanceRow,
} from "./accountingService.js";
import { csvEscape } from "./reportService.js";
import { compareAccountCode } from "./trialBalanceLayout.js";

export type CustomReportKind = "PL" | "BS";

export interface CustomHeadingPart {
  headingId: string;
  sign: 1 | -1;
}

export interface CustomHeading {
  id: string;
  name: string;
  /** Printed note/reference number, e.g. 20-29 on the printed P&L. */
  note?: string;
  /** "accounts" sums CoA nodes; "subtotal" adds/subtracts other headings. */
  kind: "accounts" | "subtotal";
  /** P&L only: "opening" reads balances carried into the period. */
  basis?: "opening";
  accountIds: number[];
  /** Account headings only: subtrees left out of this heading. */
  excludedAccountIds?: number[];
  /** Subtotal headings only: the account headings it adds and subtracts. */
  parts: CustomHeadingPart[];
}

/** One printed line: a picked node, one of its sub-accounts, or an unassigned account. */
export interface CustomReportRow {
  accountId: number;
  code: string;
  name: string;
  depth: number;
  /** The account's own value (not its subtree's), in its natural sign. */
  value: number;
  /** Explicitly picked by the user, so it keeps a zero line. */
  selected: boolean;
  /** Has sub-account lines printed under it. */
  isHeader: boolean;
}

export interface CustomReportHeadingResult extends CustomHeading {
  value: number;
  rows: CustomReportRow[];
}

export interface CustomReportResult {
  kind: CustomReportKind;
  headings: CustomReportHeadingResult[];
  /** Accounts no heading covers, so the report still ties out. */
  unassigned: { value: number; rows: CustomReportRow[] };
  /** Standard-report totals for the footer. */
  footer: Array<{ label: string; value: number }>;
  /** Balance sheet only; null for the P&L. */
  balanced: boolean | null;
}

export interface CustomReportOptions {
  from?: string | null;
  to?: string | null;
  /** Balance sheet "as at" date (defaults to `to`, else everything posted). */
  asAt?: string | null;
}

const SETTINGS_GROUP = "REPORTS";
const SETTING_KEYS: Record<CustomReportKind, string> = {
  PL: "custom_pl_report",
  BS: "custom_bs_report",
};

export const MAX_CUSTOM_HEADINGS = 50;
const MAX_HEADING_NAME = 80;
const MAX_HEADING_ID = 40;
const MAX_NOTE = 20;
/** Virtual account id for the balance sheet's unposted profit line. */
export const NET_PROFIT_ACCOUNT_ID = 0;
const NET_PROFIT_LABEL = "Net profit (P&L)";
/** Virtual account id for profit earned before the selected P&L period. */
export const OPENING_PROFIT_ACCOUNT_ID = -1;
const OPENING_PROFIT_LABEL = "Opening profit/(loss) before period";

/** Account types each statement may reference. */
const REPORT_TYPES: Record<CustomReportKind, readonly AccountType[]> = {
  PL: ["REVENUE", "EXPENSE"],
  BS: ["ASSET", "LIABILITY", "EQUITY"],
};

/** Account types a heading may reference, including the opening-profit exception. */
function allowedTypes(kind: CustomReportKind, basis?: "opening"): ReadonlySet<AccountType> {
  return new Set(basis === "opening" ? (["EQUITY"] as const) : REPORT_TYPES[kind]);
}

function byAccountCode(a: { account_code: string }, b: { account_code: string }): number {
  return compareAccountCode(a.account_code, b.account_code);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function dedupeParts(parts: readonly CustomHeadingPart[]): CustomHeadingPart[] {
  const seen = new Map<string, 1 | -1>();
  for (const part of parts) {
    if (!seen.has(part.headingId)) seen.set(part.headingId, part.sign);
  }
  return [...seen.entries()].map(([headingId, sign]) => ({ headingId, sign }));
}

/** Roots of one type: accounts with no parent inside the same type. */
function rootAccounts(accounts: readonly AccountRow[], type: AccountType): AccountRow[] {
  const typeIds = new Set(
    accounts
      .filter((account) => account.account_type === type && account.is_active === 1)
      .map((account) => account.id),
  );
  return accounts
    .filter(
      (account) =>
        account.account_type === type &&
        account.is_active === 1 &&
        (account.parent_account_id == null || !typeIds.has(account.parent_account_id)),
    )
    .sort(byAccountCode);
}

/** Starting headings: the printed "Profit and Loss (Spinning)" layout. */
function defaultTemplate(kind: CustomReportKind, accounts: readonly AccountRow[]): CustomHeading[] {
  if (kind === "BS") {
    return [
      { id: "assets", name: "Assets", kind: "accounts", accountIds: rootAccounts(accounts, "ASSET").map((a) => a.id), parts: [] },
      { id: "liabilities", name: "Liabilities", kind: "accounts", accountIds: rootAccounts(accounts, "LIABILITY").map((a) => a.id), parts: [] },
      {
        id: "equity",
        name: "Equity",
        kind: "accounts",
        accountIds: [...rootAccounts(accounts, "EQUITY").map((a) => a.id), NET_PROFIT_ACCOUNT_ID],
        parts: [],
      },
    ];
  }

  const byCode = new Map(accounts.map((account) => [account.account_code, account.id]));
  const ids = (...codes: string[]): number[] =>
    codes.flatMap((code) => {
      const id = byCode.get(code);
      return id == null ? [] : [id];
    });
  const account = (
    id: string,
    name: string,
    note: string,
    codes: string[] = [],
    excludedCodes: string[] = [],
  ): CustomHeading => {
    const excludedAccountIds = ids(...excludedCodes);
    return {
      id,
      name,
      note,
      kind: "accounts",
      accountIds: ids(...codes),
      ...(excludedAccountIds.length > 0 ? { excludedAccountIds } : {}),
      parts: [],
    };
  };
  const subtotal = (
    id: string,
    name: string,
    parts: Array<[string, 1 | -1]>,
    note?: string,
  ): CustomHeading => ({
    id,
    name,
    ...(note ? { note } : {}),
    kind: "subtotal",
    accountIds: [],
    parts: parts.map(([headingId, sign]) => ({ headingId, sign })),
  });

  // Sales - Net is intentionally unmapped; the user will select its accounts.
  const costCategories: CustomHeading[] = [
    account("discount", "Discount", "21", ["512"]),
    account("cost-of-goods-sold", "Cost of Goods Sold", "21", ["511"]),
    account("waste", "Waste", "21", ["514"]),
    account("selling-distribution-cost", "Selling & Distribution", "21", ["6100", "5206"]),
    account(
      "utility-expense",
      "Utility Expense",
      "21",
      ["520901", "520902", "520903", "520904", "540"],
    ),
    account("advertisement", "Advertisement", "21", ["520905"]),
    account("other-cost", "Other Expenses", "21", ["54"]),
    account("raw-materials", "Raw Materials", "21", ["56"]),
    account("packing-material", "Packing Material", "21", ["58"], ["33006"]),
    account("misc-cost", "Miscellaneous Expenses", "21", ["33006"]),
    account(
      "repair-vehicle",
      "Repair Vehicle",
      "21",
      ["59"],
      [
        "540",
        "5203",
        "34100",
        "34350",
        "52063",
        "64008",
        "ACCOUNT-00014",
        "34550003",
        "34550004",
      ],
    ),
    account("depreciation", "Depreciation", "21", ["5203"]),
    account("salaries-wages-mfg", "Salaries & Wages", "21", ["34100"]),
    account("repair-maintenance", "Repair & Maintenance", "21", ["34350"]),
    account("insurance", "Insurance", "21", ["52063"]),
  ];
  const costParts = costCategories.map((heading): [string, 1] => [heading.id, 1]);

  const adminCategories: CustomHeading[] = [
    account(
      "salaries-wages-admin",
      "Salaries & Wages",
      "22",
      ["52"],
      ["5202", "5205", "5206", "5207", "5208", "5209", "5210", "ACCOUNT-00017"],
    ),
    account("fees", "Fees", "22", ["ACCOUNT-00017"]),
    account("other-maintenance", "Other", "22", ["5202"], ["52022"]),
    account("ho-furniture", "HO Furniture", "22", ["52022"]),
    account("travel-conveyance", "Travel & Conveyance", "22", ["5205", "ACCOUNT-00014"]),
    account("zakat", "Zakat", "22", ["5207", "520906"]),
    account("fee-subscription", "Fee & Subscription", "22", ["5208"]),
    account(
      "other-overhead",
      "Other",
      "22",
      ["5209"],
      ["520901", "520902", "520903", "520904", "520905", "520906", "520910"],
    ),
    account("misc-admin", "Miscellaneous Expenses", "22", ["34550003", "64008"]),
    account("vehicle-token-tax", "Vehicle Token Tax & Others", "22", ["34550004"]),
  ];
  const adminParts = adminCategories.map((heading): [string, 1] => [heading.id, 1]);

  const financeCategories: CustomHeading[] = [
    account("financial-expenses", "Financial Expenses", "25", ["5210"], ["52101", "52102", "ACCOUNT-00013"]),
    account("bank-charges", "Bank Charges", "25", ["52102"]),
    account("interest", "Interest", "25", ["52101", "ACCOUNT-00013"]),
  ];
  const financeParts = financeCategories.map((heading): [string, 1] => [heading.id, 1]);

  const profitParts: Array<[string, 1 | -1]> = [
    ["sales-net", 1],
    ["cost-of-sales", -1],
    ["administrative-expenses", -1],
    ["selling-distribution", -1],
    ["other-income", 1],
    ["financial-charges", -1],
    ["others", -1],
  ];

  return [
    account("sales-net", "Sales - Net", "20"),
    ...costCategories,
    subtotal("cost-of-sales", "Cost of Sales", costParts, "21"),
    subtotal("gross-profit", "Gross Profit/(Loss)", [
      ["sales-net", 1],
      ["cost-of-sales", -1],
    ]),
    ...adminCategories,
    subtotal("administrative-expenses", "Administrative Expenses", adminParts, "22"),
    account("selling-distribution", "Promotional & Public Relations", "23", ["520910"]),
    subtotal("operating-expenses", "Operating Expenses", [
      ["administrative-expenses", 1],
      ["selling-distribution", 1],
    ]),
    subtotal("operating-profit", "Operating Profit/(Loss)", [
      ["sales-net", 1],
      ["cost-of-sales", -1],
      ["administrative-expenses", -1],
      ["selling-distribution", -1],
    ]),
    account("other-income", "Other Income", "24"),
    ...financeCategories,
    subtotal("financial-charges", "Financial Charges", financeParts, "25"),
    account("others", "Others", "26"),
    subtotal("profit-before-tax", "Profit/(Loss) Before Taxation", profitParts),
    account("taxation-current", "Taxation (Current)", "27", ["53"]),
    subtotal("profit-after-tax", "Profit/(Loss) After Taxation", [
      ...profitParts,
      ["taxation-current", -1],
    ]),
    account("prior-year-adjustment", "Prior Year Adjustment", "28"),
    {
      id: "accumulated-profit-bf",
      name: "Acc. Profit/(Loss) B/F (y/opening)",
      note: "29",
      kind: "accounts",
      basis: "opening",
      accountIds: [OPENING_PROFIT_ACCOUNT_ID],
      parts: [],
    },
    subtotal("profit-cf", "Profit/(Loss) C/F to B/Sheet", [
      ...profitParts,
      ["taxation-current", -1],
      ["prior-year-adjustment", 1],
      ["accumulated-profit-bf", 1],
    ]),
  ];
}

/**
 * Stored template → headings, dropping anything that no longer exists (deleted
 * accounts, renamed/deleted headings). A missing or unreadable template falls
 * back to the defaults, so a corrupt row can never take the report down.
 */
function readTemplate(
  raw: unknown,
  kind: CustomReportKind,
  accounts: readonly AccountRow[],
): CustomHeading[] | null {
  const record = asRecord(raw);
  if (!record || !Array.isArray(record.headings)) return null;

  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const headings: CustomHeading[] = [];
  const ids = new Set<string>();

  for (const item of record.headings) {
    const heading = asRecord(item);
    if (!heading) continue;
    const id = typeof heading.id === "string" ? heading.id.trim().slice(0, MAX_HEADING_ID) : "";
    const name = typeof heading.name === "string" ? heading.name.trim().slice(0, MAX_HEADING_NAME) : "";
    const note =
      typeof heading.note === "string" ? heading.note.trim().slice(0, MAX_NOTE) || undefined : undefined;
    if (!id || !name || ids.has(id)) continue;
    ids.add(id);

    if (heading.kind === "subtotal") {
      const parts = Array.isArray(heading.parts)
        ? heading.parts.flatMap((rawPart): CustomHeadingPart[] => {
            const part = asRecord(rawPart);
            if (!part || typeof part.headingId !== "string" || !part.headingId.trim()) return [];
            return [{ headingId: part.headingId.trim(), sign: part.sign === -1 ? -1 : 1 }];
          })
        : [];
      headings.push({
        id,
        name,
        ...(note ? { note } : {}),
        kind: "subtotal",
        accountIds: [],
        parts: dedupeParts(parts),
      });
      continue;
    }

    const basis = kind === "PL" && heading.basis === "opening" ? "opening" : undefined;
    const allowed = allowedTypes(kind, basis);
    const accountIds: number[] = [];
    for (const rawId of Array.isArray(heading.accountIds) ? heading.accountIds : []) {
      const accountId = Number(rawId);
      if (!Number.isInteger(accountId) || accountIds.includes(accountId)) continue;
      if (accountId === NET_PROFIT_ACCOUNT_ID) {
        if (kind === "BS") accountIds.push(accountId);
        continue;
      }
      if (accountId === OPENING_PROFIT_ACCOUNT_ID) {
        if (basis === "opening") accountIds.push(accountId);
        continue;
      }
      const account = accountsById.get(accountId);
      if (account && allowed.has(account.account_type)) accountIds.push(accountId);
    }
    const excludedAccountIds: number[] = [];
    for (const rawId of Array.isArray(heading.excludedAccountIds)
      ? heading.excludedAccountIds
      : []) {
      const accountId = Number(rawId);
      if (!Number.isInteger(accountId) || accountId <= 0) continue;
      if (accountIds.includes(accountId) || excludedAccountIds.includes(accountId)) continue;
      const account = accountsById.get(accountId);
      if (account && allowed.has(account.account_type)) excludedAccountIds.push(accountId);
    }
    headings.push({
      id,
      name,
      ...(note ? { note } : {}),
      ...(basis ? { basis } : {}),
      kind: "accounts",
      accountIds,
      ...(excludedAccountIds.length > 0 ? { excludedAccountIds } : {}),
      parts: [],
    });
  }

  // Subtotal parts may name an account heading anywhere, or an earlier
  // subtotal (never a later one, so the values stay acyclic), and never itself.
  const accountHeadingIds = new Set(
    headings.filter((heading) => heading.kind === "accounts").map((heading) => heading.id),
  );
  const subtotalIndex = new Map(
    headings.flatMap((heading, index) =>
      heading.kind === "subtotal" ? [[heading.id, index] as const] : [],
    ),
  );
  headings.forEach((heading, index) => {
    if (heading.kind !== "subtotal") return;
    heading.parts = dedupeParts(
      heading.parts.filter((part) => {
        if (part.headingId === heading.id) return false;
        if (accountHeadingIds.has(part.headingId)) return true;
        const partIndex = subtotalIndex.get(part.headingId);
        return partIndex != null && partIndex < index;
      }),
    );
  });
  return headings;
}

/** Strict counterpart of readTemplate, for a template being saved. */
function validateTemplate(
  raw: unknown,
  kind: CustomReportKind,
  accounts: readonly AccountRow[],
): CustomHeading[] {
  const record = asRecord(raw);
  if (!record || !Array.isArray(record.headings)) {
    throw new ValidationError("A custom report needs a headings list.");
  }
  if (record.headings.length > MAX_CUSTOM_HEADINGS) {
    throw new ValidationError(`A custom report can have at most ${MAX_CUSTOM_HEADINGS} headings.`);
  }

  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const ids = new Set<string>();
  const headings: CustomHeading[] = record.headings.map((item, index) => {
    const heading = asRecord(item);
    if (!heading) throw new ValidationError(`Heading ${index + 1} is invalid.`);
    const id = typeof heading.id === "string" ? heading.id.trim() : "";
    const name = typeof heading.name === "string" ? heading.name.trim() : "";
    if (!id || id.length > MAX_HEADING_ID) {
      throw new ValidationError(`Heading ${index + 1} needs an id of at most ${MAX_HEADING_ID} characters.`);
    }
    if (!name || name.length > MAX_HEADING_NAME) {
      throw new ValidationError(`Heading ${index + 1} needs a name of at most ${MAX_HEADING_NAME} characters.`);
    }
    if (ids.has(id)) throw new ValidationError(`Duplicate heading id '${id}'.`);
    ids.add(id);
    if (heading.note != null && typeof heading.note !== "string") {
      throw new ValidationError(`Heading '${name}' has an invalid note.`);
    }
    const note = typeof heading.note === "string" ? heading.note.trim() : "";
    if (note.length > MAX_NOTE) {
      throw new ValidationError(`Heading '${name}' has a note longer than ${MAX_NOTE} characters.`);
    }
    if (heading.basis != null && heading.basis !== "opening") {
      throw new ValidationError(`Heading '${name}' has an invalid value basis.`);
    }
    const basis = heading.basis === "opening" ? "opening" : undefined;
    if (basis && kind !== "PL") {
      throw new ValidationError("Only the profit & loss can use opening balances.");
    }

    if (heading.kind === "subtotal") {
      if (basis) throw new ValidationError(`Heading '${name}' cannot be a subtotal and use opening balances.`);
      const rawParts = Array.isArray(heading.parts) ? heading.parts : [];
      const parts: CustomHeadingPart[] = rawParts.map((rawPart, partIndex) => {
        const part = asRecord(rawPart);
        const headingId = part && typeof part.headingId === "string" ? part.headingId.trim() : "";
        if (!headingId) {
          throw new ValidationError(`Heading '${name}' has an invalid subtotal line ${partIndex + 1}.`);
        }
        if (part?.sign !== 1 && part?.sign !== -1) {
          throw new ValidationError(`Heading '${name}' has an invalid sign on '${headingId}'.`);
        }
        return { headingId, sign: part.sign };
      });
      if (new Set(parts.map((part) => part.headingId)).size !== parts.length) {
        throw new ValidationError(`Heading '${name}' lists the same heading twice.`);
      }
      if (parts.some((part) => part.headingId === id)) {
        throw new ValidationError(`Heading '${name}' cannot add itself.`);
      }
      return {
        id,
        name,
        ...(note ? { note } : {}),
        kind: "subtotal",
        accountIds: [],
        parts,
      };
    }

    if (heading.kind !== "accounts") {
      throw new ValidationError(`Heading '${name}' is neither an accounts nor a subtotal heading.`);
    }
    const allowed = allowedTypes(kind, basis);
    const accountIds: number[] = [];
    for (const rawId of Array.isArray(heading.accountIds) ? heading.accountIds : []) {
      const accountId = Number(rawId);
      if (!Number.isInteger(accountId)) {
        throw new ValidationError(`Heading '${name}' has an invalid account.`);
      }
      if (accountId === NET_PROFIT_ACCOUNT_ID) {
        if (kind === "BS") accountIds.push(accountId);
        continue;
      }
      if (accountId === OPENING_PROFIT_ACCOUNT_ID) {
        if (basis === "opening") accountIds.push(accountId);
        continue;
      }
      if (accountId < 0) {
        throw new ValidationError(`Heading '${name}' has an invalid account.`);
      }
      // A CoA row deleted after the template was saved is dropped, not an error.
      const account = accountsById.get(accountId);
      if (!account) continue;
      if (!allowed.has(account.account_type)) {
        throw new ValidationError(
          `Account '${account.account_code}' cannot be used on this report.`,
        );
      }
      if (!accountIds.includes(accountId)) accountIds.push(accountId);
    }
    const excludedAccountIds: number[] = [];
    for (const rawId of Array.isArray(heading.excludedAccountIds)
      ? heading.excludedAccountIds
      : []) {
      const accountId = Number(rawId);
      if (!Number.isInteger(accountId) || accountId <= 0) {
        throw new ValidationError(`Heading '${name}' has an invalid excluded account.`);
      }
      if (accountIds.includes(accountId)) {
        throw new ValidationError(`Heading '${name}' both includes and excludes the same account.`);
      }
      if (excludedAccountIds.includes(accountId)) continue;
      const account = accountsById.get(accountId);
      if (!account) continue;
      if (!allowed.has(account.account_type)) {
        throw new ValidationError(
          `Account '${account.account_code}' cannot be used on this report.`,
        );
      }
      excludedAccountIds.push(accountId);
    }
    return {
      id,
      name,
      ...(note ? { note } : {}),
      ...(basis ? { basis } : {}),
      kind: "accounts",
      accountIds,
      ...(excludedAccountIds.length > 0 ? { excludedAccountIds } : {}),
      parts: [],
    };
  });

  const accountHeadingIds = new Set(
    headings.filter((heading) => heading.kind === "accounts").map((heading) => heading.id),
  );
  const subtotalIndex = new Map(
    headings.flatMap((heading, index) =>
      heading.kind === "subtotal" ? [[heading.id, index] as const] : [],
    ),
  );
  headings.forEach((heading, index) => {
    if (heading.kind !== "subtotal") return;
    for (const part of heading.parts) {
      if (accountHeadingIds.has(part.headingId)) continue;
      const partIndex = subtotalIndex.get(part.headingId);
      if (partIndex != null && partIndex < index) continue;
      throw new ValidationError(
        `Heading '${heading.name}' adds '${part.headingId}', which is not an account heading or an earlier subtotal.`,
      );
    }
  });
  return headings;
}

/** The original, unmapped P&L defaults, saved before the CoA was mapped. */
const LEGACY_DEFAULT_HEADING_IDS = [
  "sales-net",
  "cost-of-sales",
  "gross-profit",
  "operating-expenses",
  "administrative-expenses",
  "selling-distribution",
  "operating-profit",
  "other-income",
  "financial-charges",
  "others",
  "profit-before-tax",
  "taxation-current",
  "profit-after-tax",
  "prior-year-adjustment",
  "accumulated-profit-bf",
  "profit-cf",
];

function isLegacyDefaultTemplate(headings: readonly CustomHeading[]): boolean {
  if (headings.length !== LEGACY_DEFAULT_HEADING_IDS.length) return false;
  if (!headings.every((heading, index) => heading.id === LEGACY_DEFAULT_HEADING_IDS[index])) {
    return false;
  }
  // Any real account selection means the user made the template their own.
  return headings.every(
    (heading) =>
      heading.kind === "subtotal" ||
      heading.accountIds.every((id) => id === OPENING_PROFIT_ACCOUNT_ID),
  );
}

/** Keep names/notes, replace the unmapped layout with the mapped defaults. */
function upgradeLegacyDefault(
  saved: readonly CustomHeading[],
  accounts: readonly AccountRow[],
): CustomHeading[] {
  const oldById = new Map(saved.map((heading) => [heading.id, heading]));
  return defaultTemplate("PL", accounts).map((heading) => {
    const old = oldById.get(heading.id);
    if (!old) return heading;
    return {
      ...heading,
      name: old.name,
      ...(old.note ? { note: old.note } : {}),
    };
  });
}

/** Account value in its natural sign for the statement. */
function accountValue(
  row: TrialBalanceRow,
  kind: CustomReportKind,
  opening = false,
): number {
  if (kind === "PL") {
    const debit = new Decimal(opening ? row.openingDebit : row.debit);
    const credit = new Decimal(opening ? row.openingCredit : row.credit);
    if (row.accountType === "REVENUE" || (opening && row.accountType === "EQUITY")) {
      return toStorage(credit.minus(debit));
    }
    if (row.accountType === "EXPENSE") return toStorage(debit.minus(credit));
    return 0;
  }
  const closingDebit = new Decimal(row.closingDebit);
  const closingCredit = new Decimal(row.closingCredit);
  if (row.accountType === "ASSET") return toStorage(closingDebit.minus(closingCredit));
  if (row.accountType === "LIABILITY" || row.accountType === "EQUITY") {
    return toStorage(closingCredit.minus(closingDebit));
  }
  return 0;
}

/** Revenue less expenses earned before the selected period starts. */
function openingNetProfit(rows: readonly TrialBalanceRow[]): Decimal {
  let revenue = new Decimal(0);
  let expenses = new Decimal(0);
  for (const row of rows) {
    if (row.accountType === "REVENUE") {
      revenue = revenue.plus(row.openingCredit).minus(row.openingDebit);
    } else if (row.accountType === "EXPENSE") {
      expenses = expenses.plus(row.openingDebit).minus(row.openingCredit);
    }
  }
  return revenue.minus(expenses);
}

/** Revenue less expenses as at the balance-sheet date, from the closing columns. */
function balanceSheetNetProfit(rows: readonly TrialBalanceRow[]): Decimal {
  let revenue = new Decimal(0);
  let expenses = new Decimal(0);
  for (const row of rows) {
    if (row.accountType === "REVENUE") {
      revenue = revenue.plus(row.closingCredit).minus(row.closingDebit);
    } else if (row.accountType === "EXPENSE") {
      expenses = expenses.plus(row.closingDebit).minus(row.closingCredit);
    }
  }
  return revenue.minus(expenses);
}

export class CustomReportService {
  private readonly accounts: AccountRepository;
  private readonly settings: SettingsRepository;
  private readonly accounting: AccountingService;

  constructor(
    private readonly db: SqlDatabase,
    private readonly companyId = 1,
  ) {
    this.accounts = new AccountRepository(db);
    this.settings = new SettingsRepository(db);
    this.accounting = new AccountingService(db, companyId);
  }

  /** The saved template, or the defaults when nothing is saved yet. */
  async getTemplate(kind: CustomReportKind): Promise<CustomHeading[]> {
    const accounts = await this.accountRows();
    const stored = await this.settings.getSetting(
      this.companyId,
      SETTING_KEYS[kind],
      SETTINGS_GROUP,
    );
    const saved = readTemplate(stored, kind, accounts);
    if (saved && kind === "PL" && isLegacyDefaultTemplate(saved)) {
      return upgradeLegacyDefault(saved, accounts);
    }
    return saved ?? defaultTemplate(kind, accounts);
  }

  /** Validate and store a template; returns the normalized headings. */
  async saveTemplate(kind: CustomReportKind, input: unknown): Promise<CustomHeading[]> {
    const headings = validateTemplate(input, kind, await this.accountRows());
    await this.settings.setSetting(
      this.companyId,
      SETTING_KEYS[kind],
      { headings },
      SETTINGS_GROUP,
    );
    return headings;
  }

  /** Headings with their values and lines, the unassigned line, and the footer checks. */
  async build(
    kind: CustomReportKind,
    options: CustomReportOptions = {},
  ): Promise<CustomReportResult> {
    const rows = await this.accounting.getTrialBalance(
      this.companyId,
      kind === "PL"
        ? { from: options.from, to: options.to }
        : { to: options.asAt ?? options.to ?? null },
    );
    return this.buildFromRows(kind, rows);
  }

  /** Render from trial-balance rows another report call already fetched. */
  async buildFromRows(
    kind: CustomReportKind,
    rows: readonly TrialBalanceRow[],
  ): Promise<CustomReportResult> {
    const template = await this.getTemplate(kind);
    const accounts = await this.accountRows();
    return this.render(kind, template, accounts, rows);
  }

  /** CSV of the same lines the screen and workbook show; `includeDetail` adds the account rows. */
  async customCsv(
    kind: CustomReportKind,
    options: CustomReportOptions = {},
    includeDetail = true,
  ): Promise<string> {
    const report = await this.build(kind, options);
    const title =
      kind === "PL"
        ? `Custom Profit & Loss (${formatDayMonthYear(options.from) || "start"} to ${formatDayMonthYear(options.to) || "today"})`
        : `Custom Balance Sheet (as at ${formatDayMonthYear(options.asAt ?? options.to ?? "") || "today"})`;
    const lines = [title, "Heading,Account Code,Account,Amount,Note"];
    const line = (
      heading: string,
      code: string,
      account: string,
      value: number,
      note = "",
    ): string =>
      [csvEscape(heading), csvEscape(code), csvEscape(account), value.toFixed(2), csvEscape(note)].join(",");

    for (const heading of report.headings) {
      lines.push(line(heading.name, "", "", heading.value, heading.note));
      if (!includeDetail) continue;
      for (const row of heading.rows) {
        lines.push(line("", row.code, `${"  ".repeat(row.depth)}${row.name}`, row.value));
      }
    }
    if (report.unassigned.rows.length > 0) {
      lines.push(line("Unassigned (not in any heading)", "", "", report.unassigned.value));
      for (const row of report.unassigned.rows) {
        lines.push(line("", row.code, row.name, row.value));
      }
    }
    lines.push("");
    for (const footerLine of report.footer) {
      lines.push(line(footerLine.label, "", "", footerLine.value));
    }
    if (report.balanced !== null) {
      lines.push(line("Balanced", "", "", report.balanced ? 1 : 0));
    }
    return lines.join("\n");
  }

  private async accountRows(): Promise<AccountRow[]> {
    // Inactive accounts are kept: a deactivated parent may still own active
    // sub-accounts with balances, and the rows must not drop out of the tree.
    return this.accounts.listForCompany(this.companyId, false);
  }

  private render(
    kind: CustomReportKind,
    headings: readonly CustomHeading[],
    accounts: readonly AccountRow[],
    rows: readonly TrialBalanceRow[],
  ): CustomReportResult {
    const allowed = new Set<AccountType>(REPORT_TYPES[kind]);
    if (kind === "PL") allowed.add("EQUITY");
    const accountsById = new Map(accounts.map((account) => [account.id, account]));
    const values = new Map<number, number>();
    const openingValues = new Map<number, number>();
    for (const row of rows) {
      values.set(row.accountId, accountValue(row, kind));
      if (kind === "PL") openingValues.set(row.accountId, accountValue(row, kind, true));
    }
    const netProfit = balanceSheetNetProfit(rows);
    const openingProfit = openingNetProfit(rows);

    const childrenByParent = new Map<number, AccountRow[]>();
    for (const account of accounts) {
      if (!allowed.has(account.account_type)) continue;
      const parent = account.parent_account_id;
      if (parent == null || parent === account.id) continue;
      const siblings = childrenByParent.get(parent) ?? [];
      siblings.push(account);
      childrenByParent.set(parent, siblings);
    }
    for (const siblings of childrenByParent.values()) siblings.sort(byAccountCode);

    const valueOf = (accountId: number, opening = false): Decimal => {
      if (accountId === OPENING_PROFIT_ACCOUNT_ID) return openingProfit;
      if (accountId === NET_PROFIT_ACCOUNT_ID) return new Decimal(netProfit);
      const source = opening ? openingValues : values;
      return new Decimal(source.get(accountId) ?? 0);
    };

    const codeOf = (accountId: number): string =>
      accountId <= 0 ? "" : (accountsById.get(accountId)?.account_code ?? "");
    const nameOf = (accountId: number): string => {
      if (accountId === OPENING_PROFIT_ACCOUNT_ID) return OPENING_PROFIT_LABEL;
      if (accountId === NET_PROFIT_ACCOUNT_ID) return NET_PROFIT_LABEL;
      return accountsById.get(accountId)?.account_name ?? "";
    };

    const childrenOf = (accountId: number): AccountRow[] =>
      accountId <= 0 ? [] : (childrenByParent.get(accountId) ?? []);

    const assigned = new Set<number>();
    const accountResults = new Map<string, CustomReportHeadingResult>();

    for (const heading of headings) {
      if (heading.kind !== "accounts") continue;
      const opening = heading.basis === "opening";
      const selected = new Set(heading.accountIds);
      const excluded = new Set(heading.excludedAccountIds ?? []);

      // A picked node covered by another picked node in the same heading is
      // printed once, under its parent, and never counted twice.
      const hasSelectedAncestor = (accountId: number): boolean => {
        const seen = new Set<number>([accountId]);
        let parent = accountsById.get(accountId)?.parent_account_id ?? null;
        while (parent != null && !seen.has(parent)) {
          if (selected.has(parent)) return true;
          seen.add(parent);
          parent = accountsById.get(parent)?.parent_account_id ?? null;
        }
        return false;
      };
      const hasExcludedAncestor = (accountId: number): boolean => {
        const seen = new Set<number>();
        let cursor: number | null = accountId;
        while (cursor != null && !seen.has(cursor)) {
          if (excluded.has(cursor)) return true;
          seen.add(cursor);
          cursor = accountsById.get(cursor)?.parent_account_id ?? null;
        }
        return false;
      };
      const roots = [...selected]
        .filter((accountId) => !hasSelectedAncestor(accountId) && !hasExcludedAncestor(accountId))
        .sort((a, b) => compareAccountCode(codeOf(a), codeOf(b)));

      const covered = new Set<number>();
      const addSubtree = (accountId: number): void => {
        if (excluded.has(accountId) || covered.has(accountId)) return;
        covered.add(accountId);
        for (const child of childrenOf(accountId)) addSubtree(child.id);
      };
      for (const root of roots) addSubtree(root);
      if (!opening) {
        for (const accountId of covered) assigned.add(accountId);
      }

      let value = new Decimal(0);
      for (const accountId of covered) value = value.plus(valueOf(accountId, opening));

      const buildRows = (accountId: number, depth: number): CustomReportRow[] => {
        if (excluded.has(accountId)) return [];
        const childRows = childrenOf(accountId).flatMap((child) => buildRows(child.id, depth + 1));
        const own = valueOf(accountId, opening);
        const isSelected = selected.has(accountId);
        // Zero lines the user did not pick are noise; a picked node stays.
        if (!isSelected && own.isZero() && childRows.length === 0) return [];
        return [
          {
            accountId,
            code: codeOf(accountId),
            name: nameOf(accountId),
            depth,
            value: toStorage(own),
            selected: isSelected,
            isHeader: childRows.length > 0,
          },
          ...childRows,
        ];
      };
      const lines = roots.flatMap((root) => buildRows(root, 0));

      accountResults.set(heading.id, {
        ...heading,
        value: toStorage(value),
        rows: lines,
      });
    }

    // Account headings are all known now, so subtotals can read them (and any
    // earlier subtotal) in one pass while still allowing forward account refs.
    const subtotalValues = new Map<string, number>();
    for (const heading of headings) {
      if (heading.kind !== "subtotal") continue;
      let value = new Decimal(0);
      for (const part of heading.parts) {
        const referenced =
          accountResults.get(part.headingId)?.value ?? subtotalValues.get(part.headingId);
        if (referenced == null) continue;
        value = part.sign === 1 ? value.plus(referenced) : value.minus(referenced);
      }
      subtotalValues.set(heading.id, toStorage(value));
    }

    const results = headings.map((heading): CustomReportHeadingResult => {
      if (heading.kind === "accounts") {
        return accountResults.get(heading.id) ?? { ...heading, value: 0, rows: [] };
      }
      return { ...heading, value: subtotalValues.get(heading.id) ?? 0, rows: [] };
    });

    const unassignedRows: CustomReportRow[] = [...values.entries()]
      .filter(([accountId, value]) => value !== 0 && !assigned.has(accountId))
      .map(([accountId, value]) => ({
        accountId,
        code: accountsById.get(accountId)?.account_code ?? "",
        name: accountsById.get(accountId)?.account_name ?? "",
        depth: 0,
        value,
        selected: false,
        isHeader: false,
      }))
      .sort((a, b) => compareAccountCode(a.code, b.code));
    if (kind === "BS" && !assigned.has(NET_PROFIT_ACCOUNT_ID) && !netProfit.isZero()) {
      unassignedRows.push({
        accountId: NET_PROFIT_ACCOUNT_ID,
        code: "",
        name: NET_PROFIT_LABEL,
        depth: 0,
        value: toStorage(netProfit),
        selected: false,
        isHeader: false,
      });
    }
    const unassignedValue = unassignedRows.reduce(
      (total, row) => total.plus(row.value),
      new Decimal(0),
    );

    return {
      kind,
      headings: results,
      unassigned: { value: toStorage(unassignedValue), rows: unassignedRows },
      ...this.footer(kind, rows, netProfit),
    };
  }

  /** Standard-report totals, so the custom view can be checked against them. */
  private footer(
    kind: CustomReportKind,
    rows: readonly TrialBalanceRow[],
    netProfit: Decimal,
  ): { footer: Array<{ label: string; value: number }>; balanced: boolean | null } {
    if (kind === "PL") {
      let revenue = new Decimal(0);
      let expenses = new Decimal(0);
      for (const row of rows) {
        if (row.accountType === "REVENUE") {
          revenue = revenue.plus(row.credit).minus(row.debit);
        } else if (row.accountType === "EXPENSE") {
          expenses = expenses.plus(row.debit).minus(row.credit);
        }
      }
      return {
        footer: [
          { label: "Revenue", value: toStorage(revenue) },
          { label: "Expenses", value: toStorage(expenses) },
          { label: "Net profit", value: toStorage(revenue.minus(expenses)) },
        ],
        balanced: null,
      };
    }

    let assets = new Decimal(0);
    let liabilities = new Decimal(0);
    let equity = new Decimal(0);
    for (const row of rows) {
      const debit = new Decimal(row.closingDebit);
      const credit = new Decimal(row.closingCredit);
      if (row.accountType === "ASSET") assets = assets.plus(debit).minus(credit);
      else if (row.accountType === "LIABILITY") liabilities = liabilities.plus(credit).minus(debit);
      else if (row.accountType === "EQUITY") equity = equity.plus(credit).minus(debit);
    }
    const equityWithProfit = equity.plus(netProfit);
    return {
      footer: [
        { label: "Assets", value: toStorage(assets) },
        { label: "Liabilities", value: toStorage(liabilities) },
        { label: "Equity (incl. net profit)", value: toStorage(equityWithProfit) },
        { label: "Net profit", value: toStorage(netProfit) },
      ],
      balanced: assets
        .minus(liabilities)
        .minus(equityWithProfit)
        .abs()
        .lessThan(new Decimal("0.01")),
    };
  }
}
