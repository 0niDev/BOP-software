/**
 * Date validation utilities.
 *
 * The audit found that dates were accepted as raw strings with no format or
 * calendar validation. This module provides a Zod-compatible validator that
 * enforces ISO 8601 date format (YYYY-MM-DD) and valid calendar dates.
 */
import { z } from "zod";
import { ValidationError } from "../domain/errors.js";

/**
 * Regular expression for ISO 8601 date format (YYYY-MM-DD).
 * This is stricter than just checking string length — it validates the format.
 */
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates that a string is a valid ISO 8601 date (YYYY-MM-DD) and represents
 * a real calendar date (e.g., rejects 2026-02-30, 2026-13-01).
 *
 * @param value - The string to validate
 * @returns The validated date string (YYYY-MM-DD)
 * @throws ValidationError if the date is invalid
 */
export function validateIsoDate(value: string): string {
  if (typeof value !== "string") {
    throw new ValidationError("Date must be a string.");
  }
  if (!ISO_DATE_REGEX.test(value)) {
    throw new ValidationError("Date must be in YYYY-MM-DD format.");
  }

  // Parse components
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));

  // Basic range checks
  if (year < 1900 || year > 2100) {
    throw new ValidationError("Year must be between 1900 and 2100.");
  }
  if (month < 1 || month > 12) {
    throw new ValidationError("Month must be between 01 and 12.");
  }
  if (day < 1 || day > 31) {
    throw new ValidationError("Day must be between 01 and 31.");
  }

  // Calendar validation using Date object — this catches invalid dates like
  // 2026-02-30, 2026-04-31, etc. The Date constructor rolls over invalid dates,
  // so we compare the parsed components with the constructed date's components.
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new ValidationError("Invalid calendar date.");
  }

  return value;
}

/**
 * Zod schema for an ISO 8601 date string (YYYY-MM-DD) with calendar validation.
 * Use this in place of `z.string().min(1)` for date fields.
 *
 * @example
 * const schema = z.object({
 *   invoiceDate: isoDateSchema,
 * });
 */
export const isoDateSchema = z.string().refine(validateIsoDate, {
  message: "Date must be a valid calendar date in YYYY-MM-DD format.",
});

/**
 * Optional ISO date schema — allows null/undefined.
 */
export const optionalIsoDateSchema = z.string().refine(validateIsoDate, {
  message: "Date must be a valid calendar date in YYYY-MM-DD format.",
}).nullish();

/**
 * Validates a date string and returns a Date object (UTC midnight).
 * Useful when you need to do date arithmetic.
 */
export function parseIsoDate(value: string): Date {
  validateIsoDate(value);
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Formats a Date as YYYY-MM-DD (UTC).
 */
export function formatIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns today's date as YYYY-MM-DD (UTC).
 */
export function todayIso(): string {
  return formatIsoDate(new Date());
}

/**
 * Returns the first day of the current month as YYYY-MM-DD (UTC).
 */
export function monthStartIso(): string {
  const date = new Date();
  return formatIsoDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)));
}