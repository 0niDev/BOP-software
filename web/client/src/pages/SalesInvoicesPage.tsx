import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import type { Item, Party, PaymentType, SalesInvoice } from "../types";

interface LineDraft {
  key: number;
  itemId: number;
  quantity: number;
  unitPrice: number;
  taxAmount: number;
}

let lineKey = 1;
function newLine(): LineDraft {
  return { key: lineKey++, itemId: 0, quantity: 1, unitPrice: 0, taxAmount: 0 };
}

function money(value: number): string {
  return value.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SalesInvoicesPage() {
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  const [customerId, setCustomerId] = useState(0);
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentType, setPaymentType] = useState<PaymentType>("CASH");
  const [lines, setLines] = useState<LineDraft[]>([newLine()]);

  async function refresh() {
    try {
      setInvoices(await api.salesInvoices());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load invoices.");
    }
  }

  useEffect(() => {
    void refresh();
    void api.parties({ type: "CUSTOMER" }).then(setCustomers).catch(() => undefined);
    void api.items().then(setItems).catch(() => undefined);
  }, []);

  const subtotal = useMemo(
    () => lines.reduce((a, l) => a + l.quantity * l.unitPrice, 0),
    [lines],
  );
  const tax = useMemo(() => lines.reduce((a, l) => a + l.taxAmount, 0), [lines]);
  const total = subtotal + tax;

  function updateLine(key: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!customerId) {
      setError("Select a customer.");
      return;
    }
    const payload = lines.filter((l) => l.itemId > 0 && l.quantity > 0);
    if (payload.length === 0) {
      setError("Add at least one line item.");
      return;
    }
    setBusy(true);
    try {
      const created = await api.createSalesInvoice({
        customerId,
        invoiceDate,
        paymentType,
        items: payload.map((l) => ({
          itemId: l.itemId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          taxAmount: l.taxAmount || undefined,
        })),
      });
      setNotice(`Created ${created.invoiceNumber} — total ${money(created.totalAmount)}`);
      setLines([newLine()]);
      setShowForm(false);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create invoice.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Sales Invoices</h2>
          <button className="primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Close" : "New invoice"}
          </button>
        </div>
        {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
        {notice && <div className="badge" style={{ display: "inline-block", marginTop: 12 }}>{notice}</div>}
      </div>

      {showForm && (
        <form className="card" onSubmit={submit}>
          <h2>New sales invoice</h2>
          <div className="row">
            <div>
              <label>Customer</label>
              <select value={customerId} onChange={(e) => setCustomerId(Number(e.target.value))}>
                <option value={0}>Select customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Date</label>
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </div>
            <div>
              <label>Payment</label>
              <select value={paymentType} onChange={(e) => setPaymentType(e.target.value as PaymentType)}>
                {(["CASH", "BANK", "CHEQUE", "CREDIT"] as const).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <table style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Item</th>
                <th className="num">Qty</th>
                <th className="num">Unit price</th>
                <th className="num">Tax</th>
                <th className="num">Line total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.key}>
                  <td>
                    <select
                      value={line.itemId}
                      onChange={(e) => updateLine(line.key, { itemId: Number(e.target.value) })}
                    >
                      <option value={0}>Select item...</option>
                      {items.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.item_name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="num">
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: Number(e.target.value) })}
                      style={{ width: 90 }}
                    />
                  </td>
                  <td className="num">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(line.key, { unitPrice: Number(e.target.value) })}
                      style={{ width: 110 }}
                    />
                  </td>
                  <td className="num">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.taxAmount}
                      onChange={(e) => updateLine(line.key, { taxAmount: Number(e.target.value) })}
                      style={{ width: 100 }}
                    />
                  </td>
                  <td className="num">{money(line.quantity * line.unitPrice + line.taxAmount)}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                      disabled={lines.length === 1}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="total">
                <td colSpan={4}>Subtotal / Tax / Total</td>
                <td className="num">{money(subtotal)}</td>
                <td className="num">{money(tax)}</td>
              </tr>
            </tfoot>
          </table>

          <div className="row" style={{ marginTop: 14, justifyContent: "space-between" }}>
            <button type="button" onClick={() => setLines((prev) => [...prev, newLine()])}>
              Add line
            </button>
            <div>
              <strong style={{ marginRight: 16 }}>Total: {money(total)}</strong>
              <button className="primary" type="submit" disabled={busy}>
                {busy ? "Saving..." : "Create invoice"}
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Number</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Payment</th>
              <th className="num">Total</th>
              <th className="num">Paid</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.invoice_number}</td>
                <td>{inv.invoice_date}</td>
                <td>{inv.customer_name}</td>
                <td>{inv.payment_type}</td>
                <td className="num">{money(inv.total_amount)}</td>
                <td className="num">{money(inv.paid_amount)}</td>
                <td>{inv.status}</td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={7}>No invoices yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
