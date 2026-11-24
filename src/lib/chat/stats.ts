// The site chat's daily counters in D1 (OPS-242). Counts only: no visitor text,
// no address, no transcript. A failed write never blocks an answer.
import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { desc, gte } from "drizzle-orm";
import { chatDaily } from "@/db/d1/schema/chat";

export type Counts = { sessions?: number; messages?: number; handoffs?: number; guardHits?: number; fallbacks?: number };

/** Pacific date (yyyy-mm-dd) of an instant, the day the counters are kept by. */
export function pacificDay(now = new Date()): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Adds the counts to today's row, creating it on the first call of the day. */
export async function addCounts(db: DrizzleD1Database, counts: Counts, now = new Date()): Promise<void> {
  const v = { sessions: counts.sessions ?? 0, messages: counts.messages ?? 0, handoffs: counts.handoffs ?? 0, guardHits: counts.guardHits ?? 0, fallbacks: counts.fallbacks ?? 0 };
  await db
    .insert(chatDaily)
    .values({ day: pacificDay(now), ...v })
    .onConflictDoUpdate({
      target: chatDaily.day,
      set: {
        sessions: sql`${chatDaily.sessions} + ${v.sessions}`,
        messages: sql`${chatDaily.messages} + ${v.messages}`,
        handoffs: sql`${chatDaily.handoffs} + ${v.handoffs}`,
        guardHits: sql`${chatDaily.guardHits} + ${v.guardHits}`,
        fallbacks: sql`${chatDaily.fallbacks} + ${v.fallbacks}`,
      },
    });
}

/** Hand-offs (a visitor pressed "Continue to your quote") over the last 7 Pacific days, today included. */
export async function handoffs7d(db: DrizzleD1Database, now = new Date()): Promise<number> {
  const since = pacificDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
  const rows = await db.select({ handoffs: chatDaily.handoffs }).from(chatDaily).where(gte(chatDaily.day, since)).orderBy(desc(chatDaily.day));
  return rows.reduce((n, r) => n + r.handoffs, 0);
}
