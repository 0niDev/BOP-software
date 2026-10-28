import { useEffect, useState } from "react";
import {
  Banknote,
  BookOpen,
  Building2,
  ChevronDown,
  ChevronRight,
  Factory,
  FileBarChart,
  History,
  Landmark,
  LayoutDashboard,
  Leaf,
  Package,
  Receipt,
  RotateCcw,
  ScrollText,
  Settings,
  ShoppingCart,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Page } from "../../App";

export interface NavChild {
  id: Page;
  label: string;
}

export interface NavEntry {
  id: Page;
  label: string;
  icon: LucideIcon;
  children?: readonly NavChild[];
}

/**
 * Sidebar sections. They are contiguous slices of one flat order — the module
 * jump shortcuts (Ctrl+1…0, Ctrl+Tab) index that flat order, so the browser
 * audit pins Ctrl+2 = Sales Invoices and Ctrl+6 = Manufacturing.
 */
export const NAV_SECTIONS: ReadonlyArray<{ title: string; items: readonly NavEntry[] }> = [
  {
    title: "Overview",
    items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Sales & Purchasing",
    items: [
      { id: "sales", label: "Sales Invoices", icon: Receipt },
      { id: "purchases", label: "Purchase Invoices", icon: ShoppingCart },
      { id: "returns", label: "Returns", icon: RotateCcw },
    ],
  },
  {
    title: "Inventory & Production",
    items: [
      { id: "items", label: "Inventory", icon: Package },
      { id: "manufacturing", label: "Manufacturing", icon: Factory },
    ],
  },
  {
    title: "Accounting",
    items: [
      { id: "payments", label: "Invoice Payments", icon: Banknote },
      { id: "expenses", label: "Expense Vouchers", icon: Wallet },
      { id: "banking", label: "Banking Payments", icon: Landmark },
      { id: "journal", label: "Journal Vouchers", icon: ScrollText },
    ],
  },
  {
    title: "Master data",
    items: [
      { id: "parties", label: "Customers & Suppliers", icon: Users },
      { id: "accounts", label: "Chart of Accounts", icon: BookOpen },
      { id: "assets", label: "Fixed Assets", icon: Building2 },
    ],
  },
  {
    title: "Insights",
    items: [
      {
        id: "reports",
        label: "Reports",
        icon: FileBarChart,
        children: [
          { id: "report-trial-balance", label: "Trial Balance" },
          { id: "report-party-ledger", label: "Party Ledger" },
          { id: "report-cash-book", label: "Cash Book" },
          { id: "report-profit-loss", label: "Profit & Loss" },
          { id: "report-balance-sheet", label: "Balance Sheet" },
          { id: "report-export", label: "Export Reports" },
        ],
      },
    ],
  },
  {
    title: "Administration",
    items: [
      { id: "users", label: "Users", icon: UserCog },
      { id: "settings", label: "Settings", icon: Settings },
      { id: "deleted", label: "Deleted Records", icon: History },
    ],
  },
];

/** Flat module order (shortcut indices 1-9, 0 and Ctrl+Tab walk this). */
export const NAV: readonly NavEntry[] = NAV_SECTIONS.flatMap((section) => section.items);

interface Props {
  page: Page;
  onNavigate: (page: Page) => void;
  /** Sections already narrowed to the current search, empty sections removed. */
  sections: ReadonlyArray<{ title: string; items: readonly NavEntry[] }>;
  /** True when nothing matches the search. */
  nothingMatches: boolean;
  open: boolean;
  /** The stored "command palette" sequence, shown in the footer hint. */
  hotkey: string;
}

export default function Sidebar({
  page,
  onNavigate,
  sections,
  nothingMatches,
  open,
  hotkey,
}: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Keep the Reports submenu open while that module or any report page is selected.
  useEffect(() => {
    if (page === "reports" || page.startsWith("report-")) {
      setExpanded((prev) => (prev.reports ? prev : { ...prev, reports: true }));
    }
  }, [page]);

  return (
    <aside className={`sidebar${open ? " open" : ""}`} aria-label="Modules">
      <div className="brand">
        <span className="brand-mark" aria-hidden>
          <Leaf size={20} strokeWidth={2.2} />
        </span>
        <div className="brand-text">
          <div className="brand-name">BOP Nutraceuticals</div>
          <div className="brand-sub">ERP · {NAV.length} modules</div>
        </div>
      </div>

      <nav className="nav" aria-label="Modules">
        {sections.map((section) => (
          <div className="nav-section" key={section.title}>
            <div className="nav-section-title">{section.title}</div>
            {section.items.map((entry) => {
              const inSection = entry.children?.some((child) => child.id === page) ?? false;
              const active = entry.id === page || inSection;
              const isOpen = expanded[entry.id] ?? false;
              const hasChildren = (entry.children?.length ?? 0) > 0;
              return (
                <div className="nav-entry" key={entry.id}>
                  <button
                    type="button"
                    className={active ? "active" : undefined}
                    aria-current={entry.id === page ? "page" : undefined}
                    aria-expanded={hasChildren ? isOpen : undefined}
                    onClick={() => {
                      if (hasChildren) {
                        setExpanded((prev) => ({ ...prev, [entry.id]: !isOpen }));
                      }
                      onNavigate(entry.id);
                    }}
                  >
                    <entry.icon size={18} strokeWidth={2.1} aria-hidden />
                    <span className="min-w-0 truncate" style={{ flex: 1 }}>
                      {entry.label}
                    </span>
                    {hasChildren &&
                      (isOpen ? (
                        <ChevronDown size={14} aria-hidden />
                      ) : (
                        <ChevronRight size={14} aria-hidden />
                      ))}
                  </button>
                  {hasChildren && isOpen && (
                    <div className="nav-subitems">
                      {entry.children!.map((child) => {
                        const childActive = page === child.id;
                        return (
                          <button
                            key={child.id}
                            type="button"
                            className={childActive ? "active" : undefined}
                            aria-current={childActive ? "page" : undefined}
                            onClick={() => onNavigate(child.id)}
                          >
                            <span className="min-w-0 truncate">{child.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {nothingMatches && <div className="nav-empty">No module matches.</div>}
      </nav>

      <div className="sidebar-foot">
        <strong>Jump anywhere</strong>
        Press <span className="hotkey">{hotkey}</span> or Ctrl+F to search the modules from the
        top bar.
      </div>
    </aside>
  );
}
