import { Fragment, useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import FilterBox, { matchesQuery } from "../components/FilterBox";
import NumberInput from "../components/NumberInput";
import SearchableSelect from "../components/SearchableSelect";
import { moveRowFocus } from "../lib/gridKeys";
import type { Bom, BomComponent, Item, ProductionOrder } from "../types";
import { defaultPackUnit, packCount, packsToBulk, PACK_UNITS } from "../lib/units";

function money(value: number): string {
  return value.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function quantity(value: number): string {
  return value.toLocaleString("en-PK", { maximumFractionDigits: 3 });
}

type Tab = "boms" | "orders";

interface ComponentDraft {
  key: number;
  itemId: number;
  quantityRequired: number;
}

let componentKey = 1;
function newComponent(): ComponentDraft {
  return { key: componentKey++, itemId: 0, quantityRequired: 1 };
}

export default function ManufacturingPage() {
  const [tab, setTab] = useState<Tab>("boms");
  const [boms, setBoms] = useState<Bom[]>([]);
  const [showHiddenBoms, setShowHiddenBoms] = useState(false);
  const [bomPhase, setBomPhase] = useState("all");
  const [bomQuery, setBomQuery] = useState("");
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // BOM form
  const [finishedItemId, setFinishedItemId] = useState(0);
  const [outputQuantity, setOutputQuantity] = useState(1);
  const [componentLines, setComponentLines] = useState<ComponentDraft[]>([newComponent()]);
  // Focus the first field of a row only when it was just added.
  const addedComponent = useRef(false);
  const [editingBomId, setEditingBomId] = useState<number | null>(null);

  // Order form
  const [bomId, setBomId] = useState(0);
  const [plannedQuantity, setPlannedQuantity] = useState(1);
  const [manufacturingDate, setManufacturingDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [ignoreStockOrders, setIgnoreStockOrders] = useState<Record<number, boolean>>({});
  const [packingOrderId, setPackingOrderId] = useState<number | null>(null);
  const [packingLines, setPackingLines] = useState<ComponentDraft[]>([newComponent()]);
  const [packBomId, setPackBomId] = useState<number | null>(null);
  const [packFinishedItemId, setPackFinishedItemId] = useState(0);
  const addedPacking = useRef(false);
  const [packPacks, setPackPacks] = useState(0);
  const [packSize, setPackSize] = useState(1);
  const [packUnit, setPackUnit] = useState<string>("KG");
  const [packItemUnit, setPackItemUnit] = useState<string>("KG");
  const [packBom, setPackBom] = useState<{ components: BomComponent[]; output: number }>({
    components: [],
    output: 1,
  });

  async function refresh() {
    try {
      setBoms(await api.boms(false));
      setOrders(await api.productionOrders());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load manufacturing data.");
    }
  }

  useEffect(() => {
    void refresh();
    void api.items({ activeOnly: false }).then(setItems).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [expandedBomId, setExpandedBomId] = useState<number | null>(null);
  const [bomComponents, setBomComponents] = useState<Record<number, BomComponent[]>>({});

  async function toggleBomComponents(id: number) {
    if (expandedBomId === id) {
      setExpandedBomId(null);
      return;
    }
    setExpandedBomId(id);
    if (!bomComponents[id]) {
      try {
        const detail = await api.bom(id);
        setBomComponents((prev) => ({ ...prev, [id]: detail.components }));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load BOM components.");
      }
    }
  }

  const itemName = (id: number) => items.find((i) => i.id === id)?.item_name ?? String(id);
  const itemUnit = (id: number) => items.find((i) => i.id === id)?.unit ?? "UNIT";

  const savedBoms = boms.filter((bom) => bom.is_temp !== 1);
  // Production (raw) orders use formulation BOMs; keep a legacy/edited order's
  // own packing BOM visible so the select still shows its current value.
  const orderBoms = savedBoms.filter((bom) => bom.phase === "FORMULATION" || bom.id === bomId);
  const visibleBoms = boms.filter(
    (bom) =>
      (showHiddenBoms || (bom.is_active === 1 && bom.is_temp !== 1)) &&
      (bomPhase === "all" || bom.phase === bomPhase) &&
      matchesQuery(bomQuery, [bom.bom_name, itemName(bom.finished_item_id)]),
  );

  function bomComponentList(id: number) {
    const components = bomComponents[id];
    if (!components) return "Loading components…";
    if (components.length === 0) return "No components.";
    return (
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {components.map((component) => (
          <li key={component.id}>
            {itemName(component.component_item_id)} — {component.quantity_required}
            {component.wastage_percent > 0 ? ` (+${component.wastage_percent}% wastage)` : ""}
          </li>
        ))}
      </ul>
    );
  }

  const finishedGoods = items.filter(
    (i) => i.is_active === 1 && i.item_type === "FINISHED_GOOD",
  );
  const components = items.filter(
    (i) =>
      i.is_active === 1 &&
      (i.item_type === "RAW_MATERIAL" || i.item_type === "PACKING_MATERIAL"),
  );
  const componentOptions = [
    { value: "0", label: "Select..." },
    ...components.map((i) => ({ value: String(i.id), label: i.item_name })),
  ];
  const packingOptions = [
    { value: "0", label: "Select..." },
    ...items
      .filter((i) => i.is_active === 1 && i.item_type === "PACKING_MATERIAL")
      .map((i) => ({ value: String(i.id), label: i.item_name })),
  ];

  const packingOrder = orders.find((o) => o.id === packingOrderId);
  const packAvailable = packingOrder?.unpacked_quantity ?? packingOrder?.actual_quantity ?? 0;
  // The packer knows the pack size and how many packs the run makes; the bulk
  // consumed from the unpacked batch is derived from those two.
  const packBulk = packsToBulk(packPacks, packItemUnit, packSize, packUnit);
  const packQuantity = packBulk.bulk;

  function updateComponentLine(key: number, patch: Partial<ComponentDraft>) {
    setComponentLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function resetBomForm() {
    setEditingBomId(null);
    setFinishedItemId(0);
    setOutputQuantity(1);
    setComponentLines([newComponent()]);
  }

  async function createBom(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!finishedItemId) {
      setError("Select a finished item.");
      return;
    }
    const payload = componentLines.filter((l) => l.itemId > 0 && l.quantityRequired > 0);
    if (payload.length === 0) {
      setError("Add at least one component.");
      return;
    }
    try {
      const body = {
        finishedItemId,
        outputQuantity,
        components: payload.map((l) => ({
          componentItemId: l.itemId,
          quantityRequired: l.quantityRequired,
        })),
      };
      const bom =
        editingBomId === null
          ? await api.createBom(body)
          : await api.updateBom(editingBomId, body);
      if (editingBomId !== null) {
        setBomComponents((prev) => {
          const next = { ...prev };
          delete next[editingBomId];
          return next;
        });
      }
      setNotice(`${editingBomId === null ? "Created" : "Updated"} BOM ${bom.bomName}`);
      resetBomForm();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save BOM.");
    }
  }

  async function startEditBom(bom: Bom) {
    setError(null);
    setNotice(null);
    try {
      const detail = await api.bom(bom.id);
      setFinishedItemId(detail.bom.finished_item_id);
      setOutputQuantity(detail.bom.output_quantity);
      setComponentLines(
        detail.components.length > 0
          ? detail.components.map((c) => ({
              key: componentKey++,
              itemId: c.component_item_id,
              quantityRequired: c.quantity_required,
            }))
          : [newComponent()],
      );
      setEditingBomId(bom.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load BOM.");
    }
  }

  async function removeBom(bom: Bom) {
    if (!window.confirm(`Delete BOM ${bom.bom_name}?`)) return;
    setError(null);
    setNotice(null);
    try {
      await api.deleteBom(bom.id);
      setBomComponents((prev) => {
        const next = { ...prev };
        delete next[bom.id];
        return next;
      });
      if (editingBomId === bom.id) resetBomForm();
      setNotice(`Deleted BOM ${bom.bom_name}`);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete BOM.");
    }
  }

  function resetOrderForm() {
    setEditingOrderId(null);
    setBomId(0);
    setPlannedQuantity(1);
    setManufacturingDate(new Date().toISOString().slice(0, 10));
  }

  async function createOrder(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!bomId) {
      setError("Select a BOM.");
      return;
    }
    try {
      if (editingOrderId !== null) {
        await api.updateProductionOrder(editingOrderId, {
          bomId,
          plannedQuantity,
          manufacturingDate,
        });
        setNotice("Updated production order");
      } else {
        const order = await api.createProductionOrder({
          bomId,
          plannedQuantity,
          manufacturingDate,
        });
        setNotice(`Created production order ${order.orderNumber}`);
      }
      resetOrderForm();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save order.");
    }
  }

  function selectBom(next: string) {
    const id = Number(next);
    setBomId(id);
    if (id && !bomComponents[id]) {
      void api
        .bom(id)
        .then((detail) => setBomComponents((prev) => ({ ...prev, [id]: detail.components })))
        .catch((err: unknown) =>
          setError(err instanceof ApiError ? err.message : "Failed to load BOM components."),
        );
    }
  }

  function startEditOrder(order: ProductionOrder) {
    setError(null);
    setNotice(null);
    setEditingOrderId(order.id);
    selectBom(String(order.bom_id));
    setPlannedQuantity(order.planned_quantity);
    setManufacturingDate(order.manufacturing_date);
  }

  async function removeOrder(order: ProductionOrder) {
    if (!window.confirm(`Delete production order ${order.order_number}?`)) return;
    setError(null);
    setNotice(null);
    try {
      await api.deleteProductionOrder(order.id);
      if (editingOrderId === order.id) resetOrderForm();
      setNotice(`Deleted order ${order.order_number}`);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete order.");
    }
  }

  async function start(id: number) {
    try {
      await api.startProduction(id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start order.");
    }
  }

  async function produce(id: number, planned: number) {
    const raw = window.prompt("Unpacked quantity produced:", String(planned));
    if (raw === null) return;
    const actual = Number(raw);
    if (!(actual > 0)) {
      setError("Unpacked quantity must be greater than 0.");
      return;
    }
    const batch = window.prompt("Unpacked batch number (optional):", "") ?? "";
    try {
      const result = await api.produceProduction(id, {
        actualQuantity: actual,
        outputBatchNumber: batch || undefined,
        ignoreStock: ignoreStockOrders[id] || undefined,
      });
      setNotice(`Produced unpacked stock for order ${id} — raw cost ${money(result.productionCost)}`);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to produce order.");
    }
  }

  /** BOM packing materials scaled to the quantity being packed. */
  function packingLinesFor(
    qty: number,
    components: BomComponent[],
    output: number,
  ): ComponentDraft[] {
    const ratio = qty / (output || 1);
    const lines = components
      .filter((component) => isPackingComponent(component))
      .map((component) => ({
        key: componentKey++,
        itemId: component.component_item_id,
        quantityRequired:
          component.quantity_required * ratio * (1 + (component.wastage_percent || 0) / 100),
      }));
    return lines.length > 0 ? lines : [newComponent()];
  }

  function isPackingComponent(component: BomComponent): boolean {
    return (
      items.find((i) => i.id === component.component_item_id)?.item_type === "PACKING_MATERIAL"
    );
  }

  /** The active packing BOM for a finished item; latest wins (same as the server). */
  function packingBomFor(finishedItemId: number): Bom | undefined {
    return savedBoms
      .filter(
        (bom) =>
          bom.is_active === 1 &&
          bom.phase === "PACKING" &&
          bom.finished_item_id === finishedItemId,
      )
      .reduce<Bom | undefined>((latest, bom) => (!latest || bom.id > latest.id ? bom : latest), undefined);
  }

  const packingBomChoices = savedBoms.filter(
    (bom) =>
      bom.is_active === 1 && bom.phase === "PACKING" && bom.finished_item_id === packFinishedItemId,
  );

  async function changePackBom(nextId: number): Promise<void> {
    setPackBomId(nextId);
    try {
      const detail = await api.bom(nextId);
      const output = detail.bom.output_quantity || 1;
      setPackBom({ components: detail.components, output });
      applyRecipe(packItemUnit, output, detail.components);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load packing BOM.");
    }
  }

  /**
   * Adopt a packing BOM's recipe: its output quantity is one pack, so the pack
   * size is set from it and the material lines are the BOM's per-output
   * quantities scaled to the whole packs the unpacked stock makes.
   */
  function applyRecipe(
    itemUnit: string,
    output: number,
    components: BomComponent[],
    available = packAvailable,
  ): void {
    const unit = defaultPackUnit(itemUnit);
    const whole =
      available > 0 && output > 0 ? packCount(available, itemUnit, output, unit) : null;
    const size = whole?.error ? available : output;
    const packs = whole ? (whole.error ? 1 : whole.packs) : 0;
    setPackSize(size);
    setPackUnit(unit);
    setPackPacks(packs);
    const bulk = packsToBulk(packs, itemUnit, size, unit);
    if (!bulk.error) {
      setPackingLines(packingLinesFor(bulk.bulk, components, output));
    }
  }

  /** Set the number of packs; the bulk drawn from stock is derived from it. */
  function applyPacks(packs: number, size = packSize, unit = packUnit): void {
    setPackPacks(packs);
    // A first pack has no recipe to scale yet — leave the lines the user typed.
    if (packBomId === null) return;
    const bulk = packsToBulk(packs, packItemUnit, size, unit);
    if (!bulk.error) {
      setPackingLines(packingLinesFor(bulk.bulk, packBom.components, packBom.output));
    }
  }

  /** Fill as many whole packs of the chosen size as the unpacked stock allows. */
  function refillWholePacks(size: number, unit: string): void {
    const whole = packCount(packAvailable, packItemUnit, size, unit);
    applyPacks(whole.error ? packPacks : whole.packs, size, unit);
  }

  function changePackSize(next: number): void {
    setPackSize(next);
    refillWholePacks(next, packUnit);
  }

  function changePackUnit(next: string): void {
    setPackUnit(next);
    refillWholePacks(packSize, next);
  }

  async function startPack(order: ProductionOrder) {
    setError(null);
    setNotice(null);
    try {
      // The BOM detail also carries the finished item for temporary BOMs,
      // which are hidden from the BOM list.
      const detail = await api.bom(order.bom_id);
      setBomComponents((prev) => ({ ...prev, [order.bom_id]: detail.components }));
      const finishedItemId = detail.bom.finished_item_id;
      // Split model: the order's BOM is the raw recipe, so the packing
      // materials come from the active packing BOM for the same finished item.
      const ownPacking = detail.components.some(isPackingComponent);
      const packingBom = ownPacking ? undefined : packingBomFor(finishedItemId);
      const source = packingBom ? await api.bom(packingBom.id) : detail;
      const output = source.bom.output_quantity || 1;
      const available = order.unpacked_quantity ?? order.actual_quantity;
      const unit = itemUnit(finishedItemId);
      setPackFinishedItemId(finishedItemId);
      setPackBomId(packingBom ? packingBom.id : ownPacking ? order.bom_id : null);
      setPackBom({ components: source.components, output });
      setPackItemUnit(unit);
      if (packingBom || ownPacking) {
        // A saved packing BOM defines one pack: adopt its size and ratio.
        applyRecipe(unit, output, source.components, available);
      } else {
        // First pack: no recipe yet, so start from the whole unpacked batch.
        setPackSize(1);
        setPackUnit(defaultPackUnit(unit));
        setPackPacks(available);
        setPackingLines(packingLinesFor(available, source.components, output));
      }
      setPackingOrderId(order.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load packing materials.");
    }
  }

  function updatePackingLine(key: number, patch: Partial<ComponentDraft>) {
    setPackingLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function confirmPack() {
    if (packingOrderId === null) return;
    if (packBulk.error || packQuantity <= 0) {
      setError(packBulk.error ?? "Enter how many packs to make.");
      return;
    }
    const batch = window.prompt("Final finished-goods batch number (optional):", "");
    if (batch === null) return;
    const materials = packingLines
      .filter((l) => l.itemId > 0 && l.quantityRequired > 0)
      .map((l) => ({ itemId: l.itemId, quantity: l.quantityRequired }));
    const perPack = packsToBulk(1, packItemUnit, packSize, packUnit);
    try {
      const result = await api.packProduction(packingOrderId, {
        quantity: packQuantity,
        packSize: perPack.error ? undefined : perPack.bulk,
        materials,
        outputBatchNumber: batch || undefined,
        ignoreStock: ignoreStockOrders[packingOrderId] || undefined,
      });
      setNotice(
        `Packed ${packQuantity} — production cost ${money(result.productionCost)}` +
          (result.packingBomName ? ` — saved packing BOM ${result.packingBomName}` : ""),
      );
      setPackingOrderId(null);
      setPackingLines([newComponent()]);
      setPackPacks(0);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to pack order.");
    }
  }

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Manufacturing</h2>
          <div className="row">
            <button className={tab === "boms" ? "primary" : ""} onClick={() => setTab("boms")}>
              Bills of Materials
            </button>
            <button className={tab === "orders" ? "primary" : ""} onClick={() => setTab("orders")}>
              Production Orders
            </button>
          </div>
        </div>
        {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
        {notice && <div className="badge" style={{ display: "inline-block", marginTop: 12 }}>{notice}</div>}
      </div>

      {tab === "boms" && (
        <>
          <form className="card" onSubmit={createBom}>
            <h2>{editingBomId === null ? "New bill of materials" : "Edit bill of materials"}</h2>
            <div className="row">
              <div>
                <label>Finished item</label>
                <SearchableSelect
                  value={String(finishedItemId)}
                  onChange={(next) => setFinishedItemId(Number(next))}
                  placeholder="Select..."
                  emptyText="No matching item"
                  options={[
                    { value: "0", label: "Select..." },
                    ...finishedGoods.map((i) => ({ value: String(i.id), label: i.item_name })),
                  ]}
                />
              </div>
              <div>
                <label>Output quantity</label>
                <NumberInput
                  min="0"
                  step="0.001"
                  value={outputQuantity}
                  onChange={(e) => setOutputQuantity(Number(e.target.value))}
                  style={{ width: 120 }}
                />
              </div>
            </div>

            <table style={{ marginTop: 16 }} onKeyDown={moveRowFocus}>
              <thead>
                <tr>
                  <th>Component</th>
                  <th className="num">Qty required</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {componentLines.map((line) => (
                  <tr key={line.key}>
                    <td>
                      <SearchableSelect
                        value={String(line.itemId)}
                        autoFocus={addedComponent.current && line.key === componentLines.at(-1)?.key}
                        onChange={(next) => updateComponentLine(line.key, { itemId: Number(next) })}
                        placeholder="Select..."
                        emptyText="No matching item"
                        options={componentOptions}
                      />
                    </td>
                    <td className="num">
                      <NumberInput
                        min="0"
                        step="0.001"
                        value={line.quantityRequired}
                        onChange={(e) =>
                          updateComponentLine(line.key, { quantityRequired: Number(e.target.value) })
                        }
                        style={{ width: 120 }}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() =>
                          setComponentLines((prev) => prev.filter((l) => l.key !== line.key))
                        }
                        disabled={componentLines.length === 1}
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
                  addedComponent.current = true;
                  setComponentLines((prev) => [...prev, newComponent()]);
                }}
              >
                Add component
              </button>
              <button className="primary" type="submit">
                {editingBomId === null ? "Create BOM" : "Save changes"}
              </button>
              {editingBomId !== null && (
                <button type="button" onClick={resetBomForm} style={{ marginLeft: 8 }}>
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className="card">
            <div className="row" style={{ marginBottom: 12 }}>
              <FilterBox
                value={bomQuery}
                onChange={setBomQuery}
                placeholder="Search BOMs or products…"
              />
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={showHiddenBoms}
                  onChange={(e) => setShowHiddenBoms(e.target.checked)}
                />
                Show hidden
              </label>
              <select
                value={bomPhase}
                onChange={(e) => setBomPhase(e.target.value)}
                aria-label="BOM phase"
              >
                <option value="all">All phases</option>
                <option value="FORMULATION">Production (raw)</option>
                <option value="PACKING">Packing</option>
              </select>
            </div>
            <table>
              <thead>
                <tr>
                  <th>BOM</th>
                  <th>Finished item</th>
                  <th className="num">Output qty</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibleBoms.map((bom) => (
                  <Fragment key={bom.id}>
                    <tr>
                      <td>{bom.bom_name}</td>
                      <td>{itemName(bom.finished_item_id)}</td>
                      <td className="num">{bom.output_quantity}</td>
                      <td>
                        <button type="button" onClick={() => void toggleBomComponents(bom.id)}>
                          {expandedBomId === bom.id ? "Hide components" : "Components"}
                        </button>{" "}
                        <button type="button" onClick={() => void startEditBom(bom)}>
                          Edit
                        </button>{" "}
                        <button type="button" onClick={() => void removeBom(bom)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                    {expandedBomId === bom.id && (
                      <tr>
                        <td colSpan={4} style={{ opacity: 0.85 }}>
                          {bomComponentList(bom.id)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {visibleBoms.length === 0 && (
                  <tr>
                    <td colSpan={4}>
                      {boms.length === 0 ? "No bills of materials yet." : "No matching BOMs."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "orders" && (
        <>
          <form className="card" onSubmit={createOrder}>
            <h2>{editingOrderId === null ? "New production order" : "Edit production order"}</h2>
            <div className="row">
              <div>
                <label>BOM</label>
                <SearchableSelect
                  value={String(bomId)}
                  onChange={selectBom}
                  placeholder="Search by product or BOM..."
                  emptyText="No matching BOM"
                  options={orderBoms.map((b) => ({
                    value: String(b.id),
                    label: `${itemName(b.finished_item_id)} — ${b.bom_name}${b.is_active ? "" : " (inactive)"}`,
                  }))}
                />
              </div>
              <div>
                <label>Planned quantity</label>
                <NumberInput
                  min="0"
                  step="0.001"
                  value={plannedQuantity}
                  onChange={(e) => setPlannedQuantity(Number(e.target.value))}
                  style={{ width: 140 }}
                />
              </div>
              <div>
                <label>Manufacturing date</label>
                <input
                  type="date"
                  value={manufacturingDate}
                  onChange={(e) => setManufacturingDate(e.target.value)}
                />
              </div>
            </div>
            {orderBoms.length === 0 && (
              <p style={{ opacity: 0.7, fontSize: 12 }}>
                No production (raw) BOMs yet. Create one under Bills of Materials first.
              </p>
            )}
            {bomId > 0 && (
              <div style={{ marginTop: 16 }}>
                <strong>Components from this BOM</strong>
                {bomComponentList(bomId)}
              </div>
            )}
            <div className="row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
              <button className="primary" type="submit">
                {editingOrderId === null ? "Create order" : "Save changes"}
              </button>
              {editingOrderId !== null && (
                <button type="button" onClick={resetOrderForm}>
                  Cancel
                </button>
              )}
            </div>
          </form>

          {packingOrderId !== null && (
            <div className="card">
              <h2>
                Pack order {orders.find((o) => o.id === packingOrderId)?.order_number ?? ""}
              </h2>
              <p style={{ opacity: 0.7, fontSize: 12 }}>
                Enter the pack size and how many packs the run makes — the quantity drawn from the
                unpacked batch and the packing materials are worked out from those two. The rest
                stays unpacked in stock. Materials are prefilled from the packing BOM, deducted from
                stock scaled to the BOM, and can be changed. Tick Ignore stock to skip the stock
                check and deduction.
              </p>
              <div className="row" style={{ marginBottom: 12 }}>
                <div>
                  <label>Packing BOM</label>
                  {packingBomChoices.length > 0 ? (
                    <SearchableSelect
                      value={String(packBomId ?? 0)}
                      onChange={(next) => void changePackBom(Number(next))}
                      placeholder="Search packing BOM..."
                      emptyText="No matching packing BOM"
                      options={packingBomChoices.map((b) => ({
                        value: String(b.id),
                        label: `${b.bom_name} — ${quantity(b.output_quantity)} ${itemUnit(b.finished_item_id)} per pack`,
                      }))}
                    />
                  ) : (
                    <p style={{ margin: 0, opacity: 0.7, fontSize: 12 }}>
                      No packing BOM yet — the materials you use now are saved as one.
                    </p>
                  )}
                </div>
              </div>
              <div className="row" style={{ marginBottom: 12, alignItems: "flex-end" }}>
                <div>
                  <label>Packs to make</label>
                  <NumberInput
                    min="1"
                    step="1"
                    value={packPacks}
                    onChange={(e) => applyPacks(Number(e.target.value))}
                    style={{ width: 100 }}
                  />
                </div>
                <div>
                  <label>Pack size</label>
                  <div className="row">
                    <NumberInput
                      min="0.001"
                      step="0.001"
                      value={packSize}
                      onChange={(e) => changePackSize(Number(e.target.value))}
                      style={{ width: 100 }}
                    />
                    <select value={packUnit} onChange={(e) => changePackUnit(e.target.value)}>
                      {PACK_UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ alignSelf: "flex-end", paddingBottom: 6 }}>
                  {packBulk.error ? (
                    <span style={{ color: "var(--danger)", fontSize: 12 }}>{packBulk.error}</span>
                  ) : (
                    <span className="badge">
                      uses {quantity(packQuantity)} {packItemUnit} → {quantity(packPacks)} ×{" "}
                      {quantity(packSize)} {packUnit}
                      {packQuantity > packAvailable
                        ? ` (only ${quantity(packAvailable)} unpacked)`
                        : packAvailable - packQuantity > 0
                          ? ` (${quantity(packAvailable - packQuantity)} ${packItemUnit} left unpacked)`
                          : ""}
                    </span>
                  )}
                </div>
                <div style={{ opacity: 0.7, fontSize: 12, alignSelf: "flex-end", paddingBottom: 6 }}>
                  {quantity(packAvailable)} {packItemUnit} unpacked available
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Packing material</th>
                    <th className="num">Quantity used</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {packingLines.map((line) => (
                    <tr key={line.key}>
                      <td>
                        <SearchableSelect
                          value={String(line.itemId)}
                          autoFocus={addedPacking.current && line.key === packingLines.at(-1)?.key}
                          onChange={(next) =>
                            updatePackingLine(line.key, { itemId: Number(next) })
                          }
                          placeholder="Select packing material..."
                          emptyText="No matching packing material"
                          options={packingOptions}
                        />
                      </td>
                      <td className="num">
                        <NumberInput
                          min="0"
                          step="0.001"
                          value={line.quantityRequired}
                          onChange={(e) =>
                            updatePackingLine(line.key, {
                              quantityRequired: Number(e.target.value),
                            })
                          }
                          style={{ width: 140 }}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() =>
                            setPackingLines((prev) => prev.filter((l) => l.key !== line.key))
                          }
                          disabled={packingLines.length === 1}
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
                    addedPacking.current = true;
                    setPackingLines((prev) => [...prev, newComponent()]);
                  }}
                >
                  Add packing material
                </button>
                <div className="row">
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={ignoreStockOrders[packingOrderId] ?? false}
                      onChange={(e) =>
                        setIgnoreStockOrders((prev) => ({
                          ...prev,
                          [packingOrderId]: e.target.checked,
                        }))
                      }
                    />
                    Ignore stock
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setPackingOrderId(null);
                      setPackingLines([newComponent()]);
                    }}
                  >
                    Cancel
                  </button>
                  <button className="primary" type="button" onClick={() => void confirmPack()}>
                    Confirm pack
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Status</th>
                  <th className="num">Planned</th>
                  <th className="num">Actual</th>
                  <th className="num">Cost</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.order_number}</td>
                    <td>
                      {order.status === "IN_PROGRESS" && order.actual_quantity > 0
                        ? `UNPACKED (${order.unpacked_quantity ?? 0} left)`
                        : order.status}
                    </td>
                    <td className="num">{order.planned_quantity}</td>
                    <td className="num">{order.actual_quantity}</td>
                    <td className="num">{money(order.production_cost)}</td>
                    <td>
                      {order.status === "DRAFT" && (
                        <>
                          {boms.some((b) => b.id === order.bom_id && b.is_temp !== 1) && (
                            <>
                              <button onClick={() => startEditOrder(order)}>Edit</button>{" "}
                            </>
                          )}
                          <button onClick={() => void removeOrder(order)}>Delete</button>{" "}
                          <button onClick={() => void start(order.id)}>Start</button>
                        </>
                      )}
                      {order.status === "IN_PROGRESS" && (
                        <>
                          {order.actual_quantity > 0 ? (
                            <button onClick={() => void startPack(order)}>Pack</button>
                          ) : (
                            <button onClick={() => void produce(order.id, order.planned_quantity)}>
                              Produce
                            </button>
                          )}
                          <label style={{ marginLeft: 8, whiteSpace: "nowrap" }}>
                            <input
                              type="checkbox"
                              checked={ignoreStockOrders[order.id] ?? false}
                              onChange={(e) =>
                                setIgnoreStockOrders((prev) => ({
                                  ...prev,
                                  [order.id]: e.target.checked,
                                }))
                              }
                            />{" "}
                            Ignore stock
                          </label>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={6}>No production orders yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
