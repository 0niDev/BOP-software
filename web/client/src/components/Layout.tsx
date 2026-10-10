import { useEffect, useRef, useState, type ReactNode } from "react";
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
  { id: "assets", label: "Fixed Assets" },
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
  const [finder, setFinder] = useState("");
  const finderRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  // Ctrl+F focuses the current page's table filter when it has one, else the
  // module finder — the same behaviour as main_window._focus_search.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "f") return;
      event.preventDefault();
      const local = mainRef.current?.querySelector<HTMLInputElement>("[data-search]");
      const target = local ?? finderRef.current;
      target?.focus();
      target?.select();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const needle = finder.trim().toLowerCase();
  const visible = needle
    ? NAV.filter((entry) => entry.label.toLowerCase().includes(needle))
    : NAV;

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">BOP Nutraceuticals ERP</div>
        <input
          ref={finderRef}
          className="nav-filter"
          placeholder="Find module…  (Ctrl+F)"
          value={finder}
          onChange={(e) => setFinder(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setFinder("");
            const first = visible[0];
            if (e.key === "Enter" && first) {
              onNavigate(first.id);
              setFinder("");
            }
          }}
        />
        <nav className="nav">
          {visible.map((entry) => (
            <button
              key={entry.id}
              className={entry.id === page ? "active" : ""}
              onClick={() => onNavigate(entry.id)}
            >
              {entry.label}
            </button>
          ))}
          {visible.length === 0 && <div className="nav-empty">No module matches.</div>}
        </nav>
      </aside>
      <main className="main" ref={mainRef}>
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
