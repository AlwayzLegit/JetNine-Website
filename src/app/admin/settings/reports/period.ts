import { sql, type SQL } from "drizzle-orm";

// Shared by the Reports page and its CSV export.

// Smoke/QA quotes are flagged at write time by a "[SMOKE]" first-name prefix
// and a "smoke+…" email (see src/app/quote/actions.ts); they auto-cancel and
// otherwise pollute totals. This excludes them from quote counts so post-deploy
// smoke tests don't skew KPIs. (Postgres LIKE treats "[" literally — only
// % and _ are wildcards — so "[SMOKE]%" matches the literal prefix.)
export const NOT_SMOKE = sql`not (
  contact_snapshot->>'firstName' ilike '[SMOKE]%'
  or contact_snapshot->>'email' ilike 'smoke+%'
)`;

export type PeriodKey = "30" | "90" | "ytd";

export const PERIODS: { key: PeriodKey; label: string; words: string; prevWords: string | null }[] = [
  { key: "30", label: "Last 30 days", words: "in the last 30 days", prevWords: "vs. previous 30 days" },
  { key: "90", label: "Last 90 days", words: "in the last 90 days", prevWords: "vs. previous 90 days" },
  { key: "ytd", label: "This year", words: "so far this year", prevWords: null },
];

export function parsePeriod(v: string | undefined | null): PeriodKey {
  return v === "90" || v === "ytd" ? v : "30";
}

/** Window start / previous-window start as SQL date expressions. */
export function periodBounds(period: PeriodKey): { start: SQL; prevStart: SQL } {
  if (period === "ytd") {
    return {
      start: sql`date_trunc('year', current_date)::date`,
      prevStart: sql`(date_trunc('year', current_date) - interval '1 year')::date`,
    };
  }
  const days = period === "90" ? 90 : 30;
  return {
    start: sql`current_date - ${days}::int`,
    prevStart: sql`current_date - ${days * 2}::int`,
  };
}

/**
 * The start of the window as a date (UTC midnight), for the CSV export, which reads through
 * the request store and so cannot take the Postgres expressions of periodBounds. Same day as
 * `current_date - n` and `date_trunc('year', current_date)` on a UTC database.
 */
export function periodStartDate(period: PeriodKey, now: Date = new Date()): Date {
  if (period === "ytd") return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const days = period === "90" ? 90 : 30;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - days * 86_400_000);
}

/**
 * The start of the previous window (UTC midnight), for the D1 report store (OPS-163), which
 * cannot take the Postgres expressions of periodBounds. Same day as `current_date - 2n` and
 * `date_trunc('year', current_date) - interval '1 year'` on a UTC database.
 */
export function periodPrevStartDate(period: PeriodKey, now: Date = new Date()): Date {
  if (period === "ytd") return new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1));
  const days = period === "90" ? 90 : 30;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - days * 2 * 86_400_000);
}
