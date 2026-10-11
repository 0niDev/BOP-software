import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Page } from "../App";
import { SHORTCUTS_CHANGED, matchesSequence, shortcutMap } from "../shortcuts";
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
  const [shortcuts, setShortcuts] = useState<Record<string, string>>({});
  const finderRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  // The stored shortcuts, reloaded whenever the Settings page rebinds one.
  useEffect(() => {
    let cancelled = false;
    const load = (force: boolean) =>
      void shortcutMap(force).then((map) => {
        if (!cancelled) setShortcuts(map);
      });
    load(false);
    const reload = () => load(true);
    window.addEventListener(SHORTCUTS_CHANGED, reload);
    return () => {
      cancelled = true;
      window.removeEventListener(SHORTCUTS_CHANGED, reload);
    };
  }, []);

  // Bind the stored sequences (falling back to the defaults until they load):
  // "search" focuses the current page's filter when it has one, else the module
  // finder — the same behaviour as main_window._focus_search — and the
  // module_jump_* / module_next / module_prev actions walk the sidebar.
  useEffect(() => {
    function focusSearch(): void {
      const local = mainRef.current?.querySelector<HTMLInputElement>("[data-search]");
      const target = local ?? finderRef.current;
      target?.focus();
      target?.select();
    }

    function onKeyDown(event: KeyboardEvent): void {
      const sequence = (actionId: string, fallback: string): string =>
        shortcuts[actionId] ?? fallback;

      if (matchesSequence(event, sequence("search", "Ctrl+F"))) {
        event.preventDefault();
        focusSearch();
        return;
      }

      // Ctrl+1..9 and Ctrl+0 jump to the first ten modules.
      for (const [index, entry] of NAV.slice(0, 10).entries()) {
        const digit = index === 9 ? 0 : index + 1;
        if (matchesSequence(event, sequence(`module_jump_${digit}`, `Ctrl+${digit}`))) {
          event.preventDefault();
          onNavigate(entry.id);
          return;
        }
      }

      const current = Math.max(
        NAV.findIndex((entry) => entry.id === page),
        0,
      );
      const walk: Array<[string, string, number]> = [
        ["module_next", "Ctrl+Tab", 1],
        ["module_prev", "Ctrl+Shift+Tab", -1],
      ];
      for (const [actionId, fallback, step] of walk) {
        if (matchesSequence(event, sequence(actionId, fallback))) {
          event.preventDefault();
          onNavigate(NAV[(current + step + NAV.length) % NAV.length]!.id);
          return;
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shortcuts, page, onNavigate]);

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
