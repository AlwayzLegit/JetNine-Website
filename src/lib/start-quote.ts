"use client";

import { useQuoteStore, type TripType } from "@/lib/quote-store";

export type QuoteStart = {
  trip: TripType;
  pax: number;
  /** Airport code or city as typed; confirmed in the mission step's picker. */
  from?: string;
  to?: string;
  /** ISO dates (yyyy-mm-dd). */
  depart?: string;
  return?: string;
};

/**
 * Seed the quote store from a public-page trip form, before routing to
 * /quote/mission. The store is a sessionStorage-backed client singleton, so
 * the values survive the client-side navigation and the wizard's rehydrate.
 * From/To are seeded as raw codes the user confirms in the mission step's
 * airport picker (which resolves city / name / distance needed for pricing).
 * Every "Request a quote" form on the site goes through here.
 */
export function seedQuote(start: QuoteStart) {
  const store = useQuoteStore.getState();
  store.setTripType(start.trip);
  store.setPax(start.pax);

  const legs = useQuoteStore.getState().legs;
  const from = start.from?.trim().toUpperCase();
  const to = start.to?.trim().toUpperCase();
  if (legs[0] && (from || to || start.depart)) {
    store.updateLeg(legs[0].id, {
      ...(from ? { fromIata: from } : {}),
      ...(to ? { toIata: to } : {}),
      ...(start.depart ? { date: start.depart } : {}),
    });
  }
  if (start.trip === "roundtrip" && legs[1] && start.return) {
    store.updateLeg(legs[1].id, { date: start.return });
  }
}
