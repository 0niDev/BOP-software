/**
 * Live table filter, ported from views/widgets/search_bar.py: typing filters
 * the rows in place (case-insensitive substring across every visible column),
 * Esc clears, and Layout's Ctrl+F focuses the first `[data-search]` input on
 * the page (falling back to the sidebar module finder).
 */

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function FilterBox({ value, onChange, placeholder = "Type to filter…" }: Props) {
  return (
    <input
      data-search
      className="filter-box"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Escape") onChange("");
      }}
    />
  );
}

/** True when the query is empty or appears in any of the given cell values. */
export function matchesQuery(query: string, values: Array<string | number | null | undefined>): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return values.some((value) => value != null && String(value).toLowerCase().includes(needle));
}
