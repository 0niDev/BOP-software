import type { ReactNode } from "react";

/**
 * Fixed-height frame a chart draws inside. Recharts' `ResponsiveContainer`
 * measures its parent, so the wrapper must own a real height and must be
 * allowed to shrink to zero width inside a flex/grid column (`min-w-0`).
 */
export default function ChartFrame({
  height = 220,
  legend,
  children,
}: {
  height?: number;
  legend?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      {legend && (
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">{legend}</div>
      )}
      <div className="w-full min-w-0" style={{ height }}>
        {children}
      </div>
    </div>
  );
}

/** One entry of a hand-rolled legend (Recharts' own legend is not themable). */
export function LegendItem({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-muted">
      <span
        aria-hidden
        style={{ background: color, width: 10, height: 10, borderRadius: 3, display: "inline-block" }}
      />
      {label}
      {value && <span className="num font-bold text-ink">{value}</span>}
    </span>
  );
}
