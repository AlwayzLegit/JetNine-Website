import { sql } from "drizzle-orm";
import type { db } from "@/db";
import { emptyLegCodeSequence } from "@/db/schema/empty-legs";
import { invoiceCodeSequence } from "@/db/schema/invoices";
import { memberCodeSequence } from "@/db/schema/members";
import { quoteCodeSequence } from "@/db/schema/quotes";
import { tripCodeSequence } from "@/db/schema/trips";

// Human-readable codes (JN-2026-00042, INV-2026-0007, ...), made by the app
// (OPS-101). Until now a Postgres trigger filled them: it ran
// `insert into [kind]_code_sequence ... on conflict (year) do update set
// last_value = last_value + 1 returning last_value` and formatted the result.
// The app now runs the same single statement, written with Drizzle so that it
// compiles for Postgres and for D1 (SQLite 3.35+ has UPSERT ... RETURNING).
//
// The triggers stay in place while production is on Postgres. They fill the
// code only when it is null or empty, so with the app supplying it they do
// nothing and the counter moves once.

export type CodeKind = "quote" | "trip" | "invoice" | "empty_leg" | "member";

const FORMATS: Record<CodeKind, { prefix: string; pad: number }> = {
  quote: { prefix: "JN", pad: 5 },
  trip: { prefix: "JN", pad: 4 },
  invoice: { prefix: "INV", pad: 4 },
  empty_leg: { prefix: "EL", pad: 4 },
  member: { prefix: "M", pad: 4 },
};

// Every sequence table has the same two columns (year, last_value); only the
// table name in the type differs, so one of them stands for all five.
type SequenceTable = typeof quoteCodeSequence;
const SEQUENCES: Record<CodeKind, SequenceTable> = {
  quote: quoteCodeSequence,
  trip: tripCodeSequence as unknown as SequenceTable,
  invoice: invoiceCodeSequence as unknown as SequenceTable,
  empty_leg: emptyLegCodeSequence as unknown as SequenceTable,
  member: memberCodeSequence as unknown as SequenceTable,
};

/** The year in every code: UTC, as `extract(year from now())` was on a UTC database. */
export function codeYear(now: Date = new Date()): number {
  return now.getUTCFullYear();
}

/** JN-2026-00042, INV-2026-0007, ... A number wider than the padding is kept whole. */
export function formatCode(kind: CodeKind, year: number, n: number): string {
  const { prefix, pad } = FORMATS[kind];
  return `${prefix}-${year}-${String(n).padStart(pad, "0")}`;
}

/** The database handle or a transaction from `db.transaction(async (tx) => ...)`. */
export type CodeExecutor = Pick<typeof db, "insert">;

/**
 * The next code for a kind. One atomic statement. Call it inside the same
 * transaction as the insert that uses the code, so a failed insert gives the
 * number back.
 */
export async function nextCode(
  executor: CodeExecutor,
  kind: CodeKind,
  now: Date = new Date(),
): Promise<string> {
  const year = codeYear(now);
  const table = SEQUENCES[kind];
  const [row] = await executor
    .insert(table)
    .values({ year, lastValue: 1 })
    .onConflictDoUpdate({
      target: table.year,
      set: { lastValue: sql`${table.lastValue} + 1` },
    })
    .returning({ n: table.lastValue });
  if (!row) throw new Error(`code sequence for ${kind} returned no row`);
  return formatCode(kind, year, row.n);
}
