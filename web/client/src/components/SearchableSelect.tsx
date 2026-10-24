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
  /** Focus the field when it mounts (first field of a dialog). */
  autoFocus?: boolean;
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
  autoFocus = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  // Did the user pick or move the highlight? Tabbing through an untouched
  // field must not replace an existing choice with the first option.
  const engaged = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);
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

  // A field focused automatically (a newly added line) opens its list, so the
  // user can pick straight away; tabbing in by hand leaves it closed.
  useEffect(() => {
    if (autoFocus) setOpen(true);
  }, [autoFocus]);

  // Keep the highlight inside the filtered list as it changes.
  useEffect(() => {
    setHighlight((current) => Math.min(Math.max(current, 0), Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  // Arrow keys move the highlight; keep it visible in the scrolling panel.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector(".sselect-option.active")?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  function commit(option: SelectOption): void {
    onChange(option.value);
    setOpen(false);
    setQuery("");
    engaged.current = false;
  }

  function choose(option: SelectOption): void {
    commit(option);
  }

  // While open the input holds the search text; once closed it shows the choice.
  const display = open ? query : (selected?.label ?? "");

  return (
    <div className={`sselect${className ? ` ${className}` : ""}`} style={style} ref={wrapRef}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-label={ariaLabel ?? placeholder}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={selected ? selected.label : placeholder}
        value={display}
        // Open on click, not on focus: tabbing through a form must not pop every
        // dropdown open, it should just move on.
        onMouseDown={() => {
          if (open) return;
          setOpen(true);
          setQuery("");
        }}
        // Clicking an option uses mousedown+preventDefault, so this only fires
        // when focus really leaves the field (Tab, click elsewhere).
        onBlur={() => {
          setOpen(false);
          setQuery("");
          engaged.current = false;
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          engaged.current = true;
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            engaged.current = true;
            setOpen(true);
            setHighlight((current) =>
              open ? Math.min(current + 1, Math.max(filtered.length - 1, 0)) : 0,
            );
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            engaged.current = true;
            setHighlight((current) => Math.max(current - 1, 0));
          } else if (event.key === "Enter") {
            const choice = filtered[highlight];
            if (open && choice && engaged.current) {
              event.preventDefault();
              choose(choice);
            } else if (open) {
              // Nothing was picked: just close, do not submit the form.
              event.preventDefault();
              setOpen(false);
              setQuery("");
            } else {
              // Closed box: open the list like a native select, do not submit.
              event.preventDefault();
              setOpen(true);
              setHighlight(0);
            }
          } else if (event.key === "Tab" && !event.shiftKey) {
            // Commit the highlighted match and let the browser move to the next
            // field, so a form can be filled without the mouse.
            const choice = filtered[highlight];
            if (open && choice && engaged.current) commit(choice);
          } else if (event.key === "Escape") {
            // Close only the dropdown when it is open; otherwise let the key
            // reach the dialog and close that.
            if (open) event.stopPropagation();
            setOpen(false);
            setQuery("");
          }
        }}
      />
      {open && (
        <div className="sselect-panel" role="listbox" ref={panelRef} tabIndex={-1}>
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
