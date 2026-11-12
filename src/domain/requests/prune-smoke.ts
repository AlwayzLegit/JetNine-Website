import { and, eq, inArray, lt, notExists, sql } from "drizzle-orm";
import { db } from "@/db";
import { messages } from "@/db/schema/audit";
import { quotes } from "@/db/schema/quotes";
import { trips } from "@/db/schema/trips";
import { IS_SMOKE } from "@/domain/common";

/** Most rows removed per run, so one backlog never holds a long transaction. */
const BATCH = 200;

/**
 * Delete the quotes the post-deploy smoke suite leaves behind.
 *
 * Every deploy submits a real quote flagged "[SMOKE]" (see IS_SMOKE). The
 * desk never sees them, but they accumulate one per deploy. A row goes only
 * when all three hold:
 *   - it carries the smoke marker,
 *   - it is more than 7 days old, so a failed deploy can still be inspected,
 *   - no trip points at it, so nothing that was ever booked is touched.
 *
 * Legs, sourced options and schedule blocks cascade from the quote. Thread
 * messages are polymorphic with no foreign key, so they go first, in the
 * same transaction.
 */
export async function pruneSmokeQuotes(): Promise<number> {
  return db.transaction(async (tx) => {
    const stale = await tx
      .select({ id: quotes.id })
      .from(quotes)
      .where(
        and(
          IS_SMOKE,
          lt(quotes.createdAt, sql`now() - interval '7 days'`),
          notExists(tx.select({ one: sql`1` }).from(trips).where(eq(trips.quoteId, quotes.id))),
        ),
      )
      .limit(BATCH);
    if (stale.length === 0) return 0;

    const ids = stale.map((row) => row.id);
    await tx.delete(messages).where(and(eq(messages.subjectType, "quote"), inArray(messages.subjectId, ids)));
    await tx.delete(quotes).where(inArray(quotes.id, ids));
    return ids.length;
  });
}
