import { Fragment, useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import FilterBox, { matchesQuery } from "../components/FilterBox";
import NumberInput from "../components/NumberInput";
import SearchableSelect from "../components/SearchableSelect";
import { moveRowFocus } from "../lib/gridKeys";
import type { Bom, BomComponent, Item, PackingOrder, ProductionOrder } from "../types";
import { defaultPackUnit, packsToBulk, PACK_UNITS, PACK_UNIT_LABELS } from "../lib/units";

function money(value: number): string {
  return value.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function quantity(value: number): string {
  return value.toLocaleString("en-PK", { maximumFractionDigits: 6 });
}

const UNPACKED_PREFIX = "(Unpacked) ";

type Tab = "formulations" | "production" | "packing";
type BomKind = "FORMULATION" | "PACKING";

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
  const [tab, setTab] = useState<Tab>("formulations");
  const [boms, setBoms] = useState<Bom[]>([]);
  const [bomQuery, setBomQuery] = useState("");
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [packingOrders, setPackingOrders] = useState<PackingOrder[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [bomComponents, setBomComponents] = useState<Record<number, BomComponent[]>>({});
  const [expandedBomId, setExpandedBomId] = useState<number | null>(null);

  // Formulations form
  const [bomKind, setBomKind] = useState<BomKind>("FORMULATION");
  const [bomName, setBomName] = useState("");
  const [bomOutputItemId, setBomOutputItemId] = useState(0);
  const [outputQuantity, setOutputQuantity] = useState(1);
  const [componentLines, setComponentLines] = useState<ComponentDraft[]>([newComponent()]);
  const [editingBomId, setEditingBomId] = useState<number | null>(null);
  const addedComponent = useRef(false);

  // Production form
  const [productionBomId, setProductionBomId] = useState(0);
  const [productionQuantity, setProductionQuantity] = useState(1);
  const [productionDate, setProductionDate] = useState(today());
  const [productionBomName, setProductionBomName] = useState("");
  const [productionLines, setProductionLines] = useState<ComponentDraft[]>([newComponent()]);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [ignoreStockOrders, setIgnoreStockOrders] = useState<Record<number, boolean>>({});
  const addedProduction = useRef(false);

  // Packing form
  const [packingBomId, setPackingBomId] = useState(0);
  const [packingQuantity, setPackingQuantity] = useState(1);
  const [packingDate, setPackingDate] = useState(today());
  const [packingBomName, setPackingBomName] = useState("");
  const [packingOutputItemId, setPackingOutputItemId] = useState(0);
  const [packingUnpackedItemId, setPackingUnpackedItemId] = useState(0);
  const [packSize, setPackSize] = useState(1);
  const [packUnit, setPackUnit] = useState<string>("UNIT");
  const [packingLines, setPackingLines] = useState<ComponentDraft[]>([newComponent()]);
  const [editingPackingOrderId, setEditingPackingOrderId] = useState<number | null>(null);
  const [ignoreStockPacking, setIgnoreStockPacking] = useState<Record<number, boolean>>({});
  const addedPacking = useRef(false);

  // Pack dialog
  const [packOrderId, setPackOrderId] = useState<number | null>(null);
  const [packUnits, setPackUnits] = useState(1);
  const [packUnpackedQty, setPackUnpackedQty] = useState(0);
  const [packUnpackedItemId, setPackUnpackedItemId] = useState(0);
  const [packLines, setPackLines] = useState<ComponentDraft[]>([]);

  async function refresh() {
    try {
      setBoms(await api.boms(false));
      setOrders(await api.productionOrders());
      setPackingOrders(await api.packingOrders());
      // Creating a formulation BOM creates its "(Unpacked)" item, so the item
      // list has to come along on every refresh.
      setItems(await api.items({ activeOnly: false }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load manufacturing data.");
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const itemName = (id: number) => items.find((i) => i.id === id)?.item_name ?? String(id);
  const itemUnit = (id: number) => items.find((i) => i.id === id)?.unit ?? "UNIT";
  const activeItems = items.filter((i) => i.is_active === 1);
  const rawMaterials = activeItems.filter((i) => i.item_type === "RAW_MATERIAL");
  const packingMaterials = activeItems.filter((i) => i.item_type === "PACKING_MATERIAL");
  const finishedGoods = activeItems.filter((i) => i.item_type === "FINISHED_GOOD");

  const formulationBoms = boms.filter((bom) => bom.phase !== "PACKING");
  const packingBoms = boms.filter((bom) => bom.phase === "PACKING");
  const visibleBoms = boms.filter((bom) =>
    matchesQuery(bomQuery, [bom.bom_name, itemName(bom.finished_item_id)]),
  );

  const optionsFor = (list: Item[]) => [
    { value: "0", label: "Select..." },
    ...list.map((i) => ({ value: String(i.id), label: i.item_name })),
  ];

  async function loadComponents(id: number): Promise<BomComponent[]> {
    if (bomComponents[id]) return bomComponents[id]!;
    const detail = await api.bom(id);
    setBomComponents((prev) => ({ ...prev, [id]: detail.components }));
    return detail.components;
  }

  function forgetComponents(id: number) {
    setBomComponents((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

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

  async function toggleBomComponents(id: number) {
    if (expandedBomId === id) {
      setExpandedBomId(null);
      return;
    }
    setExpandedBomId(id);
    try {
      await loadComponents(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load BOM components.");
    }
  }

  // --- Formulations ------------------------------------------------------
  function resetBomForm() {
    setEditingBomId(null);
    setBomKind("FORMULATION");
    setBomName("");
    setBomOutputItemId(0);
    setOutputQuantity(1);
    setComponentLines([newComponent()]);
  }

  function validLines(lines: ComponentDraft[]) {
    return lines.filter((line) => line.itemId > 0 && line.quantityRequired > 0);
  }

  async function saveBom(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const payload = validLines(componentLines);
    if (payload.length === 0) {
      setError("Add at least one component.");
      return;
    }
    if (bomKind === "PACKING" && !bomOutputItemId) {
      setError("Select the finished output item.");
      return;
    }
    try {
      const body = {
        bomName: bomName.trim() || null,
        outputQuantity,
        finishedItemId: bomKind === "PACKING" ? bomOutputItemId : undefined,
        components: payload.map((line) => ({
          componentItemId: line.itemId,
          quantityRequired: line.quantityRequired,
        })),
      };
      const bom =
        editingBomId === null
          ? await api.createBom(body)
          : await api.updateBom(editingBomId, body);
      if (editingBomId !== null) forgetComponents(editingBomId);
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
      setBomKind(bom.phase === "PACKING" ? "PACKING" : "FORMULATION");
      setBomName(detail.bom.bom_name);
      setBomOutputItemId(detail.bom.finished_item_id);
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
      forgetComponents(bom.id);
      if (editingBomId === bom.id) resetBomForm();
      setNotice(`Deleted BOM ${bom.bom_name}`);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete BOM.");
    }
  }

  // --- Production --------------------------------------------------------
  function resetProductionForm() {
    setEditingOrderId(null);
    setProductionBomId(0);
    setProductionQuantity(1);
    setProductionDate(today());
    setProductionBomName("");
    setProductionLines([newComponent()]);
  }

  function updateProductionLine(key: number, patch: Partial<ComponentDraft>) {
    setProductionLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function saveProductionOrder(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      if (editingOrderId !== null) {
        await api.updateProductionOrder(editingOrderId, {
          bomId: productionBomId,
          plannedQuantity: productionQuantity,
          manufacturingDate: productionDate,
        });
        setNotice("Updated production order");
      } else if (productionBomId > 0) {
        const order = await api.createProductionOrder({
          bomId: productionBomId,
          plannedQuantity: productionQuantity,
          manufacturingDate: productionDate,
        });
        setNotice(`Created production order ${order.orderNumber}`);
      } else {
        const payload = validLines(productionLines);
        if (!productionBomName.trim()) {
          setError("Name the BOM this run saves.");
          return;
        }
        if (payload.length === 0) {
          setError("Add the raw materials this run consumes.");
          return;
        }
        const order = await api.createProductionOrder({
          bomName: productionBomName,
          plannedQuantity: productionQuantity,
          manufacturingDate: productionDate,
          components: payload.map((line) => ({
            componentItemId: line.itemId,
            quantityRequired: line.quantityRequired,
          })),
        });
        setNotice(`Created production order ${order.orderNumber} and saved its per-unit BOM`);
      }
      resetProductionForm();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save order.");
    }
  }

  async function selectProductionBom(next: string) {
    const id = Number(next);
    setProductionBomId(id);
    if (id) {
      try {
        await loadComponents(id);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load BOM components.");
      }
    }
  }

  function startEditOrder(order: ProductionOrder) {
    setError(null);
    setNotice(null);
    setEditingOrderId(order.id);
    setProductionBomId(order.bom_id);
    setProductionQuantity(order.planned_quantity);
    setProductionDate(order.manufacturing_date);
    void loadComponents(order.bom_id).catch(() => undefined);
  }

  async function removeOrder(order: ProductionOrder) {
    if (!window.confirm(`Delete production order ${order.order_number}?`)) return;
    setError(null);
    setNotice(null);
    try {
      await api.deleteProductionOrder(order.id);
      if (editingOrderId === order.id) resetProductionForm();
      setNotice(`Deleted order ${order.order_number}`);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete order.");
    }
  }

  async function startProduction(id: number) {
    try {
      await api.startProduction(id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start order.");
    }
  }

  async function produce(order: ProductionOrder) {
    const raw = window.prompt("Unpacked quantity produced:", String(order.planned_quantity));
    if (raw === null) return;
    const actual = Number(raw);
    if (!(actual > 0)) {
      setError("Unpacked quantity must be greater than 0.");
      return;
    }
    const batch = window.prompt("Unpacked batch number (optional):", "") ?? "";
    try {
      const result = await api.produceProduction(order.id, {
        actualQuantity: actual,
        outputBatchNumber: batch || undefined,
        ignoreStock: ignoreStockOrders[order.id] || undefined,
      });
      setNotice(
        `Produced ${quantity(actual)} unpacked (${result.outputBatchNumber}) — raw cost ${money(result.productionCost)}`,
      );
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to produce order.");
    }
  }

  // --- Packing -----------------------------------------------------------
  function resetPackingForm() {
    setEditingPackingOrderId(null);
    setPackingBomId(0);
    setPackingQuantity(1);
    setPackingDate(today());
    setPackingBomName("");
    setPackingOutputItemId(0);
    setPackingUnpackedItemId(0);
    setPackSize(1);
    setPackUnit("UNIT");
    setPackingLines([newComponent()]);
  }

  function updatePackingLine(key: number, patch: Partial<ComponentDraft>) {
    setPackingLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function selectUnpackedItem(next: string) {
    const id = Number(next);
    setPackingUnpackedItemId(id);
    setPackUnit(defaultPackUnit(itemUnit(id)));
  }

  const unpackedBulk = packsToBulk(
    packingQuantity,
    itemUnit(packingUnpackedItemId),
    packSize,
    packUnit,
  );

  async function savePackingOrder(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      if (editingPackingOrderId !== null) {
        await api.updatePackingOrder(editingPackingOrderId, {
          bomId: packingBomId,
          plannedQuantity: packingQuantity,
          manufacturingDate: packingDate,
        });
        setNotice("Updated packing order");
      } else if (packingBomId > 0) {
        const order = await api.createPackingOrder({
          bomId: packingBomId,
          plannedQuantity: packingQuantity,
          manufacturingDate: packingDate,
        });
        setNotice(`Created packing order ${order.orderNumber}`);
      } else {
        if (!packingOutputItemId || !packingUnpackedItemId) {
          setError("Select the output item and the unpacked material.");
          return;
        }
        if (unpackedBulk.error || unpackedBulk.bulk <= 0) {
          setError(unpackedBulk.error ?? "Set the size per item and the items generated.");
          return;
        }
        const materials = validLines(packingLines);
        const order = await api.createPackingOrder({
          packingBomName: packingBomName.trim() || null,
          plannedQuantity: packingQuantity,
          manufacturingDate: packingDate,
          outputItemId: packingOutputItemId,
          unpackedItemId: packingUnpackedItemId,
          unpackedQuantity: unpackedBulk.bulk,
          materials: materials.map((line) => ({
            componentItemId: line.itemId,
            quantityRequired: line.quantityRequired,
          })),
        });
        setNotice(`Created packing order ${order.orderNumber} and saved its per-unit BOM`);
      }
      resetPackingForm();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save packing order.");
    }
  }

  async function selectPackingBom(next: string) {
    const id = Number(next);
    setPackingBomId(id);
    if (id) {
      try {
        await loadComponents(id);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load BOM components.");
      }
    }
  }

  function startEditPackingOrder(order: PackingOrder) {
    setError(null);
    setNotice(null);
    setEditingPackingOrderId(order.id);
    setPackingBomId(order.bom_id);
    setPackingQuantity(order.planned_quantity);
    setPackingDate(order.manufacturing_date);
    void loadComponents(order.bom_id).catch(() => undefined);
  }

  async function removePackingOrder(order: PackingOrder) {
    if (!window.confirm(`Delete packing order ${order.order_number}?`)) return;
    setError(null);
    setNotice(null);
    try {
      await api.deletePackingOrder(order.id);
      if (editingPackingOrderId === order.id) resetPackingForm();
      setNotice(`Deleted packing order ${order.order_number}`);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete packing order.");
    }
  }

  async function startPackingOrder(id: number) {
    try {
      await api.startPacking(id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start packing order.");
    }
  }

  /** The BOM's per-output recipe scaled to `units`. */
  function scaledLines(components: BomComponent[], units: number, output: number): ComponentDraft[] {
    const ratio = units / (output || 1);
    return components
      .filter((component) => {
        const type = items.find((i) => i.id === component.component_item_id)?.item_type;
        return type === "PACKING_MATERIAL";
      })
      .map((component) => ({
        key: componentKey++,
        itemId: component.component_item_id,
        quantityRequired:
          component.quantity_required * ratio * (1 + (component.wastage_percent || 0) / 100),
      }));
  }

  async function openPackDialog(order: PackingOrder) {
    setError(null);
    setNotice(null);
    try {
      const detail = await api.bom(order.bom_id);
      setBomComponents((prev) => ({ ...prev, [order.bom_id]: detail.components }));
      const unpacked = detail.components.find(
        (component) => items.find((i) => i.id === component.component_item_id)?.item_type === "FINISHED_GOOD",
      );
      if (!unpacked) {
        setError("This packing BOM has no unpacked material.");
        return;
      }
      const ratio = order.planned_quantity / (detail.bom.output_quantity || 1);
      const perUnit = unpacked.quantity_required * ratio * (1 + (unpacked.wastage_percent || 0) / 100);
      setPackOrderId(order.id);
      setPackUnits(order.planned_quantity);
      setPackUnpackedItemId(unpacked.component_item_id);
      setPackUnpackedQty(perUnit);
      const lines = scaledLines(detail.components, order.planned_quantity, detail.bom.output_quantity);
      setPackLines(lines.length > 0 ? lines : [newComponent()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load the packing BOM.");
    }
  }

  async function confirmPack() {
    if (packOrderId === null) return;
    if (!(packUnits > 0) || !(packUnpackedQty > 0)) {
      setError("Items generated and unpacked quantity must be greater than 0.");
      return;
    }
    const batch = window.prompt("Finished-goods batch number (optional):", "");
    if (batch === null) return;
    const materials = validLines(packLines).map((line) => ({
      itemId: line.itemId,
      quantity: line.quantityRequired,
    }));
    try {
      const result = await api.packPackingOrder(packOrderId, {
        units: packUnits,
        unpackedQuantity: packUnpackedQty,
        materials,
        outputBatchNumber: batch || undefined,
        ignoreStock: ignoreStockPacking[packOrderId] || undefined,
      });
      setNotice(
        `Packed ${quantity(packUnits)} (${result.outputBatchNumber}) — cost ${money(result.productionCost)}`,
      );
      setPackOrderId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to pack order.");
    }
  }

  const packOrder = packingOrders.find((order) => order.id === packOrderId);
  const packUnpackedAvailable = items.find((i) => i.id === packUnpackedItemId)?.current_stock ?? 0;

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Manufacturing</h2>
          <div className="coa-tabs" role="tablist">
            {(
              [
                ["formulations", "Formulations"],
                ["production", "Production"],
                ["packing", "Packing"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                className={tab === value ? "active" : undefined}
                onClick={() => setTab(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
        {notice && <div className="badge" style={{ display: "inline-block", marginTop: 12 }}>{notice}</div>}
      </div>

      {tab === "formulations" && (
        <>
          <form className="card" onSubmit={saveBom}>
            <h2>{editingBomId === null ? "New bill of materials" : "Edit bill of materials"}</h2>
            <div className="row">
              <div>
                <label>BOM type</label>
                <select
                  value={bomKind}
                  onChange={(e) => setBomKind(e.target.value as BomKind)}
                  aria-label="BOM type"
                  disabled={editingBomId !== null}
                >
                  <option value="FORMULATION">Formulation (raw materials)</option>
                  <option value="PACKING">Packing (unpacked + packaging)</option>
                </select>
              </div>
              <div>
                <label>BOM name</label>
                <input
                  value={bomName}
                  onChange={(e) => setBomName(e.target.value)}
                  placeholder="e.g. Syrup 500ml"
                  style={{ width: 220 }}
                />
              </div>
              {bomKind === "PACKING" && (
                <div>
                  <label>Finished output item</label>
                  <SearchableSelect
                    value={String(bomOutputItemId)}
                    onChange={(next) => setBomOutputItemId(Number(next))}
                    ariaLabel="Finished output item"
                    placeholder="Select..."
                    emptyText="No matching item"
                    options={optionsFor(finishedGoods)}
                  />
                </div>
              )}
              <div>
                <label>Output quantity</label>
                <NumberInput
                  min="0"
                  step="0.001"
                  aria-label="Output quantity"
                  value={outputQuantity}
                  onChange={(e) => setOutputQuantity(Number(e.target.value))}
                  style={{ width: 120 }}
                />
              </div>
            </div>
            {bomKind === "FORMULATION" && (
              <p style={{ opacity: 0.7, fontSize: 12 }}>
                Output item: {UNPACKED_PREFIX}
                {bomName.trim() || "<BOM name>"} — created in inventory automatically.
              </p>
            )}

            <table style={{ marginTop: 16 }} onKeyDown={moveRowFocus}>
              <thead>
                <tr>
                  <th>{bomKind === "PACKING" ? "Unpacked / packing material" : "Raw material"}</th>
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
                        ariaLabel="Component item"
                        onChange={(next) => setComponentLines((prev) =>
                          prev.map((l) => (l.key === line.key ? { ...l, itemId: Number(next) } : l)),
                        )}
                        placeholder="Select..."
                        emptyText="No matching item"
                        options={optionsFor(
                          bomKind === "PACKING"
                            ? [...finishedGoods, ...packingMaterials]
                            : rawMaterials,
                        )}
                      />
                    </td>
                    <td className="num">
                      <NumberInput
                        min="0"
                        step="0.001"
                        aria-label="Component quantity"
                        value={line.quantityRequired}
                        onChange={(e) => setComponentLines((prev) =>
                          prev.map((l) =>
                            l.key === line.key
                              ? { ...l, quantityRequired: Number(e.target.value) }
                              : l,
                          ),
                        )}
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
              <div className="row">
                {editingBomId !== null && (
                  <button type="button" onClick={resetBomForm}>
                    Cancel
                  </button>
                )}
                <button className="primary" type="submit">
                  {editingBomId === null ? "Create BOM" : "Save changes"}
                </button>
              </div>
            </div>
          </form>

          <div className="card">
            <h2>Bills of materials</h2>
            <div className="row" style={{ marginBottom: 12 }}>
              <FilterBox
                value={bomQuery}
                onChange={setBomQuery}
                placeholder="Search BOMs or products…"
              />
            </div>
            <table>
              <thead>
                <tr>
                  <th>BOM</th>
                  <th>Stage</th>
                  <th>Output item</th>
                  <th className="num">Output qty</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibleBoms.map((bom) => (
                  <Fragment key={bom.id}>
                    <tr>
                      <td>{bom.bom_name}</td>
                      <td>{bom.phase === "PACKING" ? "Packing" : "Formulation"}</td>
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
                        <td colSpan={5} style={{ opacity: 0.85 }}>
                          {bomComponentList(bom.id)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {visibleBoms.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      {boms.length === 0 ? "No bills of materials yet." : "No matching BOMs."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "production" && (
        <>
          <form className="card" onSubmit={saveProductionOrder}>
            <h2>{editingOrderId === null ? "New production order" : "Edit production order"}</h2>
            <div className="row">
              <div>
                <label>BOM</label>
                <SearchableSelect
                  value={String(productionBomId)}
                  onChange={(next) => void selectProductionBom(next)}
                  ariaLabel="Production BOM"
                  placeholder="Search by product or BOM..."
                  emptyText="No matching BOM"
                  options={[
                    { value: "0", label: "Manual run — save a new BOM" },
                    ...formulationBoms.map((b) => ({
                      value: String(b.id),
                      label: `${b.bom_name} — ${itemName(b.finished_item_id)}`,
                    })),
                  ]}
                />
              </div>
              <div>
                <label>Total output quantity</label>
                <NumberInput
                  min="0"
                  step="0.001"
                  aria-label="Total output quantity"
                  value={productionQuantity}
                  onChange={(e) => setProductionQuantity(Number(e.target.value))}
                  style={{ width: 140 }}
                />
              </div>
              <div>
                <label>Manufacturing date</label>
                <input
                  type="date"
                  value={productionDate}
                  onChange={(e) => setProductionDate(e.target.value)}
                />
              </div>
            </div>

            {productionBomId > 0 ? (
              <div style={{ marginTop: 16 }}>
                <strong>Components from this BOM</strong>
                {bomComponentList(productionBomId)}
              </div>
            ) : (
              <>
                <p style={{ opacity: 0.7, fontSize: 12 }}>
                  No BOM selected: enter the run's totals. A per-unit BOM is saved automatically and
                  the output item {UNPACKED_PREFIX}
                  {productionBomName.trim() || "<BOM name>"} is created in inventory.
                </p>
                <div className="row">
                  <div>
                    <label>BOM name</label>
                    <input
                      value={productionBomName}
                      onChange={(e) => setProductionBomName(e.target.value)}
                      placeholder="e.g. Syrup 500ml"
                      style={{ width: 220 }}
                    />
                  </div>
                </div>
                <table style={{ marginTop: 16 }} onKeyDown={moveRowFocus}>
                  <thead>
                    <tr>
                      <th>Raw material</th>
                      <th className="num">Total consumed</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {productionLines.map((line) => (
                      <tr key={line.key}>
                        <td>
                          <SearchableSelect
                            value={String(line.itemId)}
                            autoFocus={
                              addedProduction.current && line.key === productionLines.at(-1)?.key
                            }
                            ariaLabel="Raw material"
                            onChange={(next) => updateProductionLine(line.key, { itemId: Number(next) })}
                            placeholder="Select..."
                            emptyText="No matching item"
                            options={optionsFor(rawMaterials)}
                          />
                        </td>
                        <td className="num">
                          <NumberInput
                            min="0"
                            step="0.001"
                            aria-label="Total consumed"
                            value={line.quantityRequired}
                            onChange={(e) =>
                              updateProductionLine(line.key, {
                                quantityRequired: Number(e.target.value),
                              })
                            }
                            style={{ width: 120 }}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() =>
                              setProductionLines((prev) => prev.filter((l) => l.key !== line.key))
                            }
                            disabled={productionLines.length === 1}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button
                  type="button"
                  style={{ marginTop: 12 }}
                  onClick={() => {
                    addedProduction.current = true;
                    setProductionLines((prev) => [...prev, newComponent()]);
                  }}
                >
                  Add raw material
                </button>
              </>
            )}

            <div className="row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
              {editingOrderId !== null && (
                <button type="button" onClick={resetProductionForm}>
                  Cancel
                </button>
              )}
              <button className="primary" type="submit">
                {editingOrderId === null ? "Create order" : "Save changes"}
              </button>
            </div>
          </form>

          <div className="card">
            <h2>Production orders</h2>
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Status</th>
                  <th className="num">Planned</th>
                  <th className="num">Actual</th>
                  <th className="num">Raw cost</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.order_number}</td>
                    <td>{order.status}</td>
                    <td className="num">{order.planned_quantity}</td>
                    <td className="num">{order.actual_quantity}</td>
                    <td className="num">{money(order.production_cost)}</td>
                    <td>
                      {order.status === "DRAFT" && (
                        <>
                          <button onClick={() => startEditOrder(order)}>Edit</button>{" "}
                          <button onClick={() => void removeOrder(order)}>Delete</button>{" "}
                          <button onClick={() => void startProduction(order.id)}>Start</button>
                        </>
                      )}
                      {order.status === "IN_PROGRESS" && order.actual_quantity <= 0 && (
                        <>
                          <button onClick={() => void produce(order)}>Produce</button>
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
                      {order.status === "COMPLETED" && order.output_batch_number && (
                        <span style={{ opacity: 0.7, fontSize: 12 }}>
                          batch {order.output_batch_number}
                        </span>
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

      {tab === "packing" && (
        <>
          <form className="card" onSubmit={savePackingOrder}>
            <h2>{editingPackingOrderId === null ? "New packing order" : "Edit packing order"}</h2>
            <div className="row">
              <div>
                <label>Packing BOM</label>
                <SearchableSelect
                  value={String(packingBomId)}
                  onChange={(next) => void selectPackingBom(next)}
                  ariaLabel="Packing BOM"
                  placeholder="Search packing BOM..."
                  emptyText="No matching packing BOM"
                  options={[
                    { value: "0", label: "Manual run — save a new BOM" },
                    ...packingBoms.map((b) => ({
                      value: String(b.id),
                      label: `${b.bom_name} — ${itemName(b.finished_item_id)}`,
                    })),
                  ]}
                />
              </div>
              <div>
                <label>Items generated</label>
                <NumberInput
                  min="1"
                  step="1"
                  aria-label="Items generated"
                  value={packingQuantity}
                  onChange={(e) => setPackingQuantity(Number(e.target.value))}
                  style={{ width: 120 }}
                />
              </div>
              <div>
                <label>Packing date</label>
                <input
                  type="date"
                  value={packingDate}
                  onChange={(e) => setPackingDate(e.target.value)}
                />
              </div>
            </div>

            {packingBomId > 0 ? (
              <div style={{ marginTop: 16 }}>
                <strong>Components from this BOM</strong>
                {bomComponentList(packingBomId)}
              </div>
            ) : (
              <>
                <p style={{ opacity: 0.7, fontSize: 12 }}>
                  No BOM selected: pick the output item and the unpacked material, then set the size
                  per item. Unpacked used = items generated × size per item.
                </p>
                <div className="row">
                  <div>
                    <label>Packing BOM name</label>
                    <input
                      value={packingBomName}
                      onChange={(e) => setPackingBomName(e.target.value)}
                      placeholder="e.g. Syrup 500ml bottle"
                      style={{ width: 220 }}
                    />
                  </div>
                  <div>
                    <label>Output item</label>
                    <SearchableSelect
                      value={String(packingOutputItemId)}
                      onChange={(next) => setPackingOutputItemId(Number(next))}
                      ariaLabel="Output item"
                      placeholder="Select..."
                      emptyText="No matching item"
                      options={optionsFor(finishedGoods)}
                    />
                  </div>
                  <div>
                    <label>Unpacked material</label>
                    <SearchableSelect
                      value={String(packingUnpackedItemId)}
                      onChange={selectUnpackedItem}
                      ariaLabel="Unpacked material"
                      placeholder="Select..."
                      emptyText="No matching item"
                      options={optionsFor(finishedGoods)}
                    />
                  </div>
                  <div>
                    <label>Size per item</label>
                    <div className="row">
                      <NumberInput
                        min="0.001"
                        step="0.001"
                        aria-label="Size per item"
                        value={packSize}
                        onChange={(e) => setPackSize(Number(e.target.value))}
                        style={{ width: 100 }}
                      />
                      <select value={packUnit} onChange={(e) => setPackUnit(e.target.value)}>
                        {PACK_UNITS.map((unit) => (
                          <option key={unit} value={unit}>
                            {PACK_UNIT_LABELS[unit]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={{ alignSelf: "flex-end", paddingBottom: 6 }}>
                    {unpackedBulk.error ? (
                      <span style={{ color: "var(--danger)", fontSize: 12 }}>{unpackedBulk.error}</span>
                    ) : (
                      <span className="badge">
                        Unpacked used: {quantity(unpackedBulk.bulk)}{" "}
                        {itemUnit(packingUnpackedItemId)}
                      </span>
                    )}
                  </div>
                </div>
                <table style={{ marginTop: 16 }} onKeyDown={moveRowFocus}>
                  <thead>
                    <tr>
                      <th>Packing material</th>
                      <th className="num">Total used</th>
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
                            ariaLabel="Packing material"
                            onChange={(next) => updatePackingLine(line.key, { itemId: Number(next) })}
                            placeholder="Select packing material..."
                            emptyText="No matching packing material"
                            options={optionsFor(packingMaterials)}
                          />
                        </td>
                        <td className="num">
                          <NumberInput
                            min="0"
                            step="0.001"
                            aria-label="Total used"
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
                <button
                  type="button"
                  style={{ marginTop: 12 }}
                  onClick={() => {
                    addedPacking.current = true;
                    setPackingLines((prev) => [...prev, newComponent()]);
                  }}
                >
                  Add packing material
                </button>
              </>
            )}

            <div className="row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
              {editingPackingOrderId !== null && (
                <button type="button" onClick={resetPackingForm}>
                  Cancel
                </button>
              )}
              <button className="primary" type="submit">
                {editingPackingOrderId === null ? "Create packing order" : "Save changes"}
              </button>
            </div>
          </form>

          {packOrder && (
            <div className="card">
              <h2>Pack order {packOrder.order_number}</h2>
              <p style={{ opacity: 0.7, fontSize: 12 }}>
                Consumes the unpacked bulk and the packing materials, then puts the finished goods
                into stock. Tick Ignore stock to skip the stock check and deduction.
              </p>
              <div className="row" style={{ marginBottom: 12, alignItems: "flex-end" }}>
                <div>
                  <label>Items generated</label>
                  <NumberInput
                    min="1"
                    step="1"
                    aria-label="Items generated"
                    value={packUnits}
                    onChange={(e) => setPackUnits(Number(e.target.value))}
                    style={{ width: 100 }}
                  />
                </div>
                <div>
                  <label>Unpacked used ({itemUnit(packUnpackedItemId)})</label>
                  <NumberInput
                    min="0.001"
                    step="0.001"
                    aria-label="Unpacked used"
                    value={packUnpackedQty}
                    onChange={(e) => setPackUnpackedQty(Number(e.target.value))}
                    style={{ width: 140 }}
                  />
                </div>
                <div style={{ opacity: 0.7, fontSize: 12, alignSelf: "flex-end", paddingBottom: 6 }}>
                  {quantity(packUnpackedAvailable)} {itemUnit(packUnpackedItemId)} unpacked available
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
                  {packLines.map((line) => (
                    <tr key={line.key}>
                      <td>
                        <SearchableSelect
                          value={String(line.itemId)}
                          ariaLabel="Packing material"
                          onChange={(next) =>
                            setPackLines((prev) =>
                              prev.map((l) => (l.key === line.key ? { ...l, itemId: Number(next) } : l)),
                            )
                          }
                          placeholder="Select packing material..."
                          emptyText="No matching packing material"
                          options={optionsFor(packingMaterials)}
                        />
                      </td>
                      <td className="num">
                        <NumberInput
                          min="0"
                          step="0.001"
                          aria-label="Quantity used"
                          value={line.quantityRequired}
                          onChange={(e) =>
                            setPackLines((prev) =>
                              prev.map((l) =>
                                l.key === line.key
                                  ? { ...l, quantityRequired: Number(e.target.value) }
                                  : l,
                              ),
                            )
                          }
                          style={{ width: 140 }}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => setPackLines((prev) => prev.filter((l) => l.key !== line.key))}
                          disabled={packLines.length === 1}
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
                  onClick={() => setPackLines((prev) => [...prev, newComponent()])}
                >
                  Add packing material
                </button>
                <div className="row">
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={ignoreStockPacking[packOrder.id] ?? false}
                      onChange={(e) =>
                        setIgnoreStockPacking((prev) => ({
                          ...prev,
                          [packOrder.id]: e.target.checked,
                        }))
                      }
                    />
                    Ignore stock
                  </label>
                  <button type="button" onClick={() => setPackOrderId(null)}>
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
            <h2>Packing orders</h2>
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Output item</th>
                  <th>Status</th>
                  <th className="num">Items</th>
                  <th className="num">Cost</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {packingOrders.map((order) => {
                  const bom = boms.find((b) => b.id === order.bom_id);
                  return (
                    <tr key={order.id}>
                      <td>{order.order_number}</td>
                      <td>{bom ? itemName(bom.finished_item_id) : order.bom_id}</td>
                      <td>{order.status}</td>
                      <td className="num">
                        {order.actual_quantity} / {order.planned_quantity}
                      </td>
                      <td className="num">{money(order.production_cost)}</td>
                      <td>
                        {order.status === "DRAFT" && (
                          <>
                            <button onClick={() => startEditPackingOrder(order)}>Edit</button>{" "}
                            <button onClick={() => void removePackingOrder(order)}>Delete</button>{" "}
                            <button onClick={() => void startPackingOrder(order.id)}>Start</button>
                          </>
                        )}
                        {order.status === "IN_PROGRESS" && (
                          <button onClick={() => void openPackDialog(order)}>Pack</button>
                        )}
                        {order.status === "COMPLETED" && order.output_batch_number && (
                          <span style={{ opacity: 0.7, fontSize: 12 }}>
                            batch {order.output_batch_number}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {packingOrders.length === 0 && (
                  <tr>
                    <td colSpan={6}>No packing orders yet.</td>
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

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
