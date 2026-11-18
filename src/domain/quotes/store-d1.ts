import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { codeSql } from "@/db/codes";
import { aircraft } from "@/db/d1/schema/aircraft";
import { airports } from "@/db/d1/schema/airports";
import { quoteCodeSequence, quoteLegs, quotes } from "@/db/d1/schema/quotes";
import { sourcedOptions } from "@/db/d1/schema/sourced-option";
import { staff } from "@/db/d1/schema/staff";
import { tripLegs, trips } from "@/db/d1/schema/trips";
import { DuplicateIdempotencyKey, type QuoteStore } from "./store";

// The D1 (SQLite) side of the quote store (OPS-153). Same methods and the same
// results as store-pg.ts, on the D1 twin tables (src/db/d1/schema, OPS-100).
// The client is passed in so a test can hand it a real SQLite.
//
// D1 from a Worker has no interactive transaction, only atomic batches, so:
// - The submit is one batch: the code counter moves first, the insert reads the
//   counter in SQL (codeSql, OPS-113), then the missing airports and the legs.
//   The quote id is made by the app so the legs can name it in the same batch.
//   A failed statement rolls the whole batch back, the number included.
// - The client's pick is one batch of three statements. The first is the
//   conditional claim of the quote; the other two carry a guard in SQL, so they
//   change nothing unless this very call made the claim (D1 runs the batches of
//   two simultaneous requests one after the other: the second claim matches no
//   row and its guarded statements match no row either).
// - D1 allows 100 bound values per statement: airports and legs go one statement
//   each instead of one multi-row insert.
// - The duplicate-key error says "UNIQUE constraint failed: quotes.client_idempotency_key".

type D1Client = DrizzleD1Database;

function isIdempotencyViolation(err: unknown): boolean {
  for (let e: unknown = err, i = 0; e instanceof Error && i < 4; e = (e as { cause?: unknown }).cause, i++) {
    if (/UNIQUE constraint failed: quotes\.client_idempotency_key/i.test(e.message)) return true;
  }
  return false;
}

export function d1QuoteStore(db: D1Client): QuoteStore {
  return {
    async findByIdempotencyKey(key) {
      const [row] = await db
        .select({ id: quotes.id, quoteCode: quotes.quoteCode, statusToken: quotes.statusToken })
        .from(quotes)
        .where(eq(quotes.clientIdempotencyKey, key))
        .limit(1);
      return row;
    },

    async createQuote({ values, legs, airports: airportRows, year }) {
      const id = crypto.randomUUID();
      const seen = new Set<string>();
      const airportStatements = airportRows
        .filter((a) => (seen.has(a.icao) ? false : (seen.add(a.icao), true)))
        .map((a) => db.insert(airports).values(a as never).onConflictDoNothing({ target: airports.icao }));
      const legStatements = legs.map((l) => db.insert(quoteLegs).values({ ...(l as object), quoteId: id } as never));
      try {
        const [, rows] = await db.batch([
          // The counter moves first: the insert's code reads the value this leaves.
          db
            .insert(quoteCodeSequence)
            .values({ year, lastValue: 1 })
            .onConflictDoUpdate({
              target: quoteCodeSequence.year,
              set: { lastValue: sql`${quoteCodeSequence.lastValue} + 1` },
            }),
          db
            .insert(quotes)
            .values({ ...(values as object), id, quoteCode: codeSql("quote", year) } as never)
            .returning({ id: quotes.id, quoteCode: quotes.quoteCode }),
          // The airports go before the legs, which point at them.
          ...airportStatements,
          ...legStatements,
        ] as unknown as Parameters<D1Client["batch"]>[0]);
        const row = (rows as unknown as { id: string; quoteCode: string }[])[0];
        if (!row) throw new Error("quote insert returned no row");
        return row;
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
      if (quote.convertedTripId) trip = await loadTrip(db, quote.convertedTripId);

      return { quote, legs, options, dispatcher: dispatcherRows[0] ?? null, trip } as never;
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
      const ms = now.getTime();
      // True only when this very call made the claim: the quote is accepted at
      // exactly this call's instant.
      const claimedHere = sql`exists (select 1 from "quotes" q where q."id" = ${quoteId} and q."status" = 'accepted' and q."accepted_at" = ${ms})`;
      // And no other option of the quote was chosen at this same instant. Two
      // claims in the same millisecond cannot both pass: the first one's chosen
      // option blocks the second one's statements.
      const noOtherChosenNow = sql`not exists (select 1 from "sourced_options" s where s."quote_id" = ${quoteId} and s."is_chosen" = 1 and s."updated_at" = ${ms} and s."id" <> ${optionId})`;
      const [claim] = await db.batch([
        db
          .update(quotes)
          .set({ status: "accepted", acceptedAt: now, updatedAt: now })
          .where(and(eq(quotes.id, quoteId), inArray(quotes.status, ["options_sent", "held"])))
          .returning({ id: quotes.id }),
        db
          .update(sourcedOptions)
          .set({ isChosen: false, updatedAt: now })
          .where(and(eq(sourcedOptions.quoteId, quoteId), claimedHere, noOtherChosenNow)),
        db
          .update(sourcedOptions)
          .set({ isChosen: true, status: "accepted", updatedAt: now })
          .where(
            and(eq(sourcedOptions.id, optionId), eq(sourcedOptions.quoteId, quoteId), claimedHere, noOtherChosenNow),
          ),
      ]);
      return claim.length > 0;
    },
  };
}

async function loadTrip(db: D1Client, tripId: string) {
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
