import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Command, LogOut, Menu, Plus, Search } from "lucide-react";
import Avatar from "../ui/Avatar";
import useMediaQuery from "../../lib/useMediaQuery";
import { api } from "../../api";
import type { DashboardData, User } from "../../types";
import type { Page } from "../../App";

const TONE_COLOR: Record<string, string> = {
  warning: "var(--amber-ink)",
  danger: "var(--danger-ink)",
  success: "var(--ok-ink)",
};

/** Bell + the alert feed. The feed is fetched the first time it is opened. */
function NotificationBell({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const [open, setOpen] = useState(false);
  const [feed, setFeed] = useState<DashboardData["alerts"] | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent): void => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open || feed) return;
    let cancelled = false;
    api
      .dashboard()
      .then((data) => {
        if (!cancelled) setFeed(data.alerts);
      })
      .catch(() => {
        if (!cancelled) setFeed({ count: 0, alerts: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [open, feed]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        className={`icon-btn${open ? " active" : ""}`}
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={18} strokeWidth={2.2} aria-hidden />
      </button>
      {feed && feed.count > 0 && !open && (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold text-white"
          style={{ background: "var(--danger)" }}
        >
          {feed.count}
        </span>
      )}
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Notifications"
            className="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            <div className="px-2.5 py-2 text-[12px] font-bold uppercase tracking-[0.08em] text-muted">
              {feed ? `${feed.count} alert${feed.count === 1 ? "" : "s"}` : "Loading alerts…"}
            </div>
            {feed?.alerts.slice(0, 5).map((alert, index) => (
              <div key={`${alert.title}-${index}`} className="flex gap-2.5 px-2.5 py-2">
                <span
                  aria-hidden
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: TONE_COLOR[alert.type] ?? "var(--muted)" }}
                />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold text-ink">{alert.title}</p>
                  <p className="text-[12px] font-medium leading-snug text-muted">{alert.message}</p>
                </div>
              </div>
            ))}
            {feed && feed.count === 0 && (
              <p className="empty-state">Nothing needs attention.</p>
            )}
            <button
              type="button"
              role="menuitem"
              className="mt-1"
              onClick={() => {
                setOpen(false);
                onNavigate("dashboard");
              }}
            >
              Open the dashboard
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface Props {
  user: User;
  search: string;
  onSearchChange: (value: string) => void;
  onSearchKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  onOpenSidebar: () => void;
}

export default function TopBar({
  user,
  search,
  onSearchChange,
  onSearchKeyDown,
  searchRef,
  onNavigate,
  onLogout,
  onOpenSidebar,
}: Props) {
  // Only the compact layout gets the drawer toggle — see useMediaQuery.
  const compact = useMediaQuery("(max-width: 1023.9px)");

  return (
    <div className="topbar">
      {compact && (
        <button
          type="button"
          className="sidebar-toggle icon-btn"
          aria-label="Open navigation"
          onClick={onOpenSidebar}
        >
          <Menu size={18} strokeWidth={2.3} aria-hidden />
        </button>
      )}

      <div className="search-field">
        <Search size={16} strokeWidth={2.3} aria-hidden />
        <input
          ref={searchRef}
          aria-label="Find module"
          placeholder="Find module…  (Ctrl+F)"
          value={search}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onSearchChange(event.target.value)}
          onKeyDown={onSearchKeyDown}
        />
        <span className="hotkey" aria-hidden>
          <Command size={11} strokeWidth={2.6} />K
        </span>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <NotificationBell onNavigate={onNavigate} />
        <button
          type="button"
          className="icon-btn"
          aria-label="New sales invoice"
          title="New sales invoice"
          onClick={() => onNavigate("sales")}
        >
          <Plus size={18} strokeWidth={2.4} aria-hidden />
        </button>
        <span className="hidden min-w-0 items-center gap-2.5 rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-3.5 xl:flex">
          <Avatar name={user.fullName} size={30} rounded={999} />
          <span className="min-w-0">
            <span className="block truncate text-[12.5px] font-bold leading-tight text-ink">
              {user.fullName}
            </span>
            <span className="block truncate text-[12px] font-medium leading-tight text-muted">
              {user.roleName ?? "No role"}
            </span>
          </span>
        </span>
        <button type="button" onClick={onLogout}>
          <LogOut size={15} strokeWidth={2.3} aria-hidden />
          Sign out
        </button>
      </div>
    </div>
  );
}
