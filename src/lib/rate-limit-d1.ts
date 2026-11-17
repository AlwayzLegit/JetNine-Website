import { lt, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { requestRateLimits } from "@/db/d1/schema/rate-limits";

// The D1 (SQLite) statements of the rate limiter (OPS-123). The client is passed in so a
// test can hand it a real SQLite. Same single atomic statement as on Postgres: an insert
// with an upsert on the (bucket, window) key that adds one and returns the count.

/** Count one hit in the window that starts at `windowStartMs`; returns the hits so far, this one included. */
export async function d1CountHit(db: DrizzleD1Database, bucket: string, windowStartMs: number): Promise<number> {
  const [row] = await db
    .insert(requestRateLimits)
    .values({ id: `${bucket}|${windowStartMs}`, bucket, windowStart: new Date(windowStartMs), hits: 1 })
    .onConflictDoUpdate({ target: requestRateLimits.id, set: { hits: sql`${requestRateLimits.hits} + 1` } })
    .returning({ hits: requestRateLimits.hits });
  return row?.hits ?? 1;
}

/** Delete the windows that started before `cutoffMs`. */
export async function d1PruneBefore(db: DrizzleD1Database, cutoffMs: number): Promise<void> {
  await db.delete(requestRateLimits).where(lt(requestRateLimits.windowStart, new Date(cutoffMs)));
}
