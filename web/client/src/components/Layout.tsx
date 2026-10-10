import type { ReactNode } from "react";
import type { Page } from "../App";
import type { User } from "../types";

const NAV: Array<{ id: Page; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "sales", label: "Sales Invoices" },
  { id: "purchases", label: "Purchase Invoices" },
  { id: "payments", label: "Payments & Receipts" },
  { id: "manufacturing", label: "Manufacturing" },
  { id: "expenses", label: "Expenses" },
  { id: "banking", label: "Banking" },
  { id: "returns", label: "Returns" },
  { id: "parties", label: "Customers & Suppliers" },
  { id: "items", label: "Items" },
  { id: "accounts", label: "Chart of Accounts" },
  { id: "reports", label: "Reports" },
  { id: "users", label: "Users" },
  { id: "settings", label: "Settings" },
];

interface Props {
  user: User;
  page: Page;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  children: ReactNode;
}

export default function Layout({ user, page, onNavigate, onLogout, children }: Props) {
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">BOP Nutraceuticals ERP</div>
        <nav className="nav">
          {NAV.map((entry) => (
            <button
              key={entry.id}
              className={entry.id === page ? "active" : ""}
              onClick={() => onNavigate(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="main">
        <div className="topbar">
          <div>
            Signed in as <strong>{user.fullName}</strong>
            {user.roleName ? ` (${user.roleName})` : ""}
          </div>
          <button onClick={onLogout}>Sign out</button>
        </div>
        {children}
      </main>
    </div>
  );
}
