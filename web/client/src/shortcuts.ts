/**
 * Client access to the keyboard shortcuts stored by the server.
 *
 * These are the desktop app's shortcuts: the same `SHORTCUTS` settings group and
 * the same action ids (see web/server/src/domain/shortcuts.ts), so a key rebound
 * in either app applies to both. The Layout binds the actions that map onto the
 * web UI — the module jumps, next/previous module, and focusing the module
 * finder. The rest of the catalogue is either browser-native (copy/paste/undo,
 * Ctrl+W, Ctrl+S) or has no web equivalent yet; they stay editable so the two
 * apps keep one catalogue.
 */
import { api } from "./api";

/** Fired when the Settings page changes a shortcut, so the Layout re-reads them. */
export const SHORTCUTS_CHANGED = "bop-erp:shortcuts-changed";

let cache: Record<string, string> | null = null;

/** actionId -> current key sequence. Failures fall back to the defaults. */
export async function shortcutMap(force = false): Promise<Record<string, string>> {
  if (cache && !force) return cache;
  try {
    const entries = await api.shortcuts();
    cache = Object.fromEntries(entries.map((entry) => [entry.actionId, entry.currentSequence]));
  } catch {
    cache = {}; // settings must never break the UI
  }
  return cache;
}

/** Forget the cache and tell the Layout to reload the sequences. */
export function shortcutsChanged(): void {
  cache = null;
  window.dispatchEvent(new Event(SHORTCUTS_CHANGED));
}

const MODIFIERS = ["ctrl", "alt", "shift", "meta", "cmd"];

function normaliseKey(key: string): string {
  return key.length === 1 ? key.toUpperCase() : key.toLowerCase();
}

/** Does a keyboard event match a Qt-style sequence such as "Ctrl+Shift+F"? */
export function matchesSequence(event: KeyboardEvent, sequence: string): boolean {
  const parts = sequence
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  const key = parts[parts.length - 1];
  if (!key || MODIFIERS.includes(key.toLowerCase())) return false;

  const wants = new Set(parts.slice(0, -1).map((part) => part.toLowerCase()));
  if (wants.has("ctrl") !== event.ctrlKey) return false;
  if (wants.has("alt") !== event.altKey) return false;
  if (wants.has("shift") !== event.shiftKey) return false;
  if ((wants.has("meta") || wants.has("cmd")) !== event.metaKey) return false;

  return normaliseKey(event.key) === normaliseKey(key);
}
