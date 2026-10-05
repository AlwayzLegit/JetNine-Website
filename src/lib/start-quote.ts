"use client";

import { AIRPORTS, distanceNm, findAirport, type Airport } from "@/lib/airports";
import type { Leg } from "@/lib/quote-pricing";
import { useQuoteStore, type TripType } from "@/lib/quote-store";

export type QuoteStart = {
  trip: TripType;
  pax: number;
  /** Airport code or city as typed. */
  from?: string;
  to?: string;
  /** ISO dates (yyyy-mm-dd). */
  depart?: string;
  return?: string;
};

/**
 * Resolve typed text to one airport: an exact IATA / ICAO code, or a city
 * name that matches exactly one airport in the catalog. Anything else
 * (ambiguous city, partial text) stays unresolved for the user to pick.
 */
function resolveAirport(text: string): Airport | undefined {
  const byCode = findAirport(text);
  if (byCode) return byCode;
  const q = text.trim().toLowerCase();
  const byCity = AIRPORTS.filter((a) => a.city.toLowerCase() === q);
  return byCity.length === 1 ? byCity[0] : undefined;
}

/** The same fields the mission step's airport picker writes. */
function endFields(side: "from" | "to", text: string | undefined, a: Airport | undefined): Partial<Leg> {
  if (a) {
    return side === "from"
      ? { fromIata: a.iata, fromCity: a.city, fromName: a.name }
      : { toIata: a.iata, toCity: a.city, toName: a.name };
  }
  const raw = text?.trim().toUpperCase();
  if (!raw) return {};
  // Clear what an earlier draft resolved, so a stale city / name never
  // sits beside new unconfirmed text.
  return side === "from"
    ? { fromIata: raw, fromCity: undefined, fromName: undefined }
    : { toIata: raw, toCity: undefined, toName: undefined };
}

/**
 * Seed the quote store from a public-page trip form, before routing to
 * /quote/mission. The store is a sessionStorage-backed client singleton, so
 * the values survive the client-side navigation and the wizard's rehydrate.
 * Airports that resolve unambiguously are written exactly as the picker
 * writes them (code, city, name, distance) so the price shows at once; the
 * rest are seeded as typed and confirmed in the picker. Round trips get the
 * return leg mirrored. Every "Request a quote" form on the site goes
 * through here.
 */
export function seedQuote(start: QuoteStart) {
  const store = useQuoteStore.getState();
  store.setTripType(start.trip);
  store.setPax(start.pax);

  const legs = useQuoteStore.getState().legs;
  const fromA = start.from ? resolveAirport(start.from) : undefined;
  const toA = start.to ? resolveAirport(start.to) : undefined;

  // Like the picker: once both ends of a leg are set, the distance follows
  // from whatever codes the leg now holds (new or kept from the draft).
  const withDistance = (leg: Leg, patch: Partial<Leg>): Partial<Leg> => {
    const next = { ...leg, ...patch };
    const f = next.fromIata ? findAirport(next.fromIata) : undefined;
    const t = next.toIata ? findAirport(next.toIata) : undefined;
    return { ...patch, distanceNm: f && t ? distanceNm(f, t) : undefined };
  };

  if (legs[0] && (start.from || start.to || start.depart)) {
    store.updateLeg(
      legs[0].id,
      withDistance(legs[0], {
        ...endFields("from", start.from, fromA),
        ...endFields("to", start.to, toA),
        ...(start.depart ? { date: start.depart } : {}),
      }),
    );
  }

  if (start.trip === "roundtrip" && legs[1]) {
    store.updateLeg(
      legs[1].id,
      withDistance(legs[1], {
        ...endFields("from", start.to, toA),
        ...endFields("to", start.from, fromA),
        ...(start.return ? { date: start.return } : {}),
      }),
    );
  }
}
