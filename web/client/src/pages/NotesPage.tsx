import { useEffect, useState } from "react";
import { api } from "../api";
import PLNotes, { noteBlocks } from "../components/PLNotes";
import { saveBlob } from "../lib/download";
import { usePageVisible } from "../lib/pageVisibility";
import type { CustomReport } from "../types";

/** The printed notes as CSV, matching the on-screen Note | Particulars | Amount. */
export function notesCsv(report: CustomReport): string {
  const cell = (value: string): string => `"${value.replace(/"/g, '""')}"`;
  const lines = noteBlocks(report).flatMap((block) => [
    [
      cell(block.note ? `Note No : ${block.note}` : ""),
      cell(block.title),
      block.total.toFixed(2),
    ].join(","),
    ...block.rows.map((row) => [cell(row.note), cell(row.name), row.amount.toFixed(2)].join(",")),
  ]);
  lines.push('"*** End of Report ***",,');
  return lines.join("\n");
}

/**
 * "Notes" module: the printed Notes to the Accounts for the P&L period. Kept
 * apart from the P&L report so the statement and its notes print separately.
 */
export default function NotesPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [report, setReport] = useState<CustomReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageVisible = usePageVisible();

  async function load(next?: { from?: string; to?: string }): Promise<void> {
    const f = next?.from ?? from;
    const t = next?.to ?? to;
    setBusy(true);
    setError(null);
    try {
      setReport(await api.customReport("PL", f || undefined, t || undefined));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notes.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load({ from: "", to: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageVisible]);

  function exportCsv(): void {
    if (!report) return;
    const tag = from || to ? `${from || "start"}_to_${to || "today"}` : "all-posted";
    saveBlob(
      new Blob([notesCsv(report)], { type: "text/csv;charset=utf-8" }),
      `notes_${tag}.csv`,
    );
  }

  return (
    <>
      <div className="card">
        <h2>Report period</h2>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <div>
            <label>From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label>To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button className="primary" onClick={() => void load()} disabled={busy}>
            {busy ? "Loading…" : "Apply"}
          </button>
          <button
            onClick={() => {
              setFrom("");
              setTo("");
              void load({ from: "", to: "" });
            }}
            disabled={busy}
          >
            All posted entries
          </button>
        </div>
        <p style={{ opacity: 0.7, fontSize: 12, marginBottom: 0 }}>
          Leave the dates empty to report on every posted entry.
        </p>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card" id="report-notes">
        <div className="row" style={{ alignItems: "center" }}>
          <h2 style={{ flex: 1, margin: 0 }}>
            Notes{" "}
            <span className="badge">
              {from || to ? "for the period" : "all posted entries"}
            </span>
          </h2>
          <button onClick={exportCsv} disabled={!report}>
            Export CSV
          </button>
        </div>
        {report ? (
          <PLNotes report={report} />
        ) : (
          <p style={{ opacity: 0.7, margin: 0 }}>Loading notes…</p>
        )}
      </div>
    </>
  );
}
