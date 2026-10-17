import { AlertTriangle, CheckCircle2, CircleAlert } from "lucide-react";
import Card from "../ui/Card";
import { dayLabel } from "../../lib/format";
import type { DashboardData } from "../../types";

const TONE = {
  warning: { color: "var(--amber-ink)", Icon: AlertTriangle, label: "Watch" },
  danger: { color: "var(--danger-ink)", Icon: CircleAlert, label: "Action" },
  success: { color: "var(--ok-ink)", Icon: CheckCircle2, label: "Clear" },
} as const;

/** The dashboard's existing alert feed, in the drawer column. */
export default function AlertsCard({
  alerts,
  generatedAt,
}: {
  alerts: DashboardData["alerts"]["alerts"];
  generatedAt: string;
}) {
  return (
    <Card
      title="Alerts"
      subtitle={`Stock and expiry checks · ${dayLabel(generatedAt)}`}
      outline="amber"
      compact
      action={<span className="pill pill-slate">{alerts.length}</span>}
    >
      <ul className="space-y-2">
        {alerts.map((alert, index) => {
          const tone = TONE[alert.type];
          return (
            <li
              key={`${alert.title}-${index}`}
              className="flex gap-3 rounded-xl border border-line bg-[var(--panel-2)] p-3 transition-colors duration-200 hover:border-line-strong"
            >
              <span
                aria-hidden
                className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                style={{ background: "color-mix(in srgb, currentColor 12%, transparent)", color: tone.color }}
              >
                <tone.Icon size={15} strokeWidth={2.4} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold text-ink">{alert.title}</p>
                <p className="mt-0.5 text-[12px] font-medium leading-snug text-muted">
                  {alert.message}
                </p>
              </div>
            </li>
          );
        })}
        {alerts.length === 0 && <li className="empty-state">Nothing needs attention.</li>}
      </ul>
    </Card>
  );
}
