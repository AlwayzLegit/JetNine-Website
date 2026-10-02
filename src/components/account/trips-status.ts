// Plain-words helpers for a member's trips — shared by the account overview,
// /account/trips and the trip detail page. Status enums become sentences;
// legs become "City → City" routes and "departs 9:00 AM · about 2 h" lines.

import { CATEGORY_PLAIN, formatClock, formatMinutes } from "@/lib/request-format";
import type { StatusWords } from "./quotes-status";

/** Trips that are over — they never count as "upcoming". */
export const TRIP_CLOSED = ["completed", "cancelled_wx", "cancelled_other"] as const;

export function tripStatusWords(status: string): StatusWords {
  switch (status) {
    case "draft":
      return { text: "Being set up", tone: "steel" };
    case "confirmed":
      return { text: "Confirmed", tone: "success" };
    case "crew_briefed":
      return { text: "Confirmed · crew briefed", tone: "success" };
    case "boarding":
      return { text: "Boarding", tone: "success" };
    case "airborne":
      return { text: "In the air", tone: "success" };
    case "wheels_down":
      return { text: "Landed", tone: "success" };
    case "completed":
      return { text: "Completed", tone: "steel" };
    case "cancelled_wx":
      return { text: "Cancelled · weather", tone: "steel" };
    case "cancelled_other":
      return { text: "Cancelled", tone: "steel" };
    case "diverted":
      return { text: "Diverted — dispatch will call you", tone: "gold" };
    case "irregular_ops":
      return { text: "Schedule change — dispatch will call you", tone: "gold" };
    default:
      return { text: "With dispatch", tone: "gold" };
  }
}

export const MISSION_WORDS: Record<string, string> = {
  one_way: "one way",
  round: "round trip",
  multi_leg: "multi-leg",
  empty_leg_purchase: "empty leg",
  repositioning_internal: "repositioning",
};

export type RouteLeg = {
  legNumber?: number;
  fromIata: string | null;
  toIata: string | null;
  fromCity: string | null;
  toCity: string | null;
};

function place(city: string | null, iata: string | null): string {
  return city ?? iata ?? "—";
}

/**
 * "Los Angeles → Aspen" from a trip's legs. A round trip reads as its
 * outbound leg; a multi-leg trip chains every stop.
 */
export function routeWords(legs: RouteLeg[]): string {
  if (legs.length === 0) return "Your trip";
  const first = legs[0];
  const isRound =
    legs.length === 2 &&
    (legs[1].toCity ?? legs[1].toIata) === (first.fromCity ?? first.fromIata) &&
    (legs[1].fromCity ?? legs[1].fromIata) === (first.toCity ?? first.toIata);
  if (legs.length === 1 || isRound) {
    return `${place(first.fromCity, first.fromIata)} → ${place(first.toCity, first.toIata)}`;
  }
  return [place(first.fromCity, first.fromIata), ...legs.map((l) => place(l.toCity, l.toIata))].join(" → ");
}

const CLOCK_LA = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
});

/** "9:00 AM" from a leg's local time, falling back to the scheduled timestamp. */
export function departClock(departTime: string | null, scheduledDepAt: Date | null): string | null {
  return formatClock(departTime) ?? (scheduledDepAt ? CLOCK_LA.format(scheduledDepAt) : null);
}

/** "about 2 h 10 min" from the scheduled timestamps, or null if unknown. */
export function legDurationWords(dep: Date | null, arr: Date | null): string | null {
  if (!dep || !arr) return null;
  return formatMinutes(Math.round((arr.getTime() - dep.getTime()) / 60_000));
}

/** "Citation XLS · midsize jet · 8 seats" from an aircraft row. */
export function aircraftWords(ac: { makeModel: string; category?: string | null; seats?: number | null } | null | undefined): string | null {
  if (!ac) return null;
  const parts = [ac.makeModel];
  const plain = ac.category ? CATEGORY_PLAIN[ac.category] : null;
  if (plain) parts.push(plain.toLowerCase());
  if (ac.seats) parts.push(`${ac.seats} seats`);
  return parts.join(" · ");
}

/** Pick the leg the member flies next: the first one departing today or later. */
export function nextLeg<L extends { departDate: string | null }>(legs: L[], today: string): L | null {
  return legs.find((l) => l.departDate != null && l.departDate >= today) ?? null;
}

/** Upcoming = not closed and still has a leg to fly (or no dates at all yet). */
export function isUpcoming(status: string, legs: { departDate: string | null }[], today: string): boolean {
  if ((TRIP_CLOSED as readonly string[]).includes(status)) return false;
  if (legs.every((l) => l.departDate == null)) return true;
  return nextLeg(legs, today) != null;
}
