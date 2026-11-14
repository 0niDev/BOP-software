import { Fragment, useEffect, useState } from "react";
import type { ReportPage } from "../App";
import { api, ApiError } from "../api";
import CustomReportEditor from "../components/CustomReportEditor";
import CustomReportTable from "../components/CustomReportTable";
import ProfitLossSummary from "../components/ProfitLossSummary";
import SearchableSelect from "../components/SearchableSelect";
import { saveBlob } from "../lib/download";
import { formatDate } from "../lib/format";
import { usePageVisible } from "../lib/pageVisibility";
import type { Account, AccountType, AllPartyLedgers, BalanceSheet, CustomHeading, CustomReport, CustomReportKind, LedgerEntry, Party, PartyLedgerWithBalance, PartyProductSales, ProfitAndLoss, TrialBalance, TrialBalanceRow } from "../types";

/** Chart-of-accounts order: assets, liabilities, equity, revenue, expenses. */
const COA_ORDER: AccountType[] = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];

const TYPE_LABELS: Record<AccountType, string> = {
  ASSET: "Assets",
  LIABILITY: "Liabilities",
  EQUITY: "Equity",
  REVENUE: "Revenue",
  EXPENSE: "Expenses",
};

/** A trial balance account placed in the CoA tree. */
export interface TbTreeRow extends TrialBalanceRow {
  /** 0 for a top-level account, 1+ for a CoA sub-account. */
  depth: number;
  /** Has sub-accounts printed beneath it (a CoA "header"). */
  hasChildren: boolean;
}

export interface TbGroup {
  type: AccountType;
  rows: TbTreeRow[];
  closingDebit: number;
  closingCredit: number;
}

function byCode(a: TrialBalanceRow, b: TrialBalanceRow): number {
  return a.accountCode.localeCompare(b.accountCode, undefined, { numeric: true });
}

/**
 * The CoA page's organization applied to the trial balance: type sections in
 * CoA order, each a tree of accounts by parent (siblings in code order), plus a
 * closing subtotal per section. A sub-account whose parent is not in the rows
 * (hidden as zero, or filtered out) prints as a root instead of disappearing.
 */
export function groupTbRows(rows: TrialBalanceRow[]): TbGroup[] {
  return COA_ORDER.flatMap((type) => {
    const typeRows = rows.filter((row) => row.accountType === type);
    if (typeRows.length === 0) return [];

    const byId = new Map(typeRows.map((row) => [row.accountId, row]));
    const childrenByParent = new Map<number, TrialBalanceRow[]>();
    for (const row of typeRows) {
      const parentId = row.parentAccountId;
      if (parentId == null || parentId === row.accountId || !byId.has(parentId)) continue;
      const siblings = childrenByParent.get(parentId) ?? [];
      siblings.push(row);
      childrenByParent.set(parentId, siblings);
    }
    for (const siblings of childrenByParent.values()) siblings.sort(byCode);

    const isRoot = (row: TrialBalanceRow): boolean => {
      const parentId = row.parentAccountId;
      return parentId == null || parentId === row.accountId || !byId.has(parentId);
    };

    const laidOut: TbTreeRow[] = [];
    const placed = new Set<number>();
    const walk = (row: TrialBalanceRow, depth: number): void => {
      if (placed.has(row.accountId)) return;
      placed.add(row.accountId);
      const children = childrenByParent.get(row.accountId) ?? [];
      laidOut.push({ ...row, depth, hasChildren: children.length > 0 });
      for (const child of children) walk(child, depth + 1);
    };
    for (const root of typeRows.filter(isRoot).sort(byCode)) walk(root, 0);
    // Defensive: a parent cycle leaves rows unreachable from any root.
    for (const row of [...typeRows].sort(byCode)) {
      if (!placed.has(row.accountId)) walk(row, 0);
    }

    return [
      {
        type,
        rows: laidOut,
        closingDebit: laidOut.reduce((sum, row) => sum + row.closingDebit, 0),
        closingCredit: laidOut.reduce((sum, row) => sum + row.closingCredit, 0),
      },
    ];
  });
}

