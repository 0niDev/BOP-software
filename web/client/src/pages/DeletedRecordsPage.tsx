import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import { formatDate } from "../lib/format";
import { usePageVisible } from "../lib/pageVisibility";
import type { DeletedRecord } from "../types";

const TABLE_LABELS: Record<string, string> = {
  expenses: "Expense",
  expense_settlements: "Expense settlement",
  payments: "Supplier payment",
  receipts: "Customer receipt",
  bank_transactions: "Bank transaction",
  cheques: "Cheque",
  sales_returns: "Sales return",
  purchase_returns: "Purchase return",
  assets: "Fixed asset",
};

function label(table: string): string {
  return TABLE_LABELS[table] ?? table;
}

/** Pull the voucher/amount worth showing out of the stored delete payload. */
function summary(row: DeletedRecord): string {
  if (!row.details) return "";
  try {
    const details = JSON.parse(row.details) as {
      voucherNumber?: string;
      returnNumber?: string;
      input?: { voucherNumber?: string; amount?: number; assetName?: string; chequeNumber?: string };
    };
    const input = details.input ?? {};
    const name =
      details.voucherNumber ??
      details.returnNumber ??
      input.voucherNumber ??
      input.assetName ??
      input.chequeNumber;
    const amount = input.amount;
    if (name && amount != null) return `${name} — ${Number(amount).toFixed(2)}`;
    if (name) return String(name);
    if (amount != null) return Number(amount).toFixed(2);
    return "";
  } catch {
    return "";
  }
}

export default function DeletedRecordsPage() {
  const [rows, setRows] = useState<DeletedRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function refresh(): Promise<void> {
    try {
      setRows(await api.deletedRecords());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load deleted records.");
    }
  }

  const pageVisible = usePageVisible();

  useEffect(() => {
    void refresh();
  }, [pageVisible]);

  async function restore(row: DeletedRecord): Promise<void> {
    if (
      !window.confirm(
        `Restore this ${label(row.entity_table).toLowerCase()}? It is re-posted as a new record (a fresh voucher number).`,
      )
    ) {
      return;
    }
    setBusyId(row.id);
    setError(null);
    setNotice(null);
    try {
      const result = await api.restoreRecord(row.id);
      setNotice(`Restored as ${label(result.table).toLowerCase()} #${result.id}.`);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to restore the record.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Deleted records</h2>
      <p className="sub" style={{ marginTop: 0 }}>
        Every delete keeps its data here. Restoring re-posts the original document with the same
        figures; voucher numbers are allocated fresh.
      </p>
      {error && <div className="error">{error}</div>}
      {notice && (
        <div className="badge" style={{ display: "inline-block", marginBottom: 12 }}>
          {notice}
        </div>
      )}
      <table>
        <thead>
          <tr>
            <th>Deleted</th>
            <th>Type</th>
            <th>Record</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{formatDate(row.created_at, true)}</td>
              <td>{label(row.entity_table)}</td>
              <td>{summary(row)}</td>
              <td>
                {row.restored ? (
                  <span className="badge">Restored</span>
                ) : (
                  <span className="sub">Deleted</span>
                )}
              </td>
              <td>
                {!row.restored && (
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void restore(row)}
                  >
                    {busyId === row.id ? "Restoring…" : "Restore"}
                  </button>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5}>No deleted records.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
