import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { emptyLegWatchlists } from "@/db/schema/empty-legs";
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

export type UnsubscribeScope = "email" | "all";

export async function unsubscribeByToken(
  token: string,
  scope: UnsubscribeScope,
): Promise<{ ok: boolean; found: boolean }> {
  if (!token) return { ok: false, found: false };

  let row;
  try {
    [row] = await db
      .select({ id: emptyLegWatchlists.id, email: emptyLegWatchlists.email })
      .from(emptyLegWatchlists)
      .where(eq(emptyLegWatchlists.unsubscribeToken, token))
      .limit(1);
  } catch (err) {
    console.error("[watchlist-unsubscribe] lookup failed", err);
    return { ok: false, found: false };
  }
  if (!row) return { ok: true, found: false };

  try {
    await db
      .update(emptyLegWatchlists)
      .set(
        scope === "all"
          ? {
              active: false,
              deactivatedAt: new Date(),
              deactivatedReason: "email_unsubscribe",
              emailConfirmedAt: null,
              notifyChannels: { email: false, sms: false },
            }
          : { emailConfirmedAt: null, notifyChannels: { email: false, sms: true } },
      )
      .where(eq(emptyLegWatchlists.id, row.id));
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
