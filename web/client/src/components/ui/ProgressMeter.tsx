import type { ReactNode } from "react";

/** A slim labelled progress meter (revenue share, stock cover, …). */
export default function ProgressMeter({
  value,
  tone = "brand",
  label,
  trailing,
}: {
  /** 0–100. */
  value: number;
  tone?: "brand" | "ok" | "amber" | "danger";
  label?: ReactNode;
  trailing?: ReactNode;
}) {
  const width = Math.max(0, Math.min(100, value));
  const toneClass =
    tone === "brand" ? "meter" : `meter tone-${tone === "ok" ? "ok" : tone}`;
  return (
    <div className="w-full min-w-0">
      {(label || trailing) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          {label && <span className="truncate text-[12px] font-semibold text-ink">{label}</span>}
          {trailing && (
            <span className="num shrink-0 text-[12px] font-semibold text-muted">{trailing}</span>
          )}
        </div>
      )}
      <div
        className={toneClass}
        role="progressbar"
        aria-valuenow={Math.round(width)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
