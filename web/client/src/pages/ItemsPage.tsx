import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import NumberInput from "../components/NumberInput";
import ItemTagsDialog from "../components/ItemTagsDialog";
import SearchableSelect from "../components/SearchableSelect";
import { SortTh, sortRows, type SortState } from "../components/Sort";
import { saveBlob } from "../lib/download";
import { usePageVisible } from "../lib/pageVisibility";
import type {
  Item,
  ItemConsumption,
  Party,
  StockLedgerReset,
  StockValueEntry,
  TaxRate,
} from "../types";
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

/** Default a correction to the first of the current month (the clean cutover). */
function firstOfMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function ItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [stockFilter, setStockFilter] = useState<"" | "in" | "zero">("");
  const [showInactive, setShowInactive] = useState(false);
  const [sort, setSort] = useState<SortState | null>(null);
  const [tagsOpen, setTagsOpen] = useState(false);

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editing, setEditing] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

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

  // "Stock value correction": per-item qty on hand + unit cost, one dated entry.
  const [stockFixes, setStockFixes] = useState<Record<number, { qty: number; cost: number }>>({});
  const [stockDate, setStockDate] = useState(firstOfMonth());
  const [stockAllItems, setStockAllItems] = useState(false);
  const [stockSearch, setStockSearch] = useState("");
  const [stockValueEntries, setStockValueEntries] = useState<StockValueEntry[]>([]);
  const [consumption, setConsumption] = useState<ItemConsumption[]>([]);

  // Stock ledger reset (clear every batch quantity, reversibly)
  const [ledgerResets, setLedgerResets] = useState<StockLedgerReset[]>([]);
  const [zeroReason, setZeroReason] = useState("");
  const [ledgerBusy, setLedgerBusy] = useState(false);

  async function refresh(): Promise<void> {
    try {
      const [itemList, rates, supplierList, resets, everyItem, runs, corrections] =
        await Promise.all([
          api.items({
            search: search || undefined,
            type: (typeFilter || undefined) as Item["item_type"] | undefined,
            activeOnly: !showInactive,
          }),
          api.taxRates(),
          api.parties({ type: "SUPPLIER" }),
          api.stockLedgerResets(),
          api.items({ activeOnly: true }),
          api.consumptionHistory(),
          api.stockValues(),
        ]);
      setItems(itemList);
      setTaxRates(rates);
      setSuppliers(supplierList);
      setLedgerResets(resets);
      setAllItems(everyItem);
      setConsumption(runs);
      setStockValueEntries(corrections);
      setStockItemId((current) => current ?? itemList[0]?.id ?? null);
    } catch (err) {
      setError(message(err, "Failed to load items."));
    }
  }

  const pageVisible = usePageVisible();

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, typeFilter, showInactive, pageVisible]);

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

  /**
   * Posts the rows the operator filled in. A row counts when it has a unit cost
   * and either a positive on-hand qty or a currently-negative balance (0 is a
   * valid target that zeroes the negative).
   */
  async function submitStockValues(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!stockDate) {
      setError("Choose a correction date.");
      return;
    }
    const entries = stockBaseItems
      .map((item) => {
        const fix = stockFixes[item.id];
        return {
          itemId: item.id,
          quantityOnHand: fix?.qty ?? 0,
          unitCost: fix?.cost ?? 0,
          current: item.current_stock,
        };
      })
      .filter(
        (entry) => entry.unitCost > 0 && (entry.quantityOnHand > 0 || entry.current < 0),
      );
    if (entries.length === 0) {
      setError("Enter qty on hand and unit cost for at least one item.");
      return;
    }
    setBusy(true);
    try {
      const result = await api.setStockValues({
        entryDate: stockDate,
        entries: entries.map(({ itemId, quantityOnHand, unitCost }) => ({
          itemId,
          quantityOnHand,
          unitCost,
        })),
      });
      setNotice(
        `Saved correction #${result.entryId} dated ${stockDate}: ` +
          `${result.entries.length} item(s), value ${money(result.totalValue)}.`,
      );
      setStockFixes({});
      await refresh();
    } catch (err) {
      setError(message(err, "Failed to save stock values."));
    } finally {
      setBusy(false);
    }
  }

  /** Undo a saved correction (the server refuses once its stock has moved). */
  async function undoStockValue(entry: StockValueEntry): Promise<void> {
    if (
      !window.confirm(
        `Undo correction #${entry.id} dated ${entry.entry_date}?\n\n` +
          "Its stock is removed and the journal entry is reversed. Refused if the stock has already moved.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.reverseStockValues(entry.id);
      setNotice(`Undid correction #${entry.id}.`);
      await refresh();
    } catch (err) {
      setError(message(err, "Failed to undo the correction."));
    } finally {
      setBusy(false);
    }
  }

  /** Undo, then load the same values into the form so they can be corrected. */
  async function editStockValue(entry: StockValueEntry): Promise<void> {
    if (
      !window.confirm(
        `Undo correction #${entry.id} and load its values for editing?\n\n` +
          "The stock is removed, the entry is reversed, and the values return to the form.",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.reverseStockValues(entry.id);
      await refresh();
      setStockDate(entry.entry_date);
      setStockAllItems(true);
      setStockSearch("");
      const next: Record<number, { qty: number; cost: number }> = {};
      for (const line of entry.lines) {
        next[line.item_id] = { qty: line.quantity_on_hand, cost: line.unit_cost };
      }
      setStockFixes(next);
      setNotice(`Correction #${entry.id} reversed and loaded. Adjust and save.`);
    } catch (err) {
      setError(message(err, "Failed to load the correction for editing."));
    } finally {
      setBusy(false);
    }
  }

  function setStockFix(id: number, key: "qty" | "cost", value: number): void {
    setStockFixes((current) => ({
      ...current,
      [id]: { qty: 0, cost: 0, ...current[id], [key]: value },
    }));
  }

  /**
   * Zero every batch quantity. The server snapshots the database first, so the
   * reset is always recoverable from the history below. Stock only — the
   * accounting side of a stock rewrite is a separate dated adjustment.
   */
  async function zeroStockLedger(): Promise<void> {
    const confirmed = window.confirm(
      "Zero out the stock ledger?\n\n" +
        "Every batch quantity becomes 0. A database snapshot is taken first and this " +
        "reset can be undone from the history below.\n\n" +
        "No journal entry is posted — only stock changes.",
    );
    if (!confirmed) return;
    setLedgerBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.zeroStockLedger(zeroReason.trim() || null);
      setNotice(
        `Zeroed ${result.batchCount} batch(es) worth ${money(result.totalValue)}. ` +
          `Snapshot: ${result.snapshotFile ?? "—"}.`,
      );
      setZeroReason("");
      await refresh();
    } catch (err) {
      setError(message(err, "Failed to zero the stock ledger."));
    } finally {
      setLedgerBusy(false);
    }
  }

  /** Undo a reset: each batch gets its recorded quantity back. */
  async function restoreStockLedger(reset: StockLedgerReset): Promise<void> {
    const confirmed = window.confirm(
      `Restore the stock ledger to before ${reset.created_at}?\n\n` +
        "Each batch gets its recorded quantity back. Do this BEFORE loading a new stock " +
        "count, otherwise the restored batches are counted twice.",
    );
    if (!confirmed) return;
    setLedgerBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.restoreStockLedger(reset.id);
      setNotice(`Restored ${result.batchCount} batch(es).`);
      await refresh();
    } catch (err) {
      setError(message(err, "Failed to restore the stock ledger."));
    } finally {
      setLedgerBusy(false);
    }
  }

  /**
   * Download the inventory report as .xlsx. The workbook is built from the same
   * filters the table is showing, so the file and the screen agree.
   */
  async function exportInventory(): Promise<void> {
    setExporting(true);
    setError(null);
    setNotice(null);
    try {
      const blob = await api.inventoryXlsx({
        search: search || undefined,
        type: (typeFilter || undefined) as Item["item_type"] | undefined,
        activeOnly: !showInactive,
        stock: stockFilter || undefined,
      });
      saveBlob(blob, `inventory_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      setError(message(err, "Excel export failed."));
    } finally {
      setExporting(false);
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

  const stockMatches = (item: Item): boolean =>
    stockFilter === "" || (stockFilter === "zero" ? item.current_stock === 0 : item.current_stock !== 0);
  const visibleItems = items.filter(stockMatches);

  /** Tags present on the loaded rows, so the filter needs no extra call. */
  const tagOptions = [
    ...new Set(items.flatMap((item) => (item.tags ? item.tags.split(", ") : []))),
  ].sort((a, b) => a.localeCompare(b));
  const taggedItems = visibleItems.filter(
    (item) => tagFilter === "" || (item.tags ?? "").split(", ").includes(tagFilter),
  );

  const sortedItems = sortRows(taggedItems, sort, (item, key) => {
    switch (key) {
      case "code":
        return item.item_code;
      case "name":
        return item.item_name;
      case "type":
        return item.item_type;
      case "purchase":
        return item.purchase_price;
      case "selling":
        return item.selling_price;
      case "stock":
        return item.current_stock;
      default:
        return "";
    }
  });

  /** Unfiltered so the correction card does not shrink when the list above is searched. */
  const negativeItems = allItems.filter((item) => item.current_stock < 0);
  const stockBaseItems = stockAllItems ? allItems : negativeItems;
  const stockQuery = stockSearch.trim().toLowerCase();
  const stockVisibleItems = stockQuery
    ? stockBaseItems.filter(
        (item) =>
          item.item_name.toLowerCase().includes(stockQuery) ||
          item.item_code.toLowerCase().includes(stockQuery),
      )
    : stockBaseItems;
  const stockItemName = (id: number): string =>
    allItems.find((item) => item.id === id)?.item_name ?? String(id);
  /** Runs arrive oldest first, so each item's list keeps that order. */
  const consumptionByItem = new Map<number, ItemConsumption[]>();
  for (const run of consumption) {
    const list = consumptionByItem.get(run.item_id);
    if (list) list.push(run);
    else consumptionByItem.set(run.item_id, [run]);
  }
  const stockFixesTotal = stockBaseItems.reduce((total, item) => {
    const fix = stockFixes[item.id];
    if (!fix || fix.cost <= 0) return total;
    if (fix.qty <= 0 && item.current_stock >= 0) return total;
    return total + (fix.qty - item.current_stock) * fix.cost;
  }, 0);

  return (
    <>
      <div className="card">
        <div className="row" style={{ alignItems: "flex-end", flexWrap: "wrap" }}>
          <h2 style={{ flex: 1, margin: 0 }}>Inventory</h2>
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
            <label>Tag</label>
            <SearchableSelect
              value={tagFilter}
              onChange={setTagFilter}
              placeholder="All tags"
              options={[
                { value: "", label: "All tags" },
                ...tagOptions.map((tag) => ({ value: tag, label: tag })),
              ]}
            />
          </div>
          <div>
            <label>Stock</label>
            <SearchableSelect
              value={stockFilter}
              onChange={(next) => setStockFilter(next as "" | "in" | "zero")}
              placeholder="All stock"
              options={[
                { value: "", label: "All stock" },
                { value: "in", label: "In stock (non-zero)" },
                { value: "zero", label: "Zero stock" },
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
          <button
            type="button"
            onClick={() => setTagsOpen(true)}
            title="Assign tags (e.g. bottle) to many products at once"
          >
            Tags
          </button>
          <button
            type="button"
            onClick={() => void exportInventory()}
            disabled={exporting}
            title="Download the items shown above as an Excel workbook (id, code, name, stock…)"
          >
            {exporting ? "Preparing…" : "Export Excel"}
          </button>
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
              <SortTh label="Code" sortKey="code" sort={sort} setSort={setSort} />
              <SortTh label="Name" sortKey="name" sort={sort} setSort={setSort} />
              <SortTh label="Type" sortKey="type" sort={sort} setSort={setSort} />
              <th>Unit</th>
              <SortTh label="Purchase" sortKey="purchase" sort={sort} setSort={setSort} className="num" />
              <SortTh label="Selling" sortKey="selling" sort={sort} setSort={setSort} className="num" />
              <th className="num">Min / Max</th>
              <SortTh label="Stock" sortKey="stock" sort={sort} setSort={setSort} className="num" />
              <th>Tags</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item) => (
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
                  {(item.tags ? item.tags.split(", ") : []).map((tag) => (
                    <span className="badge" key={tag} style={{ marginRight: 4 }}>
                      {tag}
                    </span>
                  ))}
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
            {taggedItems.length === 0 && !error && (
              <tr>
                <td colSpan={11}>No items match the current filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form className="card" onSubmit={submitStockValues}>
        <h2>Stock value correction</h2>
        <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label>Correction date</label>
            <input
              type="date"
              value={stockDate}
              onChange={(e) => setStockDate(e.target.value)}
            />
          </div>
          <div>
            <label>Find item</label>
            <input
              className="filter-box"
              placeholder="Search name or code…"
              value={stockSearch}
              onChange={(e) => setStockSearch(e.target.value)}
            />
          </div>
          <label style={{ paddingBottom: 7 }}>
            <input
              type="checkbox"
              checked={stockAllItems}
              onChange={(e) => setStockAllItems(e.target.checked)}
            />{" "}
            Show all items (stock take)
          </label>
        </div>
        <p style={{ opacity: 0.7, fontSize: 12 }}>
          Enter what you actually have and what it cost. Each saved correction is dated, posted as
          inventory against Retained Earnings (your supplier ledger is not touched), and listed
          below where it can be undone. This only adds stock — it cannot reduce a positive balance.
        </p>

        {stockBaseItems.length === 0 ? (
          <p style={{ opacity: 0.7, fontSize: 12, marginBottom: 0 }}>
            No items are below zero. Tick “Show all items” for a full stock take.
          </p>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="num">Current</th>
                  <th className="num">Qty on hand</th>
                  <th className="num">Unit cost</th>
                  <th className="num">Value</th>
                  <th>Used in</th>
                </tr>
              </thead>
              <tbody>
                {stockVisibleItems.map((item) => {
                  const fix = stockFixes[item.id];
                  const qty = fix?.qty ?? 0;
                  const cost = fix?.cost ?? 0;
                  const value =
                    cost > 0 && (qty > 0 || item.current_stock < 0)
                      ? (qty - item.current_stock) * cost
                      : 0;
                  return (
                    <tr key={item.id}>
                      <td>
                        {item.item_code} — {item.item_name}
                      </td>
                      <td className="num">
                        {item.current_stock} {item.unit}
                      </td>
                      <td className="num">
                        <NumberInput
                          min="0"
                          step="0.01"
                          value={qty}
                          onChange={(e) => setStockFix(item.id, "qty", Number(e.target.value))}
                          style={{ width: 100 }}
                        />
                      </td>
                      <td className="num">
                        <NumberInput
                          min="0"
                          step="0.01"
                          value={cost}
                          onChange={(e) => setStockFix(item.id, "cost", Number(e.target.value))}
                          style={{ width: 100 }}
                        />
                      </td>
                      <td className="num">{money(value)}</td>
                      <td style={{ fontSize: 12, lineHeight: 1.4 }}>
                        {(consumptionByItem.get(item.id) ?? []).length === 0
                          ? "—"
                          : (consumptionByItem.get(item.id) ?? []).map((run, index) => (
                              <div key={index}>
                                {run.order_number} · {run.manufacturing_date} ·{" "}
                                {run.quantity_consumed} {item.unit}
                              </div>
                            ))}
                      </td>
                    </tr>
                  );
                })}
                {stockVisibleItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className="sub">
                      No items match this search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="row" style={{ alignItems: "center", marginTop: 8 }}>
              <strong>Total value: {money(stockFixesTotal)}</strong>
              <button className="primary" type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save correction"}
              </button>
            </div>
          </>
        )}

        <h3 style={{ marginTop: 20 }}>Saved corrections</h3>
        {stockValueEntries.length === 0 ? (
          <p className="sub" style={{ marginBottom: 0 }}>
            No corrections saved yet.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th className="num">Items</th>
                <th className="num">Value</th>
                <th>Voucher</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {stockValueEntries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.entry_date}</td>
                  <td
                    className="num"
                    title={entry.lines.map((line) => stockItemName(line.item_id)).join(", ")}
                  >
                    {entry.lines.length}
                  </td>
                  <td className="num">{money(entry.total_value)}</td>
                  <td>{entry.journal_entry_id ?? "—"}</td>
                  <td>
                    {entry.reversed_at ? (
                      <span className="badge">Reversed {entry.reversed_at}</span>
                    ) : (
                      <span className="badge">Active</span>
                    )}
                  </td>
                  <td>
                    {!entry.reversed_at && (
                      <>
                        <button
                          type="button"
                          onClick={() => void editStockValue(entry)}
                          disabled={busy}
                        >
                          Edit
                        </button>{" "}
                        <button
                          type="button"
                          onClick={() => void undoStockValue(entry)}
                          disabled={busy}
                        >
                          Undo
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </form>

      <section className="card">
        <h2>Stock ledger</h2>
        <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <label>Reason (optional)</label>
            <input
              value={zeroReason}
              onChange={(e) => setZeroReason(e.target.value)}
              placeholder="31 Oct stock count"
            />
          </div>
          <button
            type="button"
            onClick={() => void zeroStockLedger()}
            disabled={ledgerBusy}
            title="Set every batch quantity to 0 — a snapshot is taken first and the reset can be undone"
          >
            {ledgerBusy ? "Working…" : "Zero out stock ledger"}
          </button>
        </div>
        <p style={{ opacity: 0.7, fontSize: 12 }}>
          Clears every batch quantity. A database snapshot is taken first, and the reset is listed
          below where it can be undone. No journal entry is posted — stock only.
        </p>
        {ledgerResets.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Reason</th>
                <th className="num">Batches</th>
                <th className="num">Value</th>
                <th>Snapshot</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ledgerResets.map((reset) => (
                <tr key={reset.id}>
                  <td>{reset.created_at}</td>
                  <td>{reset.reason ?? "—"}</td>
                  <td className="num">{reset.batch_count}</td>
                  <td className="num">{money(reset.total_value)}</td>
                  <td>{reset.snapshot_file ?? "—"}</td>
                  <td>
                    {reset.restored_at ? (
                      <span className="badge">Restored {reset.restored_at}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void restoreStockLedger(reset)}
                        disabled={ledgerBusy}
                      >
                        Restore
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

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
            <NumberInput
              min="0"
              step="0.01"
              value={stockQty}
              onChange={(e) => setStockQty(Number(e.target.value))}
              style={{ width: 110 }}
            />
          </div>
          <div>
            <label>Unit cost</label>
            <NumberInput
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
              options={ITEM_UNITS.map((u) => ({ value: u, label: u.toLowerCase() }))}
            />
          </div>
          <div>
            <label>Purchase price</label>
            <NumberInput
              min="0"
              step="0.01"
              value={draft.purchasePrice}
              onChange={(e) => set("purchasePrice", Number(e.target.value))}
              style={{ width: 110 }}
            />
          </div>
          <div>
            <label>Selling price</label>
            <NumberInput
              min="0"
              step="0.01"
              value={draft.sellingPrice}
              onChange={(e) => set("sellingPrice", Number(e.target.value))}
              style={{ width: 110 }}
            />
          </div>
          <div>
            <label>Min stock</label>
            <NumberInput
              min="0"
              step="0.01"
              value={draft.minimumStock}
              onChange={(e) => set("minimumStock", Number(e.target.value))}
              style={{ width: 100 }}
            />
          </div>
          <div>
            <label>Max stock</label>
            <NumberInput
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

      {tagsOpen && (
        <ItemTagsDialog onClose={() => setTagsOpen(false)} onSaved={() => void refresh()} />
      )}
    </>
  );
}
