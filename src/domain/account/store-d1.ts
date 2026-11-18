import { and, asc, desc, eq, inArray, or, type SQL } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { aircraft } from "@/db/d1/schema/aircraft";
import { invoices } from "@/db/d1/schema/invoices";
import { quoteLegs, quotes } from "@/db/d1/schema/quotes";
import { tripLegs, trips } from "@/db/d1/schema/trips";
import { chunks } from "@/db/d1/helpers";
import type { AccountQuoteLegRow, AccountStore, AircraftCardRow, HomeTripLegRow, QuoteOwner } from "./store";

// The D1 (SQLite) side of the account store (OPS-164). Same methods and the same results as
// store-pg.ts, on the D1 twin tables (src/db/d1/schema, OPS-100). The client is passed in so a
// test can hand it a real SQLite.
//
// Differences from Postgres: timestamps are integer milliseconds that drizzle maps to Date,
// dates are text YYYY-MM-DD, and D1 allows 100 bound values per statement, so each id list is
// read in chunks of 50. A quote's or a trip's legs all sit in one chunk (the list holds ids,
// not legs), so each one's legs stay in leg-number order.

type D1Client = DrizzleD1Database;

function ownership(owner: QuoteOwner): SQL | undefined {
  return owner.memberId
    ? or(eq(quotes.createdByUserId, owner.userId), eq(quotes.memberId, owner.memberId))
    : eq(quotes.createdByUserId, owner.userId);
}

export function d1AccountStore(db: D1Client): AccountStore {
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
      const out: AccountQuoteLegRow[] = [];
      for (const part of chunks(quoteIds)) {
        out.push(
          ...(await db
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
            .where(inArray(quoteLegs.quoteId, part))
            .orderBy(asc(quoteLegs.legNumber))),
        );
      }
      return out;
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
      const out: HomeTripLegRow[] = [];
      for (const part of chunks(tripIds)) {
        out.push(
          ...(await db
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
            .where(inArray(tripLegs.tripId, part))
            .orderBy(asc(tripLegs.legNumber))),
        );
      }
      return out;
    },

    async aircraftCards(ids) {
      const out: AircraftCardRow[] = [];
      for (const part of chunks(ids)) {
        out.push(
          ...(await db
            .select({ id: aircraft.id, makeModel: aircraft.makeModel, category: aircraft.category, seats: aircraft.seats })
            .from(aircraft)
            .where(inArray(aircraft.id, part))),
        );
      }
      return out;
    },

    async invoiceFacts(memberId) {
      return db
        .select({ status: invoices.status, totalUsd: invoices.totalUsd, paidOn: invoices.paidOn })
        .from(invoices)
        .where(eq(invoices.memberId, memberId));
    },
  };
}
