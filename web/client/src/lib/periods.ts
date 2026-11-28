/**
 * Period presets for the report pickers, ported from
 * report_view._populate_export_periods (every month/year since the project's
 * first books, most recent last).
 */
const EXPORT_START_YEAR = 2022;
const EXPORT_START_MONTH = 7; // 0-based → August 2022
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export interface ExportPeriod {
  label: string;
  from: string;
  to: string;
}

export function exportPeriods(
  frequency: "Monthly" | "Yearly",
  now = new Date(),
): ExportPeriod[] {
  const periods: ExportPeriod[] = [];
  if (frequency === "Yearly") {
    for (let year = EXPORT_START_YEAR; year <= now.getFullYear(); year += 1) {
      periods.push({ label: `${year}`, from: `${year}-01-01`, to: `${year}-12-31` });
    }
    return periods;
  }
  let year = EXPORT_START_YEAR;
  let month = EXPORT_START_MONTH;
  while (year < now.getFullYear() || (year === now.getFullYear() && month <= now.getMonth())) {
    const mm = String(month + 1).padStart(2, "0");
    const lastDay = new Date(year, month + 1, 0).getDate();
    periods.push({
      label: `${year}-${mm}  (${MONTH_NAMES[month]} ${year})`,
      from: `${year}-${mm}-01`,
      to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
    });
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return periods;
}
