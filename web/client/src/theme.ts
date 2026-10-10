/**
 * Theme application. The Python desktop app shipped Dark / Light / System /
 * Custom Qt palettes; the web client has the same four names stored in the
 * APPEARANCE settings group, resolved here into a `data-theme` attribute on
 * <html> (styling lives in styles.css).
 */

export const THEMES = ["dark", "light", "system", "custom"] as const;
export type ThemeName = (typeof THEMES)[number];

/** "system" follows the OS preference; "custom" falls back to the dark base. */
export function resolveTheme(name: unknown): "dark" | "light" {
  const value = typeof name === "string" ? name.toLowerCase() : "dark";
  if (value === "light") return "light";
  if (value === "system" && typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return "dark";
}

export function applyTheme(name: unknown): void {
  document.documentElement.dataset.theme = resolveTheme(name);
  document.documentElement.dataset.themeSource =
    typeof name === "string" ? name.toLowerCase() : "dark";
}
