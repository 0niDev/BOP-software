import { TrendingDown, TrendingUp } from "lucide-react";

/**
 * Percentage badge for a KPI. Renders nothing when there is no baseline to
 * compare against, so a tile never shows an invented percentage.
 */
export default function DeltaPill({
  change,
  label = "vs last month",
  invert = false,
}: {
  change: number | null;
  label?: string;
  /** For metrics where "up" is bad (expenses, payables). */
  invert?: boolean;
}) {
  if (change === null) return null;

  const rising = change >= 0;
  const good = invert ? !rising : rising;
  const tone = change === 0 ? "slate" : good ? "ok" : "danger";
  const Icon = rising ? TrendingUp : TrendingDown;
  const sign = rising ? "+" : "−";

  return (
    <span className={`pill pill-${tone}`}>
      <Icon size={13} strokeWidth={2.4} aria-hidden />
      {sign}
      {Math.abs(change).toFixed(1)}%
      <span className="font-medium opacity-70">{label}</span>
    </span>
  );
}
