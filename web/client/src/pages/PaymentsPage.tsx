import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import BankSelect from "../components/BankSelect";
import FilterBox, { matchesQuery } from "../components/FilterBox";
import NumberInput from "../components/NumberInput";
import SearchableSelect from "../components/SearchableSelect";
import { formatDate } from "../lib/format";
import { usePageVisible } from "../lib/pageVisibility";
import type {
  BankAccount,
  Party,
  Payment,
  PurchaseInvoice,
  Receipt,
  SalesInvoice,
  SettlementMethod,
} from "../types";

function money(value: number): string {
  return value.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Tab = "payments" | "receipts";

export default function PaymentsPage() {
  const [tab, setTab] = useState<Tab>("payments");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  /** Open invoices, so a voucher can be applied to one and move its paid_amount. */
  const [salesInvoices, setSalesInvoices] = useState<SalesInvoice[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [partyId, setPartyId] = useState(0);
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<SettlementMethod>("CASH");
  const [bankId, setBankId] = useState(0);
  /** Invoice this voucher settles; 0 = leave it as a party-level advance. */
  const [invoiceId, setInvoiceId] = useState(0);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [outstanding, setOutstanding] = useState<number | null>(null);
  /** Voucher being edited in the form above; null = recording a new one. */
  const [editingId, setEditingId] = useState<number | null>(null);

  function startEdit(row: Payment | Receipt): void {
    setError(null);
    setNotice(null);
    setEditingId(row.id);
    setPartyId(row.party_id);
    setAmount(row.amount);
    setDate("payment_date" in row ? row.payment_date : row.receipt_date);
    setMethod(row.payment_method);
    setBankId(row.bank_account_id ?? 0);
  }

  async function removeRow(row: Payment | Receipt): Promise<void> {
    if (!window.confirm(`Delete ${row.voucher_number}? Its journal entry is reversed.`)) return;
    setError(null);
    setNotice(null);
    try {
      if (tab === "payments") await api.deletePayment(row.id);
      else await api.deleteReceipt(row.id);
      setNotice(`${row.voucher_number} deleted.`);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete.");
    }
  }

  useEffect(() => {
    if (!partyId) {
      setOutstanding(null);
      return;
    }
    let active = true;
    void api
      .partyLedger(partyId)
      .then((entries) => {
        if (!active) return;
        // Running balance is debit - credit: a positive figure is money the
        // party owes us (receivable); for a supplier the payable is its inverse.
        const balance = entries.length ? (entries[entries.length - 1]?.balance ?? 0) : 0;
        setOutstanding(tab === "payments" ? -balance : balance);
      })
      .catch(() => {
        if (active) setOutstanding(null);
      });
    return () => {
      active = false;
    };
  }, [partyId, tab]);

  async function refresh() {
    try {
      setPayments(await api.payments());
      setReceipts(await api.receipts());
      setSalesInvoices(await api.salesInvoices());
      setPurchaseInvoices(await api.purchaseInvoices());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load payments.");
    }
  }

  const pageVisible = usePageVisible();

  useEffect(() => {
    void refresh();
    void api.parties({ type: "SUPPLIER" }).then(setSuppliers).catch(() => undefined);
    void api.parties({ type: "CUSTOMER" }).then(setCustomers).catch(() => undefined);
    void api.bankAccounts().then(setBanks).catch(() => undefined);
  }, [pageVisible]);

  const bankName = (id: number | null): string =>
    banks.find((bank) => bank.id === id)?.bank_name ?? "—";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!partyId) {
      setError(tab === "payments" ? "Select a supplier." : "Select a customer.");
      return;
    }
    if (amount <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }
    setBusy(true);
    try {
      const bankAccountId = method === "CASH" ? null : bankId || null;
      if (editingId != null) {
        if (tab === "payments") {
          await api.updatePayment(editingId, {
            supplierId: partyId,
            amount,
            paymentDate: date,
            paymentMethod: method,
            bankAccountId,
          });
        } else {
          await api.updateReceipt(editingId, {
            customerId: partyId,
            amount,
            paymentDate: date,
            paymentMethod: method,
            bankAccountId,
          });
        }
        setNotice("Updated.");
        setEditingId(null);
        await refresh();
        return;
      }
      const result =
        tab === "payments"
          ? await api.paySupplier({
              supplierId: partyId,
              amount,
              paymentDate: date,
              paymentMethod: method,
              bankAccountId,
              purchaseInvoiceId: invoiceId || null,
            })
          : await api.receivePayment({
              customerId: partyId,
              amount,
              paymentDate: date,
              paymentMethod: method,
              bankAccountId,
              salesInvoiceId: invoiceId || null,
            });
      setNotice(`Recorded ${result.voucherNumber} for ${money(amount)}`);
      setAmount(0);
      setPartyId(0);
      setInvoiceId(0);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record.");
    } finally {
      setBusy(false);
    }
  }

  const partyOptions = tab === "payments" ? suppliers : customers;
  const rows = tab === "payments" ? payments : receipts;
  /** Unsettled invoices of the selected party; a voucher can be applied to one. */
  const openInvoices = (tab === "payments" ? purchaseInvoices : salesInvoices)
    .filter((inv) => {
      const party =
        tab === "payments" ? (inv as PurchaseInvoice).supplier_id : (inv as SalesInvoice).customer_id;
      return (
        party === partyId &&
        inv.status === "CONFIRMED" &&
        inv.paid_amount < inv.total_amount &&
        // A cash invoice was settled at creation; the server refuses the receipt.
        inv.payment_type !== "CASH"
      );
    })
    .map((inv) => ({
      id: inv.id,
      remaining: inv.total_amount - inv.paid_amount,
      label: `${inv.invoice_number} - ${money(inv.total_amount - inv.paid_amount)} of ${money(
        inv.total_amount,
      )} left`,
    }));
  const overBalance = outstanding !== null && amount > 0 && amount > outstanding;
  const outstandingAmount = outstanding ?? 0;
  const visibleRows = rows.filter((row) =>
    matchesQuery(query, [
      row.voucher_number,
      row.party_name,
      row.party_code,
      "payment_date" in row ? row.payment_date : row.receipt_date,
      row.payment_method,
      bankName(row.bank_account_id),
      row.amount,
    ]),
  );

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Invoice Payments</h2>
          <div className="row">
            <button
              className={tab === "payments" ? "primary" : ""}
              onClick={() => {
                setTab("payments");
                setPartyId(0);
                setInvoiceId(0);
                setEditingId(null);
              }}
            >
              Payments
            </button>
            <button
              className={tab === "receipts" ? "primary" : ""}
              onClick={() => {
                setTab("receipts");
                setPartyId(0);
                setInvoiceId(0);
                setEditingId(null);
              }}
            >
              Receipts
            </button>
          </div>
        </div>
        {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
        {notice && <div className="badge" style={{ display: "inline-block", marginTop: 12 }}>{notice}</div>}
        {overBalance && (
          <div className="warning" style={{ marginTop: 12 }}>
            This {tab === "payments" ? "payment" : "receipt"} is{" "}
            {money(amount - Math.max(outstandingAmount, 0))} more than the{" "}
            {tab === "payments" ? "payable" : "receivable"} of{" "}
            {money(Math.max(outstandingAmount, 0))} for this{" "}
            {tab === "payments" ? "supplier" : "customer"}. It will be saved as an advance.
          </div>
        )}
      </div>

      <form className="card" onSubmit={submit}>
        <h2>
          {editingId != null
            ? "Edit voucher"
            : tab === "payments"
              ? "Record payment to supplier"
              : "Record receipt from customer"}
        </h2>
        <div className="row">
          <div>
            <label>{tab === "payments" ? "Supplier" : "Customer"}</label>
            <SearchableSelect
              value={String(partyId)}
              onChange={(next) => {
                setPartyId(Number(next));
                setInvoiceId(0);
              }}
              placeholder="Select..."
              options={[
                { value: "0", label: "Select..." },
                ...partyOptions.map((p) => ({
                  value: String(p.id),
                  label: `${p.name} (${p.code})`,
                })),
              ]}
            />
          </div>
          {editingId == null && (
            <div>
              <label>Invoice (optional)</label>
              <SearchableSelect
                value={String(invoiceId)}
                onChange={(next) => {
                  const id = Number(next);
                  setInvoiceId(id);
                  const invoice = openInvoices.find((inv) => inv.id === id);
                  if (invoice) setAmount(invoice.remaining);
                }}
                placeholder="Not linked"
                options={[
                  { value: "0", label: "Not linked (advance)" },
                  ...openInvoices.map((inv) => ({ value: String(inv.id), label: inv.label })),
                ]}
              />
            </div>
          )}
          <div>
            <label>Amount</label>
            <NumberInput
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              style={{ width: 130 }}
            />
          </div>
          <div>
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label>Method</label>
            <SearchableSelect
              value={method}
              onChange={(next) => setMethod(next as SettlementMethod)}
              placeholder="Method"
              options={(["CASH", "BANK", "CHEQUE"] as const).map((m) => ({ value: m, label: m }))}
            />
          </div>
          {method !== "CASH" && <BankSelect value={bankId} onChange={setBankId} />}
          <button className="primary" type="submit" disabled={busy}>
            {busy ? "Saving..." : editingId != null ? "Save changes" : tab === "payments" ? "Record payment" : "Record receipt"}
          </button>
          {editingId != null && (
            <button type="button" onClick={() => setEditingId(null)}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="card">
        <div className="row" style={{ alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ flex: 1, margin: 0 }}>
            {tab === "payments" ? "Payments" : "Receipts"}{" "}
            <span className="badge">{visibleRows.length} of {rows.length}</span>
          </h2>
          <FilterBox value={query} onChange={setQuery} />
        </div>
        <table>
          <thead>
            <tr>
              <th>Voucher</th>
              <th>{tab === "payments" ? "Supplier" : "Customer"}</th>
              <th>Date</th>
              <th>Method</th>
              <th>Bank</th>
              <th className="num">Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const rowDate = "payment_date" in row ? row.payment_date : row.receipt_date;
              return (
                <tr key={row.id}>
                  <td>{row.voucher_number}</td>
                  <td>{row.party_name}</td>
                  <td>{formatDate(rowDate)}</td>
                  <td>{row.payment_method}</td>
                  <td>{bankName(row.bank_account_id)}</td>
                  <td className="num">{money(row.amount)}</td>
                  <td>
                    <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                      <button type="button" onClick={() => startEdit(row)}>
                        Edit
                      </button>
                      <button type="button" onClick={() => void removeRow(row)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={7}>
                  {rows.length === 0
                    ? "Nothing recorded yet."
                    : "No vouchers match this filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