function money(value: number): string {
  return value.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function amount(value: number): string {
  return value === 0 ? "" : money(value);
}

/** Any opening, period or closing balance on the account. */
function hasMovement(row: TrialBalanceRow): boolean {
  return [
    row.openingDebit,
    row.openingCredit,
    row.debit,
    row.credit,
    row.closingDebit,
    row.closingCredit,
  ].some((value) => value !== 0);
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/**
 * Period presets for the "Export all reports" action, ported from
 * report_view._populate_export_periods (which listed every month/year since
 * the project's first books, most recent last).
 */
const EXPORT_START_YEAR = 2022;
const EXPORT_START_MONTH = 7; // 0-based → August 2022
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function exportPeriods(frequency: "Monthly" | "Yearly", now = new Date()): Array<{
  label: string;
  from: string;
  to: string;
}> {
  const periods: Array<{ label: string; from: string; to: string }> = [];
  if (frequency === "Yearly") {
    for (let year = EXPORT_START_YEAR; year <= now.getFullYear(); year += 1) {
      periods.push({ label: `${year}`, from: `${year}-01-01`, to: `${year}-12-31` });
    }
    return periods;
  }
  let year = EXPORT_START_YEAR;
  let month = EXPORT_START_MONTH;
  while (year < now.getFullYear() || (year === now.getFullYear() && month <= now.getMonth())) {
    const mm = String(month + 1).padStart(2, "0");
    const lastDay = new Date(year, month + 1, 0).getDate();
    periods.push({
      label: `${year}-${mm}  (${MONTH_NAMES[month]} ${year})`,
      from: `${year}-${mm}-01`,
      to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
    });
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return periods;
}

/**
 * Period tag for exported file names, matching the server's naming so exporting
 * two different periods does not overwrite the same file.
 */
function periodTag(from: string, to: string): string {
  return from || to ? `${from || "start"}_to_${to || "today"}` : "all-posted";
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card" style={{ flex: 1, margin: 0 }}>
      <label>{label}</label>
      <div style={{ fontSize: 22 }}>{money(value)}</div>
    </div>
  );
}

interface LedgerTableProps {
  rows: LedgerEntry[];
  caption: string;
}

function LedgerTable({ rows, caption }: LedgerTableProps) {
  if (rows.length === 0) {
    return <p style={{ opacity: 0.7 }}>No entries {caption}.</p>;
  }
  return (
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Voucher</th>
          <th>Type</th>
          <th>Description</th>
          <th>Notes</th>
          <th className="num">Debit</th>
          <th className="num">Credit</th>
          <th className="num">Balance</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`${row.voucherNumber}-${index}`}>
            <LedgerCells row={row} />
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface GroupedTbRowsProps {
  group: TbGroup;
  showUnpriced: boolean;
}

/** One entry row, shared by the single-party and all-parties ledger tables. */
function LedgerCells({ row }: { row: LedgerEntry }) {
  return (
    <>
      <td>{formatDate(row.date)}</td>
      <td>{row.voucherNumber}</td>
      <td>{row.voucherType}</td>
      <td>
        {row.description ?? "—"}
        {row.settled ? <span style={{ opacity: 0.6 }}> · settled</span> : null}
        {row.beforeOpening ? (
          <span style={{ opacity: 0.6 }}> · before opening</span>
        ) : null}
      </td>
      <td>{row.notes ?? "—"}</td>
      <td className="num">{amount(row.debit)}</td>
      <td className="num">{amount(row.credit)}</td>
      <td className="num">{money(row.balance)}</td>
    </>
  );
}

/** All parties in one table: a balance band per party, its entries beneath. */
function AllPartyLedgerTable({
  report,
}: {
  report: AllPartyLedgers;
}) {
  return (
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Voucher</th>
          <th>Type</th>
          <th>Description</th>
          <th>Notes</th>
          <th className="num">Debit</th>
          <th className="num">Credit</th>
          <th className="num">Balance</th>
        </tr>
      </thead>
      <tbody>
        {report.parties.map((party) => (
          <Fragment key={party.partyId}>
            <tr>
              <td
                colSpan={7}
                style={{
                  background: "var(--accent-soft)",
                  fontWeight: 700,
                }}
              >
                {party.name} ({party.code})
              </td>
              <td
                className="num"
                style={{
                  background: "var(--accent-soft)",
                  fontWeight: 700,
                }}
              >
                {money(party.closingBalance)}
              </td>
            </tr>
            {party.entries.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ opacity: 0.7 }}>
                  No entries.
                </td>
              </tr>
            ) : (
              party.entries.map((row, index) => (
                <tr key={`${party.partyId}-${row.voucherNumber}-${index}`}>
                  <LedgerCells row={row} />
                </tr>
              ))
            )}
          </Fragment>
        ))}
      </tbody>
      <tfoot>
        <tr className="total">
          <td colSpan={7}>Grand total (all parties)</td>
          <td className="num">{money(report.grandTotal)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

/** Every party's product purchases: a band per party, its products beneath. */
function PartyProductTable({ report }: { report: PartyProductSales }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Party / Product</th>
          <th className="num">Value</th>
        </tr>
      </thead>
      <tbody>
        {report.parties.map((party) => (
          <Fragment key={party.partyId}>
            <tr>
              <td style={{ background: "var(--accent-soft)", fontWeight: 700 }}>
                {party.name} ({party.code})
              </td>
              <td
                className="num"
                style={{ background: "var(--accent-soft)", fontWeight: 700 }}
              >
                {money(party.total)}
              </td>
            </tr>
            {party.products.map((product) => (
              <tr key={`${party.partyId}-${product.itemId}`}>
                <td style={{ paddingLeft: 24 }}>{product.itemName}</td>
                <td className="num">{money(product.value)}</td>
              </tr>
            ))}
          </Fragment>
        ))}
      </tbody>
      <tfoot>
        <tr className="total">
          <td>Grand total (all parties)</td>
          <td className="num">{money(report.grandTotal)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

/** COA section: type band, the account tree (sub-accounts indented), subtotal. */
function GroupedTbRows({ group, showUnpriced }: GroupedTbRowsProps) {
  return (
    <>
      <tr>
        <td
          colSpan={8}
          style={{
            background: "var(--accent-soft)",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontSize: 12,
            opacity: 0.8,
          }}
        >
          {TYPE_LABELS[group.type]} ({group.rows.length})
        </td>
      </tr>
      {group.rows.map((row) => (
        <Fragment key={row.accountId}>
          <tr>
            <td style={{ whiteSpace: "nowrap" }} title={`Internal code: ${row.accountCode}`}>
              <span className="coa-code">
                {Array.from({ length: row.depth }, (_, index) => (
                  <span key={index} className="coa-rail" />
                ))}
                {row.depth > 0 && <span className="coa-elbow">└</span>}
                {row.displayCode ?? row.accountCode}
              </span>
            </td>
            <td style={row.hasChildren ? { fontWeight: 600 } : undefined}>{row.accountName}</td>
            <td className="num">{amount(row.openingDebit)}</td>
            <td className="num">{amount(row.openingCredit)}</td>
            <td className="num">{amount(row.debit)}</td>
            <td className="num">{amount(row.credit)}</td>
            <td className="num">{amount(row.closingDebit)}</td>
            <td className="num">{amount(row.closingCredit)}</td>
          </tr>
          {(() => {
            const tags = row.tagBreakdown ?? [];
            const sold = row.soldValue;
            const used = row.usedValue;
            const stockTotal = tags.reduce((total, tag) => total + tag.value, 0);
            // For finished goods the account is sold + on the shelf, so the gap
            // is the stock value against what is left after the sold part.
            const expectedInStock = sold == null ? row.closingDebit : row.closingDebit - sold;
            const difference = stockTotal - expectedInStock;
            if (tags.length === 0 && sold == null && used == null) return null;
            const indent = { paddingLeft: 28 + row.depth * 12, fontSize: 12 };
            // A line inside the memo block, with free text on the right.
            const detailRow = (key: string, label: string, note: string, level: number) => (
              <tr key={key} style={{ opacity: 0.6 }}>
                <td />
                <td
                  style={{
                    ...indent,
                    paddingLeft: indent.paddingLeft + 16 * level,
                    fontSize: 11,
                  }}
                >
                  {label}
                </td>
                <td className="num" />
                <td className="num" />
                <td className="num" />
                <td className="num" />
                <td className="num" style={{ fontSize: 11 }}>
                  {note}
                </td>
                <td className="num" />
              </tr>
            );
            // Memo lines sit under the account and never feed the report totals.
            // `nested` tucks a line under the memo line above it, e.g. a tag
            // breaking down the "In stock" total.
            const memoRow = (
              key: string,
              label: string,
              value: number,
              strong = false,
              nested = false,
            ) => (
              <tr key={key} style={{ opacity: 0.75 }}>
                <td />
                <td style={nested ? { ...indent, paddingLeft: indent.paddingLeft + 16 } : indent}>
                  {nested ? "·" : "↳"} {label}
                </td>
                <td className="num" />
                <td className="num" />
                <td className="num" />
                <td className="num" />
                <td className="num">{strong ? money(value) : amount(value)}</td>
                <td className="num" />
              </tr>
            );
            return (
              <>
                {/* Finished goods: what the invoices sold, then what is left. */}
                {sold != null ? (
                  <>
                    {memoRow(`${row.accountId}-sold`, "Sold FG (per invoices)", sold, true)}
                    {memoRow(`${row.accountId}-stock`, "FG in stock", stockTotal, true)}
                  </>
                ) : used != null ? (
                  <>
                    {memoRow(`${row.accountId}-used`, "Used in production", used, true)}
                    {memoRow(`${row.accountId}-stock`, "In stock", stockTotal, true)}
                    {tags.map((tag) =>
                      memoRow(`${row.accountId}-tag-${tag.name}`, tag.name, tag.value, false, true),
                    )}
                  </>
                ) : (
                  tags.map((tag) =>
                    memoRow(`${row.accountId}-tag-${tag.name}`, tag.name, tag.value, false, true),
                  )
                )}
                {memoRow(`${row.accountId}-difference`, "Difference (stock - GL)", difference, true)}
                {/* Opt-in: what is behind the figure but carries no cost. */}
                {showUnpriced && (row.unpricedItems?.length ?? 0) > 0
                  ? [
                      detailRow(
                        `${row.accountId}-unpriced`,
                        `Unpriced items (${row.unpricedItems!.length})`,
                        "",
                        1,
                      ),
                      ...row.unpricedItems!.map((item) =>
                        detailRow(
                          `${row.accountId}-unpriced-${item.name}`,
                          item.name,
                          amount(item.quantity),
                          2,
                        ),
                      ),
                    ]
                  : null}
              </>
            );
          })()}
        </Fragment>
      ))}
      <tr className="total">
        <td colSpan={6}>Total {TYPE_LABELS[group.type]}</td>
        <td className="num">{amount(group.closingDebit)}</td>
        <td className="num">{amount(group.closingCredit)}</td>
      </tr>
    </>
  );
}

export default function TrialBalancePage({ section = "reports" }: { section?: ReportPage }) {
  const showAll = section === "reports";
  const showListing = section === "listing";
  const showTb = showListing || section === "report-trial-balance";
  const showPl = showListing || section === "report-profit-loss";
  const showBs = showListing || section === "report-balance-sheet";
  const showParty = showAll || section === "report-party-ledger";
  const showAllParties = showAll || section === "report-party-ledger-all";
  const showPartyProducts = showAll || section === "report-party-product-sales";
  const showPartyPurchases = showAll || section === "report-party-product-purchases";
  const showCash = showAll || section === "report-cash-book";
  const showExport = showAll || section === "report-export";
  const showPeriod = showListing || showTb || showPl || showBs;

  const [tb, setTb] = useState<TrialBalance | null>(null);
  const [pl, setPl] = useState<ProfitAndLoss | null>(null);
  const [bs, setBs] = useState<BalanceSheet | null>(null);
  const [customPl, setCustomPl] = useState<CustomReport | null>(null);
  const [customBs, setCustomBs] = useState<CustomReport | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customEditor, setCustomEditor] = useState<CustomReportKind | null>(null);
  const [customBusy, setCustomBusy] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  // Custom-report exports show only heading totals unless this is ticked.
  const [includeDetail, setIncludeDetail] = useState(false);
  const [parties, setParties] = useState<Party[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** A trial balance is read for its balances: hide the empty chart lines by default. */
  const [showZero, setShowZero] = useState(false);
  // Opt-in list of the items behind each inventory figure that cost nothing.
  const [showUnpriced, setShowUnpriced] = useState(false);
  // Revenue / expenses / net-profit totals are hidden by default; remember it.
  const [showTotals, setShowTotals] = useState(
    () => localStorage.getItem("pl-show-totals") === "1",
  );

  // Report period (trial balance + P&L) and the balance-sheet date.
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [asAt, setAsAt] = useState("");
  const [reportsBusy, setReportsBusy] = useState(false);

  const [partyId, setPartyId] = useState<number | null>(null);
  const [ledgerFrom, setLedgerFrom] = useState("");
  const [ledgerTo, setLedgerTo] = useState("");
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [ledgerLoaded, setLedgerLoaded] = useState(false);
  const [ledgerBusy, setLedgerBusy] = useState(false);

  const [cashFrom, setCashFrom] = useState("");
  const [cashTo, setCashTo] = useState("");
  const [cashBook, setCashBook] = useState<LedgerEntry[]>([]);
  const [cashLoaded, setCashLoaded] = useState(false);
  const [cashBusy, setCashBusy] = useState(false);

  const [allPartyLedgers, setAllPartyLedgers] = useState<AllPartyLedgers | null>(null);
  const [allFrom, setAllFrom] = useState("");
  const [allTo, setAllTo] = useState("");
  const [allShowOpening, setAllShowOpening] = useState(false);
  const [allLoaded, setAllLoaded] = useState(false);
  const [allBusy, setAllBusy] = useState(false);

  const [partyProducts, setPartyProducts] = useState<PartyProductSales | null>(null);
  const [ppFrom, setPpFrom] = useState("");
  const [ppTo, setPpTo] = useState("");
  const [ppLoaded, setPpLoaded] = useState(false);
  const [ppBusy, setPpBusy] = useState(false);

  const [partyPurchases, setPartyPurchases] = useState<PartyProductSales | null>(null);
  const [puFrom, setPuFrom] = useState("");
  const [puTo, setPuTo] = useState("");
  const [puLoaded, setPuLoaded] = useState(false);
  const [puBusy, setPuBusy] = useState(false);

  const [csvBusy, setCsvBusy] = useState(false);
  // Which Excel export is preparing, so only the button that was pressed shows
  // "Preparing…" while the workbook is built.
  const [xlsxBusy, setXlsxBusy] = useState<string | null>(null);

  const [exportFrequency, setExportFrequency] = useState<"Monthly" | "Yearly">("Monthly");
  const [exportIndex, setExportIndex] = useState(() =>
    Math.min(2, exportPeriods("Monthly").length - 1),
  );
  const [exportBusy, setExportBusy] = useState(false);

  // Default the period picker to the most recent one (like the desktop app).
  const periods = exportPeriods(exportFrequency);
  const selectedPeriod = periods[Math.min(exportIndex, periods.length - 1)];

  async function loadReports(next?: { from?: string; to?: string; asAt?: string }): Promise<void> {
    const f = next?.from ?? from;
    const t = next?.to ?? to;
    const a = next?.asAt ?? asAt;
    setReportsBusy(true);
    setError(null);
    try {
      const bundle = await api.reportsBundle(f || undefined, t || undefined, a || undefined);
      setTb(bundle.trialBalance);
      setPl(bundle.profitAndLoss);
      setBs(bundle.balanceSheet);
      setCustomPl(bundle.customPl);
      setCustomBs(bundle.customBs);
    } catch (err) {
      setError(errorMessage(err, "Failed to load reports."));
    } finally {
      setReportsBusy(false);
    }
  }

  const pageVisible = usePageVisible();

  useEffect(() => {
    void loadReports({ from: "", to: "", asAt: "" });
    // Inactive accounts too: a heading may already reference one, and it must
    // still be visible (and removable) in the tree.
    Promise.all([api.parties(), api.accounts(false)])
      .then(([partyList, accountList]) => {
        setAccounts(accountList);
        setParties(partyList);
        const first = partyList[0];
        if (first) setPartyId(first.id);
      })
      .catch((err) => setError(errorMessage(err, "Failed to load parties and accounts.")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageVisible]);

  async function loadLedger(): Promise<void> {
    if (partyId == null) return;
    setLedgerBusy(true);
    setError(null);
    try {
      setLedger(await api.partyLedger(partyId, ledgerFrom || undefined, ledgerTo || undefined));
      setLedgerLoaded(true);
    } catch (err) {
      setError(errorMessage(err, "Failed to load party ledger."));
    } finally {
      setLedgerBusy(false);
    }
  }

  async function loadCashBook(): Promise<void> {
    setCashBusy(true);
    setError(null);
    try {
      setCashBook(await api.cashBook(cashFrom || undefined, cashTo || undefined));
      setCashLoaded(true);
    } catch (err) {
      setError(errorMessage(err, "Failed to load cash book."));
    } finally {
      setCashBusy(false);
    }
  }

  async function loadAllPartyLedgers(): Promise<void> {
    setAllBusy(true);
    setError(null);
    try {
      setAllPartyLedgers(
        await api.partyLedgerAll(allFrom || undefined, allTo || undefined, allShowOpening),
      );
      setAllLoaded(true);
    } catch (err) {
      setError(errorMessage(err, "Failed to load all party ledgers."));
    } finally {
      setAllBusy(false);
    }
  }

  async function loadPartyProducts(): Promise<void> {
    setPpBusy(true);
    setError(null);
    try {
      setPartyProducts(await api.partyProductSales(ppFrom || undefined, ppTo || undefined));
      setPpLoaded(true);
    } catch (err) {
      setError(errorMessage(err, "Failed to load party product sales."));
    } finally {
      setPpBusy(false);
    }
  }

  async function loadPartyPurchases(): Promise<void> {
    setPuBusy(true);
    setError(null);
    try {
      setPartyPurchases(
        await api.partyProductPurchases(puFrom || undefined, puTo || undefined),
      );
      setPuLoaded(true);
    } catch (err) {
      setError(errorMessage(err, "Failed to load party product purchases."));
    } finally {
      setPuBusy(false);
    }
  }

  async function exportCsv(): Promise<void> {
    setCsvBusy(true);
    setError(null);
    try {
      const csv = await api.trialBalanceCsv(
        from || undefined,
        to || undefined,
        showUnpriced,
        showZero,
      );
      saveBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), "trial-balance.csv");
    } catch (err) {
      setError(errorMessage(err, "CSV export failed."));
    } finally {
      setCsvBusy(false);
    }
  }

  async function exportAll(): Promise<void> {
    if (!selectedPeriod) {
      setError("No export period is available.");
      return;
    }
    setExportBusy(true);
    setError(null);
    try {
      const csv = await api.exportAllCsv(
        selectedPeriod.from,
        selectedPeriod.to,
        showUnpriced,
        showZero,
      );
      saveBlob(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
        `all-reports_${selectedPeriod.from}_to_${selectedPeriod.to}.csv`,
      );
    } catch (err) {
      setError(errorMessage(err, "Export failed."));
    } finally {
      setExportBusy(false);
    }
  }

  async function saveCustomHeadings(
    kind: CustomReportKind,
    headings: CustomHeading[],
  ): Promise<void> {
    setCustomBusy(true);
    setCustomError(null);
    try {
      await api.saveCustomReport(kind, headings);
      setCustomEditor(null);
      await loadReports();
    } catch (err) {
      setCustomError(errorMessage(err, "Failed to save the headings."));
    } finally {
      setCustomBusy(false);
    }
  }

  async function exportCustomCsv(kind: CustomReportKind, detail = true): Promise<void> {
    setCsvBusy(true);
    setError(null);
    try {
      const csv =
        kind === "PL"
          ? await api.customReportCsv("PL", from || undefined, to || undefined, undefined, detail)
          : await api.customReportCsv("BS", undefined, undefined, asAt || undefined);
      const name =
        kind === "PL"
          ? `custom-profit-and-loss_${periodTag(from, to)}.csv`
          : `custom-balance-sheet_${asAt ? `as-at_${asAt}` : "as-at-today"}.csv`;
      saveBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), name);
    } catch (err) {
      setError(errorMessage(err, "CSV export failed."));
    } finally {
      setCsvBusy(false);
    }
  }

  /** Download any report as an Excel workbook (one sheet, or all of them). */
  async function exportXlsx(
    which: string,
    load: () => Promise<Blob>,
    fileName: string,
  ): Promise<void> {
    setXlsxBusy(which);
    setError(null);
    try {
      saveBlob(await load(), fileName);
    } catch (err) {
      setError(errorMessage(err, "Excel export failed."));
    } finally {
      setXlsxBusy(null);
    }
  }

  /** The party ledger needs a party, so resolve that before exporting. */
  function exportLedger(): void {
    if (partyId == null) {
      setError("Select a party before exporting its ledger.");
      return;
    }
    const id = partyId;
    void exportXlsx(
      "ledger",
      () => api.partyLedgerXlsx(id, ledgerFrom || undefined, ledgerTo || undefined),
      `party-ledger_${periodTag(ledgerFrom, ledgerTo)}.xlsx`,
    );
  }

  const visibleTbRows = tb ? (showZero ? tb.rows : tb.rows.filter(hasMovement)) : [];

  return (
    <>
      {showPeriod && (
      <div className="card">
        <h2>Report period</h2>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <div>
            <label>From (trial balance &amp; P&amp;L)</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label>To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <label>Balance sheet as at</label>
            <input type="date" value={asAt} onChange={(e) => setAsAt(e.target.value)} />
          </div>
          <button className="primary" onClick={() => void loadReports()} disabled={reportsBusy}>
            {reportsBusy ? "Loading…" : "Apply"}
          </button>
          <button
            onClick={() => {
              setFrom("");
              setTo("");
              setAsAt("");
              void loadReports({ from: "", to: "", asAt: "" });
            }}
            disabled={reportsBusy}
          >
            All posted entries
          </button>
        </div>
        <p style={{ opacity: 0.7, fontSize: 12, marginBottom: 0 }}>
          Leave the dates empty to report on every posted entry.
        </p>
      </div>
      )}

      {showExport && (
      <div className="card" id="report-export">
        <h2>Export all reports</h2>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <div>
            <label>Frequency</label>
            <SearchableSelect
              value={exportFrequency}
              onChange={(value) => {
                const next = value as "Monthly" | "Yearly";
                setExportFrequency(next);
                setExportIndex(Math.max(exportPeriods(next).length - 1, 0));
              }}
              placeholder="Frequency"
              options={[
                { value: "Monthly", label: "Monthly" },
                { value: "Yearly", label: "Yearly" },
              ]}
            />
          </div>
          <div>
            <label>Period</label>
            <SearchableSelect
              value={String(exportIndex)}
              onChange={(next) => setExportIndex(Number(next))}
              placeholder="Period"
              emptyText="No matching period"
              options={periods.map((period, index) => ({
                value: String(index),
                label: period.label,
              }))}
            />
          </div>
          <button
            className="primary"
            onClick={() => void exportAll()}
            disabled={exportBusy || !selectedPeriod}
          >
            {exportBusy ? "Preparing…" : "Download all reports (CSV)"}
          </button>
          <button
            onClick={() =>
              void exportXlsx(
                "all",
                () =>
                  api.exportAllXlsx(
                    selectedPeriod?.from,
                    selectedPeriod?.to,
                    showUnpriced,
                    showZero,
                  ),
                `all-reports_${selectedPeriod?.from ?? "start"}_to_${selectedPeriod?.to ?? "today"}.xlsx`,
              )
            }
            disabled={xlsxBusy !== null || !selectedPeriod}
          >
            {xlsxBusy === "all" ? "Preparing…" : "Download all reports (Excel)"}
          </button>
        </div>
        <p style={{ opacity: 0.7, fontSize: 12, marginBottom: 0 }}>
          One file containing the trial balance, profit &amp; loss, balance sheet (as at the
          period end) and cash book for {""}
          <strong>
            {selectedPeriod
              ? `${formatDate(selectedPeriod.from)} → ${formatDate(selectedPeriod.to)}`
              : "—"}
          </strong>
          .
        </p>
      </div>
      )}

      {error && <div className="error">{error}</div>}

      {showPl && (
      <div className="card" id="report-profit-loss">
        {pl ? (
          <>
            <div className="row" style={{ alignItems: "center" }}>
              <h2 style={{ flex: 1, margin: 0 }}>
                Profit &amp; Loss{" "}
                <span className="badge">
                  {from || to ? "for the period" : "all posted entries"}
                </span>
              </h2>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={showTotals}
                  onChange={(event) => {
                    setShowTotals(event.target.checked);
                    localStorage.setItem("pl-show-totals", event.target.checked ? "1" : "0");
                  }}
                />
                Show totals
              </label>
              <button
                onClick={() =>
                  void exportXlsx(
                    "pl",
                    () => api.profitAndLossXlsx(from || undefined, to || undefined),
                    `profit-and-loss_${periodTag(from, to)}.xlsx`,
                  )
                }
                disabled={xlsxBusy !== null}
              >
                {xlsxBusy === "pl" ? "Preparing…" : "Export Excel"}
              </button>
            </div>
            {showTotals && (
              <div className="row">
                <Stat label="Revenue" value={pl.revenue} />
                <Stat label="Expenses" value={pl.expenses} />
                <Stat label="Net profit" value={pl.netProfit} />
              </div>
            )}
            {customPl && (
              <div style={{ marginTop: 16 }}>
                <h3 style={{ margin: 0 }}>P&amp;L summary</h3>
                <ProfitLossSummary report={customPl} />
              </div>
            )}
            <div className="row" style={{ alignItems: "center", marginTop: 12 }}>
              <h3 style={{ flex: 1, margin: 0 }}>Custom headings</h3>
              <button
                onClick={() => {
                  setCustomError(null);
                  setCustomEditor(customEditor === "PL" ? null : "PL");
                }}
              >
                {customEditor === "PL" ? "Close editor" : "Edit headings"}
              </button>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={includeDetail}
                  onChange={(event) => setIncludeDetail(event.target.checked)}
                />
                Include account detail in export
              </label>
              <button
                onClick={() =>
                  void exportXlsx(
                    "custom-pl",
                    () =>
                      api.customReportXlsx(
                        "PL",
                        from || undefined,
                        to || undefined,
                        undefined,
                        includeDetail,
                      ),
                    `custom-profit-and-loss_${periodTag(from, to)}.xlsx`,
                  )
                }
                disabled={xlsxBusy !== null}
              >
                {xlsxBusy === "custom-pl" ? "Preparing…" : "Export Excel"}
              </button>
              <button
                onClick={() => void exportCustomCsv("PL", includeDetail)}
                disabled={csvBusy}
              >
                {csvBusy ? "Preparing…" : "Export CSV"}
              </button>
            </div>
            {customEditor === "PL" ? (
              <CustomReportEditor
                kind="PL"
                accounts={accounts}
                headings={customPl?.headings ?? []}
                busy={customBusy}
                error={customError}
                onSave={(headings) => void saveCustomHeadings("PL", headings)}
                onCancel={() => setCustomEditor(null)}
              />
            ) : customPl ? (
              <CustomReportTable report={customPl} showFooter={showTotals} />
            ) : (
              <p style={{ opacity: 0.7, margin: 0 }}>Loading custom report…</p>
            )}
          </>
        ) : (
          <p style={{ opacity: 0.7, margin: 0 }}>Loading profit &amp; loss…</p>
        )}
      </div>
      )}

      {showBs && (
      <div className="card" id="report-balance-sheet">
        {bs ? (
          <>
            <div className="row" style={{ alignItems: "center" }}>
              <h2 style={{ flex: 1, margin: 0 }}>
                Balance Sheet{" "}
                <span className="badge">
                  {asAt ? `as at ${formatDate(asAt)}` : "as at today"}
                </span>{" "}
                <span className="badge">{bs.balanced ? "Balanced" : "OUT OF BALANCE"}</span>
              </h2>
              <button
                onClick={() =>
                  void exportXlsx(
                    "bs",
                    () => api.balanceSheetXlsx(asAt || undefined),
                    `balance-sheet_${asAt ? `as-at_${asAt}` : "as-at-today"}.xlsx`,
                  )
                }
                disabled={xlsxBusy !== null}
              >
                {xlsxBusy === "bs" ? "Preparing…" : "Export Excel"}
              </button>
            </div>
            <div className="row">
              <Stat label="Assets" value={bs.assets} />
              <Stat label="Liabilities" value={bs.liabilities} />
              <Stat label="Equity (incl. profit)" value={bs.equity} />
              <Stat label="Net profit" value={bs.netProfit} />
            </div>
            <div className="row" style={{ alignItems: "center", marginTop: 12 }}>
              <h3 style={{ flex: 1, margin: 0 }}>Custom headings</h3>
              <button
                onClick={() => {
                  setCustomError(null);
                  setCustomEditor(customEditor === "BS" ? null : "BS");
                }}
              >
                {customEditor === "BS" ? "Close editor" : "Edit headings"}
              </button>
              <button
                onClick={() =>
                  void exportXlsx(
                    "custom-bs",
                    () => api.customReportXlsx("BS", undefined, undefined, asAt || undefined),
                    `custom-balance-sheet_${asAt ? `as-at_${asAt}` : "as-at-today"}.xlsx`,
                  )
                }
                disabled={xlsxBusy !== null}
              >
                {xlsxBusy === "custom-bs" ? "Preparing…" : "Export Excel"}
              </button>
              <button onClick={() => void exportCustomCsv("BS")} disabled={csvBusy}>
                {csvBusy ? "Preparing…" : "Export CSV"}
              </button>
            </div>
            {customEditor === "BS" ? (
              <CustomReportEditor
                kind="BS"
                accounts={accounts}
                headings={customBs?.headings ?? []}
                busy={customBusy}
                error={customError}
                onSave={(headings) => void saveCustomHeadings("BS", headings)}
                onCancel={() => setCustomEditor(null)}
              />
            ) : customBs ? (
              <CustomReportTable report={customBs} />
            ) : (
              <p style={{ opacity: 0.7, margin: 0 }}>Loading custom report…</p>
            )}
          </>
        ) : (
          <p style={{ opacity: 0.7, margin: 0 }}>Loading balance sheet…</p>
        )}
      </div>
      )}

      {showTb && (
      <div className="card" id="report-trial-balance">
        <div className="row" style={{ alignItems: "center" }}>
          <h2 style={{ flex: 1, margin: 0 }}>
            Trial Balance{" "}
            {tb && <span className="badge">{tb.balanced ? "Balanced" : "OUT OF BALANCE"}</span>}
            {tb && <span className="badge">{visibleTbRows.length} accounts</span>}
          </h2>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={showZero}
              onChange={(event) => setShowZero(event.target.checked)}
            />
            Show zero balances
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={showUnpriced}
              onChange={(event) => setShowUnpriced(event.target.checked)}
            />
            Show unpriced items
          </label>
          <button onClick={() => void exportCsv()} disabled={csvBusy}>
            {csvBusy ? "Preparing…" : "Export CSV"}
          </button>
          <button
            onClick={() =>
              void exportXlsx(
                "tb",
                () =>
                  api.trialBalanceXlsx(from || undefined, to || undefined, showUnpriced),
                `trial-balance_${periodTag(from, to)}.xlsx`,
              )
            }
            disabled={xlsxBusy !== null}
          >
            {xlsxBusy === "tb" ? "Preparing…" : "Export Excel"}
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Account</th>
              <th className="num">Opening Dr</th>
              <th className="num">Opening Cr</th>
              <th className="num">Period Dr</th>
              <th className="num">Period Cr</th>
              <th className="num">Closing Dr</th>
              <th className="num">Closing Cr</th>
            </tr>
          </thead>
          <tbody>
            {groupTbRows(visibleTbRows).map((group) => (
              <GroupedTbRows key={group.type} group={group} showUnpriced={showUnpriced} />
            ))}
            {tb && visibleTbRows.length === 0 && (
              <tr>
                <td colSpan={8}>No accounts with posted entries in this period.</td>
              </tr>
            )}
          </tbody>
          {tb && (
            <tfoot>
              <tr className="total">
                <td colSpan={6}>Closing totals</td>
                <td className="num">{amount(tb.totalDebit)}</td>
                <td className="num">{amount(tb.totalCredit)}</td>
              </tr>
            </tfoot>
          )}
        </table>
        {tb && visibleTbRows.some((row) => row.tagBreakdown?.length) && (
          <p style={{ opacity: 0.7, fontSize: 12, marginBottom: 0 }}>
            Inventory tags are memo lines: stock valued at current unit cost, with tag
            membership as at the report end. An item under several tags counts in full
            under each. They do not change the account balances.
          </p>
        )}
      </div>
      )}

      {showParty && (
      <div className="card" id="report-party-ledger">
        <h2>Party Ledger</h2>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <div>
            <label>Party</label>
            <SearchableSelect
              value={partyId == null ? "" : String(partyId)}
              onChange={(next) => setPartyId(next ? Number(next) : null)}
              placeholder="Select a party"
              emptyText="No matching party"
              options={parties.map((party) => ({
                value: String(party.id),
                label: party.name,
              }))}
            />
          </div>
          <div>
            <label>From</label>
            <input
              type="date"
              value={ledgerFrom}
              onChange={(event) => setLedgerFrom(event.target.value)}
            />
          </div>
          <div>
            <label>To</label>
            <input
              type="date"
              value={ledgerTo}
              onChange={(event) => setLedgerTo(event.target.value)}
            />
          </div>
          <button
            className="primary"
            onClick={() => void loadLedger()}
            disabled={ledgerBusy || partyId == null}
          >
            {ledgerBusy ? "Loading…" : "Load ledger"}
          </button>
          <button onClick={exportLedger} disabled={xlsxBusy !== null || partyId == null}>
            {xlsxBusy === "ledger" ? "Preparing…" : "Export Excel"}
          </button>
        </div>
        {ledgerLoaded && <LedgerTable rows={ledger} caption="for this party and period" />}
      </div>
      )}

      {showAllParties && (
      <div className="card" id="report-party-ledger-all">
        <h2>All Party Ledgers</h2>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <div>
            <label>From</label>
            <input type="date" value={allFrom} onChange={(e) => setAllFrom(e.target.value)} />
          </div>
          <div>
            <label>To</label>
            <input type="date" value={allTo} onChange={(e) => setAllTo(e.target.value)} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={allShowOpening}
              onChange={(event) => setAllShowOpening(event.target.checked)}
            />
            Show opening balances
          </label>
          <button
            className="primary"
            onClick={() => void loadAllPartyLedgers()}
            disabled={allBusy}
          >
            {allBusy ? "Loading…" : "Generate report"}
          </button>
          <button
            onClick={() =>
              void exportXlsx(
                "all-parties",
                () => api.partyLedgerAllXlsx(allFrom || undefined, allTo || undefined, allShowOpening),
                `all-party-ledgers_${periodTag(allFrom, allTo)}.xlsx`,
              )
            }
            disabled={xlsxBusy !== null}
          >
            {xlsxBusy === "all-parties" ? "Preparing…" : "Export Excel"}
          </button>
        </div>
        <p style={{ opacity: 0.7, fontSize: 12, marginBottom: 12 }}>
          Every party's activity in the period with its sum; the last row totals
          all parties. Opening balances are hidden unless ticked. Leave the
          dates empty for full history.
        </p>
        {allLoaded && allPartyLedgers && <AllPartyLedgerTable report={allPartyLedgers} />}
      </div>
      )}

      {showPartyProducts && (
      <div className="card" id="report-party-product-sales">
        <h2>Party Product Sales</h2>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <div>
            <label>From</label>
            <input type="date" value={ppFrom} onChange={(e) => setPpFrom(e.target.value)} />
          </div>
          <div>
            <label>To</label>
            <input type="date" value={ppTo} onChange={(e) => setPpTo(e.target.value)} />
          </div>
          <button className="primary" onClick={() => void loadPartyProducts()} disabled={ppBusy}>
            {ppBusy ? "Loading…" : "Generate report"}
          </button>
          <button
            onClick={() =>
              void exportXlsx(
                "party-products",
                () => api.partyProductSalesXlsx(ppFrom || undefined, ppTo || undefined),
                `party-product-sales_${periodTag(ppFrom, ppTo)}.xlsx`,
              )
            }
            disabled={xlsxBusy !== null}
          >
            {xlsxBusy === "party-products" ? "Preparing…" : "Export Excel"}
          </button>
        </div>
        <p style={{ opacity: 0.7, fontSize: 12, marginBottom: 12 }}>
          What each party spent per product across all its confirmed sale
          invoices; the party band shows that party's total. Leave the dates empty
          for full history.
        </p>
        {ppLoaded && partyProducts && <PartyProductTable report={partyProducts} />}
      </div>
      )}

      {showPartyPurchases && (
      <div className="card" id="report-party-product-purchases">
        <h2>Party Product Purchases</h2>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <div>
            <label>From</label>
            <input type="date" value={puFrom} onChange={(e) => setPuFrom(e.target.value)} />
          </div>
          <div>
            <label>To</label>
            <input type="date" value={puTo} onChange={(e) => setPuTo(e.target.value)} />
          </div>
          <button className="primary" onClick={() => void loadPartyPurchases()} disabled={puBusy}>
            {puBusy ? "Loading…" : "Generate report"}
          </button>
          <button
            onClick={() =>
              void exportXlsx(
                "party-purchases",
                () => api.partyProductPurchasesXlsx(puFrom || undefined, puTo || undefined),
                `party-product-purchases_${periodTag(puFrom, puTo)}.xlsx`,
              )
            }
            disabled={xlsxBusy !== null}
          >
            {xlsxBusy === "party-purchases" ? "Preparing…" : "Export Excel"}
          </button>
        </div>
        <p style={{ opacity: 0.7, fontSize: 12, marginBottom: 12 }}>
          What each party supplied per product across all its confirmed purchase
          invoices; the party band shows that party's total. Leave the dates empty
          for full history.
        </p>
        {puLoaded && partyPurchases && <PartyProductTable report={partyPurchases} />}
      </div>
      )}

      {showCash && (
      <div className="card" id="report-cash-book">
        <h2>Cash Book (Cash in Hand — 1000)</h2>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <div>
            <label>From</label>
            <input type="date" value={cashFrom} onChange={(e) => setCashFrom(e.target.value)} />
          </div>
          <div>
            <label>To</label>
            <input type="date" value={cashTo} onChange={(e) => setCashTo(e.target.value)} />
          </div>
          <button className="primary" onClick={() => void loadCashBook()} disabled={cashBusy}>
            {cashBusy ? "Loading…" : "Load cash book"}
          </button>
          <button
            onClick={() =>
              void exportXlsx(
                "cash",
                () => api.cashBookXlsx(cashFrom || undefined, cashTo || undefined),
                `cash-book_${periodTag(cashFrom, cashTo)}.xlsx`,
              )
            }
            disabled={xlsxBusy !== null}
          >
            {xlsxBusy === "cash" ? "Preparing…" : "Export Excel"}
          </button>
        </div>
        {cashLoaded && <LedgerTable rows={cashBook} caption="in this period" />}
      </div>
      )}
    </>
  );
}
