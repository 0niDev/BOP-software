import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError, type ReturnBody } from "../api";
import NumberInput from "../components/NumberInput";
import SearchableSelect from "../components/SearchableSelect";
import { formatDate } from "../lib/format";
import { moveRowFocus } from "../lib/gridKeys";
import { usePageVisible } from "../lib/pageVisibility";
import type { Item, Party } from "../types";

type Tab = "sales" | "purchase";
type Destination = "INVENTORY" | "WASTE";

interface LineDraft {
  key: number;
  itemId: number;
  quantity: number;
  unitCost: number;
  destination: Destination;
}

let lineKey = 1;
function newLine(): LineDraft {
  return { key: lineKey++, itemId: 0, quantity: 1, unitCost: 0, destination: "INVENTORY" };
}

function money(value: number): string {
  return value.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ReturnsPage() {
  const [tab, setTab] = useState<Tab>("sales");
  const [salesReturns, setSalesReturns] = useState<Record<string, unknown>[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<Record<string, unknown>[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [partyId, setPartyId] = useState(0);
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([newLine()]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const addedLine = useRef(false);

  async function refresh() {
    try {
      setSalesReturns(await api.salesReturns());
      setPurchaseReturns(await api.purchaseReturns());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load returns.");
    }
  }

  const pageVisible = usePageVisible();

  useEffect(() => {
    void refresh();
    void api.items().then(setItems).catch(() => undefined);
  }, [pageVisible]);

  useEffect(() => {
    setPartyId(0);
    void api
      .parties({ type: tab === "sales" ? "CUSTOMER" : "SUPPLIER" })
      .then(setParties)
      .catch(() => undefined);
  }, [tab, pageVisible]);

  function resetForm() {
    setEditingId(null);
    setPartyId(0);
    setReturnDate(new Date().toISOString().slice(0, 10));
    setNotes("");
    setLines([newLine()]);
    setShowForm(false);
  }

  function switchTab(next: Tab) {
    setTab(next);
    resetForm();
  }

  function updateLine(key: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!partyId) {
      setError(tab === "sales" ? "Select a customer." : "Select a supplier.");
      return;
    }
    const payload = lines.filter((line) => line.itemId > 0 && line.quantity > 0);
    if (payload.length === 0) {
      setError("Add at least one item.");
      return;
    }
    const body: ReturnBody = {
      partyId,
      returnDate,
      notes: notes.trim() || null,
      items: payload.map((line) => ({
        itemId: line.itemId,
        quantity: line.quantity,
        unitCost: line.unitCost,
        ...(tab === "sales" ? { destination: line.destination } : {}),
      })),
    };
    setBusy(true);
    try {
      const result =
        editingId != null
          ? tab === "sales"
            ? await api.updateSalesReturn(editingId, body)
            : await api.updatePurchaseReturn(editingId, body)
          : tab === "sales"
            ? await api.createSalesReturn(body)
            : await api.createPurchaseReturn(body);
      setNotice(
        `${editingId != null ? "Updated" : "Created"} ${result.returnNumber} for ${money(result.totalAmount)}`,
      );
      resetForm();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save the return.");
    } finally {
      setBusy(false);
    }
  }

  async function startEdit(row: Record<string, unknown>): Promise<void> {
    setError(null);
    setNotice(null);
    try {
      const id = Number(row.id);
      const detail = tab === "sales" ? await api.salesReturn(id) : await api.purchaseReturn(id);
      setEditingId(id);
      setPartyId(Number(detail.return.party_id));
      setReturnDate(String(detail.return.return_date));
      setNotes(String(detail.return.notes ?? ""));
      setLines(
        detail.items.map((item) => ({
          key: lineKey++,
          itemId: Number(item.item_id),
          quantity: Number(item.quantity),
          unitCost: Number(item.unit_cost),
          destination: (item.destination === "WASTE" ? "WASTE" : "INVENTORY") as Destination,
        })),
      );
      setShowForm(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load the return.");
    }
  }

  async function remove(row: Record<string, unknown>): Promise<void> {
    if (!window.confirm(`Delete return ${String(row.return_number ?? "")}? Stock and accounting are reversed.`)) {
      return;
    }
    setError(null);
    setNotice(null);
    try {
      const id = Number(row.id);
      if (tab === "sales") await api.deleteSalesReturn(id);
      else await api.deletePurchaseReturn(id);
      setNotice(`Return ${String(row.return_number ?? "")} deleted.`);
      if (editingId === id) resetForm();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete the return.");
    }
  }

  const rows = tab === "sales" ? salesReturns : purchaseReturns;
  const total = lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);

  const formFields = (
    <>
      <h2>{editingId != null ? "Edit return" : `New ${tab === "sales" ? "sales" : "purchase"} return`}</h2>
      <div className="row">
        <div>
          <label>{tab === "sales" ? "Customer" : "Supplier"}</label>
          <SearchableSelect
            value={String(partyId)}
            onChange={(next) => setPartyId(Number(next))}
            placeholder={tab === "sales" ? "Select customer..." : "Select supplier..."}
            options={[
              { value: "0", label: tab === "sales" ? "Select customer..." : "Select supplier..." },
              ...parties.map((party) => ({ value: String(party.id), label: `${party.name} (${party.code})` })),
            ]}
          />
        </div>
        <div>
          <label>Date</label>
          <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <label>Note (shown in party ledger)</label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. damaged boxes returned"
          style={{ width: "100%" }}
        />
      </div>

      <table style={{ marginTop: 16 }} onKeyDown={moveRowFocus}>
        <thead>
          <tr>
            <th>Item</th>
            <th className="num">Qty</th>
            <th className="num">Unit cost</th>
            {tab === "sales" && <th>Destination</th>}
            <th className="num">Line total</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.key}>
              <td>
                <SearchableSelect
                  value={String(line.itemId)}
                  autoFocus={addedLine.current && line.key === lines.at(-1)?.key}
                  onChange={(next) => updateLine(line.key, { itemId: Number(next) })}
                  placeholder="Select item..."
                  options={[
                    { value: "0", label: "Select item..." },
                    ...items.map((item) => ({ value: String(item.id), label: item.item_name })),
                  ]}
                />
              </td>
              <td className="num">
                <NumberInput
                  min="0"
                  step="0.001"
                  value={line.quantity}
                  onChange={(e) => updateLine(line.key, { quantity: Number(e.target.value) })}
                  style={{ width: 90 }}
                />
              </td>
              <td className="num">
                <NumberInput
                  min="0"
                  step="0.01"
                  value={line.unitCost}
                  onChange={(e) => updateLine(line.key, { unitCost: Number(e.target.value) })}
                  style={{ width: 120 }}
                />
              </td>
              {tab === "sales" && (
                <td>
                  <SearchableSelect
                    value={line.destination}
                    onChange={(next) =>
                      updateLine(line.key, { destination: next as Destination })
                    }
                    options={[
                      { value: "INVENTORY", label: "Add to inventory" },
                      { value: "WASTE", label: "Waste" },
                    ]}
                  />
                </td>
              )}
              <td className="num">{money(line.quantity * line.unitCost)}</td>
              <td>
                <button
                  type="button"
                  onClick={() => setLines((prev) => prev.filter((item) => item.key !== line.key))}
                  disabled={lines.length === 1}
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="row" style={{ marginTop: 14, justifyContent: "space-between" }}>
        <button
          type="button"
          onClick={() => {
            addedLine.current = true;
            setLines((prev) => [...prev, newLine()]);
          }}
        >
          Add line
        </button>
        <div>
          <strong style={{ marginRight: 16 }}>Total: {money(total)}</strong>
          {(editingId != null || showForm) && (
            <button type="button" style={{ marginRight: 8 }} onClick={resetForm}>
              Cancel
            </button>
          )}
          <button className="primary" type="submit" disabled={busy}>
            {busy ? "Saving..." : editingId != null ? "Save changes" : "Create return"}
          </button>
        </div>
      </div>
      {tab === "sales" && (
        <p className="sub" style={{ color: "#adb5bd", fontSize: 13 }}>
          Inventory lines go back into stock. Waste lines stay out of stock and post to Wastage
          Expense. The party is credited in Accounts Receivable.
        </p>
      )}
    </>
  );

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Returns</h2>
          <div className="row">
            <button className={tab === "sales" ? "primary" : ""} onClick={() => switchTab("sales")}>
              Sales Returns
            </button>
            <button className={tab === "purchase" ? "primary" : ""} onClick={() => switchTab("purchase")}>
              Purchase Returns
            </button>
            <button className="primary" onClick={() => (showForm ? resetForm() : setShowForm(true))}>
              {showForm ? "Close" : "New return"}
            </button>
          </div>
        </div>
        {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
        {notice && <div className="badge" style={{ display: "inline-block", marginTop: 12 }}>{notice}</div>}
      </div>

      {showForm && (
        <form className="card" onSubmit={submit}>
          {formFields}
        </form>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Return</th>
              <th>{tab === "sales" ? "Customer" : "Supplier"}</th>
              <th>Date</th>
              <th className="num">Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.id)}>
                <td>{String(row.return_number ?? "")}</td>
                <td>{String(row.party_name ?? "")}</td>
                <td>{formatDate(String(row.return_date ?? ""))}</td>
                <td className="num">{money(Number(row.total_amount ?? 0))}</td>
                <td>
                  <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                    <button type="button" onClick={() => void startEdit(row)}>
                      Edit
                    </button>
                    <button type="button" onClick={() => void remove(row)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5}>No returns recorded yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
