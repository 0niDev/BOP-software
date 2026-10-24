import { useEffect, useRef, useState, type ChangeEvent, type InputHTMLAttributes } from "react";

/**
 * A numeric input that never forces a "0" into the box.
 *
 * A controlled `type="number"` bound to numeric state shows "0" for zero (you
 * have to delete it first) and the browser eats intermediate text such as "0."
 * while typing "0.5". This keeps the raw text, shows nothing for zero, selects
 * the content on focus so typing replaces it, and still hands the native change
 * event to the caller, so `Number(event.target.value)` keeps working.
 *
 * Text rather than number on purpose: the browsers strip partial decimals from
 * number inputs, and the arrow keys are already used to move between table rows.
 */
interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
  value: number;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

const NUMERIC = /^-?\d*\.?\d*$/;

export default function NumberInput({ value, onChange, ...rest }: Props) {
  const [text, setText] = useState(value === 0 ? "" : String(value));
  const focused = useRef(false);

  // Follow programmatic changes (item selected, form reset) while not typing.
  useEffect(() => {
    if (!focused.current) setText(value === 0 ? "" : String(value));
  }, [value]);

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onFocus={(event) => {
        focused.current = true;
        event.currentTarget.select();
        rest.onFocus?.(event);
      }}
      onBlur={(event) => {
        focused.current = false;
        setText(value === 0 ? "" : String(value));
        rest.onBlur?.(event);
      }}
      onChange={(event) => {
        if (!NUMERIC.test(event.target.value)) return; // keep letters/paste noise out
        setText(event.target.value);
        onChange(event);
      }}
    />
  );
}
