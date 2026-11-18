import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { nextCode } from "@/db/codes";
import { aircraft } from "@/db/schema/aircraft";
import { airports } from "@/db/schema/airports";
import { quoteLegs, quotes } from "@/db/schema/quotes";
import { sourcedOptions } from "@/db/schema/sourced-option";
import { staff } from "@/db/schema/staff";
import { tripLegs, trips } from "@/db/schema/trips";
import { DuplicateIdempotencyKey, type QuoteStore } from "./store";

// The Postgres side of the quote store (OPS-153): today's queries, moved here
// unchanged. The submit is one interactive transaction (code, quote, missing
// airports, legs); the client's pick is the conditional update inside one
// transaction.

/** Postgres reports the unique index by name in the message (SQLSTATE 23505). */
function isIdempotencyViolation(err: unknown): boolean {
  for (let e: unknown = err, i = 0; e instanceof Error && i < 4; e = (e as { cause?: unknown }).cause, i++) {
    if (/quotes_client_idempotency_key_uq|duplicate key/i.test(e.message)) return true;
  }
  return false;
}

export function pgQuoteStore(): QuoteStore {
  return {
    async findByIdempotencyKey(key) {
      const [row] = await db
        .select({ id: quotes.id, quoteCode: quotes.quoteCode, statusToken: quotes.statusToken })
        .from(quotes)
        .where(eq(quotes.clientIdempotencyKey, key))
        .limit(1);
      return row;
    },

    async createQuote({ values, legs, airports: airportRows }) {
      try {
        return await db.transaction(async (tx) => {
          // The app makes the code (OPS-101). The quotes_default_quote_code trigger
          // fills it only when empty, so it does nothing now and the counter moves once.
          const quoteCode = await nextCode(tx, "quote");
          const [row] = await tx
            .insert(quotes)
            .values({ ...values, quoteCode })
            .returning({ id: quotes.id, quoteCode: quotes.quoteCode });

          // quote_legs FKs its ICAOs to airports.icao, and the picker has outgrown
          // the seeds before (migration 0055): add what this quote needs first;
          // existing rows are untouched.
          if (airportRows.length > 0) {
            await tx.insert(airports).values(airportRows).onConflictDoNothing({ target: airports.icao });
          }
          if (legs.length > 0) {
            await tx.insert(quoteLegs).values(legs.map((l) => ({ ...l, quoteId: row.id })));
          }
          return row;
        });
      } catch (err) {
        if (values.clientIdempotencyKey && isIdempotencyViolation(err)) throw new DuplicateIdempotencyKey();
        throw err;
      }
    },

    async loadRequestRows(token) {
      const [quote] = await db
        .select({
          id: quotes.id,
          code: quotes.quoteCode,
          status: quotes.status,
          tripType: quotes.tripType,
          paxCount: quotes.paxCount,
          notes: quotes.notes,
          contactSnapshot: quotes.contactSnapshot,
          receivedAt: quotes.receivedAt,
          respondedAt: quotes.respondedAt,
          acceptedAt: quotes.acceptedAt,
          assignedDispatcherId: quotes.assignedDispatcherId,
          convertedTripId: quotes.convertedTripId,
        })
        .from(quotes)
        .where(eq(quotes.statusToken, token))
        .limit(1);
      if (!quote) return null;

      const [legs, options, dispatcherRows] = await Promise.all([
        db
          .select({
            legNumber: quoteLegs.legNumber,
            fromIata: quoteLegs.fromIata,
            fromCity: quoteLegs.fromCity,
            fromName: quoteLegs.fromName,
            toIata: quoteLegs.toIata,
            toCity: quoteLegs.toCity,
            toName: quoteLegs.toName,
            departDate: quoteLegs.departDate,
            departTime: quoteLegs.departTime,
            distanceNm: quoteLegs.distanceNm,
          })
          .from(quoteLegs)
          .where(eq(quoteLegs.quoteId, quote.id))
          .orderBy(asc(quoteLegs.legNumber)),
        db
          .select({
            id: sourcedOptions.id,
            optionNumber: sourcedOptions.optionNumber,
            aircraftType: sourcedOptions.aircraftType,
            category: sourcedOptions.category,
            paxCapacity: sourcedOptions.paxCapacity,
            yearOfMake: sourcedOptions.yearOfMake,
            totalFlightTimeMin: sourcedOptions.totalFlightTimeMin,
            clientPriceUsd: sourcedOptions.clientPriceUsd,
            softHoldExpiry: sourcedOptions.softHoldExpiry,
            isChosen: sourcedOptions.isChosen,
            status: sourcedOptions.status,
          })
          .from(sourcedOptions)
          .where(eq(sourcedOptions.quoteId, quote.id))
          .orderBy(asc(sourcedOptions.optionNumber)),
        quote.assignedDispatcherId
          ? db
              .select({ displayName: staff.displayName, directLineE164: staff.directLineE164 })
              .from(staff)
              .where(eq(staff.id, quote.assignedDispatcherId))
              .limit(1)
          : Promise.resolve([]),
      ]);

      let trip: Awaited<ReturnType<typeof loadTrip>> = null;
      if (quote.convertedTripId) trip = await loadTrip(quote.convertedTripId);

      return { quote, legs, options, dispatcher: dispatcherRows[0] ?? null, trip };
    },

    async quoteForChoice(token) {
      const [row] = await db
        .select({
          id: quotes.id,
          code: quotes.quoteCode,
          status: quotes.status,
          contactSnapshot: quotes.contactSnapshot,
        })
        .from(quotes)
        .where(eq(quotes.statusToken, token))
        .limit(1);
      return row;
    },

    async optionForChoice(quoteId, optionId) {
      const [row] = await db
        .select({
          id: sourcedOptions.id,
          status: sourcedOptions.status,
          aircraftType: sourcedOptions.aircraftType,
          clientPriceUsd: sourcedOptions.clientPriceUsd,
        })
        .from(sourcedOptions)
        .where(and(eq(sourcedOptions.id, optionId), eq(sourcedOptions.quoteId, quoteId)))
        .limit(1);
      return row;
    },

    async claimOption(quoteId, optionId, now) {
      // Claim the quote first, conditionally on it still being open: two holders
      // of the link choosing at once can both pass the reads before, but only one
      // UPDATE ... WHERE status IN (open) matches a row.
      let claimed = false;
      await db.transaction(async (tx) => {
        const rows = await tx
          .update(quotes)
          .set({ status: "accepted", acceptedAt: now, updatedAt: now })
          .where(and(eq(quotes.id, quoteId), inArray(quotes.status, ["options_sent", "held"])))
          .returning({ id: quotes.id });
        if (rows.length === 0) return;
        claimed = true;
        await tx
          .update(sourcedOptions)
          .set({ isChosen: false, updatedAt: now })
          .where(eq(sourcedOptions.quoteId, quoteId));
        await tx
          .update(sourcedOptions)
          .set({ isChosen: true, status: "accepted", updatedAt: now })
          .where(eq(sourcedOptions.id, optionId));
      });
      return claimed;
    },
  };
}

