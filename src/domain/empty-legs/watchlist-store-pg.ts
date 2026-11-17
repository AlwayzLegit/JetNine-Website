import { and, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { emptyLegWatchlistMatches, emptyLegWatchlists } from "@/db/schema/empty-legs";
import { DEACTIVATED_BY_SMS_STOP } from "@/lib/sms-optout";
import type { WatchlistStore } from "./watchlist-store";

// The Postgres side of the watchlist store (OPS-116): today's queries, moved
// here unchanged.

export function pgWatchlistStore(): WatchlistStore {
  return {
    async createWatchlist(values) {
      const [row] = await db
        .insert(emptyLegWatchlists)
        .values(values)
        .returning({ id: emptyLegWatchlists.id });
      return row.id;
    },

    async byConfirmHash(hash) {
      const [row] = await db
        .select({
          id: emptyLegWatchlists.id,
          smsHash: emptyLegWatchlists.confirmSmsTokenHash,
          emailHash: emptyLegWatchlists.confirmEmailTokenHash,
          expiresAt: emptyLegWatchlists.confirmExpiresAt,
          fromText: emptyLegWatchlists.fromText,
          toText: emptyLegWatchlists.toText,
          earliestOn: emptyLegWatchlists.earliestOn,
          latestOn: emptyLegWatchlists.latestOn,
        })
        .from(emptyLegWatchlists)
        .where(
          or(
            eq(emptyLegWatchlists.confirmSmsTokenHash, hash),
            eq(emptyLegWatchlists.confirmEmailTokenHash, hash),
          ),
        )
        .limit(1);
      return row;
    },

    async confirmChannel(id, channel, at) {
      await db
        .update(emptyLegWatchlists)
        .set(
          channel === "sms"
            ? { smsConfirmedAt: at, confirmSmsTokenHash: null }
            : { emailConfirmedAt: at, confirmEmailTokenHash: null },
        )
        .where(eq(emptyLegWatchlists.id, id));
    },

    async byUnsubscribeToken(token) {
      const [row] = await db
        .select({
          id: emptyLegWatchlists.id,
          email: emptyLegWatchlists.email,
          fromText: emptyLegWatchlists.fromText,
          toText: emptyLegWatchlists.toText,
          smsConfirmedAt: emptyLegWatchlists.smsConfirmedAt,
        })
        .from(emptyLegWatchlists)
        .where(eq(emptyLegWatchlists.unsubscribeToken, token))
        .limit(1);
      return row;
    },

    async unsubscribe(id, scope, at) {
      await db
        .update(emptyLegWatchlists)
        .set(
          scope === "all"
            ? {
                active: false,
                deactivatedAt: at,
                deactivatedReason: "email_unsubscribe",
                emailConfirmedAt: null,
                notifyChannels: { email: false, sms: false },
              }
            : { emailConfirmedAt: null, notifyChannels: { email: false, sms: true } },
        )
        .where(eq(emptyLegWatchlists.id, id));
    },

    async memberWatchlists(memberId) {
      return db
        .select()
        .from(emptyLegWatchlists)
        .where(eq(emptyLegWatchlists.memberId, memberId))
        .orderBy(desc(emptyLegWatchlists.createdAt));
    },

    async memberWatchlist(id, memberId) {
      const [row] = await db
        .select({
          id: emptyLegWatchlists.id,
          fromText: emptyLegWatchlists.fromText,
          toText: emptyLegWatchlists.toText,
          active: emptyLegWatchlists.active,
          smsConfirmedAt: emptyLegWatchlists.smsConfirmedAt,
          emailConfirmedAt: emptyLegWatchlists.emailConfirmedAt,
        })
        .from(emptyLegWatchlists)
        .where(and(eq(emptyLegWatchlists.id, id), eq(emptyLegWatchlists.memberId, memberId)));
      return row;
    },

    async deleteWatchlist(id) {
      await db.delete(emptyLegWatchlists).where(eq(emptyLegWatchlists.id, id));
    },

    async setActive(id, active) {
      await db.update(emptyLegWatchlists).set({ active }).where(eq(emptyLegWatchlists.id, id));
    },

    async smsKeyword(kind, phoneE164, at) {
      if (kind === "stop") {
        const rows = await db
          .update(emptyLegWatchlists)
          .set({
            active: false,
            deactivatedAt: at,
            deactivatedReason: DEACTIVATED_BY_SMS_STOP,
          })
          .where(
            and(eq(emptyLegWatchlists.phoneE164, phoneE164), eq(emptyLegWatchlists.active, true)),
          )
          .returning({ id: emptyLegWatchlists.id });
        return rows.length;
      }
      const rows = await db
        .update(emptyLegWatchlists)
        .set({ active: true, deactivatedAt: null, deactivatedReason: null })
        .where(
          and(
            eq(emptyLegWatchlists.phoneE164, phoneE164),
            eq(emptyLegWatchlists.active, false),
            eq(emptyLegWatchlists.deactivatedReason, DEACTIVATED_BY_SMS_STOP),
          ),
        )
        .returning({ id: emptyLegWatchlists.id });
      return rows.length;
    },

    async activeWatchlists() {
      return db
        .select({
          id: emptyLegWatchlists.id,
          email: emptyLegWatchlists.email,
          phoneE164: emptyLegWatchlists.phoneE164,
          fromIcao: emptyLegWatchlists.fromIcao,
          fromText: emptyLegWatchlists.fromText,
          toIcao: emptyLegWatchlists.toIcao,
          toText: emptyLegWatchlists.toText,
          earliestOn: emptyLegWatchlists.earliestOn,
          latestOn: emptyLegWatchlists.latestOn,
          minDiscountPct: emptyLegWatchlists.minDiscountPct,
          notifyChannels: emptyLegWatchlists.notifyChannels,
          active: emptyLegWatchlists.active,
          smsConfirmedAt: emptyLegWatchlists.smsConfirmedAt,
          emailConfirmedAt: emptyLegWatchlists.emailConfirmedAt,
          unsubscribeToken: emptyLegWatchlists.unsubscribeToken,
        })
        .from(emptyLegWatchlists)
        .where(eq(emptyLegWatchlists.active, true));
    },

    async sweepUnconfirmed(now) {
      const gone = await db
        .delete(emptyLegWatchlists)
        .where(
          and(
            isNull(emptyLegWatchlists.smsConfirmedAt),
            isNull(emptyLegWatchlists.emailConfirmedAt),
            lt(emptyLegWatchlists.confirmExpiresAt, now),
          ),
        )
        .returning({ id: emptyLegWatchlists.id });
      return gone.length;
    },

    async notifiedFor(legIds) {
      if (legIds.length === 0) return [];
      return db
        .select({
          watchlistId: emptyLegWatchlistMatches.watchlistId,
          legId: emptyLegWatchlistMatches.legId,
          channel: emptyLegWatchlistMatches.channel,
        })
        .from(emptyLegWatchlistMatches)
        .where(inArray(emptyLegWatchlistMatches.legId, legIds));
    },

    async claimMatch(watchlistId, legId, channel) {
      const claimed = await db
        .insert(emptyLegWatchlistMatches)
        .values({ watchlistId, legId, channel, status: "pending" })
        .onConflictDoNothing()
        .returning({ id: emptyLegWatchlistMatches.id });
      return claimed[0]?.id;
    },

    async recordMatch(id, outcome) {
      await db
        .update(emptyLegWatchlistMatches)
        .set({
          status: outcome.status,
          provider: outcome.provider,
          providerMessageId: outcome.providerMessageId,
          error: outcome.error,
          sentAt: outcome.sentAt,
        })
        .where(eq(emptyLegWatchlistMatches.id, id));
    },
  };
}
