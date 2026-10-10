import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import FilterBox, { matchesQuery } from "../components/FilterBox";
import type { Party, Payment, Receipt, SettlementMethod } from "../types";

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
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [partyId, setPartyId] = useState(0);
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<SettlementMethod>("CASH");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");

  async function refresh() {
    try {
      setPayments(await api.payments());
      setReceipts(await api.receipts());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load payments.");
    }
  }

  useEffect(() => {
    void refresh();
    void api.parties({ type: "SUPPLIER" }).then(setSuppliers).catch(() => undefined);
    void api.parties({ type: "CUSTOMER" }).then(setCustomers).catch(() => undefined);
  }, []);

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
      const result =
        tab === "payments"
          ? await api.paySupplier({ supplierId: partyId, amount, paymentDate: date, paymentMethod: method })
          : await api.receivePayment({ customerId: partyId, amount, paymentDate: date, paymentMethod: method });
      setNotice(`Recorded ${result.voucherNumber} for ${money(amount)}`);
      setAmount(0);
      setPartyId(0);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record.");
    } finally {
      setBusy(false);
    }
  }

  const partyOptions = tab === "payments" ? suppliers : customers;
  const rows = tab === "payments" ? payments : receipts;
  const visibleRows = rows.filter((row) =>
    matchesQuery(query, [
      row.voucher_number,
      row.party_name,
      row.party_code,
      "payment_date" in row ? row.payment_date : row.receipt_date,
      row.payment_method,
      row.amount,
    ]),
  );

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Payments &amp; Receipts</h2>
          <div className="row">
            <button className={tab === "payments" ? "primary" : ""} onClick={() => setTab("payments")}>
              Payments
            </button>
            <button className={tab === "receipts" ? "primary" : ""} onClick={() => setTab("receipts")}>
              Receipts
            </button>
          </div>
        </div>
        {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
        {notice && <div className="badge" style={{ display: "inline-block", marginTop: 12 }}>{notice}</div>}
      </div>

      <form className="card" onSubmit={submit}>
        <h2>
          {tab === "payments" ? "Record payment to supplier" : "Record receipt from customer"}
        </h2>
        <div className="row">
          <div>
            <label>{tab === "payments" ? "Supplier" : "Customer"}</label>
            <select value={partyId} onChange={(e) => setPartyId(Number(e.target.value))}>
              <option value={0}>Select...</option>
              {partyOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Amount</label>
            <input
              type="number"
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
            <select value={method} onChange={(e) => setMethod(e.target.value as SettlementMethod)}>
              {(["CASH", "BANK", "CHEQUE"] as const).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <button className="primary" type="submit" disabled={busy}>
            {busy ? "Saving..." : tab === "payments" ? "Record payment" : "Record receipt"}
          </button>
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
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const rowDate = "payment_date" in row ? row.payment_date : row.receipt_date;
              return (
                <tr key={row.id}>
                  <td>{row.voucher_number}</td>
                  <td>{row.party_name}</td>
                  <td>{rowDate}</td>
                  <td>{row.payment_method}</td>
                  <td className="num">{money(row.amount)}</td>
                </tr>
              );
            })}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={5}>
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
