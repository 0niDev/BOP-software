import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import type { DashboardData } from "../types";

function money(value: number): string {
  return value.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function message(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card" style={{ margin: 0 }}>
      <label>{label}</label>
      <div style={{ fontSize: 22 }}>{value}</div>
      {sub && <div style={{ opacity: 0.65, fontSize: 12, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

const ALERT_COLOR: Record<string, string> = {
  warning: "#e2a03f",
  danger: "#e74c3c",
  success: "#27ae60",
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load(): void {
    setLoading(true);
    api
      .dashboard()
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((err) => setError(message(err, "Failed to load the dashboard.")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  if (error && !data) {
    return (
      <div className="card">
        <h2>Dashboard</h2>
        <div className="error">{error}</div>
        <button className="primary" onClick={load} style={{ marginTop: 12 }}>
          Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card">
        <h2>Dashboard</h2>
        <p style={{ opacity: 0.7 }}>{loading ? "Loading…" : "No data."}</p>
      </div>
    );
  }

  const trendMax = Math.max(
    1,
    ...data.monthlyTrend.map((point) => Math.max(point.revenue, point.expenses)),
  );

  return (
    <>
      <div className="card">
        <div className="row" style={{ alignItems: "center" }}>
          <h2 style={{ flex: 1, margin: 0 }}>Dashboard</h2>
          <button onClick={load} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        {error && <div className="error">{error}</div>}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <Tile
          label="Today's sales"
          value={money(data.today.salesTotal)}
          sub={`${data.today.salesCount} invoice(s)`}
        />
        <Tile
          label="Today's purchases"
          value={money(data.today.purchasesTotal)}
          sub={`${data.today.purchasesCount} invoice(s)`}
        />
        <Tile label="Cash in hand" value={money(data.balances.cash)} />
        <Tile label="Bank" value={money(data.balances.bank)} />
        <Tile label="Inventory value" value={money(data.balances.inventory)} />
        <Tile
          label="Total liquid + stock"
          value={money(data.balances.total)}
          sub={`${data.inventory.totalItems} active item(s)`}
        />
        <Tile label="Receivables" value={money(data.receivablesPayables.receivable)} />
        <Tile label="Payables" value={money(data.receivablesPayables.payable)} />
      </div>

      <div className="card">
        <h2>This month</h2>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <Tile label="Revenue" value={money(data.profitLoss.revenue)} />
          <Tile label="Expenses" value={money(data.profitLoss.expenses)} />
          <Tile
            label={data.profitLoss.isProfit ? "Profit" : "Loss"}
            value={money(data.profitLoss.profit)}
          />
        </div>
      </div>

      <div className="card">
        <h2>
          Alerts <span className="badge">{data.alerts.count}</span>
        </h2>
        {data.alerts.alerts.map((alert, index) => (
          <div
            key={`${alert.title}-${index}`}
            style={{
              borderLeft: `4px solid ${ALERT_COLOR[alert.type] ?? "#888"}`,
              background: "#1b1b1b",
              padding: "8px 12px",
              borderRadius: 6,
              marginBottom: 8,
            }}
          >
            <strong style={{ fontSize: 13 }}>{alert.title}</strong>
            <div style={{ opacity: 0.75, fontSize: 12 }}>{alert.message}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Last 6 months</h2>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th className="num">Revenue</th>
              <th className="num">Expenses</th>
              <th className="num">Profit</th>
              <th style={{ width: "35%" }}></th>
            </tr>
          </thead>
          <tbody>
            {data.monthlyTrend.map((point) => (
              <tr key={point.month}>
                <td>{point.month}</td>
                <td className="num">{money(point.revenue)}</td>
                <td className="num">{money(point.expenses)}</td>
                <td className="num">{money(point.profit)}</td>
                <td>
                  <div style={{ background: "#27ae60", height: 6, borderRadius: 3, width: `${(point.revenue / trendMax) * 100}%`, marginBottom: 2 }} />
                  <div style={{ background: "#e74c3c", height: 6, borderRadius: 3, width: `${(point.expenses / trendMax) * 100}%` }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Recent transactions</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Reference</th>
              <th>Type</th>
              <th>Party</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.recentTransactions.map((tx, index) => (
              <tr key={`${tx.reference}-${index}`}>
                <td>{tx.date}</td>
                <td>{tx.reference}</td>
                <td>{tx.type}</td>
                <td>{tx.partyName ?? "—"}</td>
                <td className="num">{money(tx.amount)}</td>
              </tr>
            ))}
            {data.recentTransactions.length === 0 && (
              <tr>
                <td colSpan={5}>No transactions yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>
          Low stock <span className="badge">{data.inventory.lowStockCount}</span>
        </h2>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Item</th>
              <th className="num">In stock</th>
              <th className="num">Minimum</th>
            </tr>
          </thead>
          <tbody>
            {data.inventory.lowStockItems.map((item) => (
              <tr key={item.itemCode}>
                <td>{item.itemCode}</td>
                <td>{item.itemName}</td>
                <td className="num">{item.currentStock.toFixed(2)}</td>
                <td className="num">{item.minimumStock.toFixed(2)}</td>
              </tr>
            ))}
            {data.inventory.lowStockItems.length === 0 && (
              <tr>
                <td colSpan={4}>Nothing below its minimum stock level.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>
          Expiring within 30 days <span className="badge">{data.inventory.expiringCount}</span>
        </h2>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Batch</th>
              <th>Expiry</th>
              <th className="num">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {data.inventory.expiringItems.map((batch) => (
              <tr key={batch.batchNumber}>
                <td>
                  {batch.itemCode} — {batch.itemName}
                </td>
                <td>{batch.batchNumber}</td>
                <td>{batch.expiryDate ?? "—"}</td>
                <td className="num">{batch.quantityInStock.toFixed(2)}</td>
              </tr>
            ))}
            {data.inventory.expiringItems.length === 0 && (
              <tr>
                <td colSpan={4}>No batches expiring soon.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
