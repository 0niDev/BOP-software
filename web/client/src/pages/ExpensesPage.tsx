import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import BankSelect from "../components/BankSelect";
import FilterBox, { matchesQuery } from "../components/FilterBox";
import SearchableSelect from "../components/SearchableSelect";
import type {
  Expense,
  ExpenseCategory,
  ExpenseFrequency,
  ExpenseItem,
  SettlementMethod,
} from "../types";

/** Selected amount per expense-item id for the "Pay items" grid. */
type PayAmounts = Record<number, number>;

const FREQUENCIES: ReadonlyArray<{ value: "" | ExpenseFrequency; label: string }> = [
  { value: "", label: "Does not repeat" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "YEARLY", label: "Yearly" },
];

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
  const [dueDate, setDueDate] = useState("");
  const [newCategory, setNewCategory] = useState("");

  /** One-off expense (no recurring item): name + amount typed in the dialog. */
  const [oneOffDescription, setOneOffDescription] = useState("");
  const [oneOffAmount, setOneOffAmount] = useState(0);

  // Recurring items ("Pay Items") for the selected category.
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [payAmounts, setPayAmounts] = useState<PayAmounts>({});
  const [newItemName, setNewItemName] = useState("");
  const [newItemAmount, setNewItemAmount] = useState(0);
  const [frequency, setFrequency] = useState<"" | ExpenseFrequency>("");
  const [nextRunDate, setNextRunDate] = useState("");
  const [payBusy, setPayBusy] = useState(false);
  const [query, setQuery] = useState("");

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
      const categoryList = await api.expenseCategories();
      setCategories(categoryList);
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
      await api.createExpenseCategory(newCategory.trim());
      setNewCategory("");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add category.");
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
        frequency: frequency || null,
        nextRunDate: frequency ? nextRunDate || null : null,
      });
      setNewItemName("");
      setNewItemAmount(0);
      setFrequency("");
      setNextRunDate("");
      await loadItems(categoryId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add the item.");
    }
  }

  async function submitItems(payLater: boolean): Promise<void> {
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
          bankAccountId: payLater || method === "CASH" ? null : bankId || null,
          expenseDate: date,
          payLater,
          dueDate: payLater ? dueDate || null : null,
          selections,
        });
        parts.push(
          payLater
            ? `${result.voucherNumbers.length} bill(s) — ${money(result.totalPaid)} ` +
                `(${result.voucherNumbers.join(", ")}) — due ${dueDate || "whenever"}`
            : `Paid ${result.voucherNumbers.length} item(s) — ${money(result.totalPaid)} ` +
                `(${result.voucherNumbers.join(", ")})`,
        );
      }
      if (hasOneOff) {
        const result = await api.createExpense({
          categoryId,
          expenseDate: date,
          amount: oneOffAmount,
          paymentMethod: method,
          payLater,
          dueDate: payLater ? dueDate || null : null,
          bankAccountId: payLater || method === "CASH" ? null : bankId || null,
          description: oneOffDescription.trim() || null,
        });
        parts.push(
          payLater
            ? `Bill ${result.voucherNumber} for ${money(oneOffAmount)} — due ${dueDate || "whenever"}`
            : `Expense ${result.voucherNumber} for ${money(oneOffAmount)}`,
        );
      }
      setNotice((payLater ? "Added — " : "Recorded — ") + parts.join("; "));
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

  /** Settle an unpaid bill with the method selected in the dialog. */
  async function payBill(expense: Expense) {
    setError(null);
    setNotice(null);
    try {
      const result = await api.payExpense(expense.id, {
        paymentMethod: expense.payment_method,
        paymentDate: new Date().toISOString().slice(0, 10),
        bankAccountId: expense.payment_method === "CASH" ? null : bankId || null,
      });
      setNotice(`Settled ${result.voucherNumber} (${money(expense.amount)})`);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to pay the bill.");
    }
  }

  const visibleExpenses = expenses.filter((expense) =>
    matchesQuery(query, [
      expense.voucher_number,
      expense.expense_date,
      expense.category_name,
      expense.payment_method,
      expense.status,
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
              the one-off row. Pay them now, or add them to Pay Later to settle from the list
              below.
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
                  options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
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

            <table style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Repeats</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>
                      {item.frequency
                        ? `${item.frequency} · next ${item.next_run_date ?? "—"}`
                        : "—"}
                    </td>
                    <td className="num">
                      <input
                        type="number"
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
                  <td>
                    <span className="sub">Not an item</span>
                  </td>
                  <td className="num">
                    <input
                      type="number"
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
                    <td colSpan={3}>
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
                onClick={() => void submitItems(false)}
              >
                {payBusy ? "Working…" : "Pay now"}
              </button>
            </div>

            <div
              className="row"
              style={{
                alignItems: "flex-end",
                marginTop: 12,
                paddingTop: 12,
                borderTop: "1px solid var(--grid-line)",
              }}
            >
              <div>
                <label>Due date</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <button
                type="button"
                disabled={payBusy}
                onClick={() => void submitItems(true)}
              >
                Add to pay later
              </button>
              <span className="sub" style={{ flex: 1 }}>
                Unpaid bills go to Accounts Payable; settle them from the recorded expenses list.
              </span>
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
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newItemAmount}
                  onChange={(e) => setNewItemAmount(Number(e.target.value))}
                  style={{ width: 130 }}
                />
              </div>
              <div>
                <label>Repeat</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as "" | ExpenseFrequency)}
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              {frequency && (
                <div>
                  <label>First bill date</label>
                  <input
                    type="date"
                    value={nextRunDate}
                    onChange={(e) => setNextRunDate(e.target.value)}
                  />
                </div>
              )}
              <button type="submit">Add item</button>
            </form>
          </div>
        </div>
      )}

      <form className="card" onSubmit={addCategory}>
        <h2>Add expense category</h2>
        <div className="row">
          <div>
            <label>Name</label>
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="e.g. Utilities"
            />
          </div>
          <button type="submit">Add category</button>
        </div>
      </form>

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
              <th>Method</th>
              <th>Status</th>
              <th className="num">Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibleExpenses.map((expense) => (
              <tr key={expense.id}>
                <td>{expense.voucher_number}</td>
                <td>{expense.expense_date}</td>
                <td>{expense.category_name}</td>
                <td>{expense.payment_method}</td>
                <td>
                  {expense.status === "UNPAID" ? (
                    <span className="badge">
                      Unpaid{expense.due_date ? ` · due ${expense.due_date}` : ""}
                    </span>
                  ) : (
                    "Paid"
                  )}
                </td>
                <td className="num">{money(expense.amount)}</td>
                <td>
                  {expense.status === "UNPAID" && (
                    <button type="button" className="primary" onClick={() => void payBill(expense)}>
                      Pay ({expense.payment_method})
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {visibleExpenses.length === 0 && (
              <tr>
                <td colSpan={7}>
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
