import type { ReactNode } from "react";

export type PillTone = "brand" | "teal" | "amber" | "ok" | "danger" | "slate";

/** Status tag: "Invoiced", "Received", "Low stock", … */
export default function StatusPill({
  tone = "slate",
  icon,
  children,
}: {
  tone?: PillTone;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className={`pill pill-${tone}`}>
      {icon}
      {children}
    </span>
  );
}
