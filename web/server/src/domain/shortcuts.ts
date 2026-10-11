/**
 * Default keyboard shortcuts, ported verbatim from utils/shortcut_manager.py
 * (`DEFAULT_SHORTCUTS`).
 *
 * The desktop app persists only the customisations, in the `SHORTCUTS` settings
 * group under the key `shortcut:<action_id>`, with a JSON value shaped
 * `{"action_id": ..., "current_sequence": ...}`. The web app reads and writes the
 * same rows, so a key changed in either app shows up in the other.
 */

export interface ShortcutDefinition {
  actionId: string;
  defaultSequence: string;
  description: string;
  /** "window" = global, "widget" = only while a form has focus (desktop notion). */
  context: "window" | "widget";
  category: string;
}

export const DEFAULT_SHORTCUTS: readonly ShortcutDefinition[] = [
  // Navigation - module jump (Ctrl+1..9, Ctrl+0)
  { actionId: "module_jump_1", defaultSequence: "Ctrl+1", description: "Jump to module 1", context: "window", category: "Navigation" },
  { actionId: "module_jump_2", defaultSequence: "Ctrl+2", description: "Jump to module 2", context: "window", category: "Navigation" },
  { actionId: "module_jump_3", defaultSequence: "Ctrl+3", description: "Jump to module 3", context: "window", category: "Navigation" },
  { actionId: "module_jump_4", defaultSequence: "Ctrl+4", description: "Jump to module 4", context: "window", category: "Navigation" },
  { actionId: "module_jump_5", defaultSequence: "Ctrl+5", description: "Jump to module 5", context: "window", category: "Navigation" },
  { actionId: "module_jump_6", defaultSequence: "Ctrl+6", description: "Jump to module 6", context: "window", category: "Navigation" },
  { actionId: "module_jump_7", defaultSequence: "Ctrl+7", description: "Jump to module 7", context: "window", category: "Navigation" },
  { actionId: "module_jump_8", defaultSequence: "Ctrl+8", description: "Jump to module 8", context: "window", category: "Navigation" },
  { actionId: "module_jump_9", defaultSequence: "Ctrl+9", description: "Jump to module 9", context: "window", category: "Navigation" },
  { actionId: "module_jump_0", defaultSequence: "Ctrl+0", description: "Jump to module 10", context: "window", category: "Navigation" },

  // Module navigation
  { actionId: "module_next", defaultSequence: "Ctrl+Tab", description: "Next module", context: "window", category: "Navigation" },
  { actionId: "module_prev", defaultSequence: "Ctrl+Shift+Tab", description: "Previous module", context: "window", category: "Navigation" },

  // Common actions
  { actionId: "refresh", defaultSequence: "Ctrl+R", description: "Refresh current view", context: "window", category: "General" },
  { actionId: "search", defaultSequence: "Ctrl+F", description: "Focus search", context: "window", category: "General" },
  { actionId: "new_record", defaultSequence: "Ctrl+N", description: "Create new record", context: "window", category: "General" },
  { actionId: "command_palette", defaultSequence: "Ctrl+K", description: "Open command palette", context: "window", category: "General" },

  // File/Window actions
  { actionId: "close_tab", defaultSequence: "Ctrl+W", description: "Close current tab", context: "window", category: "Window" },
  { actionId: "save", defaultSequence: "Ctrl+S", description: "Save current form", context: "widget", category: "General" },
  { actionId: "cancel", defaultSequence: "Escape", description: "Cancel/Close dialog", context: "widget", category: "General" },

  // Edit actions
  { actionId: "copy", defaultSequence: "Ctrl+C", description: "Copy", context: "widget", category: "Edit" },
  { actionId: "paste", defaultSequence: "Ctrl+V", description: "Paste", context: "widget", category: "Edit" },
  { actionId: "cut", defaultSequence: "Ctrl+X", description: "Cut", context: "widget", category: "Edit" },
  { actionId: "undo", defaultSequence: "Ctrl+Z", description: "Undo", context: "widget", category: "Edit" },
  { actionId: "redo", defaultSequence: "Ctrl+Y", description: "Redo", context: "widget", category: "Edit" },

  // View actions
  { actionId: "toggle_sidebar", defaultSequence: "Ctrl+B", description: "Toggle sidebar", context: "window", category: "View" },
  { actionId: "fullscreen", defaultSequence: "F11", description: "Toggle fullscreen", context: "window", category: "View" },
];

export const SHORTCUTS_GROUP = "SHORTCUTS";

/** Settings key the desktop app stores one action's override under. */
export function shortcutSettingKey(actionId: string): string {
  return `shortcut:${actionId}`;
}

export function findShortcutDefinition(actionId: string): ShortcutDefinition | undefined {
  return DEFAULT_SHORTCUTS.find((entry) => entry.actionId === actionId);
}
