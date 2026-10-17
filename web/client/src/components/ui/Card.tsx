import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

interface Props {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Extra classes for the body wrapper (the default is no wrapper padding). */
  bodyClassName?: string;
  /** Slightly denser header, for the side column. */
  compact?: boolean;
  /** Entry delay in seconds when the card is not inside a `StaggerGroup`. */
  delay?: number;
  /**
   * Draws the card's razor-thin electric outline (see `.outline-*` in
   * styles.css): cyan for primary/financial widgets, indigo for secondary
   * ones, amber for inventory and warning widgets. None = neutral hairline.
   */
  outline?: "cyan" | "indigo" | "amber";
}

/**
 * The dashboard surface: a flat matte panel — 12px radius, hairline neutral
 * border, no shadow, no bevel — optionally carrying a laser-etched accent
 * outline. Every widget on the landing page is built from this so the grid
 * stays visually uniform.
 */
export default function Card({
  title,
  subtitle,
  action,
  children,
  className = "",
  bodyClassName,
  compact = false,
  delay = 0,
  outline,
}: Props) {
  const reduce = useReducedMotion();

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut", delay }}
      className={`rounded-xl border border-line bg-surface p-6 transition-colors duration-150 ${
        outline ? `outline-${outline}` : ""
      } ${className}`}
    >
      {(title || action) && (
        <header
          className={`flex items-start justify-between gap-3 ${compact ? "mb-4" : "mb-5"}`}
        >
          <div className="min-w-0">
            {title && (
              <h2
                style={{ margin: 0, fontSize: compact ? 15 : 17 }}
                className="font-bold tracking-tight text-ink"
              >
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-1 text-[12px] font-medium text-muted">{subtitle}</p>
            )}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </motion.section>
  );
}
