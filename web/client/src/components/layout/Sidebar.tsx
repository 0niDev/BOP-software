import {
  Banknote,
  BookOpen,
  Building2,
  Factory,
  FileBarChart,
  Landmark,
  LayoutDashboard,
  Leaf,
  Package,
  Receipt,
  RotateCcw,
  Settings,
  ShoppingCart,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Page } from "../../App";

export interface NavEntry {
  id: Page;
  label: string;
  icon: LucideIcon;
}

/**
 * Sidebar sections. They are contiguous slices of one flat order — the module
 * jump shortcuts (Ctrl+1…0, Ctrl+Tab) index that flat order, and the browser
 * audit asserts Ctrl+2 selects Sales Invoices and Ctrl+5 Manufacturing, so the
 * grouping must never reorder the modules themselves.
 */
export const NAV_SECTIONS: ReadonlyArray<{ title: string; items: readonly NavEntry[] }> = [
  {
    title: "Overview",
    items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Operations",
    items: [
      { id: "sales", label: "Sales Invoices", icon: Receipt },
      { id: "purchases", label: "Purchase Invoices", icon: ShoppingCart },
      { id: "payments", label: "Payments & Receipts", icon: Banknote },
      { id: "manufacturing", label: "Manufacturing", icon: Factory },
      { id: "expenses", label: "Expenses", icon: Wallet },
      { id: "banking", label: "Banking", icon: Landmark },
      { id: "returns", label: "Returns", icon: RotateCcw },
    ],
  },
  {
    title: "Master data",
    items: [
      { id: "parties", label: "Customers & Suppliers", icon: Users },
      { id: "items", label: "Items", icon: Package },
      { id: "assets", label: "Fixed Assets", icon: Building2 },
      { id: "accounts", label: "Chart of Accounts", icon: BookOpen },
    ],
  },
  {
    title: "Insights",
    items: [{ id: "reports", label: "Reports", icon: FileBarChart }],
  },
  {
    title: "Administration",
    items: [
      { id: "users", label: "Users", icon: UserCog },
      { id: "settings", label: "Settings", icon: Settings },
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
              const active = entry.id === page;
              return (
                <button
                  key={entry.id}
                  type="button"
                  className={active ? "active" : undefined}
                  aria-current={active ? "page" : undefined}
                  onClick={() => onNavigate(entry.id)}
                >
                  <entry.icon size={18} strokeWidth={2.1} aria-hidden />
                  <span className="min-w-0 truncate">{entry.label}</span>
                </button>
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
