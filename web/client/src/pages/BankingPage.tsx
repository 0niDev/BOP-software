import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import NumberInput from "../components/NumberInput";
import SearchableSelect from "../components/SearchableSelect";
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
  const [txnDate, setTxnDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [editingTxnId, setEditingTxnId] = useState<number | null>(null);

  // cheque edit
  const [editingCheque, setEditingCheque] = useState<Cheque | null>(null);
  const [chequeBankId, setChequeBankId] = useState(0);
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeAmount, setChequeAmount] = useState(0);
  const [chequeDate, setChequeDate] = useState("");
  const [chequeNotes, setChequeNotes] = useState("");

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
      if (editingTxnId != null) {
        await api.updateBankTransaction(editingTxnId, {
          type: kind === "deposit" ? "DEPOSIT" : "WITHDRAWAL",
          bankAccountId,
          amount,
          date: txnDate,
        });
        setNotice("Transaction updated.");
        setEditingTxnId(null);
      } else {
        await (kind === "deposit" ? api.deposit : api.withdraw)({
          bankAccountId,
          amount,
          date: txnDate,
        });
        setNotice(`Recorded ${kind} of ${money(amount)}`);
      }
      setAmount(0);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Failed to ${kind}.`);
    }
  }

  function startTxnEdit(t: BankTransaction): void {
    setError(null);
    setNotice(null);
    setEditingTxnId(t.id);
    setBankAccountId(t.bank_account_id);
    setAmount(t.amount);
    setTxnDate(t.transaction_date);
  }

  async function removeTxn(t: BankTransaction): Promise<void> {
    if (!window.confirm(`Delete this ${t.transaction_type.toLowerCase()} of ${money(t.amount)}?`)) return;
    setError(null);
    try {
      await api.deleteBankTransaction(t.id);
      setNotice("Transaction deleted.");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete the transaction.");
    }
  }

  function startChequeEdit(c: Cheque): void {
    setError(null);
    setNotice(null);
    setEditingCheque(c);
    setChequeBankId(c.bank_account_id);
    setChequeNumber(c.cheque_number);
    setChequeAmount(c.amount);
    setChequeDate(c.cheque_date);
    setChequeNotes(c.notes ?? "");
  }

  async function saveCheque(): Promise<void> {
    if (!editingCheque) return;
    setError(null);
    try {
      await api.updateCheque(editingCheque.id, {
        bankAccountId: chequeBankId,
        chequeNumber,
        amount: chequeAmount,
        chequeDate,
        partyId: editingCheque.party_id,
        notes: chequeNotes.trim() || null,
      });
      setNotice(`Cheque ${chequeNumber} updated.`);
      setEditingCheque(null);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update the cheque.");
    }
  }

  async function removeCheque(c: Cheque): Promise<void> {
    if (!window.confirm(`Delete cheque ${c.cheque_number}?`)) return;
    setError(null);
    try {
      await api.deleteCheque(c.id);
      setNotice(`Cheque ${c.cheque_number} deleted.`);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete the cheque.");
    }
  }

  async function cancelCheque(c: Cheque): Promise<void> {
    if (
      !window.confirm(
        c.status === "CLEARED"
          ? `Cancel cheque ${c.cheque_number}? The bank movement is reversed.`
          : `Remove cheque ${c.cheque_number}?`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      await api.cancelCheque(c.id);
      setNotice(`Cheque ${c.cheque_number} cancelled.`);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to cancel the cheque.");
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
                <NumberInput
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
                <SearchableSelect
                  value={String(bankAccountId)}
                  onChange={(next) => setBankAccountId(Number(next))}
                  placeholder="Select..."
                  options={[
                    { value: "0", label: "Select..." },
                    ...accounts.map((a) => ({
                      value: String(a.id),
                      label: `${a.bank_name} - ${a.account_number}`,
                    })),
                  ]}
                />
              </div>
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
                <input type="date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} />
              </div>
              <button className="primary" onClick={() => void move("deposit")}>
                Deposit
              </button>
              <button onClick={() => void move("withdraw")}>Withdraw</button>
              {editingTxnId != null && (
                <button type="button" onClick={() => setEditingTxnId(null)}>
                  Cancel edit
                </button>
              )}
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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td>{t.transaction_date}</td>
                    <td>{t.transaction_type}</td>
                    <td className="num">{money(t.amount)}</td>
                    <td>{t.reference_no ?? "—"}</td>
                    <td>
                      {t.journal_entry_id == null ? (
                        <span className="sub">Invoice</span>
                      ) : (
                        <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                          <button type="button" onClick={() => startTxnEdit(t)}>
                            Edit
                          </button>
                          <button type="button" onClick={() => void removeTxn(t)}>
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={5}>No transactions yet.</td>
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
                    <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                      {c.status === "UNCLEARED" && (
                        <>
                          <button onClick={() => void clear(c.id)}>Clear</button>
                          <button type="button" onClick={() => startChequeEdit(c)}>
                            Edit
                          </button>
                          <button type="button" onClick={() => void removeCheque(c)}>
                            Delete
                          </button>
                        </>
                      )}
                      {c.status !== "UNCLEARED" && (
                        <button type="button" onClick={() => void cancelCheque(c)}>
                          Cancel
                        </button>
                      )}
                    </div>
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

      {editingCheque && (
        <div className="modal-overlay" role="presentation">
          <div className="modal" role="dialog" aria-modal="true">
            <h2>Edit cheque {editingCheque.cheque_number}</h2>
            <div className="row">
              <div>
                <label>Bank account</label>
                <SearchableSelect
                  value={String(chequeBankId)}
                  onChange={(next) => setChequeBankId(Number(next))}
                  options={accounts.map((a) => ({
                    value: String(a.id),
                    label: `${a.bank_name} - ${a.account_number}`,
                  }))}
                />
              </div>
              <div>
                <label>Cheque number</label>
                <input value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} />
              </div>
              <div>
                <label>Amount</label>
                <NumberInput
                  min="0"
                  step="0.01"
                  value={chequeAmount}
                  onChange={(e) => setChequeAmount(Number(e.target.value))}
                />
              </div>
              <div>
                <label>Date</label>
                <input type="date" value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} />
              </div>
            </div>
            <div>
              <label>Notes</label>
              <input value={chequeNotes} onChange={(e) => setChequeNotes(e.target.value)} />
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button type="button" onClick={() => setEditingCheque(null)}>
                Cancel
              </button>
              <button className="primary" type="button" onClick={() => void saveCheque()}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
