import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import type { Item, TaxRate } from "../types";
import { ITEM_TYPES, ITEM_UNITS } from "../types";

interface Draft {
  itemName: string;
  itemCode: string;
  unit: string;
  itemType: string;
  purchasePrice: number;
  sellingPrice: number;
  minimumStock: number;
  maximumStock: number;
  taxRateId: number | null;
  notes: string;
  isActive: boolean;
}

const EMPTY_DRAFT: Draft = {
  itemName: "",
  itemCode: "",
  unit: "UNIT",
  itemType: "FINISHED_GOOD",
  purchasePrice: 0,
  sellingPrice: 0,
  minimumStock: 0,
  maximumStock: 0,
  taxRateId: null,
  notes: "",
  isActive: true,
};

function money(value: number): string {
  return value.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function message(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editing, setEditing] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh(): Promise<void> {
    try {
      const [itemList, rates] = await Promise.all([
        api.items({
          search: search || undefined,
          type: (typeFilter || undefined) as Item["item_type"] | undefined,
          activeOnly: !showInactive,
        }),
        api.taxRates(),
      ]);
      setItems(itemList);
      setTaxRates(rates);
    } catch (err) {
      setError(message(err, "Failed to load items."));
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, typeFilter, showInactive]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]): void {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function startEdit(item: Item): void {
    setEditing(item);
    setError(null);
    setNotice(null);
    setDraft({
      itemName: item.item_name,
      itemCode: item.item_code,
      unit: item.unit,
      itemType: item.item_type,
      purchasePrice: item.purchase_price,
      sellingPrice: item.selling_price,
      minimumStock: item.minimum_stock,
      maximumStock: item.maximum_stock,
      taxRateId: item.tax_rate_id,
      notes: item.notes ?? "",
      isActive: item.is_active === 1,
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
    if (!draft.itemName.trim()) {
      setError("Item name is required.");
      return;
    }
    setBusy(true);
    try {
      const common = {
        itemName: draft.itemName.trim(),
        unit: draft.unit,
        itemType: draft.itemType as Item["item_type"],
        purchasePrice: draft.purchasePrice,
        sellingPrice: draft.sellingPrice,
        minimumStock: draft.minimumStock,
        maximumStock: draft.maximumStock,
        taxRateId: draft.taxRateId,
        notes: draft.notes || null,
      };
      if (editing) {
        await api.updateItem(editing.id, { ...common, isActive: draft.isActive });
        setNotice(`Updated ${editing.item_code}.`);
      } else {
        const created = await api.createItem({
          ...common,
          itemCode: draft.itemCode.trim() || null,
        });
        setNotice(`Created ${created.item_code} — ${created.item_name}.`);
      }
      cancel();
    } catch (err) {
      setError(message(err, "Failed to save the item."));
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(item: Item): Promise<void> {
    setError(null);
    setNotice(null);
    try {
      await api.deactivateItem(item.id);
      setNotice(`Deactivated ${item.item_code}.`);
      await refresh();
    } catch (err) {
      setError(message(err, "Failed to deactivate the item."));
    }
  }

  return (
    <>
      <div className="card">
        <div className="row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
          <h2 style={{ flex: 1, margin: 0 }}>Items</h2>
          <div>
            <label>Search</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div>
            <label>Type</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All types</option>
              {ITEM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
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
              <th>Unit</th>
              <th className="num">Purchase</th>
              <th className="num">Selling</th>
              <th className="num">Min / Max</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.item_code}</td>
                <td>{item.item_name}</td>
                <td>{item.item_type}</td>
                <td>{item.unit}</td>
                <td className="num">{money(item.purchase_price)}</td>
                <td className="num">{money(item.selling_price)}</td>
                <td className="num">
                  {item.minimum_stock} / {item.maximum_stock}
                </td>
                <td>
                  <span className="badge">{item.is_active ? "Active" : "Inactive"}</span>
                </td>
                <td>
                  <button onClick={() => startEdit(item)}>Edit</button>{" "}
                  {item.is_active === 1 && (
                    <button onClick={() => void deactivate(item)}>Deactivate</button>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && !error && (
              <tr>
                <td colSpan={9}>No items match the current filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form className="card" onSubmit={submit}>
        <h2>{editing ? `Edit item — ${editing.item_code}` : "Add item"}</h2>
        <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label>Item code (blank = auto)</label>
            <input
              value={draft.itemCode}
              onChange={(e) => set("itemCode", e.target.value)}
              disabled={Boolean(editing)}
              placeholder="ITEM-00001"
            />
          </div>
          <div>
            <label>Name</label>
            <input value={draft.itemName} onChange={(e) => set("itemName", e.target.value)} />
          </div>
          <div>
            <label>Type</label>
            <select value={draft.itemType} onChange={(e) => set("itemType", e.target.value)}>
              {ITEM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Unit</label>
            <select value={draft.unit} onChange={(e) => set("unit", e.target.value)}>
              {ITEM_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Purchase price</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.purchasePrice}
              onChange={(e) => set("purchasePrice", Number(e.target.value))}
              style={{ width: 110 }}
            />
          </div>
          <div>
            <label>Selling price</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.sellingPrice}
              onChange={(e) => set("sellingPrice", Number(e.target.value))}
              style={{ width: 110 }}
            />
          </div>
          <div>
            <label>Min stock</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.minimumStock}
              onChange={(e) => set("minimumStock", Number(e.target.value))}
              style={{ width: 100 }}
            />
          </div>
          <div>
            <label>Max stock</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.maximumStock}
              onChange={(e) => set("maximumStock", Number(e.target.value))}
              style={{ width: 100 }}
            />
          </div>
          <div>
            <label>Tax rate</label>
            <select
              value={draft.taxRateId ?? ""}
              onChange={(e) => set("taxRateId", e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">None</option>
              {taxRates.map((rate) => (
                <option key={rate.id} value={rate.id}>
                  {rate.name} ({rate.rate_percent}%)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Notes</label>
            <input value={draft.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
          {editing && (
            <div>
              <label>Status</label>
              <select
                value={draft.isActive ? "1" : "0"}
                onChange={(e) => set("isActive", e.target.value === "1")}
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </div>
          )}
          <button className="primary" type="submit" disabled={busy}>
            {editing ? "Save changes" : "Add item"}
          </button>
          {editing && (
            <button type="button" onClick={cancel}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </>
  );
}
