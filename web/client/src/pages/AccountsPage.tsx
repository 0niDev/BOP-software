import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import type { Account, AccountType } from "../types";

const ACCOUNT_TYPES: AccountType[] = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];

interface Draft {
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  parentAccountId: number | null;
  openingBalance: number;
  accountSubtype: string;
  isActive: boolean;
}

const EMPTY_DRAFT: Draft = {
  accountCode: "",
  accountName: "",
  accountType: "ASSET",
  parentAccountId: null,
  openingBalance: 0,
  accountSubtype: "",
  isActive: true,
};

function money(value: number): string {
  return value.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function message(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function amount(value: number): string {
  return value === 0 ? "—" : money(value);
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editing, setEditing] = useState<Account | null>(null);
  const [busy, setBusy] = useState(false);

  // Opening-balance grid: amount per account id.
  const [opening, setOpening] = useState<Record<number, number>>({});
  const [openingBusy, setOpeningBusy] = useState(false);

  async function refresh(): Promise<void> {
    try {
      setAccounts(await api.accounts(!showInactive));
    } catch (err) {
      setError(message(err, "Failed to load accounts."));
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]): void {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function startEdit(account: Account): void {
    setEditing(account);
    setError(null);
    setNotice(null);
    setDraft({
      accountCode: account.account_code,
      accountName: account.account_name,
      accountType: account.account_type,
      parentAccountId: null,
      openingBalance: account.opening_balance,
      accountSubtype: account.account_subtype ?? "",
      isActive: account.is_active === 1,
    });
  }

  function cancel(): void {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
    void refresh();
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!draft.accountName.trim()) {
      setError("Account name is required.");
      return;
    }
    if (!editing && !draft.accountCode.trim()) {
      setError("Account code is required.");
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await api.updateAccount(editing.id, {
          accountName: draft.accountName.trim(),
          openingBalance: draft.openingBalance,
          parentAccountId: draft.parentAccountId,
          isActive: draft.isActive,
        });
        setNotice(`Updated ${editing.account_code}.`);
      } else {
        const created = await api.createAccount({
          accountCode: draft.accountCode.trim(),
          accountName: draft.accountName.trim(),
          accountType: draft.accountType,
          parentAccountId: draft.parentAccountId,
          openingBalance: draft.openingBalance,
          accountSubtype: draft.accountSubtype || null,
        });
        setNotice(`Created ${created.account_code} — ${created.account_name}.`);
      }
      cancel();
    } catch (err) {
      setError(message(err, "Failed to save the account."));
    } finally {
      setBusy(false);
    }
  }

  const openingRows = accounts.filter((account) => account.is_active === 1);
  const totalDebit = openingRows
    .filter((account) => account.account_type === "ASSET")
    .reduce((sum, account) => sum + (opening[account.id] ?? 0), 0);
  const totalCredit = openingRows
    .filter((account) => account.account_type === "LIABILITY" || account.account_type === "EQUITY")
    .reduce((sum, account) => sum + (opening[account.id] ?? 0), 0);
  const difference = Math.round((totalDebit - totalCredit) * 100) / 100;

  function calculateEquity(): void {
    const equity = accounts.find((account) => account.account_type === "EQUITY");
    if (!equity) {
      setError("No EQUITY account exists to absorb the difference.");
      return;
    }
    setError(null);
    setOpening((current) => {
      const next = { ...current };
      next[equity.id] = Math.round(((current[equity.id] ?? 0) + difference) * 100) / 100;
      return next;
    });
  }

  async function saveOpeningBalances(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const entries = openingRows
      .filter((account) => (opening[account.id] ?? 0) !== 0)
      .map((account) =>
        account.account_type === "ASSET"
          ? { accountId: account.id, debit: opening[account.id] ?? 0 }
          : account.account_type === "LIABILITY" || account.account_type === "EQUITY"
            ? { accountId: account.id, credit: opening[account.id] ?? 0 }
            : { accountId: account.id, debit: opening[account.id] ?? 0 },
      );
    if (entries.length === 0) {
      setError("Enter at least one opening balance.");
      return;
    }
    setOpeningBusy(true);
    try {
      const result = await api.postOpeningBalances(entries);
      setNotice(
        `Posted opening balances: debit ${money(result.totalDebit)} / credit ${money(result.totalCredit)} ` +
          `across ${result.accountsUpdated} account(s).`,
      );
      setOpening({});
      await refresh();
    } catch (err) {
      setError(message(err, "Failed to post opening balances."));
    } finally {
      setOpeningBusy(false);
    }
  }

  async function deactivate(account: Account): Promise<void> {
    setError(null);
    setNotice(null);
    try {
      await api.deactivateAccount(account.id);
      setNotice(`Deactivated ${account.account_code}.`);
      await refresh();
    } catch (err) {
      setError(message(err, "Failed to deactivate the account."));
    }
  }

  // Only same-type accounts may be a parent.
  const parentOptions = accounts.filter(
    (account) =>
      account.account_type === draft.accountType && account.id !== editing?.id && account.is_active === 1,
  );

  return (
    <>
      <div className="card">
        <div className="row" style={{ alignItems: "flex-end" }}>
          <h2 style={{ flex: 1, margin: 0 }}>Chart of Accounts</h2>
          <div>
            <label>Show</label>
            <select
              value={showInactive ? "all" : "active"}
              onChange={(e) => setShowInactive(e.target.value === "all")}
            >
              <option value="active">Active only</option>
              <option value="all">Include inactive</option>
            </select>
          </div>
        </div>
        {error && <div className="error">{error}</div>}
        {notice && (
          <div className="badge" style={{ display: "inline-block" }}>
            {notice}
          </div>
        )}
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Type</th>
              <th>Subtype</th>
              <th className="num">Opening</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td>{account.account_code}</td>
                <td>{account.account_name}</td>
                <td>{account.account_type}</td>
                <td>{account.account_subtype ?? "—"}</td>
                <td className="num">{amount(account.opening_balance)}</td>
                <td>
                  <span className="badge">
                    {account.is_active ? "Active" : "Inactive"}
                    {account.is_system_account ? " · system" : ""}
                  </span>
                </td>
                <td>
                  <button onClick={() => startEdit(account)}>Edit</button>{" "}
                  {account.is_active === 1 && account.is_system_account === 0 && (
                    <button onClick={() => void deactivate(account)}>Deactivate</button>
                  )}
                </td>
              </tr>
            ))}
            {accounts.length === 0 && !error && (
              <tr>
                <td colSpan={7}>No accounts.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form className="card" onSubmit={saveOpeningBalances}>
        <h2>Opening balances</h2>
        <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label>Debit total (assets)</label>
            <div style={{ fontSize: 18 }}>{money(totalDebit)}</div>
          </div>
          <div>
            <label>Credit total (liabilities + equity)</label>
            <div style={{ fontSize: 18 }}>{money(totalCredit)}</div>
          </div>
          <div>
            <label>Difference</label>
            <div className="badge" style={{ display: "inline-block", fontSize: 14 }}>
              {money(difference)}
            </div>
          </div>
          <button type="button" onClick={calculateEquity}>
            Calculate equity
          </button>
          <button className="primary" type="submit" disabled={openingBusy}>
            {openingBusy ? "Posting…" : "Post opening balances"}
          </button>
        </div>
        <p style={{ opacity: 0.7, fontSize: 12 }}>
          Enter an amount against the accounts you are opening. Assets are debited, liabilities and
          equity credited; use “Calculate equity” to absorb the difference, then post — all amounts
          go into a single balanced OPENING journal entry.
        </p>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Account</th>
              <th>Type</th>
              <th className="num">Opening amount</th>
            </tr>
          </thead>
          <tbody>
            {openingRows.map((account) => (
              <tr key={account.id}>
                <td>{account.account_code}</td>
                <td>{account.account_name}</td>
                <td>{account.account_type}</td>
                <td className="num">
                  <input
                    type="number"
                    step="0.01"
                    value={opening[account.id] ?? 0}
                    onChange={(e) =>
                      setOpening((current) => ({
                        ...current,
                        [account.id]: Number(e.target.value),
                      }))
                    }
                    style={{ width: 140, textAlign: "right" }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </form>

      <form className="card" onSubmit={submit}>
        <h2>{editing ? `Edit account — ${editing.account_code}` : "Add account"}</h2>
        <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label>Code</label>
            <input
              value={draft.accountCode}
              onChange={(e) => set("accountCode", e.target.value)}
              disabled={Boolean(editing)}
              placeholder="6100"
            />
          </div>
          <div>
            <label>Name</label>
            <input value={draft.accountName} onChange={(e) => set("accountName", e.target.value)} />
          </div>
          <div>
            <label>Type</label>
            <select
              value={draft.accountType}
              onChange={(e) => {
                set("accountType", e.target.value as AccountType);
                set("parentAccountId", null);
              }}
              disabled={Boolean(editing)}
            >
              {ACCOUNT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Parent account</label>
            <select
              value={draft.parentAccountId ?? ""}
              onChange={(e) =>
                set("parentAccountId", e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">None</option>
              {parentOptions.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.account_code} — {account.account_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Opening balance</label>
            <input
              type="number"
              step="0.01"
              value={draft.openingBalance}
              onChange={(e) => set("openingBalance", Number(e.target.value))}
              style={{ width: 130 }}
            />
          </div>
          {!editing && (
            <div>
              <label>Subtype</label>
              <input
                value={draft.accountSubtype}
                onChange={(e) => set("accountSubtype", e.target.value)}
                placeholder="CURRENT_ASSET"
              />
            </div>
          )}
          {editing && (
            <div>
              <label>Status</label>
              <select
                value={draft.isActive ? "1" : "0"}
                onChange={(e) => set("isActive", e.target.value === "1")}
                disabled={editing.is_system_account === 1}
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </div>
          )}
          <button className="primary" type="submit" disabled={busy}>
            {editing ? "Save changes" : "Add account"}
          </button>
          {editing && (
            <button type="button" onClick={cancel}>
              Cancel
            </button>
          )}
        </div>
        <p style={{ opacity: 0.7, fontSize: 12 }}>
          A non-zero opening balance is posted immediately as an OPENING journal entry against
          Retained Earnings (3100), so the ledger stays balanced.
        </p>
      </form>
    </>
  );
}
