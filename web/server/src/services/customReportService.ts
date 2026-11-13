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
  /** "accounts" sums CoA nodes; "subtotal" adds/subtracts other headings. */
  kind: "accounts" | "subtotal";
  accountIds: number[];
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

export const MAX_CUSTOM_HEADINGS = 30;
const MAX_HEADING_NAME = 80;
const MAX_HEADING_ID = 40;
/** Virtual account id for the balance sheet's unposted profit line. */
export const NET_PROFIT_ACCOUNT_ID = 0;
const NET_PROFIT_LABEL = "Net profit (P&L)";

/** Account types each statement may reference. */
const REPORT_TYPES: Record<CustomReportKind, readonly AccountType[]> = {
  PL: ["REVENUE", "EXPENSE"],
  BS: ["ASSET", "LIABILITY", "EQUITY"],
};

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

/** Five coherent starting headings so the editor is never a blank page. */
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
  return [
    { id: "revenue", name: "Revenue", kind: "accounts", accountIds: rootAccounts(accounts, "REVENUE").map((a) => a.id), parts: [] },
    { id: "cost-of-sales", name: "Cost of Sales", kind: "accounts", accountIds: [], parts: [] },
    { id: "operating-expenses", name: "Operating Expenses", kind: "accounts", accountIds: rootAccounts(accounts, "EXPENSE").map((a) => a.id), parts: [] },
    { id: "other-income", name: "Other Income", kind: "accounts", accountIds: [], parts: [] },
    {
      id: "net-profit",
      name: "Net Profit",
      kind: "subtotal",
      accountIds: [],
      parts: [
        { headingId: "revenue", sign: 1 },
        { headingId: "cost-of-sales", sign: -1 },
        { headingId: "operating-expenses", sign: -1 },
        { headingId: "other-income", sign: 1 },
      ],
    },
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

  const allowed = new Set(REPORT_TYPES[kind]);
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const headings: CustomHeading[] = [];
  const ids = new Set<string>();

  for (const item of record.headings) {
    const heading = asRecord(item);
    if (!heading) continue;
    const id = typeof heading.id === "string" ? heading.id.trim().slice(0, MAX_HEADING_ID) : "";
    const name = typeof heading.name === "string" ? heading.name.trim().slice(0, MAX_HEADING_NAME) : "";
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
      headings.push({ id, name, kind: "subtotal", accountIds: [], parts: dedupeParts(parts) });
      continue;
    }

    const accountIds: number[] = [];
    for (const rawId of Array.isArray(heading.accountIds) ? heading.accountIds : []) {
      const accountId = Number(rawId);
      if (!Number.isInteger(accountId) || accountIds.includes(accountId)) continue;
      if (accountId === NET_PROFIT_ACCOUNT_ID) {
        if (kind === "BS") accountIds.push(accountId);
        continue;
      }
      const account = accountsById.get(accountId);
      if (account && allowed.has(account.account_type)) accountIds.push(accountId);
    }
    headings.push({ id, name, kind: "accounts", accountIds, parts: [] });
  }

  // Subtotal parts may name a heading that appears later (or never); keep only
  // the account headings that survived, and never the subtotal itself.
  const accountHeadingIds = new Set(
    headings.filter((heading) => heading.kind === "accounts").map((heading) => heading.id),
  );
  for (const heading of headings) {
    if (heading.kind !== "subtotal") continue;
    heading.parts = dedupeParts(
      heading.parts.filter(
        (part) => part.headingId !== heading.id && accountHeadingIds.has(part.headingId),
      ),
    );
  }
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

  const allowed = new Set(REPORT_TYPES[kind]);
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

    if (heading.kind === "subtotal") {
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
      return { id, name, kind: "subtotal", accountIds: [], parts };
    }

    if (heading.kind !== "accounts") {
      throw new ValidationError(`Heading '${name}' is neither an accounts nor a subtotal heading.`);
    }
    const accountIds: number[] = [];
    for (const rawId of Array.isArray(heading.accountIds) ? heading.accountIds : []) {
      const accountId = Number(rawId);
      if (!Number.isInteger(accountId) || accountId < 0) {
        throw new ValidationError(`Heading '${name}' has an invalid account.`);
      }
      if (accountId === NET_PROFIT_ACCOUNT_ID) {
        if (kind === "BS") accountIds.push(accountId);
        continue;
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
    return { id, name, kind: "accounts", accountIds, parts: [] };
  });

  const accountHeadingIds = new Set(
    headings.filter((heading) => heading.kind === "accounts").map((heading) => heading.id),
  );
  for (const heading of headings) {
    if (heading.kind !== "subtotal") continue;
    for (const part of heading.parts) {
      if (!accountHeadingIds.has(part.headingId)) {
        throw new ValidationError(
          `Heading '${heading.name}' adds '${part.headingId}', which is not an account heading.`,
        );
      }
    }
  }
  return headings;
}

