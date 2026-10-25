/**
 * Click-to-sort table headers and a from/to date range for list filters.
 * Every list page already holds its full rows, so sorting stays client-side.
 */

import type { Dispatch, ReactNode, SetStateAction } from "react";

export type SortDir = 1 | -1;
export interface SortState {
  key: string;
  dir: SortDir;
}

/** Human order: numbers numerically, text numerically-aware ("INV-9" < "INV-10"). */
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function compareValues(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
  dir: SortDir,
): number {
  if (typeof a === "number" && typeof b === "number") return (a - b) * dir;
  return collator.compare(String(a ?? ""), String(b ?? "")) * dir;
}

export function sortRows<T>(
  rows: T[],
  sort: SortState | null,
  value: (row: T, key: string) => string | number | null | undefined,
): T[] {
  if (!sort) return rows;
  return [...rows].sort((a, b) => compareValues(value(a, sort.key), value(b, sort.key), sort.dir));
}

/** A <th> that sorts on click; clicking the active column flips the direction. */
export function SortTh({
  label,
  sortKey,
  sort,
  setSort,
  className,
}: {
  label: ReactNode;
  sortKey: string;
  sort: SortState | null;
  setSort: Dispatch<SetStateAction<SortState | null>>;
  className?: string;
}) {
  const active = sort?.key === sortKey;
  return (
    <th
      className={className}
      aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : undefined}
      style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
      onClick={() =>
        setSort((current) =>
          current?.key === sortKey
            ? { key: sortKey, dir: current.dir === 1 ? -1 : 1 }
            : { key: sortKey, dir: 1 },
        )
      }
    >
      {label}
      {active ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
    </th>
  );
}

/** True when an ISO date (YYYY-MM-DD) falls inside the inclusive range. Empty bounds are open. */
export function inDateRange(
  date: string | null | undefined,
  from: string,
  to: string,
): boolean {
  if (!from && !to) return true;
  if (!date) return false;
  return (!from || date >= from) && (!to || date <= to);
}

/** From/To date inputs; setting both to the same day jumps to that day. */
export function DateRange({
  from,
  to,
  onFrom,
  onTo,
}: {
  from: string;
  to: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
}) {
  return (
    <>
      <div>
        <label>From</label>
        <input type="date" value={from} max={to || undefined} onChange={(e) => onFrom(e.target.value)} />
      </div>
      <div>
        <label>To</label>
        <input type="date" value={to} min={from || undefined} onChange={(e) => onTo(e.target.value)} />
      </div>
    </>
  );
}
