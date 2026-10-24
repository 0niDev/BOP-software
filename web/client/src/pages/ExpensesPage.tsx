import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import BankSelect from "../components/BankSelect";
import FilterBox, { matchesQuery } from "../components/FilterBox";
import NumberInput from "../components/NumberInput";
import SearchableSelect from "../components/SearchableSelect";
import { moveRowFocus } from "../lib/gridKeys";
import type {
  Account,
  Expense,
  ExpenseCategory,
  ExpenseItem,
  SettlementMethod,
} from "../types";

/** Selected amount per expense-item id for the "Pay items" grid. */
type PayAmounts = Record<number, number>;

function money(value: number): string {
  return value.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ExpensesPage() {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [categoryId, setCategoryId] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<SettlementMethod>("CASH");
  const [bankId, setBankId] = useState(0);
  const [newCategory, setNewCategory] = useState("");
  const [newCategoryAccountId, setNewCategoryAccountId] = useState(0);
  const [expenseAccounts, setExpenseAccounts] = useState<Account[]>([]);
  const [linkingId, setLinkingId] = useState<number | null>(null);

  /** One-off expense (no recurring item): name + amount typed in the dialog. */
  const [oneOffDescription, setOneOffDescription] = useState("");
  const [oneOffAmount, setOneOffAmount] = useState(0);

  // Recurring items ("Pay Items") for the selected category.
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [payAmounts, setPayAmounts] = useState<PayAmounts>({});
  const [newItemName, setNewItemName] = useState("");
  const [newItemAmount, setNewItemAmount] = useState(0);
  const [payBusy, setPayBusy] = useState(false);
  const [query, setQuery] = useState("");

  // Edit dialog for one already-recorded expense.
  const [editing, setEditing] = useState<Expense | null>(null);
  const [editCategoryId, setEditCategoryId] = useState(0);
  const [editDate, setEditDate] = useState("");
  const [editAmount, setEditAmount] = useState(0);
  const [editMethod, setEditMethod] = useState<SettlementMethod>("CASH");
  const [editBankId, setEditBankId] = useState(0);
  const [editDescription, setEditDescription] = useState("");
  const [busy, setBusy] = useState(false);

  function openEdit(expense: Expense): void {
    setError(null);
    setNotice(null);
    setEditing(expense);
    setEditCategoryId(expense.category_id);
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
        categoryId: editCategoryId,
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

  async function loadItems(currentCategoryId: number): Promise<void> {
    if (!currentCategoryId) {
      setItems([]);
      return;
    }
    try {
      const list = await api.expenseItems(currentCategoryId);
      setItems(list);
      setPayAmounts((current) => {
        const next: PayAmounts = {};
        // Start every row at 0, like the Python dialog: the user types the
        // amounts to post, existing item defaults are not copied in.
        for (const item of list) next[item.id] = current[item.id] ?? 0;
        return next;
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load expense items.");
    }
  }

  async function refresh() {
    try {
      const [categoryList, accountList] = await Promise.all([
        api.expenseCategories(),
        api.accounts(),
      ]);
      setCategories(categoryList);
      setExpenseAccounts(accountList.filter((a) => a.account_type === "EXPENSE" && a.is_active));
      setExpenses(await api.expenses());
      const first = categoryList[0];
      if (categoryId === 0 && first) setCategoryId(first.id);
      await loadItems(categoryId || first?.id || 0);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load expenses.");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function addCategory(event: FormEvent) {
    event.preventDefault();
    if (!newCategory.trim()) return;
    try {
      await api.createExpenseCategory(newCategory.trim(), newCategoryAccountId || null);
      setNewCategory("");
      setNewCategoryAccountId(0);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add category.");
    }
  }

  /** Changing the linked account re-posts the category's expenses on the server. */
  async function linkCategoryAccount(category: ExpenseCategory, value: string) {
    setError(null);
    setNotice(null);
    setLinkingId(category.id);
    try {
      const { category: updated, reposted } = await api.updateExpenseCategory(category.id, {
        accountId: value ? Number(value) : null,
      });
      setNotice(
        `'${updated.name}' re-posted${reposted ? ` (${reposted} expense${reposted === 1 ? "" : "s"})` : ""}.`,
      );
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to relink the category.");
    } finally {
      setLinkingId(null);
    }
  }

  async function addItem(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!categoryId) {
      setError("Select a category first.");
      return;
    }
    if (!newItemName.trim()) {
      setError("Item name is required.");
      return;
    }
    try {
      await api.createExpenseItem({
        categoryId,
        name: newItemName.trim(),
        amount: newItemAmount,
      });
      setNewItemName("");
      setNewItemAmount(0);
      await loadItems(categoryId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add the item.");
    }
  }

  async function submitItems(): Promise<void> {
    setError(null);
    setNotice(null);
    if (!categoryId) {
      setError("Select a category.");
      return;
    }
    const selections = items
      .map((item) => ({
        itemId: item.id,
        amount: payAmounts[item.id] ?? 0,
        description: item.name,
      }))
      .filter((selection) => selection.amount > 0);
    const hasOneOff = oneOffAmount > 0;
    if (selections.length === 0 && !hasOneOff) {
      setError("Enter an amount against at least one item, or add a one-off amount.");
      return;
    }
    setPayBusy(true);
    const parts: string[] = [];
    try {
      if (selections.length > 0) {
        const result = await api.payExpenseItems({
          categoryId,
          paymentMethod: method,
          bankAccountId: method === "CASH" ? null : bankId || null,
          expenseDate: date,
          selections,
        });
        parts.push(
          `Paid ${result.voucherNumbers.length} item(s) — ${money(result.totalPaid)} ` +
            `(${result.voucherNumbers.join(", ")})`,
        );
      }
      if (hasOneOff) {
        const result = await api.createExpense({
          categoryId,
          expenseDate: date,
          amount: oneOffAmount,
          paymentMethod: method,
          bankAccountId: method === "CASH" ? null : bankId || null,
          description: oneOffDescription.trim() || null,
        });
        parts.push(`Expense ${result.voucherNumber} for ${money(oneOffAmount)}`);
      }
      setNotice("Recorded — " + parts.join("; "));
      setPayAmounts({});
      setOneOffDescription("");
      setOneOffAmount(0);
      setDialogOpen(false);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record the expenses.");
      await refresh();
    } finally {
      setPayBusy(false);
    }
  }

  const accountOptions = [
    { value: "", label: "6000 - General & Administrative (fallback)" },
    ...expenseAccounts.map((a) => ({
      value: String(a.id),
      label: `${a.account_code} - ${a.account_name}`,
    })),
  ];

  const accountLabels = new Map(
    expenseAccounts.map((a) => [a.id, `${a.account_code} - ${a.account_name}`]),
  );
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  /** Where the category's journal entry actually posts (null link = 6000 fallback). */
  const ledgerFor = (categoryId: number): string => {
    const accountId = categoryById.get(categoryId)?.account_id;
    return accountId != null
      ? accountLabels.get(accountId) ?? "—"
      : "6000 - General & Administrative (fallback)";
  };

  const visibleExpenses = expenses.filter((expense) =>
    matchesQuery(query, [
      expense.voucher_number,
      expense.expense_date,
      expense.category_name,
      expense.payment_method,
      expense.amount,
    ]),
  );

  /** Live total of the amounts typed into the dialog (items + one-off). */
  const selectedTotal =
    items.reduce((sum, item) => sum + Math.max(payAmounts[item.id] ?? 0, 0), 0) +
    Math.max(oneOffAmount, 0);

  return (
    <>
      <div className="card">
        <div className="row" style={{ alignItems: "center" }}>
          <h2 style={{ flex: 1, margin: 0 }}>Expenses</h2>
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
              Every item in the category starts at 0. Type an amount next to the ones you want —
              items above 0 are recorded, zeros are skipped. Anything that is not an item goes in
              the one-off row.
            </p>
            {error && <div className="error">{error}</div>}

            <div className="row">
              <div>
                <label>Category</label>
                <SearchableSelect
                  value={String(categoryId)}
                  onChange={(next) => {
                    setCategoryId(Number(next));
                    setPayAmounts({});
                    void loadItems(Number(next));
                  }}
                  placeholder="Select..."
                  emptyText="No matching category"
                  autoFocus
                  options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
                />
                <span className="sub" style={{ fontSize: 11 }}>
                  Posts to: {categoryId ? ledgerFor(categoryId) : "—"}
                </span>
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
                  <th>Item</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td className="num">
                      <NumberInput
                        min="0"
                        step="0.01"
                        aria-label={`Amount for ${item.name}`}
                        value={payAmounts[item.id] ?? 0}
                        onChange={(e) =>
                          setPayAmounts((current) => ({
                            ...current,
                            [item.id]: Number(e.target.value),
                          }))
                        }
                        style={{ width: 130, textAlign: "right" }}
                      />
                    </td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <input
                      value={oneOffDescription}
                      onChange={(e) => setOneOffDescription(e.target.value)}
                      placeholder="One-off — what for?"
                      aria-label="One-off expense description"
                    />
                  </td>
                  <td className="num">
                    <NumberInput
                      min="0"
                      step="0.01"
                      aria-label="One-off expense amount"
                      value={oneOffAmount}
                      onChange={(e) => setOneOffAmount(Number(e.target.value))}
                      style={{ width: 130, textAlign: "right" }}
                    />
                  </td>
                </tr>
                {items.length === 0 && (
                  <tr>
                    <td colSpan={2}>
                      <span className="sub">
                        No items in this category yet — add one with “Add expense item” below.
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="row" style={{ alignItems: "center", marginTop: 12 }}>
              <strong style={{ flex: 1 }}>Total: {money(selectedTotal)}</strong>
              <button
                className="primary"
                type="button"
                disabled={payBusy}
                onClick={() => void submitItems()}
              >
                {payBusy ? "Working…" : "Record"}
              </button>
            </div>

            <form
              className="row"
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: "1px solid var(--grid-line)",
              }}
              onSubmit={addItem}
            >
              <div>
                <label>New item</label>
                <input
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="e.g. Office rent"
                />
              </div>
              <div>
                <label>Default amount</label>
                <NumberInput
                  min="0"
                  step="0.01"
                  value={newItemAmount}
                  onChange={(e) => setNewItemAmount(Number(e.target.value))}
                  style={{ width: 130 }}
                />
              </div>
              <button type="submit">Add item</button>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <h2>Expense categories</h2>
        <p className="sub" style={{ marginTop: 0 }}>
          Each category posts its expenses to this ledger account. Changing it re-posts the
          category's existing expenses too, so the trial balance moves with it.
        </p>
        <form className="row" onSubmit={addCategory}>
          <div>
            <label>New category</label>
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="e.g. Utilities"
            />
          </div>
          <div>
            <label>Ledger account</label>
            <SearchableSelect
              value={String(newCategoryAccountId || "")}
              onChange={(next) => setNewCategoryAccountId(Number(next) || 0)}
              options={accountOptions}
              placeholder="Search accounts…"
            />
          </div>
          <button type="submit">Add category</button>
        </form>
        <table style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Category</th>
              <th>Ledger account</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id}>
                <td>{category.name}</td>
                <td>
                  <SearchableSelect
                    value={String(category.account_id ?? "")}
                    onChange={(next) => void linkCategoryAccount(category, next)}
                    options={accountOptions}
                    disabled={linkingId === category.id}
                    placeholder="Search accounts…"
                    ariaLabel={`Ledger account for ${category.name}`}
                  />
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={2}>No categories yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
                <label>Category</label>
                <SearchableSelect
                  value={String(editCategoryId)}
                  onChange={(next) => setEditCategoryId(Number(next))}
                  options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
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
        <div className="row" style={{ alignItems: "center" }}>
          <h2 style={{ flex: 1, margin: 0 }}>
            Recorded expenses{" "}
            <span className="badge">{visibleExpenses.length} of {expenses.length}</span>
          </h2>
          <FilterBox value={query} onChange={setQuery} />
        </div>
        <table>
          <thead>
            <tr>
              <th>Voucher</th>
              <th>Date</th>
              <th>Category</th>
              <th>Ledger account</th>
              <th>Description</th>
              <th>Method</th>
              <th>Status</th>
              <th className="num">Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleExpenses.map((expense) => (
              <tr key={expense.id}>
                <td>{expense.voucher_number}</td>
                <td>{expense.expense_date}</td>
                <td>{expense.category_name}</td>
                <td>{ledgerFor(expense.category_id)}</td>
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
