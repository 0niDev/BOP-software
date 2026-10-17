import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { fadeUp } from "./motion";

/**
 * One KPI tile: icon tile, label, big figure, optional percentage badge and a
 * hint line. Used for the top strip of the dashboard.
 */
export default function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  badge,
  hint,
  tone = "brand",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  unit?: string;
  badge?: ReactNode;
  hint?: ReactNode;
  tone?: "brand" | "teal" | "amber" | "ok";
}) {
  const reduce = useReducedMotion();

  // Which electric outline this tile wears: brand/positive → cyan,
  // warning metrics → amber, secondary/teal → indigo (see `.outline-*`).
  const OUTLINE: Record<string, "cyan" | "indigo" | "amber"> = {
    brand: "cyan",
    teal: "indigo",
    amber: "amber",
    ok: "cyan",
  };

  // The `-ink` tones are the AA-safe text variants (see styles.css tokens).
  const toneStyle: Record<string, { background: string; color: string }> = {
    brand: { background: "var(--accent-soft)", color: "var(--accent)" },
    teal: {
      background: "color-mix(in srgb, var(--teal) 12%, transparent)",
      color: "var(--teal-ink)",
    },
    amber: {
      background: "color-mix(in srgb, var(--amber) 14%, transparent)",
      color: "var(--amber-ink)",
    },
    ok: { background: "var(--badge-bg)", color: "var(--ok-ink)" },
  };

  return (
    <motion.article
      variants={reduce ? undefined : fadeUp}
      className={`flex h-full min-w-0 flex-col gap-4 rounded-xl border border-line bg-surface p-6 outline-${OUTLINE[tone]} transition-colors duration-150`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg"
          style={toneStyle[tone]}
        >
          <Icon size={19} strokeWidth={2.2} />
        </span>
        {badge}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
          {label}
        </p>
        <p className="mt-1 flex items-baseline gap-1.5">
          <span className="num text-[23px] font-extrabold leading-tight tracking-tight text-ink">
            {value}
          </span>
          {unit && <span className="text-[12px] font-semibold text-muted">{unit}</span>}
        </p>
        {hint && <p className="mt-1 text-[12px] font-medium text-muted">{hint}</p>}
      </div>
    </motion.article>
  );
}
