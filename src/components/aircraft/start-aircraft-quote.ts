"use client";

import type { AircraftCategorySlug } from "@/lib/fleet";
import { useQuoteStore, type TripType } from "@/lib/quote-store";
import { seedQuote } from "@/lib/start-quote";
import { track } from "@/lib/analytics";

/**
 * Every trip form on the aircraft pages (the Aircraft hero form, the
 * category / model side box, the route check, the cabin checklist) seeds
 * the quote draft through `seedQuote`, then adds the page's category and
 * any free-text needs, and fires the same `quote_launcher_submitted` event
 * the old inline launcher sent. The caller then routes to /quote/mission.
 */
export function startAircraftQuote({
  context,
  category,
  trip = "oneway",
  pax,
  from,
  to,
  depart,
  notes,
}: {
  context: string;
  category?: AircraftCategorySlug;
  trip?: TripType;
  pax?: number;
  from?: string;
  to?: string;
  depart?: string;
  notes?: string;
}) {
  const store = useQuoteStore.getState();
  seedQuote({
    trip,
    pax: pax && pax > 0 ? pax : store.pax,
    from: from?.trim() || undefined,
    to: to?.trim() || undefined,
    depart: depart || undefined,
  });
  if (category) useQuoteStore.getState().setCategory(category);
  const n = notes?.trim();
  if (n) {
    const prev = useQuoteStore.getState().notes.trim();
    useQuoteStore.getState().setNotes(prev && !prev.includes(n) ? `${prev}\n${n}` : n);
  }
  track("quote_launcher_submitted", { context });
}
