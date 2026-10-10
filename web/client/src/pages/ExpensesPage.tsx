import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import type { Expense, ExpenseCategory, SettlementMethod } from "../types";

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

  async function refresh() {
    try {
      setCategories(await api.expenseCategories());
      setExpenses(await api.expenses());
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
            <select value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
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
            {expenses.map((expense) => (
              <tr key={expense.id}>
                <td>{expense.voucher_number}</td>
                <td>{expense.expense_date}</td>
                <td>{expense.category_name}</td>
                <td>{expense.payment_method}</td>
                <td className="num">{money(expense.amount)}</td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={5}>No expenses recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
