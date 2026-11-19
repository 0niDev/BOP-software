import { useEffect, useState } from "react";
import { api } from "../api";
import CustomReportEditor from "../components/CustomReportEditor";
import PLNotes from "../components/PLNotes";
import { saveBlob } from "../lib/download";
import { usePageVisible } from "../lib/pageVisibility";
import type { Account, CustomHeading, CustomReport } from "../types";

/**
 * "Notes" module: the printed Notes to the Accounts for the P&L period. Kept
 * apart from the P&L report so the statement and its notes print separately.
 */
export default function NotesPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [report, setReport] = useState<CustomReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [editorBusy, setEditorBusy] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

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

  /** Heading edits belong to the notes: they change these blocks, not the P&L face. */
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
      await api.saveCustomReport("PL", headings);
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
      const tag = from || to ? `${from || "start"}_to_${to || "today"}` : "all-posted";
      saveBlob(await api.notesXlsx(from || undefined, to || undefined), `notes_${tag}.xlsx`);
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
          <button onClick={() => void exportXlsx()} disabled={exportBusy}>
            {exportBusy ? "Preparing…" : "Export Excel"}
          </button>
          <button onClick={() => void toggleEditor()} disabled={editorBusy || !report}>
            {editing ? "Close editor" : "Edit headings"}
          </button>
        </div>
        <p style={{ opacity: 0.7, fontSize: 12, marginTop: 0 }}>
          Editing headings changes these notes only; the Profit &amp; Loss statement
          keeps its printed layout.
        </p>
        {report ? (
          <PLNotes report={report} />
        ) : (
          <p style={{ opacity: 0.7, margin: 0 }}>Loading notes…</p>
        )}
        {editing && report && (
          <div style={{ marginTop: 16 }}>
            <CustomReportEditor
              kind="PL"
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
