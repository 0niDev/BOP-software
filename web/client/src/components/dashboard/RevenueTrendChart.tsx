import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "../ui/Card";
import ChartFrame, { LegendItem } from "../ui/ChartFrame";
import DeltaPill from "../ui/DeltaPill";
import { compact, money, monthLabel, percentChange } from "../../lib/format";
import type { DashboardData } from "../../types";

interface TrendRow {
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
}

interface TipPayload {
  dataKey?: string | number;
  value?: number | string;
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TipPayload[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  const revenue = Number(payload.find((row) => row.dataKey === "revenue")?.value ?? 0);
  const expenses = Number(payload.find((row) => row.dataKey === "expenses")?.value ?? 0);
  return (
    <div className="min-w-[190px] rounded-xl border border-line-strong bg-[var(--panel-solid)] p-3 shadow-float">
      <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-muted">{label}</p>
      <dl className="mt-2 space-y-1">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-[12px] font-semibold text-muted">Revenue</dt>
          <dd className="num text-[12px] font-bold text-ink">{money(revenue)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-[12px] font-semibold text-muted">Expenses</dt>
          <dd className="num text-[12px] font-bold text-ink">{money(expenses)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-line pt-1">
          <dt className="text-[12px] font-semibold text-muted">Net</dt>
          <dd
            className="num text-[12px] font-bold"
            style={{ color: revenue - expenses >= 0 ? "var(--ok)" : "var(--danger)" }}
          >
            {money(revenue - expenses)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/** Revenue against expenses for the last six months, month-over-month badge. */
export default function RevenueTrendChart({ trend }: { trend: DashboardData["monthlyTrend"] }) {
  const rows: TrendRow[] = trend.map((point) => ({
    label: monthLabel(point.month),
    revenue: point.revenue,
    expenses: point.expenses,
    profit: point.profit,
  }));

  const current = trend.at(-1);
  const previous = trend.at(-2);
  const change =
    current && previous ? percentChange(current.revenue, previous.revenue) : null;

  return (
    <Card
      title="Revenue vs expenses"
      subtitle="Posted journal entries, last six months"
      outline="cyan"
      action={<DeltaPill change={change} label="MoM" />}
    >
      <ChartFrame
        height={240}
        legend={
          <>
            <LegendItem color="var(--accent)" label="Revenue" />
            <LegendItem color="var(--amber)" label="Expenses" />
          </>
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--grid-line)" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 11, fill: "var(--muted)" }}
            />
            <YAxis
              width={52}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted)" }}
              tickFormatter={(value: number) => compact(value)}
            />
            <Tooltip content={<TrendTooltip />} cursor={{ stroke: "var(--border-strong)" }} />
            {/* Two clean, thin lines on a flat dark ground — solid electric cyan
                for revenue, dashed amber for expenses. No area fill, no glow. */}
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              animationDuration={750}
            />
            <Line
              type="monotone"
              dataKey="expenses"
              stroke="var(--amber)"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              animationDuration={850}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartFrame>
    </Card>
  );
}
