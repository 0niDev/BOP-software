import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import BankSelect from "../components/BankSelect";
import NumberInput from "../components/NumberInput";
import SearchableSelect from "../components/SearchableSelect";
import { moveRowFocus } from "../lib/gridKeys";
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
  const [editingId, setEditingId] = useState<number | null>(null);
  /** Receipts attached to an invoice whose cancel was blocked. */
  const [payDialog, setPayDialog] = useState<{
    invoice: SalesInvoice;
    rows: Array<Record<string, unknown>>;
  } | null>(null);
  const [payBusy, setPayBusy] = useState(false);

  const [customerId, setCustomerId] = useState(0);
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentType, setPaymentType] = useState<PaymentType>("CASH");
  const [bankId, setBankId] = useState(0);
  const [notes, setNotes] = useState("");
  const [ignoreStock, setIgnoreStock] = useState(false);
  const [lines, setLines] = useState<LineDraft[]>([newLine()]);
  // Focus the first field of a line only when it was just added.
  const addedLine = useRef(false);

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

  function resetForm() {
    setEditingId(null);
    setLines([newLine()]);
    setNotes("");
    setBankId(0);
    setIgnoreStock(false);
    setShowForm(false);
  }

  async function startEdit(invoice: SalesInvoice) {
    setError(null);
    setNotice(null);
    try {
      const detail = await api.salesInvoice(invoice.id);
      const grouped = new Map<number, LineDraft>();
      for (const row of detail.items) {
        const itemId = Number(row.item_id);
        const existing = grouped.get(itemId);
        if (existing) {
          existing.quantity += Number(row.quantity);
        } else {
          grouped.set(itemId, {
            key: lineKey++,
            itemId,
            quantity: Number(row.quantity),
            unitPrice: Number(row.unit_price),
            taxAmount: Number(row.tax_amount),
          });
        }
      }
      setCustomerId(detail.invoice.customer_id);
      setInvoiceDate(detail.invoice.invoice_date);
      setPaymentType(detail.invoice.payment_type);
      setBankId(detail.invoice.bank_account_id ?? 0);
      setNotes(detail.invoice.notes ?? "");
      setLines(grouped.size > 0 ? [...grouped.values()] : [newLine()]);
      setIgnoreStock(false);
      setEditingId(invoice.id);
      setShowForm(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load invoice.");
    }
  }

  async function remove(invoice: SalesInvoice) {
    if (!window.confirm(`Cancel invoice ${invoice.invoice_number}? Stock and accounting will be reversed.`)) {
      return;
    }
    setError(null);
    setNotice(null);
    try {
      await api.deleteSalesInvoice(invoice.id);
      setNotice(`Cancelled ${invoice.invoice_number}`);
      await refresh();
    } catch (err) {
      // A paid credit invoice refuses to disappear; show what is attached to it.
      // Anything else (returns still on the invoice) has no payments to list, so
      // show the server's own reason instead of an empty payments dialog.
      if (err instanceof ApiError && err.status === 409) {
        await openPayments(invoice, err.message);
        return;
      }
      setError(err instanceof ApiError ? err.message : "Failed to cancel invoice.");
    }
  }

  /** Receipts sitting on this invoice, shown when the cancel is blocked. */
  async function openPayments(invoice: SalesInvoice, blockedReason?: string): Promise<void> {
    setPayBusy(true);
    try {
      const rows = await api.invoicePayments("sales", invoice.id);
      if (rows.length === 0) {
        setError(blockedReason ?? "This invoice cannot be cancelled yet.");
        return;
      }
      setPayDialog({ invoice, rows });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load the invoice's payments.");
    } finally {
      setPayBusy(false);
    }
  }

  async function deletePaymentRow(row: Record<string, unknown>): Promise<void> {
    const voucher = String(row.voucher_number ?? "");
    if (!window.confirm(`Delete receipt ${voucher}? Its journal entry is reversed.`)) return;
    setPayBusy(true);
    setError(null);
    try {
      await api.deleteReceipt(Number(row.id));
      if (payDialog) {
        const rows = await api.invoicePayments("sales", payDialog.invoice.id);
        // The dialog's invoice snapshot is stale once its last payment is gone.
        const closed = rows.length === 0;
        setPayDialog(closed ? null : { invoice: payDialog.invoice, rows });
        setNotice(`${voucher} deleted.${closed ? " You can cancel the invoice now." : ""}`);
      } else {
        setNotice(`${voucher} deleted.`);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete the receipt.");
    } finally {
      setPayBusy(false);
    }
  }

  async function deleteAllAndCancel(): Promise<void> {
    if (!payDialog) return;
    const { invoice, rows } = payDialog;
    if (
      !window.confirm(
        `Delete ${rows.length} receipt${rows.length === 1 ? "" : "s"} and cancel invoice ${invoice.invoice_number}?`,
      )
    ) {
      return;
    }
    setPayBusy(true);
    setError(null);
    try {
      for (const row of rows) await api.deleteReceipt(Number(row.id));
      await api.deleteSalesInvoice(invoice.id);
      setPayDialog(null);
      setNotice(`Cancelled ${invoice.invoice_number}.`);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to cancel the invoice.");
    } finally {
      setPayBusy(false);
    }
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
      const body = {
        customerId,
        invoiceDate,
        paymentType,
        bankAccountId: paymentType === "BANK" || paymentType === "CHEQUE" ? bankId || null : null,
        notes: notes.trim() || null,
        ignoreStock: ignoreStock || undefined,
        items: payload.map((l) => ({
          itemId: l.itemId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          taxAmount: l.taxAmount || undefined,
        })),
      };
      const saved =
        editingId === null
          ? await api.createSalesInvoice(body)
          : await api.updateSalesInvoice(editingId, body);
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
          <h2 style={{ margin: 0 }}>Sales Invoices</h2>
          <button className="primary" onClick={() => (showForm ? resetForm() : setShowForm(true))}>
            {showForm ? "Close" : "New invoice"}
          </button>
        </div>
        {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
        {notice && <div className="badge" style={{ display: "inline-block", marginTop: 12 }}>{notice}</div>}
      </div>

      {showForm && (
        <form className="card" onSubmit={submit}>
          <h2>{editingId === null ? "New sales invoice" : "Edit sales invoice"}</h2>
          <div className="row">
            <div>
              <label>Customer</label>
              <SearchableSelect
                value={String(customerId)}
                onChange={(next) => setCustomerId(Number(next))}
                placeholder="Select customer..."
                options={[
                  { value: "0", label: "Select customer..." },
                  ...customers.map((c) => ({
                    value: String(c.id),
                    label: `${c.name} (${c.code})`,
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
              placeholder="e.g. Order 123, delivered to warehouse"
              style={{ width: "100%" }}
            />
          </div>

          <label style={{ display: "block", marginTop: 12 }}>
            <input
              type="checkbox"
              checked={ignoreStock}
              onChange={(e) => setIgnoreStock(e.target.checked)}
            />{" "}
            Ignore stock (save invoice without stock check or deduction)
          </label>

          <table style={{ marginTop: 16 }} onKeyDown={moveRowFocus}>
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
                    <SearchableSelect
                      value={String(line.itemId)}
                      autoFocus={addedLine.current && line.key === lines.at(-1)?.key}
                      onChange={(next) => updateLine(line.key, { itemId: Number(next) })}
                      placeholder="Select item..."
                      options={[
                        { value: "0", label: "Select item..." },
                        ...items.map((it) => ({ value: String(it.id), label: it.item_name })),
                      ]}
                    />
                  </td>
                  <td className="num">
                    <NumberInput
                      min="0"
                      step="0.001"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: Number(e.target.value) })}
                      style={{ width: 90 }}
                    />
                  </td>
                  <td className="num">
                    <NumberInput
                      min="0"
                      step="0.01"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(line.key, { unitPrice: Number(e.target.value) })}
                      style={{ width: 110 }}
                    />
                  </td>
                  <td className="num">
                    <NumberInput
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
            <button type="button" onClick={() => {
                addedLine.current = true;
                setLines((prev) => [...prev, newLine()]);
              }}
            >
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
              <th>Customer</th>
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
                <td>{inv.customer_name}</td>
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
                <td colSpan={8}>No invoices yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {payDialog && (
        <div className="modal-overlay" role="presentation">
          <div className="modal" role="dialog" aria-modal="true">
            <h2>Invoice {payDialog.invoice.invoice_number} has payments</h2>
            <p className="sub" style={{ marginTop: 0 }}>
              {money(payDialog.invoice.paid_amount)} is recorded against it. Delete the receipts
              first, or delete them all and cancel the invoice.
            </p>
            {payDialog.rows.length === 0 && (
              <p className="sub">No receipts found for this customer.</p>
            )}
            <table>
              <thead>
                <tr>
                  <th>Voucher</th>
                  <th>Date</th>
                  <th className="num">Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {payDialog.rows.map((row) => (
                  <tr key={String(row.id)}>
                    <td>{String(row.voucher_number ?? "")}</td>
                    <td>{String(row.receipt_date ?? "")}</td>
                    <td className="num">{money(Number(row.amount ?? 0))}</td>
                    <td>
                      <button
                        type="button"
                        disabled={payBusy}
                        onClick={() => void deletePaymentRow(row)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="row" style={{ marginTop: 12 }}>
              <button type="button" onClick={() => setPayDialog(null)}>
                Close
              </button>
              {payDialog.rows.length > 0 && (
                <button
                  className="primary"
                  type="button"
                  disabled={payBusy}
                  onClick={() => void deleteAllAndCancel()}
                >
                  {payBusy ? "Working…" : "Delete all & cancel invoice"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
