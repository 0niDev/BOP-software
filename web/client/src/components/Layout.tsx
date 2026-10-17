import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import type { Page } from "../App";
import { SHORTCUTS_CHANGED, matchesSequence, shortcutMap } from "../shortcuts";
import type { User } from "../types";
import Sidebar, { NAV, NAV_SECTIONS, type NavEntry } from "./layout/Sidebar";
import TopBar from "./layout/TopBar";

interface Props {
  user: User;
  page: Page;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  children: ReactNode;
}

/**
 * Application shell: sectioned sidebar, top bar and the module host.
 *
 * All of the desktop app's navigation shortcuts live here — the module finder
 * (Ctrl+F / the command-palette key), Ctrl+1…9 / Ctrl+0 module jumps and
 * Ctrl+Tab / Ctrl+Shift+Tab stepping — and each one reads the sequences stored
 * in the SHORTCUTS settings group.
 */
export default function Layout({ user, page, onNavigate, onLogout, children }: Props) {
  const [finder, setFinder] = useState("");
  const [shortcuts, setShortcuts] = useState<Record<string, string>>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

      // The command-palette key (Ctrl+K by default, shown in the top bar) opens
      // the same module finder.
      if (matchesSequence(event, sequence("command_palette", "Ctrl+K"))) {
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

  function go(next: Page): void {
    onNavigate(next);
    setSidebarOpen(false);
  }

  const needle = finder.trim().toLowerCase();
  const matches = needle
    ? NAV.filter((entry) => entry.label.toLowerCase().includes(needle))
    : NAV;

  // While searching, one flat list; otherwise the permanent sections, with the
  // empty ones dropped.
  const sections: Array<{ title: string; items: readonly NavEntry[] }> = needle
    ? matches.length > 0
      ? [{ title: "Matches", items: matches }]
      : []
    : NAV_SECTIONS.map((section) => ({
        title: section.title,
        items: section.items.filter((entry) => matches.includes(entry)),
      })).filter((section) => section.items.length > 0);

  const onSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Escape") setFinder("");
    if (event.key === "Enter") {
      const first = matches[0];
      if (first) {
        go(first.id);
        setFinder("");
      }
    }
  };

  return (
    <div className="layout">
      <div
        className={`sidebar-scrim${sidebarOpen ? " open" : ""}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden
      />
      <Sidebar
        page={page}
        onNavigate={go}
        sections={sections}
        nothingMatches={matches.length === 0}
        open={sidebarOpen}
        hotkey={shortcuts["command_palette"] ?? "Ctrl+K"}
      />
      <main className="main" ref={mainRef}>
        <TopBar
          user={user}
          search={finder}
          onSearchChange={setFinder}
          onSearchKeyDown={onSearchKeyDown}
          searchRef={finderRef}
          onNavigate={go}
          onLogout={onLogout}
          onOpenSidebar={() => setSidebarOpen(true)}
        />
        {children}
      </main>
    </div>
  );
}