/** Account value in its natural sign for the statement. */
function accountValue(row: TrialBalanceRow, kind: CustomReportKind): number {
  const debit = new Decimal(row.debit);
  const credit = new Decimal(row.credit);
  if (kind === "PL") {
    if (row.accountType === "REVENUE") return toStorage(credit.minus(debit));
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
    const template = await this.getTemplate(kind);
    const accounts = await this.accountRows();
    const rows = await this.accounting.getTrialBalance(
      this.companyId,
      kind === "PL"
        ? { from: options.from, to: options.to }
        : { to: options.asAt ?? options.to ?? null },
    );
    return this.render(kind, template, accounts, rows);
  }

  /** CSV of the same lines the screen and workbook show. */
  async customCsv(kind: CustomReportKind, options: CustomReportOptions = {}): Promise<string> {
    const report = await this.build(kind, options);
    const title =
      kind === "PL"
        ? `Custom Profit & Loss (${formatDayMonthYear(options.from) || "start"} to ${formatDayMonthYear(options.to) || "today"})`
        : `Custom Balance Sheet (as at ${formatDayMonthYear(options.asAt ?? options.to ?? "") || "today"})`;
    const lines = [title, "Heading,Account Code,Account,Amount"];
    const line = (heading: string, code: string, account: string, value: number): string =>
      [csvEscape(heading), csvEscape(code), csvEscape(account), value.toFixed(2)].join(",");

    for (const heading of report.headings) {
      lines.push(line(heading.name, "", "", heading.value));
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
    const allowed = new Set(REPORT_TYPES[kind]);
    const accountsById = new Map(accounts.map((account) => [account.id, account]));
    const values = new Map<number, number>();
    for (const row of rows) values.set(row.accountId, accountValue(row, kind));
    const netProfit = balanceSheetNetProfit(rows);

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

    const valueOf = (accountId: number): Decimal =>
      new Decimal(accountId === NET_PROFIT_ACCOUNT_ID ? netProfit : (values.get(accountId) ?? 0));

    const codeOf = (accountId: number): string =>
      accountId === NET_PROFIT_ACCOUNT_ID ? "" : (accountsById.get(accountId)?.account_code ?? "");
    const nameOf = (accountId: number): string =>
      accountId === NET_PROFIT_ACCOUNT_ID
        ? NET_PROFIT_LABEL
        : (accountsById.get(accountId)?.account_name ?? "");

    const childrenOf = (accountId: number): AccountRow[] =>
      accountId === NET_PROFIT_ACCOUNT_ID ? [] : (childrenByParent.get(accountId) ?? []);

    /** Ids of a node and everything under it (cycles are not possible in the CoA). */
    const subtreeIds = (accountId: number, into: Set<number> = new Set()): Set<number> => {
      if (into.has(accountId)) return into;
      into.add(accountId);
      for (const child of childrenOf(accountId)) subtreeIds(child.id, into);
      return into;
    };

    const assigned = new Set<number>();
    const accountResults = new Map<string, CustomReportHeadingResult>();

    for (const heading of headings) {
      if (heading.kind !== "accounts") continue;
      const selected = new Set(heading.accountIds);

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
      const roots = [...selected]
        .filter((accountId) => !hasSelectedAncestor(accountId))
        .sort((a, b) => compareAccountCode(codeOf(a), codeOf(b)));

      const covered = new Set<number>();
      for (const root of roots) subtreeIds(root, covered);
      for (const accountId of covered) assigned.add(accountId);

      let value = new Decimal(0);
      for (const accountId of covered) value = value.plus(valueOf(accountId));

      const buildRows = (accountId: number, depth: number): CustomReportRow[] => {
        const childRows = childrenOf(accountId).flatMap((child) => buildRows(child.id, depth + 1));
        const own = valueOf(accountId);
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

    const results = headings.map((heading): CustomReportHeadingResult => {
      if (heading.kind === "accounts") {
        return accountResults.get(heading.id) ?? { ...heading, value: 0, rows: [] };
      }
      let value = new Decimal(0);
      for (const part of heading.parts) {
        const referenced = accountResults.get(part.headingId);
        if (!referenced) continue;
        value = part.sign === 1 ? value.plus(referenced.value) : value.minus(referenced.value);
      }
      return { ...heading, value: toStorage(value), rows: [] };
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
