"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { seedQuote } from "@/lib/start-quote";
import { useQuoteStore, type TripType } from "@/lib/quote-store";
import type { AircraftCategorySlug } from "@/lib/fleet";
import { track } from "@/lib/analytics";

const PAX = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16];
const TRIPS: { label: string; value: TripType }[] = [
  { label: "One way", value: "oneway" },
  { label: "Round trip", value: "roundtrip" },
  { label: "Multi-city", value: "multileg" },
];

/**
 * Seeds the quote store with a lane (and optionally a category), then opens
 * /quote/mission — the route pages' "Quote it" / "Plan this route" actions.
 * Fires the same analytics event the old RouteQuoteLink did.
 */
export function RouteQuoteButton({
  from,
  to,
  category,
  pax = 4,
  label = "Plan this route",
  className = "btn btn-primary",
  context,
}: {
  from: string;
  to: string;
  category?: AircraftCategorySlug;
  pax?: number;
  label?: string;
  className?: string;
  context?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        seedQuote({ trip: "oneway", pax, from, to });
        if (category) useQuoteStore.getState().setCategory(category);
        track("quote_launcher_submitted", { context: context ?? `route-card:${from}-${to}` });
        router.push("/quote/mission");
      }}
    >
      {label} <span aria-hidden="true">→</span>
    </button>
  );
}

/**
 * "Plan your flight" side form from Light - Routes: trip-type segmented row,
 * From / To / Departure / Passengers in an auto-fit grid, navy submit, a
 * bronze outline link to the cost calculator. Seeds the quote store.
 */
export function RoutePlanForm({
  from: fromProp = "",
  to: toProp = "",
  context,
}: {
  from?: string;
  to?: string;
  context: string;
}) {
  const router = useRouter();
  const [trip, setTrip] = useState<TripType>("oneway");
  const [from, setFrom] = useState(fromProp);
  const [to, setTo] = useState(toProp);
  // The hub's finder drives these fields as the visitor types there.
  useEffect(() => setFrom(fromProp), [fromProp]);
  useEffect(() => setTo(toProp), [toProp]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    seedQuote({
      trip,
      pax: Number(d.get("pax")) || 4,
      from: from || undefined,
      to: to || undefined,
      depart: (d.get("depart") as string) || undefined,
    });
    track("quote_launcher_submitted", { context });
    router.push("/quote/mission");
  }

  return (
    <form onSubmit={onSubmit} className="border border-line bg-white px-5 py-[18px]">
      <h2 className="font-serif text-[24px] leading-[1.1]">Plan your flight</h2>
      <div role="radiogroup" aria-label="Trip type" className="mt-3 grid auto-cols-[minmax(0,1fr)] grid-flow-col overflow-hidden rounded-[3px] border border-line">
        {TRIPS.map((t, i) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={trip === t.value}
            onClick={() => setTrip(t.value)}
            className={[
              "h-8 border-0 text-[12px]",
              i > 0 ? "border-l border-line" : "",
              trip === t.value ? "bg-clearance font-bold text-white" : "bg-white text-bone",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-x-3 gap-y-[10px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,130px),1fr))]">
        <div className="field-jn">
          <label htmlFor={`${context}-from`}>From</label>
          <input id={`${context}-from`} value={from} onChange={(e) => setFrom(e.target.value)} placeholder="City or airport" autoComplete="off" />
        </div>
        <div className="field-jn">
          <label htmlFor={`${context}-to`}>To</label>
          <input id={`${context}-to`} value={to} onChange={(e) => setTo(e.target.value)} placeholder="City or airport" autoComplete="off" />
        </div>
        <div className="field-jn">
          <label htmlFor={`${context}-date`}>Departure date</label>
          <input id={`${context}-date`} name="depart" type="date" />
        </div>
        <div className="field-jn">
          <label htmlFor={`${context}-pax`}>Passengers</label>
          <select id={`${context}-pax`} name="pax" defaultValue="4">
            {PAX.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button type="submit" className="btn btn-primary mt-3 w-full">
        Request route options <span aria-hidden="true">→</span>
      </button>
      <p className="mt-2 text-[12px] leading-[1.4] text-steel">
        The operating carrier confirms aircraft suitability and routing. An inquiry is not a booking.
      </p>
      <Link
        href="/cost-calculator"
        className="btn mt-3 h-10 w-full border-gold bg-transparent text-[13px] font-bold text-gold hover:bg-surface-2 hover:text-gold"
      >
        Open cost calculator <span aria-hidden="true">→</span>
      </Link>
    </form>
  );
}
