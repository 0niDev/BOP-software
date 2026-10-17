import { Banknote, Landmark, PencilLine, Wallet } from "lucide-react";
import Card from "../ui/Card";
import Avatar from "../ui/Avatar";
import ProgressMeter from "../ui/ProgressMeter";
import StatusPill from "../ui/StatusPill";
import { compact, money, share } from "../../lib/format";
import type { DashboardData, User } from "../../types";
import type { Page } from "../../App";

/**
 * Right column: who is signed in, how the month is going, and what the business
 * is holding. The bars are shares of this month's revenue rather than invented
 * targets — every number here comes straight from the dashboard payload.
 */
export default function ProfileDrawer({
  user,
  data,
  onNavigate,
}: {
  user: User;
  data: DashboardData;
  onNavigate: (page: Page) => void;
}) {
  const { profitLoss, balances, receivablesPayables, today, inventory } = data;
  const basis = Math.max(profitLoss.revenue, profitLoss.expenses);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Card compact outline="cyan">
        <div className="flex items-center gap-3">
          <Avatar name={user.fullName} size={54} rounded={16} />
          <div className="min-w-0">
            <h2 style={{ margin: 0, fontSize: 16 }} className="font-bold tracking-tight text-ink">
              {user.fullName}
            </h2>
            <p className="truncate text-[12px] font-medium text-muted">@{user.username}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {user.roleName ? (
            <StatusPill tone="brand">{user.roleName}</StatusPill>
          ) : (
            <StatusPill tone="slate">No role assigned</StatusPill>
          )}
          <StatusPill tone="ok">Signed in</StatusPill>
        </div>
        <button
          type="button"
          className="mt-4 w-full"
          onClick={() => onNavigate("settings")}
        >
          <PencilLine size={15} strokeWidth={2.3} aria-hidden />
          Edit profile
        </button>
      </Card>

      <Card title="This month" subtitle="Share of the month's movement" compact outline="indigo">
        <div className="space-y-3.5">
          <ProgressMeter
            value={share(profitLoss.revenue, basis)}
            tone="brand"
            label="Revenue"
            trailing={money(profitLoss.revenue)}
          />
          <ProgressMeter
            value={share(profitLoss.expenses, basis)}
            tone="amber"
            label="Expenses"
            trailing={money(profitLoss.expenses)}
          />
          <ProgressMeter
            value={share(Math.max(profitLoss.profit, 0), basis)}
            tone={profitLoss.isProfit ? "ok" : "danger"}
            label={profitLoss.isProfit ? "Net profit" : "Net loss"}
            trailing={money(profitLoss.profit)}
          />
        </div>
      </Card>

      <Card
        title="Earnings"
        subtitle="Cash, bank and stock on hand"
        compact
        outline="cyan"
        action={
          <StatusPill tone={profitLoss.isProfit ? "ok" : "danger"}>
            {profitLoss.isProfit ? "Profit" : "Loss"}
          </StatusPill>
        }
      >
        <p className="num text-[26px] font-extrabold leading-tight tracking-tight text-ink">
          {compact(balances.total)}
        </p>
        <p className="mt-1 text-[12px] font-medium text-muted">
          Liquid + stock on hand · {today.salesCount} sale
          {today.salesCount === 1 ? "" : "s"} today ({money(today.salesTotal)})
        </p>

        <dl className="mt-4 space-y-2">
          {[
            { label: "Receivables", value: receivablesPayables.receivable, tone: "var(--accent)" },
            { label: "Payables", value: receivablesPayables.payable, tone: "var(--amber)" },
            { label: `Inventory (${inventory.totalItems} items)`, value: balances.inventory, tone: "var(--teal)" },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-[12.5px] font-semibold text-muted">
                <span
                  aria-hidden
                  style={{ background: row.tone, width: 8, height: 8, borderRadius: 3, display: "inline-block" }}
                />
                {row.label}
              </dt>
              <dd className="num text-[12.5px] font-bold text-ink">{money(row.value)}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 flex flex-col gap-2">
          <button type="button" className="primary w-full" onClick={() => onNavigate("banking")}>
            <Wallet size={15} strokeWidth={2.3} aria-hidden />
            Withdraw earnings
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onNavigate("payments")}>
              <Banknote size={15} strokeWidth={2.3} aria-hidden />
              Payments
            </button>
            <button type="button" onClick={() => onNavigate("banking")}>
              <Landmark size={15} strokeWidth={2.3} aria-hidden />
              Banking
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
