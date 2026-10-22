import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { api, ApiError } from "../api";
import SearchableSelect from "../components/SearchableSelect";
import type { Account, AccountType } from "../types";

const ACCOUNT_TYPES: AccountType[] = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];

const TYPE_LABELS: Record<AccountType, string> = {
  ASSET: "Assets",
  LIABILITY: "Liabilities",
  EQUITY: "Equity",
  REVENUE: "Revenue",
  EXPENSE: "Expenses",
};

/** Same rule as the server: class → group → ledger, three levels. */
const MAX_ACCOUNT_DEPTH = 3;

function byCode(a: Account, b: Account): number {
  return a.account_code.localeCompare(b.account_code, undefined, { numeric: true });
}

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
  const [activeType, setActiveType] = useState<"all" | AccountType>("all");

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
      parentAccountId: account.parent_account_id,
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

  // --- hierarchy ---------------------------------------------------------
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const childrenByParent = new Map<number, Account[]>();
  for (const account of accounts) {
    const parentId = account.parent_account_id;
    if (parentId == null || !accountsById.has(parentId)) continue;
    const list = childrenByParent.get(parentId) ?? [];
    list.push(account);
    childrenByParent.set(parentId, list);
  }
  for (const list of childrenByParent.values()) list.sort(byCode);

  // Accounts with at least one active child act as headers and are not
  // postable (matches the server-side posting guard).
  const headerIds = new Set<number>();
  for (const account of accounts) {
    if (account.is_active === 1 && account.parent_account_id != null) {
      headerIds.add(account.parent_account_id);
    }
  }

  const roots = accounts
    .filter(
      (account) =>
        account.parent_account_id == null || !accountsById.has(account.parent_account_id),
    )
    .sort(byCode);

  /** 1-based level of an account in the tree (class level is 1). */
  function levelOf(account: Account): number {
    let level = 1;
    let cursor: Account | undefined = account;
    while (cursor?.parent_account_id != null) {
      cursor = accountsById.get(cursor.parent_account_id);
      if (!cursor) break;
      level += 1;
    }
    return level;
  }

  function subtreeIds(rootId: number): Set<number> {
    const ids = new Set<number>();
    const stack = [rootId];
    while (stack.length > 0) {
      const id = stack.pop() as number;
      for (const child of childrenByParent.get(id) ?? []) {
        if (ids.has(child.id)) continue;
        ids.add(child.id);
        stack.push(child.id);
      }
    }
    return ids;
  }

  const openingRows = accounts.filter(
    (account) => account.is_active === 1 && !headerIds.has(account.id),
  );
  const totalDebit = openingRows
    .filter((account) => account.account_type === "ASSET")
    .reduce((sum, account) => sum + (opening[account.id] ?? 0), 0);
  const totalCredit = openingRows
    .filter((account) => account.account_type === "LIABILITY" || account.account_type === "EQUITY")
    .reduce((sum, account) => sum + (opening[account.id] ?? 0), 0);
  const difference = Math.round((totalDebit - totalCredit) * 100) / 100;

  function calculateEquity(): void {
    const equity = openingRows.find((account) => account.account_type === "EQUITY");
    if (!equity) {
      setError("No postable EQUITY account exists to absorb the difference.");
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

  // Parents must be same-type, active, not the account itself nor one of its
  // descendants, and still have room for one more level.
  const editingSubtree = editing ? subtreeIds(editing.id) : new Set<number>();
  const parentOptions = accounts.filter(
    (account) =>
      account.account_type === draft.accountType &&
      account.id !== editing?.id &&
      !editingSubtree.has(account.id) &&
      account.is_active === 1 &&
      levelOf(account) < MAX_ACCOUNT_DEPTH,
  );

  /** One tree row per account, indented by depth, children under their parent. */
  function treeRows(account: Account, depth: number): ReactNode[] {
    const children = childrenByParent.get(account.id) ?? [];
    const rows: ReactNode[] = [
      <tr key={account.id} className={`coa-row coa-l${Math.min(depth + 1, 3)}`}>
        <td style={{ whiteSpace: "nowrap" }}>
          <span className="coa-code">
            {Array.from({ length: depth }, (_, index) => (
              <span key={index} className="coa-rail" />
            ))}
            {depth > 0 && <span className="coa-elbow">└</span>}
            {account.account_code}
          </span>
        </td>
        <td style={children.length > 0 ? { fontWeight: 600 } : undefined}>
          {account.account_name}
          {children.length > 0 && (
            <span className="badge" style={{ marginLeft: 6, opacity: 0.7 }}>
              header
            </span>
          )}
        </td>
        <td>{account.account_type}</td>
        <td>{account.account_subtype ?? "—"}</td>
        <td className="num">{amount(account.opening_balance)}</td>
        <td>
          <span className="badge">
            {account.is_active ? "Active" : "Inactive"}
            {account.is_system_account ? " · system" : ""}
          </span>
        </td>
        <td style={{ whiteSpace: "nowrap" }}>
          <button onClick={() => startEdit(account)}>Edit</button>{" "}
          {account.is_active === 1 && account.is_system_account === 0 && (
            <button onClick={() => void deactivate(account)}>Deactivate</button>
          )}
        </td>
      </tr>,
    ];
    for (const child of children) rows.push(...treeRows(child, depth + 1));
    return rows;
  }

  return (
    <>
      <div className="card">
        <div className="row" style={{ alignItems: "flex-end" }}>
          <h2 style={{ flex: 1, margin: 0 }}>Chart of Accounts</h2>
          <div>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Show hidden
            </label>
          </div>
        </div>
        {error && <div className="error">{error}</div>}
        {notice && (
          <div className="badge" style={{ display: "inline-block" }}>
            {notice}
          </div>
        )}
        <div className="coa-tabs" role="tablist">
          {(["all", ...ACCOUNT_TYPES] as const).map((type) => (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={activeType === type}
              className={activeType === type ? "active" : undefined}
              onClick={() => setActiveType(type)}
            >
              {type === "all" ? "All" : TYPE_LABELS[type]}
            </button>
          ))}
        </div>
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
            {ACCOUNT_TYPES.map((type) => {
              if (activeType !== "all" && activeType !== type) return null;
              const sectionRoots = roots.filter((account) => account.account_type === type);
              if (sectionRoots.length === 0) return null;
              return [
                <tr key={`section-${type}`}>
                  <td
                    colSpan={7}
                    style={{
                      background: "var(--accent-soft)",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      fontSize: 12,
                      opacity: 0.8,
                    }}
                  >
                    {TYPE_LABELS[type]}
                  </td>
                </tr>,
                ...sectionRoots.flatMap((root) => treeRows(root, 0)),
              ];
            })}
            {roots.filter((account) => activeType === "all" || activeType === account.account_type)
              .length === 0 &&
              !error && (
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
            <label>Code (blank = auto)</label>
            <input
              value={draft.accountCode}
              onChange={(e) => set("accountCode", e.target.value)}
              disabled={Boolean(editing)}
              placeholder="auto"
            />
          </div>
          <div>
            <label>Name</label>
            <input value={draft.accountName} onChange={(e) => set("accountName", e.target.value)} />
          </div>
          <div>
            <label>Type</label>
            <SearchableSelect
              value={draft.accountType}
              onChange={(next) => {
                set("accountType", next as AccountType);
                set("parentAccountId", null);
              }}
              disabled={Boolean(editing)}
              placeholder="Type"
              options={ACCOUNT_TYPES.map((type) => ({ value: type, label: type }))}
            />
          </div>
          <div>
            <label>Parent account</label>
            <SearchableSelect
              value={draft.parentAccountId == null ? "" : String(draft.parentAccountId)}
              onChange={(next) => set("parentAccountId", next ? Number(next) : null)}
              placeholder="None"
              emptyText="No matching account"
              options={[
                { value: "", label: "None" },
                ...parentOptions.map((account) => ({
                  value: String(account.id),
                  label: `${account.account_code} — ${account.account_name}`,
                })),
              ]}
            />
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
              <SearchableSelect
                value={draft.isActive ? "1" : "0"}
                onChange={(next) => set("isActive", next === "1")}
                disabled={editing.is_system_account === 1}
                placeholder="Status"
                options={[
                  { value: "1", label: "Active" },
                  { value: "0", label: "Inactive" },
                ]}
              />
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
