/**
 * Money handling.
 *
 * This is the single most important correction over the Python code base,
 * which stored money as IEEE-754 floats and manually rounded. All money
 * arithmetic here is done in exact decimal (decimal.js) and only converted
 * to a JS number at the database boundary, rounded half-up to 2 places.
 *
 * The database columns remain SQLite REAL so the new backend stays
 * byte-compatible with the existing Python app and its data.
 */
// decimal.js ships a broken `export default` under NodeNext resolution in this
// version; the named export is the type-safe form.
import { Decimal } from "decimal.js";
import { ValidationError } from "./errors.js";

Decimal.set({
  precision: 34,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -30,
  toExpPos: 40,
});

export const MONEY_DP = 2;

/**
 * Quantities are not money: they need more than 2 decimal places (e.g. grams,
 * millilitres or fractional units). 6 dp keeps sub-unit receipts from being
 * rounded away while staying well inside what a SQLite REAL round-trips.
 */
export const QUANTITY_DP = 6;

/**
 * Largest magnitude we will persist. The SQLite Cloud driver encodes
 * whole-number parameters as 64-bit integers, so a value at or above 2^63
 * overflows and is silently stored as garbage (1e21 -> 1). This ceiling sits
 * comfortably below both that range and Number.MAX_SAFE_INTEGER.
 */
export const MAX_STORAGE_VALUE = 1e15;

export type MoneyLike = Decimal | number | string | null | undefined;

/** Coerce anything money-shaped into a Decimal without throwing on null. */
export function dec(value: MoneyLike): Decimal {
  if (value === null || value === undefined) return new Decimal(0);
  return value instanceof Decimal ? value : new Decimal(value);
}

/** Round to the storage scale (2 dp, half-up). Returns a Decimal. */
export function round2(value: MoneyLike): Decimal {
  return dec(value).toDecimalPlaces(MONEY_DP, Decimal.ROUND_HALF_UP);
}

/** Reject values that cannot be stored faithfully (non-finite or out of range). */
function assertStorageRange(value: Decimal, label: string): void {
  if (!value.isFinite()) {
    throw new ValidationError(`${label} is not a finite number.`);
  }
  if (value.abs().greaterThan(MAX_STORAGE_VALUE)) {
    throw new ValidationError(
      `${label} exceeds the maximum supported value of ${MAX_STORAGE_VALUE}.`,
    );
  }
}

/** Value to persist into a REAL money column (2 dp, range-checked). */
export function toStorage(value: MoneyLike): number {
  const rounded = round2(value);
  assertStorageRange(rounded, "Amount");
  return rounded.toNumber();
}

/** Value to persist into a REAL quantity column (6 dp, range-checked). */
export function toQuantity(value: MoneyLike): number {
  const rounded = dec(value).toDecimalPlaces(QUANTITY_DP, Decimal.ROUND_HALF_UP);
  assertStorageRange(rounded, "Quantity");
  return rounded.toNumber();
}

/** Exact sum of many money values. */
export function sum(values: readonly MoneyLike[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(dec(v)), new Decimal(0));
}

/** Multiply (quantity * price) then round to storage scale. */
export function multiply(a: MoneyLike, b: MoneyLike): Decimal {
  return round2(dec(a).times(dec(b)));
}

/** Format as an amount with two decimals and thousands separators. */
export function formatAmount(value: MoneyLike): string {
  return new Intl.NumberFormat("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(round2(value).toNumber());
}

/** Format with the configured currency symbol. */
export function formatMoney(value: MoneyLike, currency = "PKR"): string {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(round2(value).toNumber());
}

export { Decimal };