async function loadTrip(tripId: string) {
  const [t] = await db
    .select({ code: trips.tripCode, status: trips.status, aircraftId: trips.aircraftId })
    .from(trips)
    .where(eq(trips.id, tripId))
    .limit(1);
  if (!t) return null;
  const [tLegs, ac] = await Promise.all([
    db
      .select({
        legNumber: tripLegs.legNumber,
        fromIata: tripLegs.fromIata,
        fromCity: tripLegs.fromCity,
        fromName: tripLegs.fromName,
        toIata: tripLegs.toIata,
        toCity: tripLegs.toCity,
        toName: tripLegs.toName,
        departDate: tripLegs.departDate,
        departTime: tripLegs.departTime,
        scheduledDepAt: tripLegs.scheduledDepAt,
        scheduledArrAt: tripLegs.scheduledArrAt,
      })
      .from(tripLegs)
      .where(eq(tripLegs.tripId, tripId))
      .orderBy(asc(tripLegs.legNumber)),
    t.aircraftId
      ? db.select({ makeModel: aircraft.makeModel }).from(aircraft).where(eq(aircraft.id, t.aircraftId)).limit(1)
      : Promise.resolve([]),
  ]);
  return {
    code: t.code,
    status: t.status,
    aircraftId: t.aircraftId,
    aircraftMakeModel: ac[0]?.makeModel ?? null,
    legs: tLegs,
  };
}
