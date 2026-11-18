import { requestStore } from "@/domain/requests/store";

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
 * same transaction (an atomic batch on D1). The queries live in the request
 * store (OPS-154).
 */
export async function pruneSmokeQuotes(): Promise<number> {
  return requestStore().pruneSmoke(new Date(), BATCH);
}
