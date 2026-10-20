import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import useAnchoredPosition from "../lib/useAnchoredPosition";

/**
 * A native `<select>` the user can type into.
 *
 * Browsers give a `<select>` no way to filter its options, which is painful on
 * the long lists in this app (565 items, 139 parties, the whole chart of
 * accounts). This renders the same thing as a combobox: one input that shows the
 * current choice and doubles as the search box, with a filtered option panel.
 *
 * Replaces every `<select>` in the client so the interaction is uniform.
 */
export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  /** Receives the option's value directly (not a change event). */
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  id?: string;
  disabled?: boolean;
  /** Shown when nothing is selected yet. */
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
  /** Shown when the typed filter matches no option. */
  emptyText?: string;
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  id,
  disabled = false,
  placeholder = "Search…",
  ariaLabel,
  className,
  style,
  emptyText = "No matches",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) || option.value.toLowerCase().includes(needle),
    );
  }, [options, query]);

  // Close when the click lands outside (blur alone is not enough: the panel
  // lives inside the same wrapper).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent): void => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // The panel is fixed-position (so no card can clip it); anchor it to the input.
  useAnchoredPosition(open, wrapRef, panelRef, { matchWidth: true });

  // Keep the highlight inside the filtered list as it changes.
  useEffect(() => {
    setHighlight((current) => Math.min(Math.max(current, 0), Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  function choose(option: SelectOption): void {
    onChange(option.value);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  }

  // While open the input holds the search text; once closed it shows the choice.
  const display = open ? query : (selected?.label ?? "");

  return (
    <div className={`sselect${className ? ` ${className}` : ""}`} style={style} ref={wrapRef}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-label={ariaLabel ?? placeholder}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        placeholder={selected ? selected.label : placeholder}
        value={display}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setHighlight((current) => Math.min(current + 1, Math.max(filtered.length - 1, 0)));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlight((current) => Math.max(current - 1, 0));
          } else if (event.key === "Enter") {
            const choice = filtered[highlight];
            if (open && choice) {
              event.preventDefault();
              choose(choice);
            }
          } else if (event.key === "Escape") {
            setOpen(false);
            setQuery("");
            inputRef.current?.blur();
          }
        }}
      />
      {open && (
        <div className="sselect-panel" role="listbox" ref={panelRef}>
          {filtered.length === 0 && <div className="sselect-empty">{emptyText}</div>}
          {filtered.map((option, index) => (
            <div
              key={option.value === "" ? "«empty»" : option.value}
              role="option"
              aria-selected={option.value === value}
              className={`sselect-option${index === highlight ? " active" : ""}${
                option.value === value ? " selected" : ""
              }`}
              // Down, not click: mousedown fires before the input's blur.
              onMouseDown={(event) => {
                event.preventDefault();
                choose(option);
              }}
              onMouseEnter={() => setHighlight(index)}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
