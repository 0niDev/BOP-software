import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Banknote,
  Factory,
  MoreVertical,
  Receipt,
  RotateCcw,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import Card from "../ui/Card";
import Avatar from "../ui/Avatar";
import StatusPill, { type PillTone } from "../ui/StatusPill";
import { dayLabel, money } from "../../lib/format";
import useAnchoredPosition from "../../lib/useAnchoredPosition";
import type { DashboardData } from "../../types";
import type { Page } from "../../App";

type Transaction = DashboardData["recentTransactions"][number];

/** What each transaction type means, where it links, and how it is tagged. */
const META: Record<
  string,
  { label: string; tone: PillTone; target: Page; module: string }
> = {
  Sales: { label: "Invoiced", tone: "brand", target: "sales", module: "Sales Invoices" },
  Purchases: { label: "Received", tone: "teal", target: "purchases", module: "Purchase Invoices" },
  Payment: { label: "Paid", tone: "amber", target: "payments", module: "Invoice Payments" },
  Receipt: { label: "Collected", tone: "ok", target: "payments", module: "Invoice Payments" },
  Expense: { label: "Processed", tone: "slate", target: "expenses", module: "Expense Vouchers" },
};

function metaFor(type: string) {
  return META[type] ?? { label: type, tone: "slate" as PillTone, target: "dashboard" as Page, module: "Dashboard" };
}

/** Per-row action menu; every entry navigates to the module that owns the row. */
function RowMenu({ type, onNavigate }: { type: string; onNavigate: (page: Page) => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const meta = metaFor(type);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent): void => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // The menu is fixed-position (so no card can clip it); anchor it to the button.
  useAnchoredPosition(open, wrapRef, menuRef, { align: "right" });

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        className="icon-btn"
        aria-label={`Actions for this ${type.toLowerCase()} entry`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreVertical size={16} strokeWidth={2.4} aria-hidden />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="menu"
            role="menu"
            ref={menuRef}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onNavigate(meta.target);
              }}
            >
              Open in {meta.module}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onNavigate("reports");
              }}
            >
              Open reports
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TypeIcon({ type }: { type: string }) {
  const icons = {
    Sales: Receipt,
    Purchases: ShoppingCart,
    Payment: Banknote,
    Receipt: Wallet,
    Expense: Factory,
    Return: RotateCcw,
  } as const;
  const Icon = icons[type as keyof typeof icons] ?? Receipt;
  return <Icon size={15} strokeWidth={2.2} aria-hidden />;
}

/** Row 2 of the executive grid: the newest movements across every module. */
export default function ActivityList({
  rows,
  onNavigate,
}: {
  rows: Transaction[];
  onNavigate: (page: Page) => void;
}) {
  return (
    <Card
      title="Recent activity"
      subtitle={`Newest ${rows.length} movements across every module`}
      outline="indigo"
      action={
        <button type="button" onClick={() => onNavigate("sales")}>
          View all
        </button>
      }
      bodyClassName="-mx-1"
    >
      {rows.length === 0 ? (
        <p className="empty-state">No transactions yet.</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((row, index) => {
            const meta = metaFor(row.type);
            return (
              <li
                key={`${row.reference}-${index}`}
                className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors duration-200 hover:bg-[var(--panel-2)]"
              >
                <Avatar name={row.partyName ?? row.reference} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-bold text-ink">{row.reference}</p>
                  <p className="truncate text-[12px] font-medium text-muted">
                    {row.partyName ?? "—"} · {dayLabel(row.date)}
                  </p>
                </div>
                <StatusPill tone={meta.tone} icon={<TypeIcon type={row.type} />}>
                  {meta.label}
                </StatusPill>
                <span className="num hidden w-[110px] shrink-0 text-[13.5px] font-bold text-ink sm:block">
                  {money(row.amount)}
                </span>
                <RowMenu type={row.type} onNavigate={onNavigate} />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
