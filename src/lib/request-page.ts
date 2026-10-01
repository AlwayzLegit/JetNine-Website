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

// ─── Plain-words formatting ───────────────────────────────────────────────

const DAY_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const LONG_DAY_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

/** "Fri, Oct 3" from a YYYY-MM-DD date (no timezone shift). */
export function formatDay(date: string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : DAY_FMT.format(d);
}

export function formatLongDay(date: string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : LONG_DAY_FMT.format(d);
}

/** "in the morning" from HH:MM. */
export function timeOfDay(time: string | null | undefined): string | null {
  if (!time) return null;
  const h = Number(time.slice(0, 2));
  if (Number.isNaN(h)) return null;
  if (h < 5) return "overnight";
  if (h < 11) return "in the morning";
  if (h < 14) return "around midday";
  if (h < 17) return "in the afternoon";
  if (h < 21) return "in the evening";
  return "late in the evening";
}

/** "9:00 AM" from HH:MM. */
export function formatClock(time: string | null | undefined): string | null {
  if (!time) return null;
  const [hh, mm] = time.split(":");
  const h = Number(hh);
  if (Number.isNaN(h)) return null;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${(mm ?? "00").slice(0, 2)} ${suffix}`;
}

/** "about 2 h 10 min" from minutes. */
export function formatMinutes(min: number | null | undefined): string | null {
  if (!min || min <= 0) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `about ${m} min`;
  return m === 0 ? `about ${h} h` : `about ${h} h ${m} min`;
}

export const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const CATEGORY_PLAIN: Record<string, string> = {
  turboprop: "Turboprop",
  light: "Light jet",
  midsize: "Midsize jet",
  supermid: "Super-midsize jet",
  heavy: "Heavy jet",
  ulr: "Ultra long range jet",
  ultra: "Ultra long range jet",
};

export const CATEGORY_IMAGE: Record<string, string> = {
  turboprop: "/images/fleet/turboprop.webp",
  light: "/images/fleet/light.webp",
  midsize: "/images/fleet/midsize.webp",
  supermid: "/images/fleet/supermid.webp",
  heavy: "/images/fleet/heavy.webp",
  ulr: "/images/fleet/ultra.webp",
  ultra: "/images/fleet/ultra.webp",
};

export function tripTypeWords(t: RequestView["tripType"]): string {
  return t === "round" ? "round trip" : t === "one_way" ? "one way" : "multi-leg";
}

export function relativeTime(from: Date, now = new Date()): string {
  const diff = Math.max(0, now.getTime() - from.getTime());
  const min = Math.round(diff / 60_000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "Yesterday" : `${d} days ago`;
}
