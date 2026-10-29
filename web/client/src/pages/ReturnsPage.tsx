import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import NumberInput from "../components/NumberInput";
import { formatDate } from "../lib/format";
import { usePageVisible } from "../lib/pageVisibility";

function money(value: number): string {
  return value.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Tab = "sales" | "purchase";

export default function ReturnsPage() {
  const [tab, setTab] = useState<Tab>("sales");
  const [salesReturns, setSalesReturns] = useState<Record<string, unknown>[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [invoiceId, setInvoiceId] = useState(0);
  const [invoiceItemId, setInvoiceItemId] = useState(0);
  const [quantity, setQuantity] = useState(1);
  /** Return being edited in the form; null = creating a new one. */
  const [editingId, setEditingId] = useState<number | null>(null);

  async function refresh() {
    try {
      setSalesReturns(await api.salesReturns());
      setPurchaseReturns(await api.purchaseReturns());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load returns.");
    }
  }

  const pageVisible = usePageVisible();

  useEffect(() => {
    void refresh();
  }, [pageVisible]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const date = new Date().toISOString().slice(0, 10);
    try {
      const body = {
        invoiceId,
        returnDate: date,
        items: [{ invoiceItemId, quantity }],
      };
      if (editingId != null) {
        const result =
          tab === "sales"
            ? await api.updateSalesReturn(editingId, body)
            : await api.updatePurchaseReturn(editingId, body);
        setNotice(`Updated ${result.returnNumber} for ${money(result.totalAmount)}`);
        setEditingId(null);
      } else {
        const result =
          tab === "sales"
            ? await api.createSalesReturn(body)
            : await api.createPurchaseReturn(body);
        setNotice(`Created ${result.returnNumber} for ${money(result.totalAmount)}`);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create return.");
    }
  }

  /** Load a return into the form. Multi-line returns are not editable here. */
  async function startEdit(row: Record<string, unknown>): Promise<void> {
    setError(null);
    setNotice(null);
    try {
      const id = Number(row.id);
      const detail =
        tab === "sales" ? await api.salesReturn(id) : await api.purchaseReturn(id);
      if (detail.items.length !== 1) {
        setError("This return has more than one line. Delete it and record it again.");
        return;
      }
      const item = detail.items[0] as Record<string, unknown>;
      setEditingId(id);
      setInvoiceId(Number(detail.return.invoice_id));
      setInvoiceItemId(Number(item.invoice_item_id));
      setQuantity(Number(item.quantity));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load the return.");
    }
  }

  async function remove(row: Record<string, unknown>): Promise<void> {
    if (!window.confirm(`Delete return ${String(row.return_number ?? "")}? Stock is put back.`)) {
      return;
    }
    setError(null);
    setNotice(null);
    try {
      const id = Number(row.id);
      if (tab === "sales") await api.deleteSalesReturn(id);
      else await api.deletePurchaseReturn(id);
      setNotice(`Return ${String(row.return_number ?? "")} deleted.`);
      if (editingId === id) setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete the return.");
    }
  }

  const rows = tab === "sales" ? salesReturns : purchaseReturns;
  const invoiceKey = tab === "sales" ? "invoice_number" : "invoice_number";

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Returns</h2>
          <div className="row">
            <button className={tab === "sales" ? "primary" : ""} onClick={() => { setTab("sales"); setEditingId(null); }}>
              Sales Returns
            </button>
            <button className={tab === "purchase" ? "primary" : ""} onClick={() => { setTab("purchase"); setEditingId(null); }}>
              Purchase Returns
            </button>
          </div>
        </div>
        {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
        {notice && <div className="badge" style={{ display: "inline-block", marginTop: 12 }}>{notice}</div>}
      </div>

      <form className="card" onSubmit={submit}>
        <h2>{editingId != null ? "Edit return" : `New ${tab === "sales" ? "sales" : "purchase"} return`}</h2>
        <p className="sub" style={{ color: "#adb5bd", fontSize: 13 }}>
          Enter the invoice id, the invoice line id (from the invoice detail API) and quantity.
        </p>
        <div className="row">
          <div>
            <label>Invoice id</label>
            <NumberInput
              min="1"
              value={invoiceId}
              onChange={(e) => setInvoiceId(Number(e.target.value))}
              style={{ width: 120 }}
            />
          </div>
          <div>
            <label>Invoice line id</label>
            <NumberInput
              min="1"
              value={invoiceItemId}
              onChange={(e) => setInvoiceItemId(Number(e.target.value))}
              style={{ width: 140 }}
            />
          </div>
          <div>
            <label>Quantity</label>
            <NumberInput
              min="0"
              step="0.001"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              style={{ width: 120 }}
            />
          </div>
          <button className="primary" type="submit">
            {editingId != null ? "Save changes" : "Create return"}
          </button>
          {editingId != null && (
            <button type="button" onClick={() => setEditingId(null)}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Return</th>
              <th>Invoice</th>
              <th>Date</th>
              <th className="num">Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.id)}>
                <td>{String(row.return_number ?? "")}</td>
                <td>{String(row[invoiceKey] ?? "")}</td>
                <td>{formatDate(String(row.return_date ?? ""))}</td>
                <td className="num">{money(Number(row.total_amount ?? 0))}</td>
                <td>
                  <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                    <button type="button" onClick={() => void startEdit(row)}>
                      Edit
                    </button>
                    <button type="button" onClick={() => void remove(row)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5}>No returns recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
