import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { quotes, quoteLegs } from "@/db/schema/quotes";
import { sourcedOptions } from "@/db/schema/sourced-option";
import { staff } from "@/db/schema/staff";
import { trips, tripLegs } from "@/db/schema/trips";
import { aircraft } from "@/db/schema/aircraft";
import { STATUS_TOKEN_RE } from "@/lib/request-status";

// Everything the "Your request" page needs for one quote, loaded by its
// status token. Operator cost, markup and dispatcher notes never leave
// the server — only the client price and the plain-words facts.

export type RequestStage = "received" | "options" | "chosen" | "booked" | "closed";

export type RequestLeg = {
  legNumber: number;
  fromIata: string | null;
  fromCity: string | null;
  fromName: string | null;
  toIata: string | null;
  toCity: string | null;
  toName: string | null;
  departDate: string | null;
  departTime: string | null;
  distanceNm: number | null;
};

export type RequestOption = {
  id: string;
  optionNumber: number;
  aircraftType: string | null;
  category: string | null;
  paxCapacity: number | null;
  yearOfMake: number | null;
  totalFlightTimeMin: number | null;
  clientPriceUsd: number;
  softHoldExpiry: Date | null;
  isChosen: boolean;
  status: string;
};

export type RequestTripLeg = {
  legNumber: number;
  fromIata: string | null;
  fromCity: string | null;
  fromName: string | null;
  toIata: string | null;
  toCity: string | null;
  toName: string | null;
  departDate: string | null;
  departTime: string | null;
  scheduledDepAt: Date | null;
  scheduledArrAt: Date | null;
};

export type RequestView = {
  id: string;
  code: string;
  token: string;
  status: string;
  stage: RequestStage;
  tripType: "one_way" | "round" | "multi_leg";
  paxCount: number;
  notes: string | null;
  firstName: string | null;
  email: string | null;
  phoneE164: string | null;
  receivedAt: Date;
  respondedAt: Date | null;
  acceptedAt: Date | null;
  legs: RequestLeg[];
  options: RequestOption[];
  chosen: RequestOption | null;
  dispatcher: { displayName: string; directLineE164: string | null } | null;
  trip: {
    code: string;
    status: string;
    aircraft: string | null;
    legs: RequestTripLeg[];
  } | null;
};

export function stageFor(status: string, hasOptions: boolean, hasTrip: boolean): RequestStage {
  switch (status) {
    case "submitted":
    case "triaged":
    case "sourcing":
      return "received";
    case "options_sent":
    case "held":
      return hasOptions ? "options" : "received";
    case "accepted":
      return "chosen";
    case "converted":
      return hasTrip ? "booked" : "chosen";
    default:
      return "closed";
  }
}

export async function loadRequestByToken(token: string): Promise<RequestView | null> {
  if (!STATUS_TOKEN_RE.test(token)) return null;

  const [q] = await db
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
  if (!q) return null;

  const [legs, optionRows, dispatcherRows] = await Promise.all([
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
      .where(eq(quoteLegs.quoteId, q.id))
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
      .where(eq(sourcedOptions.quoteId, q.id))
      .orderBy(asc(sourcedOptions.optionNumber)),
    q.assignedDispatcherId
      ? db
          .select({ displayName: staff.displayName, directLineE164: staff.directLineE164 })
          .from(staff)
          .where(eq(staff.id, q.assignedDispatcherId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  // Only options dispatch actually sent (or the one the client picked)
  // are visible; drafts and rejected ones stay internal.
  const options: RequestOption[] = optionRows
    .filter(
      (o) =>
        o.clientPriceUsd != null &&
        (o.status === "sent_to_client" || o.status === "accepted" || o.isChosen),
    )
    .map((o) => ({ ...o, clientPriceUsd: o.clientPriceUsd as number }));
  const chosen = options.find((o) => o.isChosen) ?? null;

  let trip: RequestView["trip"] = null;
  if (q.convertedTripId) {
    const [t] = await db
      .select({
        code: trips.tripCode,
        status: trips.status,
        aircraftId: trips.aircraftId,
      })
      .from(trips)
      .where(eq(trips.id, q.convertedTripId))
      .limit(1);
    if (t) {
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
          .where(eq(tripLegs.tripId, q.convertedTripId))
          .orderBy(asc(tripLegs.legNumber)),
        t.aircraftId
          ? db
              .select({ makeModel: aircraft.makeModel })
              .from(aircraft)
              .where(and(eq(aircraft.id, t.aircraftId)))
              .limit(1)
          : Promise.resolve([]),
      ]);
      trip = {
        code: t.code,
        status: t.status,
        aircraft: ac[0]?.makeModel ?? chosen?.aircraftType ?? null,
        legs: tLegs,
      };
    }
  }

  return {
    id: q.id,
    code: q.code,
    token,
    status: q.status,
    stage: stageFor(q.status, options.length > 0, trip != null),
    tripType: q.tripType,
    paxCount: q.paxCount,
    notes: q.notes,
    firstName: q.contactSnapshot?.firstName?.trim() || null,
    email: q.contactSnapshot?.email ?? null,
    phoneE164: q.contactSnapshot?.phoneE164 ?? null,
    receivedAt: q.receivedAt,
    respondedAt: q.respondedAt,
    acceptedAt: q.acceptedAt,
    legs,
    options,
    chosen,
    dispatcher: dispatcherRows[0] ?? null,
    trip,
  };
}

// Pure formatters live in request-format.ts (safe for client components).
export * from "./request-format";
