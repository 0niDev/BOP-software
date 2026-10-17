import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import Card from "../ui/Card";
import ChartFrame from "../ui/ChartFrame";
import ProgressMeter from "../ui/ProgressMeter";
import { compact, money, percent, share } from "../../lib/format";
import type { DashboardData } from "../../types";

const SLICE_COLORS = [
  "var(--accent)",
  "#818cf8",
  "var(--amber)",
  "var(--teal)",
  "#a1a1aa",
  "#f472b6",
];

interface TipPayload {
  payload?: { partyName?: string; revenue?: number; invoices?: number };
}

function SliceTooltip({ active, payload }: { active?: boolean; payload?: TipPayload[] }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="rounded-xl border border-line-strong bg-[var(--panel-solid)] p-3 shadow-float">
      <p className="text-[12px] font-bold text-ink">{row.partyName}</p>
      <p className="num mt-1 text-[12px] font-semibold text-muted">{money(row.revenue ?? 0)}</p>
      <p className="text-[12px] font-medium text-muted">
        {row.invoices ?? 0} invoice{(row.invoices ?? 0) === 1 ? "" : "s"}
      </p>
    </div>
  );
}

/**
 * Where the sales come from: the top customers by invoiced value. The centre of
 * the donut repeats the total, and the list under it carries the exact share.
 */
export default function CustomerDonut({ rows }: { rows: DashboardData["salesByCustomer"] }) {
  const total = rows.reduce((sum, row) => sum + row.revenue, 0);

  return (
    <Card title="Customer mix" subtitle="Share of invoiced value, all time" outline="indigo">
      <ChartFrame height={186}>
        <div className="relative h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={<SliceTooltip />} />
              <Pie
                data={rows}
                dataKey="revenue"
                nameKey="partyName"
                innerRadius="62%"
                outerRadius="98%"
                paddingAngle={2}
                stroke="none"
                animationDuration={750}
              >
                {rows.map((row, index) => (
                  <Cell
                    key={row.partyName}
                    fill={SLICE_COLORS[index % SLICE_COLORS.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Invoiced
              </p>
              <p className="num text-[19px] font-extrabold tracking-tight text-ink">
                {compact(total)}
              </p>
            </div>
          </div>
        </div>
      </ChartFrame>

      {rows.length === 0 ? (
        <p className="empty-state">No confirmed sales yet.</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {rows.slice(0, 4).map((row, index) => (
            <li key={row.partyName}>
              <ProgressMeter
                value={share(row.revenue, total)}
                tone={index === 0 ? "brand" : index === 1 ? "ok" : "amber"}
                label={
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden
                      style={{
                        background: SLICE_COLORS[index % SLICE_COLORS.length],
                        width: 9,
                        height: 9,
                        borderRadius: 3,
                        display: "inline-block",
                      }}
                    />
                    {row.partyName}
                  </span>
                }
                trailing={percent(share(row.revenue, total), 0)}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
