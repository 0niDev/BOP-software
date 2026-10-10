import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import FilterBox, { matchesQuery } from "../components/FilterBox";
import type { Expense, ExpenseCategory, ExpenseItem, SettlementMethod } from "../types";

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
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<SettlementMethod>("CASH");
  const [description, setDescription] = useState("");
  const [newCategory, setNewCategory] = useState("");

  // Recurring items ("Pay Items") for the selected category.
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [payAmounts, setPayAmounts] = useState<PayAmounts>({});
  const [newItemName, setNewItemName] = useState("");
  const [newItemAmount, setNewItemAmount] = useState(0);
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
        for (const item of list) next[item.id] = current[item.id] ?? item.amount ?? 0;
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
      });
      setNewItemName("");
      setNewItemAmount(0);
      await loadItems(categoryId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add the item.");
    }
  }

  async function saveItemAmount(item: ExpenseItem): Promise<void> {
    try {
      await api.updateExpenseItem(item.id, { amount: payAmounts[item.id] ?? 0 });
      await loadItems(categoryId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save the amount.");
    }
  }

  async function payItems(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const selections = items
      .map((item) => ({
        itemId: item.id,
        amount: payAmounts[item.id] ?? 0,
        description: item.name,
      }))
      .filter((selection) => selection.amount > 0);
    if (selections.length === 0) {
      setError("Enter an amount against at least one item to pay.");
      return;
    }
    setPayBusy(true);
    try {
      const result = await api.payExpenseItems({
        categoryId,
        paymentMethod: method,
        expenseDate: date,
        selections,
      });
      setNotice(
        `Paid ${result.voucherNumbers.length} item(s) — ${money(result.totalPaid)} ` +
          `(${result.voucherNumbers.join(", ")})`,
      );
      setPayAmounts({});
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to pay the selected items.");
    } finally {
      setPayBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!categoryId) {
      setError("Select a category.");
      return;
    }
    if (amount <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }
    try {
      const result = await api.createExpense({
        categoryId,
        expenseDate: date,
        amount,
        paymentMethod: method,
        description: description || null,
      });
      setNotice(`Recorded expense ${result.voucherNumber} for ${money(amount)}`);
      setAmount(0);
      setDescription("");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record expense.");
    }
  }

  const visibleExpenses = expenses.filter((expense) =>
    matchesQuery(query, [
      expense.voucher_number,
      expense.expense_date,
      expense.category_name,
      expense.payment_method,
      expense.amount,
    ]),
  );

  return (
    <>
      <div className="card">
        <h2>Expenses</h2>
        {error && <div className="error">{error}</div>}
        {notice && <div className="badge" style={{ display: "inline-block" }}>{notice}</div>}
      </div>

      <form className="card" onSubmit={submit}>
        <h2>Record expense</h2>
        <div className="row">
          <div>
            <label>Category</label>
            <select
              value={categoryId}
              onChange={(e) => {
                const next = Number(e.target.value);
                setCategoryId(next);
                setPayAmounts({});
                void loadItems(next);
              }}
            >
              <option value={0}>Select...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
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
          <div>
            <label>Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <button className="primary" type="submit">
            Record expense
          </button>
        </div>
      </form>

      <form className="card" onSubmit={payItems}>
        <h2>Pay items</h2>
        <p style={{ opacity: 0.7, fontSize: 12, marginTop: 0 }}>
          Recurring payees and bills for the selected category. Each paid item becomes its own
          expense voucher, debiting the category account and crediting the payment account.
        </p>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">Last paid</th>
              <th className="num">Pay now</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td className="num">{item.amount == null ? "—" : money(item.amount)}</td>
                <td className="num">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
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
                <td>
                  <button type="button" onClick={() => void saveItemAmount(item)}>
                    Save amount
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4}>
                  No items in this category yet — add one below.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="primary" type="submit" disabled={payBusy || items.length === 0}>
            {payBusy ? "Paying…" : `Pay selected (${method})`}
          </button>
          <span style={{ opacity: 0.7, fontSize: 12 }}>
            Date {date} · method follows the Record expense form above.
          </span>
        </div>
      </form>

      <form className="card" onSubmit={addItem}>
        <h2>Add expense item</h2>
        <div className="row">
          <div>
            <label>Name</label>
            <input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} />
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
          <button type="submit">Add item</button>
        </div>
      </form>

      <form className="card" onSubmit={addCategory}>
        <h2>Add expense category</h2>
        <div className="row">
          <div>
            <label>Name</label>
            <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
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
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {visibleExpenses.map((expense) => (
              <tr key={expense.id}>
                <td>{expense.voucher_number}</td>
                <td>{expense.expense_date}</td>
                <td>{expense.category_name}</td>
                <td>{expense.payment_method}</td>
                <td className="num">{money(expense.amount)}</td>
              </tr>
            ))}
            {visibleExpenses.length === 0 && (
              <tr>
                <td colSpan={5}>
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
