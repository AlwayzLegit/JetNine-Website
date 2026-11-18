import { and, asc, desc, eq, inArray, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { aircraft } from "@/db/schema/aircraft";
import { invoices } from "@/db/schema/invoices";
import { quoteLegs, quotes } from "@/db/schema/quotes";
import { tripLegs, trips } from "@/db/schema/trips";
import type { AccountStore, QuoteOwner } from "./store";

// The Postgres side of the account store (OPS-164): the queries of the account home and the
// Quotes list, moved here as they were. Nothing about them changes on Postgres.

function ownership(owner: QuoteOwner): SQL | undefined {
  return owner.memberId
    ? or(eq(quotes.createdByUserId, owner.userId), eq(quotes.memberId, owner.memberId))
    : eq(quotes.createdByUserId, owner.userId);
}

export function pgAccountStore(): AccountStore {
  return {
    async openQuotes({ owner, statuses, limit }) {
      return db
        .select({
          id: quotes.id,
          status: quotes.status,
          paxCount: quotes.paxCount,
          statusToken: quotes.statusToken,
          slaDeadlineAt: quotes.slaDeadlineAt,
          assignedDispatcherId: quotes.assignedDispatcherId,
        })
        .from(quotes)
        .where(and(ownership(owner), inArray(quotes.status, statuses)))
        .orderBy(desc(quotes.receivedAt))
        .limit(limit);
    },

    async clientQuotes({ owner, limit }) {
      return db
        .select({
          id: quotes.id,
          quoteCode: quotes.quoteCode,
          status: quotes.status,
          statusToken: quotes.statusToken,
          paxCount: quotes.paxCount,
          requestedCategory: quotes.requestedCategory,
          receivedAt: quotes.receivedAt,
          slaDeadlineAt: quotes.slaDeadlineAt,
          indicativeLowUsd: quotes.indicativeLowUsd,
          indicativeHighUsd: quotes.indicativeHighUsd,
        })
        .from(quotes)
        .where(ownership(owner))
        .orderBy(desc(quotes.receivedAt))
        .limit(limit);
    },

    async quoteLegsOf(quoteIds) {
      if (quoteIds.length === 0) return [];
      return db
        .select({
          quoteId: quoteLegs.quoteId,
          legNumber: quoteLegs.legNumber,
          fromIata: quoteLegs.fromIata,
          toIata: quoteLegs.toIata,
          fromCity: quoteLegs.fromCity,
          toCity: quoteLegs.toCity,
          departDate: quoteLegs.departDate,
        })
        .from(quoteLegs)
        .where(inArray(quoteLegs.quoteId, quoteIds))
        .orderBy(asc(quoteLegs.legNumber));
    },

    async homeTrips(memberId, limit) {
      return db
        .select({
          id: trips.id,
          code: trips.tripCode,
          status: trips.status,
          paxCount: trips.paxCount,
          aircraftId: trips.aircraftId,
          revenueUsd: trips.revenueUsd,
          assignedDispatcherId: trips.assignedDispatcherId,
        })
        .from(trips)
        .where(eq(trips.memberId, memberId))
        .orderBy(desc(trips.createdAt))
        .limit(limit);
    },

    async homeTripLegs(tripIds) {
      if (tripIds.length === 0) return [];
      return db
        .select({
          tripId: tripLegs.tripId,
          fromIata: tripLegs.fromIata,
          toIata: tripLegs.toIata,
          fromCity: tripLegs.fromCity,
          toCity: tripLegs.toCity,
          fromName: tripLegs.fromName,
          departDate: tripLegs.departDate,
          departTime: tripLegs.departTime,
          scheduledDepAt: tripLegs.scheduledDepAt,
          scheduledArrAt: tripLegs.scheduledArrAt,
        })
        .from(tripLegs)
        .where(inArray(tripLegs.tripId, tripIds))
        .orderBy(asc(tripLegs.legNumber));
    },

    async aircraftCards(ids) {
      if (ids.length === 0) return [];
      return db
        .select({ id: aircraft.id, makeModel: aircraft.makeModel, category: aircraft.category, seats: aircraft.seats })
        .from(aircraft)
        .where(inArray(aircraft.id, ids));
    },

    async invoiceFacts(memberId) {
      return db
        .select({ status: invoices.status, totalUsd: invoices.totalUsd, paidOn: invoices.paidOn })
        .from(invoices)
        .where(eq(invoices.memberId, memberId));
    },
  };
}
