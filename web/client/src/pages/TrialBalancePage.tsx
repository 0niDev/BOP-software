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

  useEffect(() => {
    Promise.all([api.trialBalance(), api.profitAndLoss(), api.balanceSheet(), api.parties()])
      .then(([balance, pnl, sheet, partyList]) => {
        setTb(balance);
        setPl(pnl);
        setBs(sheet);
        setParties(partyList);
        const first = partyList[0];
        if (first) setPartyId(first.id);
      })
      .catch((err) => setError(errorMessage(err, "Failed to load reports.")));
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
      const csv = await api.trialBalanceCsv();
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

  return (
    <>
      {error && <div className="error">{error}</div>}

      {pl && (
        <div className="card">
          <h2>Profit &amp; Loss (all posted entries)</h2>
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
              <th className="num">Debit</th>
              <th className="num">Credit</th>
            </tr>
          </thead>
          <tbody>
            {tb?.rows.map((row) => (
              <tr key={row.accountId}>
                <td>{row.accountCode}</td>
                <td>{row.accountName}</td>
                <td>{row.accountType}</td>
                <td className="num">{amount(row.debit)}</td>
                <td className="num">{amount(row.credit)}</td>
              </tr>
            ))}
            {tb && tb.rows.length === 0 && (
              <tr>
                <td colSpan={5}>No posted entries yet.</td>
              </tr>
            )}
          </tbody>
          {tb && (
            <tfoot>
              <tr className="total">
                <td colSpan={3}>Totals</td>
                <td className="num">{amount(tb.totalDebit)}</td>
                <td className="num">{amount(tb.totalCredit)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="card">
        <h2>Party Ledger</h2>
        <div className="row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
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
        <div className="row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
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
