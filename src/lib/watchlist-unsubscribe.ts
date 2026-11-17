import "server-only";
import { watchlistStore, type UnsubscribeScope } from "@/domain/empty-legs/watchlist-store";
import { logAudit } from "@/lib/audit";

/**
 * Withdrawing consent, shared by the one-click POST endpoint and the
 * page behind the link in the body.
 *
 * Scope is the email channel, not the whole watchlist: the link lives in
 * an email, so it stops emails. Someone who also confirmed SMS keeps
 * getting texts, and the page says so and offers to stop those too.
 * Silently killing a channel the reader never asked about would be its
 * own kind of surprise.
 *
 * Idempotent by construction — unsubscribing an already-unsubscribed row
 * is a no-op that still reports success, because a provider retrying a
 * one-click POST must not see a failure.
 */

export type { UnsubscribeScope };

export async function unsubscribeByToken(
  token: string,
  scope: UnsubscribeScope,
): Promise<{ ok: boolean; found: boolean }> {
  if (!token) return { ok: false, found: false };

  // Chosen once, outside the try blocks, so a d1 target without its binding fails loudly.
  const store = watchlistStore();
  let row;
  try {
    row = await store.byUnsubscribeToken(token);
  } catch (err) {
    console.error("[watchlist-unsubscribe] lookup failed", err);
    return { ok: false, found: false };
  }
  if (!row) return { ok: true, found: false };

  try {
    await store.unsubscribe(row.id, scope, new Date());
  } catch (err) {
    console.error("[watchlist-unsubscribe] write failed", err);
    return { ok: false, found: true };
  }

  try {
    await logAudit({
      actorUserId: null,
      actorRole: "system",
      action: `empty_leg_watchlist.unsubscribe.${scope}`,
      subjectType: "empty_leg_watchlist",
      subjectId: row.id,
      metadata: { scope },
    });
  } catch {
    // Never fail a withdrawal of consent over an audit write.
  }

  return { ok: true, found: true };
}
