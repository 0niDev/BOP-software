import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import BankSelect from "../components/BankSelect";
import FilterBox, { matchesQuery } from "../components/FilterBox";
import NumberInput from "../components/NumberInput";
import SearchableSelect from "../components/SearchableSelect";
import { DateRange, SortTh, inDateRange, sortRows, type SortState } from "../components/Sort";
import { formatDate } from "../lib/format";
import { moveRowFocus } from "../lib/gridKeys";
import { usePageVisible } from "../lib/pageVisibility";
import type { Account, Expense, SettlementMethod } from "../types";

/** One amount row in the record dialog: an account under the chosen category. */
interface ItemRow {
  account: Account;
  depth: number;
}

/** A level-3 expense account (a "category") and every account beneath it. */
interface CategoryGroup {
  account: Account;
  items: ItemRow[];
}

function money(value: number): string {
  return value.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function codeOrder(a: Account, b: Account): number {
  return a.account_code.localeCompare(b.account_code, "en", { numeric: true });
}

/**
 * Lay the expense tree out the way the business reads it: level-3 accounts are
 * categories, everything beneath a category is an item (any depth — headers
 * included, they are postable). A childless level-2 account is its own
 * category so nothing in the tree is unreachable.
 */
function expenseCategories(accounts: readonly Account[]): CategoryGroup[] {
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const children = new Map<number, Account[]>();
  const roots: Account[] = [];
  for (const account of accounts) {
    const parent = account.parent_account_id == null ? undefined : byId.get(account.parent_account_id);
    if (!parent) {
      roots.push(account);
      continue;
    }
    children.set(parent.id, [...(children.get(parent.id) ?? []), account]);
  }

  const depthOf = (account: Account): number => {
    let depth = 0;
    let current = account;
    const seen = new Set<number>([account.id]);
    while (current.parent_account_id != null) {
      const parent = byId.get(current.parent_account_id);
      if (!parent || seen.has(parent.id)) break;
      seen.add(parent.id);
      depth += 1;
      current = parent;
    }
    return depth;
  };

  const collect = (root: Account): ItemRow[] => {
    const rows: ItemRow[] = [{ account: root, depth: 0 }];
    const walk = (parent: Account, depth: number): void => {
      for (const child of (children.get(parent.id) ?? []).slice().sort(codeOrder)) {
        rows.push({ account: child, depth });
        walk(child, depth + 1);
      }
    };
    walk(root, 1);
    return rows;
  };

  const categories: CategoryGroup[] = [];
  for (const root of roots.slice().sort(codeOrder)) {
    for (const account of [root, ...(children.get(root.id) ?? []).slice().sort(codeOrder)]) {
      const depth = depthOf(account);
      const childless = (children.get(account.id) ?? []).length === 0;
      if (depth !== 2 && !(depth < 2 && childless)) continue;
      categories.push({ account, items: collect(account) });
    }
  }
  return categories.slice().sort((a, b) => codeOrder(a.account, b.account));
}

export default function ExpensesPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [categoryId, setCategoryId] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<SettlementMethod>("CASH");
  const [bankId, setBankId] = useState(0);
  const [description, setDescription] = useState("");
  /** Amount to post for each account id (all rows start at 0). */
  const [amounts, setAmounts] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);

  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<SortState | null>(null);

  // Edit dialog for one already-recorded expense.
  const [editing, setEditing] = useState<Expense | null>(null);
  const [editAccountId, setEditAccountId] = useState(0);
  const [editDate, setEditDate] = useState("");
  const [editAmount, setEditAmount] = useState(0);
  const [editMethod, setEditMethod] = useState<SettlementMethod>("CASH");
  const [editBankId, setEditBankId] = useState(0);
  const [editDescription, setEditDescription] = useState("");

  const categories = expenseCategories(accounts);
  const category = categories.find((group) => group.account.id === categoryId);
  const items = category?.items ?? [];
  const accountOptions = accounts
    .slice()
    .sort(codeOrder)
    .map((account) => ({
      value: String(account.id),
      label: `${account.account_code} - ${account.account_name}`,
    }));

  function openEdit(expense: Expense): void {
    setError(null);
    setNotice(null);
    setEditing(expense);
    setEditAccountId(expense.account_id ?? 0);
    setEditDate(expense.expense_date);
    setEditAmount(expense.amount);
    setEditMethod(expense.payment_method);
    setEditBankId(expense.bank_account_id ?? 0);
    setEditDescription(expense.description ?? "");
  }

  async function saveEdit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      await api.updateExpense(editing.id, {
        accountId: editAccountId || null,
        expenseDate: editDate,
        amount: editAmount,
        paymentMethod: editMethod,
        bankAccountId: editMethod === "CASH" ? null : editBankId || null,
        description: editDescription.trim() || null,
      });
      setEditing(null);
      setNotice(`Expense ${editing.voucher_number} updated.`);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update the expense.");
    } finally {
      setBusy(false);
    }
  }

  async function removeExpense(expense: Expense): Promise<void> {
    if (!window.confirm(`Delete expense ${expense.voucher_number}? Its journal entry is reversed.`)) {
      return;
    }
    setError(null);
    setNotice(null);
    try {
      await api.deleteExpense(expense.id);
      setNotice(`Expense ${expense.voucher_number} deleted.`);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete the expense.");
    }
  }

  async function unsettle(expense: Expense): Promise<void> {
    if (
      !window.confirm(
        `Reverse the settlement of ${expense.voucher_number}? It returns to an unpaid bill.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      await api.deleteExpenseSettlement(expense.id);
      setNotice(`Settlement of ${expense.voucher_number} reversed.`);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reverse the settlement.");
    }
  }

  async function refresh() {
    try {
      const [accountList, expenseList] = await Promise.all([api.accounts(), api.expenses()]);
      setAccounts(accountList.filter((a) => a.account_type === "EXPENSE" && a.is_active));
      setExpenses(expenseList);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load expenses.");
    }
  }

  const pageVisible = usePageVisible();

  useEffect(() => {
    void refresh();
  }, [pageVisible]);

  /** One expense voucher per non-zero row, each posting to its own account. */
  async function submit(): Promise<void> {
    setError(null);
    setNotice(null);
    if (!categoryId) {
      setError("Select a category.");
      return;
    }
    const rows = items
      .map((item) => ({ account: item.account, amount: amounts[item.account.id] ?? 0 }))
      .filter((row) => row.amount > 0);
    if (rows.length === 0) {
      setError("Enter an amount against at least one line.");
      return;
    }
    setBusy(true);
    const parts: string[] = [];
    let total = 0;
    try {
      for (const row of rows) {
        const result = await api.createExpense({
          accountId: row.account.id,
          expenseDate: date,
          amount: row.amount,
          paymentMethod: method,
          bankAccountId: method === "CASH" ? null : bankId || null,
          description: description.trim() || null,
        });
        parts.push(result.voucherNumber);
        total += row.amount;
      }
      setNotice(`Recorded ${rows.length} expense(s) — ${money(total)} (${parts.join(", ")})`);
      setAmounts({});
      setDescription("");
      setDialogOpen(false);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record the expenses.");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const visibleExpenses = sortRows(
    expenses.filter(
      (expense) =>
        matchesQuery(query, [
          expense.voucher_number,
          expense.expense_date,
          expense.category_name,
          expense.ledger_code,
          expense.ledger_name,
          expense.description,
          expense.payment_method,
          expense.amount,
        ]) && inDateRange(expense.expense_date, from, to),
    ),
    sort,
    (expense, key) => {
      switch (key) {
        case "voucher":
          return expense.voucher_number;
        case "date":
          return expense.expense_date;
        case "category":
          return expense.category_name ?? expense.ledger_name;
        case "description":
          return expense.description;
        case "method":
          return expense.payment_method;
        case "status":
          return expense.status;
        case "amount":
          return expense.amount;
        default:
          return "";
      }
    },
  );

  const selectedTotal = items.reduce(
    (sum, item) => sum + Math.max(amounts[item.account.id] ?? 0, 0),
    0,
  );

  return (
    <>
      <div className="card">
        <div className="row" style={{ alignItems: "center" }}>
          <h2 style={{ flex: 1, margin: 0 }}>Expense Vouchers</h2>
          <button className="primary" type="button" onClick={() => setDialogOpen(true)}>
            Add expense
          </button>
        </div>
        {error && <div className="error">{error}</div>}
        {notice && <div className="badge" style={{ display: "inline-block" }}>{notice}</div>}
      </div>

      {dialogOpen && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDialogOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setDialogOpen(false);
          }}
        >
          <div className="modal" role="dialog" aria-modal="true" aria-label="Record expenses">
            <div className="row" style={{ alignItems: "center", marginBottom: 8 }}>
              <h2 style={{ flex: 1, margin: 0 }}>Record expenses</h2>
              <button type="button" onClick={() => setDialogOpen(false)}>
                Close
              </button>
            </div>
            <p className="sub" style={{ marginTop: 0 }}>
              Pick a category, then type an amount next to the accounts to post to — the category
              itself counts as a line, so you can post to it even when it has sub-accounts behind
              it. Zeros are skipped.
            </p>
            {error && <div className="error">{error}</div>}

            <div className="row">
              <div>
                <label>Category</label>
                <SearchableSelect
                  value={categoryId ? String(categoryId) : ""}
                  onChange={(next) => {
                    setCategoryId(Number(next));
                    setAmounts({});
                  }}
                  placeholder="Select..."
                  emptyText="No matching category"
                  autoFocus
                  options={categories.map((group) => ({
                    value: String(group.account.id),
                    label: `${group.account.account_code} - ${group.account.account_name}`,
                  }))}
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
                  options={(["CASH", "BANK", "CHEQUE"] as const).map((m) => ({
                    value: m,
                    label: m,
                  }))}
                />
              </div>
              {method !== "CASH" && <BankSelect value={bankId} onChange={setBankId} />}
            </div>

            <table style={{ marginTop: 12 }} onKeyDown={moveRowFocus}>
              <thead>
                <tr>
                  <th>Account</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.account.id}>
                    <td style={{ paddingLeft: 8 + item.depth * 16 }}>
                      {item.account.account_code} - {item.account.account_name}
                    </td>
                    <td className="num">
                      <NumberInput
                        min="0"
                        step="0.01"
                        aria-label={`Amount for ${item.account.account_name}`}
                        value={amounts[item.account.id] ?? 0}
                        onChange={(e) =>
                          setAmounts((current) => ({
                            ...current,
                            [item.account.id]: Number(e.target.value),
                          }))
                        }
                        style={{ width: 130, textAlign: "right" }}
                      />
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={2}>
                      <span className="sub">
                        No expense accounts found — add expense sub-accounts in the Chart of
                        Accounts first.
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div>
              <label>Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What are these for? (optional)"
              />
            </div>

            <div className="row" style={{ alignItems: "center", marginTop: 12 }}>
              <strong style={{ flex: 1 }}>Total: {money(selectedTotal)}</strong>
              <button className="primary" type="button" disabled={busy} onClick={() => void submit()}>
                {busy ? "Working…" : "Record"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditing(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setEditing(null);
          }}
        >
          <form className="modal" role="dialog" aria-modal="true" onSubmit={saveEdit}>
            <h2>Edit expense {editing.voucher_number}</h2>
            <p className="sub" style={{ marginTop: 0 }}>
              The original journal entry is replaced. A settled bill must have its settlement
              reversed first.
            </p>
            <div className="row">
              <div>
                <label>Expense account</label>
                <SearchableSelect
                  value={editAccountId ? String(editAccountId) : ""}
                  onChange={(next) => setEditAccountId(Number(next) || 0)}
                  options={accountOptions}
                  placeholder="Search accounts…"
                  emptyText="No matching account"
                />
              </div>
              <div>
                <label>Date</label>
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
              </div>
              <div>
                <label>Amount</label>
                <NumberInput
                  min="0"
                  step="0.01"
                  value={editAmount}
                  onChange={(e) => setEditAmount(Number(e.target.value))}
                />
              </div>
              <div>
                <label>Method</label>
                <SearchableSelect
                  value={editMethod}
                  onChange={(next) => setEditMethod(next as SettlementMethod)}
                  options={(["CASH", "BANK", "CHEQUE"] as const).map((m) => ({
                    value: m,
                    label: m,
                  }))}
                />
              </div>
              {editMethod !== "CASH" && <BankSelect value={editBankId} onChange={setEditBankId} />}
            </div>
            <div>
              <label>Description</label>
              <input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="What was this for?"
              />
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button type="button" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="primary" type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="row" style={{ alignItems: "flex-end" }}>
          <h2 style={{ flex: 1, margin: 0 }}>
            Recorded expenses{" "}
            <span className="badge">{visibleExpenses.length} of {expenses.length}</span>
          </h2>
          <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
          <FilterBox value={query} onChange={setQuery} />
        </div>
        <table>
          <thead>
            <tr>
              <SortTh label="Voucher" sortKey="voucher" sort={sort} setSort={setSort} />
              <SortTh label="Date" sortKey="date" sort={sort} setSort={setSort} />
              <SortTh label="Category" sortKey="category" sort={sort} setSort={setSort} />
              <th>Ledger account</th>
              <SortTh label="Description" sortKey="description" sort={sort} setSort={setSort} />
              <SortTh label="Method" sortKey="method" sort={sort} setSort={setSort} />
              <SortTh label="Status" sortKey="status" sort={sort} setSort={setSort} />
              <SortTh label="Amount" sortKey="amount" sort={sort} setSort={setSort} className="num" />
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleExpenses.map((expense) => (
              <tr key={expense.id}>
                <td>{expense.voucher_number}</td>
                <td>{formatDate(expense.expense_date)}</td>
                <td>{expense.category_name ?? "—"}</td>
                <td>
                  {expense.ledger_code} - {expense.ledger_name}
                </td>
                <td>{expense.description ?? "—"}</td>
                <td>{expense.payment_method}</td>
                <td>{expense.status === "UNPAID" ? "Unpaid" : "Paid"}</td>
                <td className="num">{money(expense.amount)}</td>
                <td>
                  <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                    <button type="button" onClick={() => openEdit(expense)}>
                      Edit
                    </button>
                    {expense.settlement_journal_entry_id != null && (
                      <button type="button" onClick={() => void unsettle(expense)}>
                        Unsettle
                      </button>
                    )}
                    <button type="button" onClick={() => void removeExpense(expense)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {visibleExpenses.length === 0 && (
              <tr>
                <td colSpan={9}>
                  {expenses.length === 0
                    ? "No expenses recorded yet."
                    : "No expenses match this filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
