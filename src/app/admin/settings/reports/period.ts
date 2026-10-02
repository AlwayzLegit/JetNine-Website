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
