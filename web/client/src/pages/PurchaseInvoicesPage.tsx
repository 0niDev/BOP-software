import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import BankSelect from "../components/BankSelect";
import SearchableSelect from "../components/SearchableSelect";
import type { Item, Party, PaymentType, PurchaseInvoice } from "../types";

interface LineDraft {
  key: number;
  itemId: number;
  quantity: number;
  unitCost: number;
  taxAmount: number;
  batchNumber: string;
}

let lineKey = 1;
function newLine(): LineDraft {
  return { key: lineKey++, itemId: 0, quantity: 1, unitCost: 0, taxAmount: 0, batchNumber: "" };
}

function money(value: number): string {
  return value.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PurchaseInvoicesPage() {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [supplierId, setSupplierId] = useState(0);
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentType, setPaymentType] = useState<PaymentType>("CASH");
  const [bankId, setBankId] = useState(0);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([newLine()]);

  async function refresh() {
    try {
      setInvoices(await api.purchaseInvoices());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load invoices.");
    }
  }

  useEffect(() => {
    void refresh();
    void api.parties({ type: "SUPPLIER" }).then(setSuppliers).catch(() => undefined);
    void api.items().then(setItems).catch(() => undefined);
  }, []);

  const subtotal = useMemo(() => lines.reduce((a, l) => a + l.quantity * l.unitCost, 0), [lines]);
  const tax = useMemo(() => lines.reduce((a, l) => a + l.taxAmount, 0), [lines]);
  const total = subtotal + tax;

  function updateLine(key: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function resetForm() {
    setEditingId(null);
    setLines([newLine()]);
    setNotes("");
    setBankId(0);
    setShowForm(false);
  }

  async function startEdit(invoice: PurchaseInvoice) {
    setError(null);
    setNotice(null);
    try {
      const detail = await api.purchaseInvoice(invoice.id);
      setSupplierId(detail.invoice.supplier_id);
      setInvoiceDate(detail.invoice.invoice_date);
      setPaymentType(detail.invoice.payment_type);
      setBankId(detail.invoice.bank_account_id ?? 0);
      setNotes(detail.invoice.notes ?? "");
      setLines(
        detail.items.length > 0
          ? detail.items.map((row) => ({
              key: lineKey++,
              itemId: Number(row.item_id),
              quantity: Number(row.quantity),
              unitCost: Number(row.unit_cost),
              taxAmount: Number(row.tax_amount),
              batchNumber: String(row.batch_number ?? ""),
            }))
          : [newLine()],
      );
      setEditingId(invoice.id);
      setShowForm(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load invoice.");
    }
  }

  async function remove(invoice: PurchaseInvoice) {
    if (!window.confirm(`Cancel invoice ${invoice.invoice_number}? Stock and accounting will be reversed.`)) {
      return;
    }
    setError(null);
    setNotice(null);
    try {
      await api.deletePurchaseInvoice(invoice.id);
      setNotice(`Cancelled ${invoice.invoice_number}`);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to cancel invoice.");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!supplierId) {
      setError("Select a supplier.");
      return;
    }
    const payload = lines.filter((l) => l.itemId > 0 && l.quantity > 0);
    if (payload.length === 0) {
      setError("Add at least one line item.");
      return;
    }
    setBusy(true);
    try {
      const body = {
        supplierId,
        invoiceDate,
        paymentType,
        bankAccountId: paymentType === "BANK" || paymentType === "CHEQUE" ? bankId || null : null,
        notes: notes.trim() || null,
        items: payload.map((l) => ({
          itemId: l.itemId,
          quantity: l.quantity,
          unitCost: l.unitCost,
          taxAmount: l.taxAmount || undefined,
          batchNumber: l.batchNumber || undefined,
        })),
      };
      const saved =
        editingId === null
          ? await api.createPurchaseInvoice(body)
          : await api.updatePurchaseInvoice(editingId, body);
      setNotice(
        `${editingId === null ? "Created" : "Updated"} ${saved.invoiceNumber} — total ${money(saved.totalAmount)}`,
      );
      resetForm();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save invoice.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Purchase Invoices</h2>
          <button className="primary" onClick={() => (showForm ? resetForm() : setShowForm(true))}>
            {showForm ? "Close" : "New purchase"}
          </button>
        </div>
        {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
        {notice && <div className="badge" style={{ display: "inline-block", marginTop: 12 }}>{notice}</div>}
      </div>

      {showForm && (
        <form className="card" onSubmit={submit}>
          <h2>{editingId === null ? "New purchase invoice" : "Edit purchase invoice"}</h2>
          <div className="row">
            <div>
              <label>Supplier</label>
              <SearchableSelect
                value={String(supplierId)}
                onChange={(next) => setSupplierId(Number(next))}
                placeholder="Select supplier..."
                options={[
                  { value: "0", label: "Select supplier..." },
                  ...suppliers.map((s) => ({
                    value: String(s.id),
                    label: `${s.name} (${s.code})`,
                  })),
                ]}
              />
            </div>
            <div>
              <label>Date</label>
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </div>
            <div>
              <label>Payment</label>
              <SearchableSelect
                value={paymentType}
                onChange={(next) => setPaymentType(next as PaymentType)}
                placeholder="Payment"
                options={(["CASH", "BANK", "CHEQUE", "CREDIT"] as const).map((p) => ({
                  value: p,
                  label: p,
                }))}
              />
            </div>
            {(paymentType === "BANK" || paymentType === "CHEQUE") && (
              <BankSelect value={bankId} onChange={setBankId} />
            )}
          </div>

          <div style={{ marginTop: 12 }}>
            <label>Note (shown in party ledger)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Supplier bill 456, received at store"
              style={{ width: "100%" }}
            />
          </div>

          <table style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Item</th>
                <th>Batch no.</th>
                <th className="num">Qty</th>
                <th className="num">Unit cost</th>
                <th className="num">Tax</th>
                <th className="num">Line total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.key}>
                  <td>
                    <SearchableSelect
                      value={String(line.itemId)}
                      onChange={(next) => updateLine(line.key, { itemId: Number(next) })}
                      placeholder="Select item..."
                      options={[
                        { value: "0", label: "Select item..." },
                        ...items.map((it) => ({ value: String(it.id), label: it.item_name })),
                      ]}
                    />
                  </td>
                  <td>
                    <input
                      value={line.batchNumber}
                      placeholder="auto"
                      onChange={(e) => updateLine(line.key, { batchNumber: e.target.value })}
                      style={{ width: 120 }}
                    />
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
                      value={line.unitCost}
                      onChange={(e) => updateLine(line.key, { unitCost: Number(e.target.value) })}
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
                  <td className="num">{money(line.quantity * line.unitCost + line.taxAmount)}</td>
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
              {editingId !== null && (
                <button type="button" style={{ marginRight: 8 }} onClick={resetForm}>
                  Cancel
                </button>
              )}
              <button className="primary" type="submit" disabled={busy}>
                {busy ? "Saving..." : editingId === null ? "Create invoice" : "Save changes"}
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
              <th>Supplier</th>
              <th>Payment</th>
              <th className="num">Total</th>
              <th className="num">Paid</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.invoice_number}</td>
                <td>{inv.invoice_date}</td>
                <td>{inv.supplier_name}</td>
                <td>{inv.payment_type}</td>
                <td className="num">{money(inv.total_amount)}</td>
                <td className="num">{money(inv.paid_amount)}</td>
                <td>{inv.status}</td>
                <td>
                  {inv.status !== "CANCELLED" && (
                    <>
                      <button type="button" onClick={() => void startEdit(inv)}>
                        Edit
                      </button>{" "}
                      <button type="button" onClick={() => void remove(inv)}>
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={8}>No purchase invoices yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
