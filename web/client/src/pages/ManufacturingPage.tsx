import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import type { Bom, Item, ProductionOrder } from "../types";

function money(value: number): string {
  return value.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Tab = "boms" | "orders";

export default function ManufacturingPage() {
  const [tab, setTab] = useState<Tab>("boms");
  const [boms, setBoms] = useState<Bom[]>([]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // BOM form
  const [finishedItemId, setFinishedItemId] = useState(0);
  const [outputQuantity, setOutputQuantity] = useState(1);
  const [componentItemId, setComponentItemId] = useState(0);
  const [quantityRequired, setQuantityRequired] = useState(1);

  // Order form
  const [bomId, setBomId] = useState(0);
  const [plannedQuantity, setPlannedQuantity] = useState(1);

  async function refresh() {
    try {
      setBoms(await api.boms());
      setOrders(await api.productionOrders());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load manufacturing data.");
    }
  }

  useEffect(() => {
    void refresh();
    void api.items().then(setItems).catch(() => undefined);
  }, []);

  const finishedGoods = items.filter((i) => i.item_type === "FINISHED_GOOD");
  const components = items.filter(
    (i) => i.item_type === "RAW_MATERIAL" || i.item_type === "PACKING_MATERIAL",
  );

  async function createBom(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!finishedItemId || !componentItemId) {
      setError("Select a finished item and a component.");
      return;
    }
    try {
      const bom = await api.createBom({
        finishedItemId,
        outputQuantity,
        components: [{ componentItemId, quantityRequired }],
      });
      setNotice(`Created BOM ${bom.bomName}`);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create BOM.");
    }
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
      const order = await api.createProductionOrder({
        bomId,
        plannedQuantity,
        manufacturingDate: new Date().toISOString().slice(0, 10),
      });
      setNotice(`Created production order ${order.orderNumber}`);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create order.");
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

  async function complete(id: number, planned: number) {
    const raw = window.prompt("Actual quantity produced:", String(planned));
    if (raw === null) return;
    const actual = Number(raw);
    if (!(actual > 0)) {
      setError("Actual quantity must be greater than 0.");
      return;
    }
    const batch = window.prompt("Output batch number (optional):", "") ?? "";
    try {
      const result = await api.completeProduction(id, {
        actualQuantity: actual,
        outputBatchNumber: batch || undefined,
      });
      setNotice(`Completed order ${id} — production cost ${money(result.productionCost)}`);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to complete order.");
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
            <h2>New bill of materials</h2>
            <div className="row">
              <div>
                <label>Finished item</label>
                <select value={finishedItemId} onChange={(e) => setFinishedItemId(Number(e.target.value))}>
                  <option value={0}>Select...</option>
                  {finishedGoods.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.item_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Output quantity</label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={outputQuantity}
                  onChange={(e) => setOutputQuantity(Number(e.target.value))}
                  style={{ width: 120 }}
                />
              </div>
              <div>
                <label>Component</label>
                <select value={componentItemId} onChange={(e) => setComponentItemId(Number(e.target.value))}>
                  <option value={0}>Select...</option>
                  {components.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.item_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Qty required</label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={quantityRequired}
                  onChange={(e) => setQuantityRequired(Number(e.target.value))}
                  style={{ width: 120 }}
                />
              </div>
              <button className="primary" type="submit">
                Create BOM
              </button>
            </div>
          </form>

          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>BOM</th>
                  <th>Finished item</th>
                  <th className="num">Output qty</th>
                </tr>
              </thead>
              <tbody>
                {boms.map((bom) => (
                  <tr key={bom.id}>
                    <td>{bom.bom_name}</td>
                    <td>{items.find((i) => i.id === bom.finished_item_id)?.item_name ?? bom.finished_item_id}</td>
                    <td className="num">{bom.output_quantity}</td>
                  </tr>
                ))}
                {boms.length === 0 && (
                  <tr>
                    <td colSpan={3}>No bills of materials yet.</td>
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
            <h2>New production order</h2>
            <div className="row">
              <div>
                <label>BOM</label>
                <select value={bomId} onChange={(e) => setBomId(Number(e.target.value))}>
                  <option value={0}>Select...</option>
                  {boms.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bom_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Planned quantity</label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={plannedQuantity}
                  onChange={(e) => setPlannedQuantity(Number(e.target.value))}
                  style={{ width: 140 }}
                />
              </div>
              <button className="primary" type="submit">
                Create order
              </button>
            </div>
          </form>

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
                    <td>{order.status}</td>
                    <td className="num">{order.planned_quantity}</td>
                    <td className="num">{order.actual_quantity}</td>
                    <td className="num">{money(order.production_cost)}</td>
                    <td>
                      {order.status === "DRAFT" && (
                        <button onClick={() => void start(order.id)}>Start</button>
                      )}
                      {order.status === "IN_PROGRESS" && (
                        <button onClick={() => void complete(order.id, order.planned_quantity)}>
                          Complete
                        </button>
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
