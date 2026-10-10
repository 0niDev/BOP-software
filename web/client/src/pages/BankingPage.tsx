import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import type { BankAccount, BankTransaction, Cheque } from "../types";

function money(value: number): string {
  return value.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Tab = "accounts" | "transactions" | "cheques";

export default function BankingPage() {
  const [tab, setTab] = useState<Tab>("accounts");
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // new bank account
  const [bankName, setBankName] = useState("");
  const [accountTitle, setAccountTitle] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [openingBalance, setOpeningBalance] = useState(0);

  // movement
  const [bankAccountId, setBankAccountId] = useState(0);
  const [amount, setAmount] = useState(0);

  async function refresh() {
    try {
      setAccounts(await api.bankAccounts());
      setTransactions(await api.bankTransactions());
      setCheques(await api.cheques());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load banking data.");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function createAccount() {
    setError(null);
    setNotice(null);
    try {
      await api.createBankAccount({ bankName, accountTitle, accountNumber, openingBalance });
      setBankName("");
      setAccountTitle("");
      setAccountNumber("");
      setOpeningBalance(0);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create account.");
    }
  }

  async function move(kind: "deposit" | "withdraw") {
    setError(null);
    setNotice(null);
    if (!bankAccountId || amount <= 0) {
      setError("Select an account and enter an amount.");
      return;
    }
    try {
      const date = new Date().toISOString().slice(0, 10);
      await (kind === "deposit" ? api.deposit : api.withdraw)({ bankAccountId, amount, date });
      setNotice(`Recorded ${kind} of ${money(amount)}`);
      setAmount(0);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Failed to ${kind}.`);
    }
  }

  async function clear(chequeId: number) {
    try {
      await api.clearCheque(chequeId);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to clear cheque.");
    }
  }

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Banking</h2>
          <div className="row">
            {(["accounts", "transactions", "cheques"] as const).map((t) => (
              <button key={t} className={tab === t ? "primary" : ""} onClick={() => setTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
        {notice && <div className="badge" style={{ display: "inline-block", marginTop: 12 }}>{notice}</div>}
      </div>

      {tab === "accounts" && (
        <>
          <div className="card">
            <h2>New bank account</h2>
            <div className="row">
              <div>
                <label>Bank name</label>
                <input value={bankName} onChange={(e) => setBankName(e.target.value)} />
              </div>
              <div>
                <label>Account title</label>
                <input value={accountTitle} onChange={(e) => setAccountTitle(e.target.value)} />
              </div>
              <div>
                <label>Account number</label>
                <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
              </div>
              <div>
                <label>Opening balance</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(Number(e.target.value))}
                  style={{ width: 130 }}
                />
              </div>
              <button className="primary" onClick={() => void createAccount()}>
                Create account
              </button>
            </div>
          </div>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Bank</th>
                  <th>Title</th>
                  <th>Number</th>
                  <th className="num">Opening</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td>{a.bank_name}</td>
                    <td>{a.account_title}</td>
                    <td>{a.account_number}</td>
                    <td className="num">{money(a.opening_balance)}</td>
                  </tr>
                ))}
                {accounts.length === 0 && (
                  <tr>
                    <td colSpan={4}>No bank accounts yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "transactions" && (
        <>
          <div className="card">
            <h2>Record movement</h2>
            <div className="row">
              <div>
                <label>Bank account</label>
                <select value={bankAccountId} onChange={(e) => setBankAccountId(Number(e.target.value))}>
                  <option value={0}>Select...</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.bank_name} - {a.account_number}
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
              <button className="primary" onClick={() => void move("deposit")}>
                Deposit
              </button>
              <button onClick={() => void move("withdraw")}>Withdraw</button>
            </div>
          </div>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th className="num">Amount</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td>{t.transaction_date}</td>
                    <td>{t.transaction_type}</td>
                    <td className="num">{money(t.amount)}</td>
                    <td>{t.reference_no ?? "—"}</td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={4}>No transactions yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "cheques" && (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Cheque</th>
                <th>Type</th>
                <th>Date</th>
                <th className="num">Amount</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cheques.map((c) => (
                <tr key={c.id}>
                  <td>{c.cheque_number}</td>
                  <td>{c.cheque_type}</td>
                  <td>{c.cheque_date}</td>
                  <td className="num">{money(c.amount)}</td>
                  <td>{c.status}</td>
                  <td>
                    {c.status === "UNCLEARED" && (
                      <button onClick={() => void clear(c.id)}>Clear</button>
                    )}
                  </td>
                </tr>
              ))}
              {cheques.length === 0 && (
                <tr>
                  <td colSpan={6}>No cheques recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
