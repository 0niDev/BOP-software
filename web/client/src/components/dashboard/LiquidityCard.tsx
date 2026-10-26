import { Banknote, Landmark, TrendingDown, TrendingUp } from "lucide-react";
import Card from "../ui/Card";
import StatusPill from "../ui/StatusPill";
import { dayLabel, money } from "../../lib/format";
import type { DashboardData } from "../../types";
import type { Page } from "../../App";

/**
 * Right column: the cash position in one place — what is owed in, what is owed
 * out and what is sitting in stock. Every figure comes from the dashboard
 * payload; the quick actions are the two places you go to act on it.
 */
export default function LiquidityCard({
  data,
  onNavigate,
}: {
  data: DashboardData;
  onNavigate: (page: Page) => void;
}) {
  const { balances, receivablesPayables, inventory } = data;
  const net = receivablesPayables.receivable - receivablesPayables.payable;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card
      title="Cash position"
      subtitle={`As at ${dayLabel(today)}`}
      compact
      outline="cyan"
      action={
        <StatusPill
          tone={net >= 0 ? "ok" : "danger"}
          icon={
            net >= 0 ? (
              <TrendingUp size={13} strokeWidth={2.4} aria-hidden />
            ) : (
              <TrendingDown size={13} strokeWidth={2.4} aria-hidden />
            )
          }
        >
          {net >= 0 ? "Net receivable" : "Net payable"}
        </StatusPill>
      }
    >
      <p className="num text-[26px] font-extrabold leading-tight tracking-tight text-ink">
        {money(balances.total)}
      </p>
      <p className="mt-1 text-[12px] font-medium text-muted">Liquid + stock on hand</p>

      <dl className="mt-4 space-y-2">
        {[
          { label: "Receivables", value: receivablesPayables.receivable, tone: "var(--accent)" },
          { label: "Payables", value: receivablesPayables.payable, tone: "var(--amber)" },
          {
            label: `Inventory (${inventory.totalItems} items)`,
            value: balances.inventory,
            tone: "var(--teal)",
          },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-2 text-[12.5px] font-semibold text-muted">
              <span
                aria-hidden
                style={{
                  background: row.tone,
                  width: 8,
                  height: 8,
                  borderRadius: 3,
                  display: "inline-block",
                }}
              />
              {row.label}
            </dt>
            <dd className="num text-[12.5px] font-bold text-ink">{money(row.value)}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => onNavigate("payments")}>
          <Banknote size={15} strokeWidth={2.3} aria-hidden />
          Payments
        </button>
        <button type="button" onClick={() => onNavigate("banking")}>
          <Landmark size={15} strokeWidth={2.3} aria-hidden />
          Bank &amp; Cash
        </button>
      </div>
    </Card>
  );
}
