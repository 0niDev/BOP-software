import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";

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

  async function refresh() {
    try {
      setSalesReturns(await api.salesReturns());
      setPurchaseReturns(await api.purchaseReturns());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load returns.");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

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
      const result =
        tab === "sales"
          ? await api.createSalesReturn(body)
          : await api.createPurchaseReturn(body);
      setNotice(`Created ${result.returnNumber} for ${money(result.totalAmount)}`);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create return.");
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
            <button className={tab === "sales" ? "primary" : ""} onClick={() => setTab("sales")}>
              Sales Returns
            </button>
            <button className={tab === "purchase" ? "primary" : ""} onClick={() => setTab("purchase")}>
              Purchase Returns
            </button>
          </div>
        </div>
        {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
        {notice && <div className="badge" style={{ display: "inline-block", marginTop: 12 }}>{notice}</div>}
      </div>

      <form className="card" onSubmit={submit}>
        <h2>New {tab === "sales" ? "sales" : "purchase"} return</h2>
        <p className="sub" style={{ color: "#adb5bd", fontSize: 13 }}>
          Enter the invoice id, the invoice line id (from the invoice detail API) and quantity.
        </p>
        <div className="row">
          <div>
            <label>Invoice id</label>
            <input
              type="number"
              min="1"
              value={invoiceId}
              onChange={(e) => setInvoiceId(Number(e.target.value))}
              style={{ width: 120 }}
            />
          </div>
          <div>
            <label>Invoice line id</label>
            <input
              type="number"
              min="1"
              value={invoiceItemId}
              onChange={(e) => setInvoiceItemId(Number(e.target.value))}
              style={{ width: 140 }}
            />
          </div>
          <div>
            <label>Quantity</label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              style={{ width: 120 }}
            />
          </div>
          <button className="primary" type="submit">
            Create return
          </button>
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
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.id)}>
                <td>{String(row.return_number ?? "")}</td>
                <td>{String(row[invoiceKey] ?? "")}</td>
                <td>{String(row.return_date ?? "")}</td>
                <td className="num">{money(Number(row.total_amount ?? 0))}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4}>No returns recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
