import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import type { BalanceSheet, LedgerEntry, Party, ProfitAndLoss, TrialBalance } from "../types";

function money(value: number): string {
  return value.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function amount(value: number): string {
  return value === 0 ? "" : money(value);
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
          <th className="num">Debit</th>
          <th className="num">Credit</th>
          <th className="num">Balance</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`${row.voucherNumber}-${index}`}>
            <td>{row.date}</td>
            <td>{row.voucherNumber}</td>
            <td>{row.voucherType}</td>
            <td>{row.description ?? "—"}</td>
            <td className="num">{amount(row.debit)}</td>
            <td className="num">{amount(row.credit)}</td>
            <td className="num">{money(row.balance)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function TrialBalancePage() {
  const [tb, setTb] = useState<TrialBalance | null>(null);
  const [pl, setPl] = useState<ProfitAndLoss | null>(null);
  const [bs, setBs] = useState<BalanceSheet | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  const [csvBusy, setCsvBusy] = useState(false);

  const [exportFrequency, setExportFrequency] = useState<"Monthly" | "Yearly">("Monthly");
  const [exportIndex, setExportIndex] = useState(() =>
    Math.max(exportPeriods("Monthly").length - 1, 0),
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
      const [balance, pnl, sheet] = await Promise.all([
        api.trialBalance(f || undefined, t || undefined),
        api.profitAndLoss(f || undefined, t || undefined),
        api.balanceSheet(a || undefined),
      ]);
      setTb(balance);
      setPl(pnl);
      setBs(sheet);
    } catch (err) {
      setError(errorMessage(err, "Failed to load reports."));
    } finally {
      setReportsBusy(false);
    }
  }

  useEffect(() => {
    void loadReports({ from: "", to: "", asAt: "" });
    api
      .parties()
      .then((partyList) => {
        setParties(partyList);
        const first = partyList[0];
        if (first) setPartyId(first.id);
      })
      .catch((err) => setError(errorMessage(err, "Failed to load parties.")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function exportCsv(): Promise<void> {
    setCsvBusy(true);
    setError(null);
    try {
      const csv = await api.trialBalanceCsv(from || undefined, to || undefined);
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "trial-balance.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
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
      const csv = await api.exportAllCsv(selectedPeriod.from, selectedPeriod.to);
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `all-reports_${selectedPeriod.from}_to_${selectedPeriod.to}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(errorMessage(err, "Export failed."));
    } finally {
      setExportBusy(false);
    }
  }

  return (
    <>
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

      <div className="card">
        <h2>Export all reports</h2>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <div>
            <label>Frequency</label>
            <select
              value={exportFrequency}
              onChange={(e) => {
                const next = e.target.value as "Monthly" | "Yearly";
                setExportFrequency(next);
                setExportIndex(Math.max(exportPeriods(next).length - 1, 0));
              }}
            >
              <option value="Monthly">Monthly</option>
              <option value="Yearly">Yearly</option>
            </select>
          </div>
          <div>
            <label>Period</label>
            <select value={exportIndex} onChange={(e) => setExportIndex(Number(e.target.value))}>
              {periods.map((period, index) => (
                <option key={period.from} value={index}>
                  {period.label}
                </option>
              ))}
            </select>
          </div>
          <button
            className="primary"
            onClick={() => void exportAll()}
            disabled={exportBusy || !selectedPeriod}
          >
            {exportBusy ? "Preparing…" : "Download all reports (CSV)"}
          </button>
        </div>
        <p style={{ opacity: 0.7, fontSize: 12, marginBottom: 0 }}>
          One file containing the trial balance, profit &amp; loss, balance sheet (as at the
          period end) and cash book for {""}
          <strong>{selectedPeriod ? `${selectedPeriod.from} → ${selectedPeriod.to}` : "—"}</strong>.
        </p>
      </div>

      {error && <div className="error">{error}</div>}

      {pl && (
        <div className="card">
          <h2>
            Profit &amp; Loss{" "}
            <span className="badge">{from || to ? "for the period" : "all posted entries"}</span>
          </h2>
          <div className="row">
            <Stat label="Revenue" value={pl.revenue} />
            <Stat label="Expenses" value={pl.expenses} />
            <Stat label="Net profit" value={pl.netProfit} />
          </div>
        </div>
      )}

      {bs && (
        <div className="card">
          <h2>
            Balance Sheet{" "}
            <span className="badge">{asAt ? `as at ${asAt}` : "as at today"}</span>{" "}
            <span className="badge">{bs.balanced ? "Balanced" : "OUT OF BALANCE"}</span>
          </h2>
          <div className="row">
            <Stat label="Assets" value={bs.assets} />
            <Stat label="Liabilities" value={bs.liabilities} />
            <Stat label="Equity (incl. profit)" value={bs.equity} />
            <Stat label="Net profit" value={bs.netProfit} />
          </div>
        </div>
      )}

      <div className="card">
        <div className="row" style={{ alignItems: "center" }}>
          <h2 style={{ flex: 1, margin: 0 }}>
            Trial Balance{" "}
            {tb && <span className="badge">{tb.balanced ? "Balanced" : "OUT OF BALANCE"}</span>}
          </h2>
          <button onClick={() => void exportCsv()} disabled={csvBusy}>
            {csvBusy ? "Preparing…" : "Export CSV"}
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Account</th>
              <th>Type</th>
              <th className="num">Opening Dr</th>
              <th className="num">Opening Cr</th>
              <th className="num">Period Dr</th>
              <th className="num">Period Cr</th>
              <th className="num">Closing Dr</th>
              <th className="num">Closing Cr</th>
            </tr>
          </thead>
          <tbody>
            {tb?.rows.map((row) => (
              <tr key={row.accountId}>
                <td>{row.accountCode}</td>
                <td>{row.accountName}</td>
                <td>{row.accountType}</td>
                <td className="num">{amount(row.openingDebit)}</td>
                <td className="num">{amount(row.openingCredit)}</td>
                <td className="num">{amount(row.debit)}</td>
                <td className="num">{amount(row.credit)}</td>
                <td className="num">{amount(row.closingDebit)}</td>
                <td className="num">{amount(row.closingCredit)}</td>
              </tr>
            ))}
            {tb && tb.rows.length === 0 && (
              <tr>
                <td colSpan={9}>No accounts with posted entries in this period.</td>
              </tr>
            )}
          </tbody>
          {tb && (
            <tfoot>
              <tr className="total">
                <td colSpan={7}>Closing totals</td>
                <td className="num">{amount(tb.totalDebit)}</td>
                <td className="num">{amount(tb.totalCredit)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="card">
        <h2>Party Ledger</h2>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <div>
            <label>Party</label>
            <select
              value={partyId ?? ""}
              onChange={(event) => setPartyId(Number(event.target.value))}
            >
              <option value="" disabled>
                Select a party
              </option>
              {parties.map((party) => (
                <option key={party.id} value={party.id}>
                  {party.name}
                </option>
              ))}
            </select>
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
        </div>
        {ledgerLoaded && <LedgerTable rows={ledger} caption="for this party and period" />}
      </div>

      <div className="card">
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
        </div>
        {cashLoaded && <LedgerTable rows={cashBook} caption="in this period" />}
      </div>
    </>
  );
}
