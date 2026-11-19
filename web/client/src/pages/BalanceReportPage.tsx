import { Fragment, useEffect, useState } from "react";
import { api, ApiError } from "../api";
import { saveBlob } from "../lib/download";
import { usePageVisible } from "../lib/pageVisibility";
import type { PartyBalance } from "../types";

type Kind = "payables" | "receivables";

function money(value: number): string {
  return value.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function amount(value: number): string {
  return value === 0 ? "" : money(value);
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/** The party-type bands of one report, in the order the page prints them. */
function sections(kind: Kind, rows: PartyBalance[]): Array<{ title: string; rows: PartyBalance[] }> {
  const byType = (partyType: string): PartyBalance[] =>
    rows
      .filter((row) => row.partyType === partyType)
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance) || a.name.localeCompare(b.name));
  return kind === "payables"
    ? [
        { title: "Suppliers — payable", rows: byType("SUPPLIER") },
        { title: "Customers — paid in advance", rows: byType("CUSTOMER") },
        { title: "Other parties", rows: byType("BOTH") },
      ]
    : [
        { title: "Customers — receivable", rows: byType("CUSTOMER") },
        { title: "Suppliers — paid in advance", rows: byType("SUPPLIER") },
        { title: "Other parties", rows: byType("BOTH") },
      ];
}

export default function BalanceReportPage({ kind }: { kind: Kind }) {
  const [rows, setRows] = useState<PartyBalance[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageVisible = usePageVisible();

  const isPayables = kind === "payables";
  const title = isPayables ? "Payables" : "Receivables";
  const closingLabel = isPayables ? "Closing Cr" : "Closing Dr";

  async function load(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const all = await api.partyBalances(from || undefined, to || undefined);
      setRows(all.filter((row) => row.side === (isPayables ? "PAYABLE" : "RECEIVABLE")));
      setLoaded(true);
    } catch (err) {
      setError(errorMessage(err, `Failed to load ${title.toLowerCase()}.`));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (pageVisible) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageVisible]);

  async function exportXlsx(): Promise<void> {
    setExporting(true);
    setError(null);
    try {
      const suffix = [from, to].filter(Boolean).join("_to_") || "all-posted";
      saveBlob(
        await api.partyBalancesXlsx(kind, from || undefined, to || undefined),
        `${kind}_${suffix}.xlsx`,
      );
    } catch (err) {
      setError(errorMessage(err, "Excel export failed."));
    } finally {
      setExporting(false);
    }
  }

  const shown = sections(kind, rows);
  const total = rows.reduce((sum, row) => sum + Math.abs(row.balance), 0);

  return (
    <div className="card" id={`report-${kind}`}>
      <h2>{title}</h2>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <div>
          <label>From</label>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div>
          <label>To</label>
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <button className="primary" onClick={() => void load()} disabled={busy}>
          {busy ? "Loading…" : "Generate report"}
        </button>
        <button onClick={() => void exportXlsx()} disabled={exporting || !loaded}>
          {exporting ? "Preparing…" : "Export Excel"}
        </button>
      </div>
      <p style={{ opacity: 0.7, fontSize: 12, marginBottom: 12 }}>
        Every party with a {isPayables ? "credit (payable)" : "debit (receivable)"} balance.
        Advances are shown in their own band. Leave the dates empty for full history; a From
        date folds everything before it into the opening balance.
      </p>
      {error && <div className="error">{error}</div>}

      {loaded && (
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Party</th>
              <th>Type</th>
              <th className="num">Opening Dr</th>
              <th className="num">Opening Cr</th>
              <th className="num">Period Dr</th>
              <th className="num">Period Cr</th>
              <th className="num">{closingLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} style={{ opacity: 0.7 }}>
                  No {title.toLowerCase()} in this period.
                </td>
              </tr>
            )}
            {shown.map((section) =>
              section.rows.length === 0 ? null : (
                <Fragment key={section.title}>
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        background: "var(--accent-soft)",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        fontSize: 12,
                        opacity: 0.8,
                      }}
                    >
                      {section.title} ({section.rows.length})
                    </td>
                    <td
                      className="num"
                      style={{ background: "var(--accent-soft)", fontWeight: 700 }}
                    >
                      {money(
                        section.rows.reduce((sum, row) => sum + Math.abs(row.balance), 0),
                      )}
                    </td>
                  </tr>
                  {section.rows.map((row) => (
                    <tr key={row.partyId}>
                      <td>{row.code}</td>
                      <td>
                        {row.name}
                        {row.isActive ? null : (
                          <span style={{ opacity: 0.6 }}> · inactive</span>
                        )}
                      </td>
                      <td>{row.partyType}</td>
                      <td className="num">{amount(row.opening > 0 ? row.opening : 0)}</td>
                      <td className="num">{amount(row.opening < 0 ? -row.opening : 0)}</td>
                      <td className="num">{amount(row.debit)}</td>
                      <td className="num">{amount(row.credit)}</td>
                      <td className="num">{money(Math.abs(row.balance))}</td>
                    </tr>
                  ))}
                </Fragment>
              ),
            )}
          </tbody>
          {shown.some((section) => section.rows.length > 0) && (
            <tfoot>
              <tr className="total">
                <td colSpan={7}>Total {title.toLowerCase()} ({rows.length} parties)</td>
                <td className="num">{money(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      )}
    </div>
  );
}
