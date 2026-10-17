import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Provide to make the column sortable by clicking its header. */
  sortValue?: (row: T) => number | string;
  /** Right-aligns the column and uses tabular figures (`.num`). */
  numeric?: boolean;
  width?: string;
}

interface Props<T> {
  columns: ReadonlyArray<Column<T>>;
  rows: readonly T[];
  rowKey: (row: T) => string;
  empty: ReactNode;
  initialSortKey?: string;
  initialSortDir?: "asc" | "desc";
  /** Scroll container minimum width; below this the table scrolls sideways. */
  minWidth?: number;
  ariaLabel: string;
}

/**
 * Sortable data table for the dashboard. Sorting is client-side over the rows
 * already fetched — the dashboard payload is a fixed top-N, so there is nothing
 * to re-query — and the header buttons are the only interactive part.
 */
export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  initialSortKey,
  initialSortDir = "desc",
  minWidth = 420,
  ariaLabel,
}: Props<T>) {
  const [sortKey, setSortKey] = useState<string | null>(initialSortKey ?? null);
  const [direction, setDirection] = useState<"asc" | "desc">(initialSortDir);

  const activeColumn = columns.find((column) => column.key === sortKey);

  const sorted = useMemo(() => {
    const read = activeColumn?.sortValue;
    if (!read) return rows;
    const factor = direction === "asc" ? 1 : -1;
    return [...rows].sort((left, right) => {
      const a = read(left);
      const b = read(right);
      if (typeof a === "number" && typeof b === "number") return (a - b) * factor;
      return String(a).localeCompare(String(b)) * factor;
    });
  }, [rows, activeColumn, direction]);

  function toggle(column: Column<T>): void {
    if (!column.sortValue) return;
    if (column.key === sortKey) {
      setDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(column.key);
    setDirection("desc");
  }

  return (
    <div className="table-scroll">
      <table className="dash-table" style={{ minWidth }} aria-label={ariaLabel}>
        <thead>
          <tr>
            {columns.map((column) => {
              const isActive = column.key === sortKey;
              return (
                <th
                  key={column.key}
                  className={column.numeric ? "num" : undefined}
                  style={column.width ? { width: column.width } : undefined}
                  aria-sort={
                    isActive ? (direction === "asc" ? "ascending" : "descending") : undefined
                  }
                >
                  {column.sortValue ? (
                    <button
                      type="button"
                      className="sort-btn"
                      onClick={() => toggle(column)}
                      title={`Sort by ${typeof column.header === "string" ? column.header : column.key}`}
                    >
                      {column.header}
                      {isActive ? (
                        direction === "asc" ? (
                          <ArrowUp size={13} strokeWidth={2.6} aria-hidden />
                        ) : (
                          <ArrowDown size={13} strokeWidth={2.6} aria-hidden />
                        )
                      ) : (
                        <ChevronsUpDown size={13} strokeWidth={2.2} aria-hidden />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.key} className={column.numeric ? "num" : undefined}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={columns.length}>
                <div className="empty-state">{empty}</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
