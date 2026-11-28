import { useEffect, useState } from "react";
import { api } from "../api";
import CustomReportEditor from "../components/CustomReportEditor";
import PLNotes from "../components/PLNotes";
import SearchableSelect from "../components/SearchableSelect";
import { saveBlob } from "../lib/download";
import { usePageVisible } from "../lib/pageVisibility";
import { exportPeriods } from "../lib/periods";
import type { Account, CustomHeading, CustomReport, CustomReportKind } from "../types";

/**
 * "Notes" module: the printed Notes to the Accounts. Holds both the P&L notes
 * (for a period) and the Balance Sheet notes (as at a date); heading edits here
 * never change the printed statement faces.
 */
export default function NotesPage() {
  const [kind, setKind] = useState<CustomReportKind>("PL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [asAt, setAsAt] = useState("");
  const [report, setReport] = useState<CustomReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [editorBusy, setEditorBusy] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  const pageVisible = usePageVisible();
  const months = exportPeriods("Monthly");
  const selectedMonth = months.find((month) => month.from === from && month.to === to);

  async function load(
    next?: { from?: string; to?: string; asAt?: string; kind?: CustomReportKind },
  ): Promise<void> {
    const k = next?.kind ?? kind;
    const f = next?.from ?? from;
    const t = next?.to ?? to;
    const a = next?.asAt ?? asAt;
    setBusy(true);
    setError(null);
    try {
      setReport(await api.customReport(k, f || undefined, t || undefined, a || undefined));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notes.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load({ from: "", to: "", asAt: "", kind: "PL" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageVisible]);

  function switchKind(next: CustomReportKind): void {
    setKind(next);
    setEditing(false);
    void load({ kind: next });
  }

  /** Heading edits belong to the notes: they change these blocks, not the statement faces. */
  async function toggleEditor(): Promise<void> {
    if (editing) {
      setEditing(false);
      return;
    }
    setEditorError(null);
    setEditing(true);
    if (accounts.length > 0) return;
    try {
      setAccounts(await api.accounts());
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : "Failed to load accounts.");
    }
  }

  async function saveHeadings(headings: CustomHeading[]): Promise<void> {
    setEditorBusy(true);
    setEditorError(null);
    try {
      await api.saveCustomReport(kind, headings);
      setEditing(false);
      await load();
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : "Failed to save headings.");
    } finally {
      setEditorBusy(false);
    }
  }

  async function exportXlsx(): Promise<void> {
    setExportBusy(true);
    setError(null);
    try {
      if (kind === "BS") {
        saveBlob(
          await api.notesXlsx(undefined, undefined, "BS", asAt || undefined),
          `balance-sheet-notes_${asAt ? `as-at_${asAt}` : "as-at-today"}.xlsx`,
        );
      } else {
        const tag = from || to ? `${from || "start"}_to_${to || "today"}` : "all-posted";
        saveBlob(await api.notesXlsx(from || undefined, to || undefined), `notes_${tag}.xlsx`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Excel export failed.");
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
            <label>Statement</label>
            <SearchableSelect
              value={kind}
              onChange={(value) => switchKind(value as CustomReportKind)}
              placeholder="Statement"
              options={[
                { value: "PL", label: "Profit & Loss notes" },
                { value: "BS", label: "Balance Sheet notes" },
              ]}
            />
          </div>
          <div>
            <label>Month</label>
            <SearchableSelect
              value={selectedMonth?.from ?? ""}
              onChange={(next) => {
                const month = months.find((period) => period.from === next);
                if (!month) return;
                setFrom(month.from);
                setTo(month.to);
                setAsAt(month.to);
                void load({ from: month.from, to: month.to, asAt: month.to });
              }}
              placeholder="Jump to month…"
              emptyText="No matching month"
              options={months.map((period) => ({ value: period.from, label: period.label }))}
            />
          </div>
          {kind === "PL" ? (
            <>
              <div>
                <label>From</label>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <label>To</label>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </>
          ) : (
            <div>
              <label>As at</label>
              <input type="date" value={asAt} onChange={(e) => setAsAt(e.target.value)} />
            </div>
          )}
          <button className="primary" onClick={() => void load()} disabled={busy}>
            {busy ? "Loading…" : "Apply"}
          </button>
          <button
            onClick={() => {
              setFrom("");
              setTo("");
              setAsAt("");
              void load({ from: "", to: "", asAt: "" });
            }}
            disabled={busy}
          >
            All posted entries
          </button>
        </div>
        <p style={{ opacity: 0.7, fontSize: 12, marginBottom: 0 }}>
          {kind === "PL"
            ? "Leave the dates empty to report on every posted entry."
            : "Leave the date empty to report the position on every posted entry."}
        </p>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card" id="report-notes">
        <div className="row" style={{ alignItems: "center" }}>
          <h2 style={{ flex: 1, margin: 0 }}>
            Notes{" "}
            <span className="badge">
              {kind === "BS"
                ? asAt
                  ? `as at ${asAt}`
                  : "as at today"
                : from || to
                  ? "for the period"
                  : "all posted entries"}
            </span>
          </h2>
          <button onClick={() => void exportXlsx()} disabled={exportBusy}>
            {exportBusy ? "Preparing…" : "Export Excel"}
          </button>
          <button onClick={() => void toggleEditor()} disabled={editorBusy || !report}>
            {editing ? "Close editor" : "Edit headings"}
          </button>
        </div>
        <p style={{ opacity: 0.7, fontSize: 12, marginTop: 0 }}>
          Editing headings changes these notes only; the printed statement keeps its layout.
        </p>
        {report ? (
          <PLNotes report={report} />
        ) : (
          <p style={{ opacity: 0.7, margin: 0 }}>Loading notes…</p>
        )}
        {editing && report && (
          <div style={{ marginTop: 16 }}>
            <CustomReportEditor
              kind={kind}
              accounts={accounts}
              headings={report.headings}
              busy={editorBusy}
              error={editorError}
              onSave={(headings) => void saveHeadings(headings)}
              onCancel={() => setEditing(false)}
            />
          </div>
        )}
      </div>
    </>
  );
}
