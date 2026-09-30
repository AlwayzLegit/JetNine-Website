"use client";

import Link from "next/link";
import type { AircraftCategorySlug } from "@/lib/fleet";
import { useQuoteStore } from "@/lib/quote-store";
import { track } from "@/lib/analytics";

type Props = {
  /** Where the link sits — the `quote_launcher_submitted` analytics context. */
  context: string;
  /** Pre-select the aircraft category in the quote draft. */
  category?: AircraftCategorySlug;
  /** Pre-fill the first leg (IATA codes) — used by the route cards. */
  from?: string;
  to?: string;
  pax?: number;
  className?: string;
  children: React.ReactNode;
};

/**
 * Plain link to the quote flow that seeds the draft from page context
 * (category, route, passengers) on the way in, and keeps firing the
 * `quote_launcher_submitted` event the old inline launcher form sent.
 * Replaces QuoteLauncher / RouteQuoteLink on the aircraft pages.
 */
export function QuoteLink({
  context,
  category,
  from,
  to,
  pax,
  className = "btn btn-primary btn-lg",
  children,
}: Props) {
  function seed() {
    const store = useQuoteStore.getState();
    if (category) store.setCategory(category);
    if (pax) store.setPax(pax);
    if (from || to) {
      store.setTripType("oneway");
      const first = useQuoteStore.getState().legs[0];
      if (first) store.updateLeg(first.id, { fromIata: from, toIata: to });
    }
    track("quote_launcher_submitted", { context });
  }

  return (
    <Link href="/quote/mission" className={className} onClick={seed}>
      {children}
    </Link>
  );
}
