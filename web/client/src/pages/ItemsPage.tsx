import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import SearchableSelect from "../components/SearchableSelect";
import type { Item, Party, TaxRate } from "../types";
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

  // The add/edit form sits below the (unpaginated) table, so editing a row
  // near the top would otherwise leave the form off-screen and look inert.
  const editFormRef = useRef<HTMLFormElement>(null);
  const itemNameRef = useRef<HTMLInputElement>(null);

  // Opening stock
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [stockItemId, setStockItemId] = useState<number | null>(null);
  const [stockQty, setStockQty] = useState(0);
  const [stockCost, setStockCost] = useState(0);
  const [stockBatch, setStockBatch] = useState("");
  const [stockExpiry, setStockExpiry] = useState("");
  const [stockPartyId, setStockPartyId] = useState<number | null>(null);

  async function refresh(): Promise<void> {
    try {
      const [itemList, rates, supplierList] = await Promise.all([
        api.items({
          search: search || undefined,
          type: (typeFilter || undefined) as Item["item_type"] | undefined,
          activeOnly: !showInactive,
        }),
        api.taxRates(),
        api.parties({ type: "SUPPLIER" }),
      ]);
      setItems(itemList);
      setTaxRates(rates);
      setSuppliers(supplierList);
      setStockItemId((current) => current ?? itemList[0]?.id ?? null);
    } catch (err) {
      setError(message(err, "Failed to load items."));
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, typeFilter, showInactive]);

  // Bring the form into view (and focus the name) when a row is edited.
  useEffect(() => {
    if (!editing) return;
    editFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    itemNameRef.current?.focus();
  }, [editing]);

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

  async function submitOpeningStock(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (stockItemId == null) {
      setError("Select an item.");
      return;
    }
    if (stockQty <= 0) {
      setError("Quantity must be greater than 0.");
      return;
    }
    setBusy(true);
    try {
      const result = await api.addOpeningStock(stockItemId, {
        quantity: stockQty,
        unitCost: stockCost,
        batchNumber: stockBatch.trim() || null,
        expiryDate: stockExpiry || null,
        partyId: stockPartyId,
      });
      setNotice(
        `Opening stock ${result.batchNumber}: ${stockQty} unit(s), value ${money(result.totalValue)}` +
          (result.journalEntryId ? " (posted to the ledger)" : ""),
      );
      setStockQty(0);
      setStockBatch("");
      setStockExpiry("");
      await refresh();
    } catch (err) {
      setError(message(err, "Failed to add opening stock."));
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
            <input
              data-search
              className="filter-box"
              placeholder="Search name or code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label>Type</label>
            <SearchableSelect
              value={typeFilter}
              onChange={setTypeFilter}
              placeholder="All types"
              options={[
                { value: "", label: "All types" },
                ...ITEM_TYPES.map((t) => ({ value: t, label: t })),
              ]}
            />
          </div>
          <div>
            <label>Show</label>
            <SearchableSelect
              value={showInactive ? "all" : "active"}
              onChange={(next) => setShowInactive(next === "all")}
              placeholder="Active only"
              options={[
                { value: "active", label: "Active only" },
                { value: "all", label: "Include inactive" },
              ]}
            />
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
              <th className="num">Stock</th>
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
                <td className="num">
                  {item.current_stock} {item.unit}
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
                <td colSpan={10}>No items match the current filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form className="card" onSubmit={submitOpeningStock}>
        <h2>Opening stock</h2>
        <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label>Item</label>
            <SearchableSelect
              value={stockItemId === null ? "" : String(stockItemId)}
              onChange={(next) => setStockItemId(next ? Number(next) : null)}
              placeholder="Select…"
              options={[
                { value: "", label: "Select…" },
                ...items.map((item) => ({
                  value: String(item.id),
                  label: `${item.item_code} — ${item.item_name}`,
                })),
              ]}
            />
          </div>
          <div>
            <label>Quantity</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={stockQty}
              onChange={(e) => setStockQty(Number(e.target.value))}
              style={{ width: 110 }}
            />
          </div>
          <div>
            <label>Unit cost</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={stockCost}
              onChange={(e) => setStockCost(Number(e.target.value))}
              style={{ width: 110 }}
            />
          </div>
          <div>
            <label>Batch number (blank = auto)</label>
            <input
              value={stockBatch}
              onChange={(e) => setStockBatch(e.target.value)}
              placeholder="OPEN-…"
            />
          </div>
          <div>
            <label>Expiry</label>
            <input
              type="date"
              value={stockExpiry}
              onChange={(e) => setStockExpiry(e.target.value)}
            />
          </div>
          <div>
            <label>Supplier (credits A/P)</label>
            <SearchableSelect
              value={stockPartyId === null ? "" : String(stockPartyId)}
              onChange={(next) => setStockPartyId(next ? Number(next) : null)}
              placeholder="None — stock only"
              options={[
                { value: "", label: "None — stock only" },
                ...suppliers.map((party) => ({
                  value: String(party.id),
                  label: `${party.code} — ${party.name}`,
                })),
              ]}
            />
          </div>
          <button className="primary" type="submit" disabled={busy}>
            Add opening stock
          </button>
        </div>
        <p style={{ opacity: 0.7, fontSize: 12, marginBottom: 0 }}>
          Value {money(stockQty * stockCost)}. With a supplier the value is posted as an OPENING
          entry (Dr inventory / Cr A/P); without one only the batch and stock movement are created.
        </p>
      </form>

      <form className="card" ref={editFormRef} onSubmit={submit}>
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
            <input
              ref={itemNameRef}
              value={draft.itemName}
              onChange={(e) => set("itemName", e.target.value)}
            />
          </div>
          <div>
            <label>Type</label>
            <SearchableSelect
              value={draft.itemType}
              onChange={(next) => set("itemType", next)}
              placeholder="Type"
              options={ITEM_TYPES.map((t) => ({ value: t, label: t }))}
            />
          </div>
          <div>
            <label>Unit</label>
            <SearchableSelect
              value={draft.unit}
              onChange={(next) => set("unit", next)}
              placeholder="Unit"
              options={ITEM_UNITS.map((u) => ({ value: u, label: u }))}
            />
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
            <SearchableSelect
              value={draft.taxRateId === null ? "" : String(draft.taxRateId)}
              onChange={(next) => set("taxRateId", next ? Number(next) : null)}
              placeholder="None"
              options={[
                { value: "", label: "None" },
                ...taxRates.map((rate) => ({
                  value: String(rate.id),
                  label: `${rate.name} (${rate.rate_percent}%)`,
                })),
              ]}
            />
          </div>
          <div>
            <label>Notes</label>
            <input value={draft.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
          {editing && (
            <div>
              <label>Status</label>
              <SearchableSelect
                value={draft.isActive ? "1" : "0"}
                onChange={(next) => set("isActive", next === "1")}
                placeholder="Active"
                options={[
                  { value: "1", label: "Active" },
                  { value: "0", label: "Inactive" },
                ]}
              />
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
