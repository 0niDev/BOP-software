/**
 * Shared number/date formatting for the dashboard widgets.
 *
 * `money()` still defers to "en-PK" to match every other screen in the ERP; the
 * compact helpers exist because the KPI tiles have to survive 1280px and 1024px
 * viewports without wrapping or overflowing.
 */

export function money(value: number, digits = 2): string {
  return value.toLocaleString("en-PK", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Compact figure for KPI tiles: 3.1M, 12.4K, 480. */
export function compact(value: number, digits = 1): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(digits)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(digits)}M`;
  if (abs >= 10_000) return `${(value / 1_000).toFixed(digits)}K`;
  return value.toLocaleString("en-PK", { maximumFractionDigits: 0 });
}

/** "2026-08-01" → "Aug 2026". Trend points are month starts. */
export function monthLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

/** "2026-10-16" → "16 Oct". */
export function dayLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function percent(value: number, digits = 1): string {
  return `${value >= 0 ? "" : "−"}${Math.abs(value).toFixed(digits)}%`;
}

/**
 * Change from `previous` to `current`, in percent. Null when there is no
 * baseline (previous is zero) — the UI shows no badge rather than a fake ∞.
 */
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** `part` as a 0–100 share of `whole`; 0 when the whole is empty. */
export function share(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.max(0, Math.min(100, (part / whole) * 100));
}

/** Up to two initials from a party or item name. */
export function initials(name: string): string {
  const words = name.trim().split(/[\s\-_/]+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0]?.[0] ?? "?";
  const second = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : (words[0]?.[1] ?? "");
  return `${first}${second}`.toUpperCase();
}

/**
 * Deterministic tint for an avatar tile: the same party always gets the same
 * gradient, and it is derived from the name so it survives a page reload.
 */
export function tint(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 360;
  }
  const from = hash;
  const to = (hash + 42) % 360;
  return `linear-gradient(140deg, hsl(${from} 68% 54%), hsl(${to} 72% 42%))`;
}
