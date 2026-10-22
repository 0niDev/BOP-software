import { useEffect, useState } from "react";
import { Banknote, Coins, Plus, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { api, ApiError } from "../api";
import Card from "../components/ui/Card";
import DeltaPill from "../components/ui/DeltaPill";
import StatCard from "../components/ui/StatCard";
import StatusPill from "../components/ui/StatusPill";
import { StaggerGroup, StaggerItem } from "../components/ui/motion";
import ActivityList from "../components/dashboard/ActivityList";
import BestSellersTable from "../components/dashboard/BestSellersTable";
import ExpiringTable from "../components/dashboard/ExpiringTable";
import LiquidityCard from "../components/dashboard/LiquidityCard";
import LowStockTable from "../components/dashboard/LowStockTable";
import RevenueTrendChart from "../components/dashboard/RevenueTrendChart";
import { compact, money, percent, percentChange, share } from "../lib/format";
import type { DashboardData } from "../types";
import type { Page } from "../App";

function message(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/**
 * Landing page: an executive grid over the aggregated dashboard payload — a KPI
 * strip, the revenue trend, the newest movements, best sellers and the two
 * inventory watchlists, with the cash position beside the activity feed. Every
 * figure comes from `/api/dashboard`; nothing is derived from a placeholder.
 * Alerts are deliberately not repeated here: the server builds them from the
 * same low-stock and expiry rows the tables below already show.
 */
export default function DashboardPage({
  onNavigate,
}: {
  onNavigate: (page: Page) => void;
}) {
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
      <Card title="Dashboard">
        <div className="error">{error}</div>
        <button className="primary mt-3" type="button" onClick={load}>
          Retry
        </button>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card title="Dashboard" subtitle="Loading the latest figures…">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className="h-[132px] animate-pulse rounded-card border border-line bg-[var(--panel-2)]"
            />
          ))}
        </div>
      </Card>
    );
  }

  const trend = data.monthlyTrend;
  const latest = trend.at(-1);
  const previous = trend.at(-2);
  const revenueChange =
    latest && previous ? percentChange(latest.revenue, previous.revenue) : null;
  const expenseChange =
    latest && previous ? percentChange(latest.expenses, previous.expenses) : null;
  const margin = share(data.profitLoss.profit, data.profitLoss.revenue);
  const liquidity = data.balances.cash + data.balances.bank;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Overview</p>
          <h1 style={{ margin: 0 }} className="mt-1.5 text-[28px] font-extrabold tracking-tight text-ink">
            Business at a glance
          </h1>
          <p className="mt-1.5 text-[13px] font-medium text-muted">
            {data.today.salesCount} sale{data.today.salesCount === 1 ? "" : "s"} (
            {money(data.today.salesTotal)}) and {data.today.purchasesCount} purchase
            {data.today.purchasesCount === 1 ? "" : "s"} ({money(data.today.purchasesTotal)}) today
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={load} disabled={loading}>
            <RefreshCw
              size={15}
              strokeWidth={2.4}
              aria-hidden
              className={loading ? "animate-spin" : undefined}
            />
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button type="button" className="primary" onClick={() => onNavigate("sales")}>
            <Plus size={16} strokeWidth={2.6} aria-hidden />
            New sales invoice
          </button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <StaggerGroup className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StaggerItem className="h-full">
          <StatCard
            icon={TrendingUp}
            label="Revenue this month"
            value={compact(data.profitLoss.revenue)}
            badge={<DeltaPill change={revenueChange} label="MoM" />}
            hint={money(data.profitLoss.revenue)}
          />
        </StaggerItem>
        <StaggerItem className="h-full">
          <StatCard
            icon={TrendingDown}
            label="Expenses this month"
            value={compact(data.profitLoss.expenses)}
            tone="amber"
            badge={<DeltaPill change={expenseChange} label="MoM" invert />}
            hint={money(data.profitLoss.expenses)}
          />
        </StaggerItem>
        <StaggerItem className="h-full">
          <StatCard
            icon={Coins}
            label="Net loss / profit"
            value={compact(data.profitLoss.profit)}
            tone={data.profitLoss.isProfit ? "ok" : "amber"}
            badge={
              <StatusPill tone={data.profitLoss.isProfit ? "ok" : "danger"}>
                {percent(margin, 1)} margin
              </StatusPill>
            }
            hint={money(data.profitLoss.profit)}
          />
        </StaggerItem>
        <StaggerItem className="h-full">
          <StatCard
            icon={Banknote}
            label="Cash & bank"
            value={compact(liquidity)}
            tone="teal"
            hint={`Cash ${money(data.balances.cash)} · Bank ${money(data.balances.bank)}`}
          />
        </StaggerItem>
      </StaggerGroup>

      <RevenueTrendChart trend={trend} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_336px]">
        <ActivityList rows={data.recentTransactions} onNavigate={onNavigate} />
        <aside className="flex min-w-0 flex-col gap-6">
          <LiquidityCard data={data} onNavigate={onNavigate} />
        </aside>
      </div>

      <BestSellersTable rows={data.topItems} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <LowStockTable rows={data.inventory.lowStockItems} total={data.inventory.totalItems} />
        <ExpiringTable rows={data.inventory.expiringItems} />
      </div>
    </div>
  );
}
