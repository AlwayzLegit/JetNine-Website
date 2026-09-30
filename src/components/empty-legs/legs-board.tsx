"use client";

import { useMemo, useState } from "react";
import { CATEGORY_LABELS, formatUSD, type EmptyLegView, type SoldLegView } from "@/lib/empty-legs";
import { SITE } from "@/lib/constants";

// Coast buckets for the filter. Derived on the server from the departure
// airport's state / country (see the page), null when the airport sits in
// neither list — those legs only show under "All".
export type BoardRegion = "west" | "east" | "intl" | null;

export type BoardLeg = EmptyLegView & {
  /** "Today", "Tomorrow", "Thu, Oct 2". */
  day: string;
  /** "4:30 PM". */
  time: string;
  region: BoardRegion;
};

type Filter = "all" | "soon" | "west" | "east" | "intl";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "soon", label: "Next 48 hours" },
  { id: "west", label: "West coast" },
  { id: "east", label: "East coast" },
  { id: "intl", label: "International" },
];

function applyFilter(legs: BoardLeg[], filter: Filter): BoardLeg[] {
  if (filter === "all") return legs;
  if (filter === "soon") return legs.filter((l) => l.hoursOut <= 48);
  return legs.filter((l) => l.region === filter);
}

// The empty-state CTA hands the visitor's date-window filter to the
// watchlist form (below on the same page) so "we'll text you" starts
// pre-filled from what they just asked for.
export const WATCHLIST_PREFILL_EVENT = "jn:watchlist-prefill";
export type WatchlistPrefill = { earliest?: string; latest?: string };

function isoDaysAhead(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function LegsBoard({
  legs,
  recentlySold = [],
}: {
  legs: BoardLeg[];
  recentlySold?: SoldLegView[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const filtered = useMemo(() => applyFilter(legs, filter), [legs, filter]);

  return (
    <section className="container-jn pt-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Five segments overflow a phone: scroll the strip sideways
            instead of wrapping, and lift the targets to 44px there. */}
        <div className="max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="segmented" role="group" aria-label="Filter the board">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                aria-pressed={filter === f.id}
                className="max-md:h-11"
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <span className="text-[14px] text-steel">
          Whole aircraft, not a seat · price is per flight · first call wins
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="card mx-auto mt-4 max-w-[820px] p-10 text-center max-md:p-6">
          {/* "Every listed leg sold" is only true when legs have in fact
              sold. With an empty board and no fills behind it, saying so
              would claim a trading history the board does not have. */}
          <h3 className="title-card">
            {legs.length > 0
              ? "No legs match that filter right now."
              : recentlySold.length > 0
                ? "The board is clear — every listed leg sold."
                : "No legs on the board right now."}
          </h3>
          <p className="mx-auto mt-3 max-w-[52ch] text-bone-2">
            {legs.length > 0
              ? "Try another filter — or set a watchlist and we'll text you when something shows up."
              : recentlySold.length > 0
                ? "Legs go the moment a confirmation comes through — first call wins. Set a watchlist and we'll text the second one matching your lanes hits the board."
                : "Repositioning legs surface at short notice and go fast. Set a watchlist with your lanes and dates and the desk will text you when one fits."}
          </p>
          <a
            href="#watchlist"
            onClick={() => {
              const detail: WatchlistPrefill =
                filter === "soon" ? { earliest: isoDaysAhead(0), latest: isoDaysAhead(2) } : {};
              window.dispatchEvent(
                new CustomEvent<WatchlistPrefill>(WATCHLIST_PREFILL_EVENT, { detail }),
              );
            }}
            className="btn btn-primary btn-lg mt-6"
          >
            Set a watchlist <span className="arrow" aria-hidden="true">→</span>
          </a>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2.5">
          {filtered.map((l) => (
            <article
              key={l.id}
              className={[
                "card grid items-center gap-4 px-7 py-[22px] max-md:px-5 max-md:py-5",
                "lg:grid-cols-[150px_minmax(0,1.4fr)_minmax(0,1fr)_180px_auto] lg:gap-6",
                l.featured ? "border-clearance" : "",
              ].join(" ")}
            >
              <div className="flex items-baseline gap-2 lg:block">
                <div className="text-[16px] font-medium text-bone">{l.day}</div>
                <div className="text-[14px] text-steel">{l.time}</div>
              </div>
              <div>
                <div className="font-serif text-[26px] leading-[1.1] text-bone">
                  {l.fromCity} <span className="text-steel">→</span> {l.toCity}
                </div>
                <div className="mt-1 text-[14px] text-bone-2">
                  {l.fromAirport} → {l.toAirport} · about {l.duration}
                </div>
              </div>
              <div className="text-[15px] text-bone">
                {l.aircraft}
                <div className="text-[14px] text-steel">
                  {CATEGORY_LABELS[l.category]} · up to {l.seats} passengers · safety-audited operator
                </div>
              </div>
              <div className="flex items-baseline gap-3 lg:block">
                <div className="font-serif text-[30px] font-light leading-none text-bone">
                  {formatUSD(l.priceNow)}
                </div>
                <div className="text-[14px] text-steel lg:mt-1">
                  <span className="line-through">{formatUSD(l.priceWas)}</span> ·{" "}
                  <span className="font-semibold text-gold">{l.discountPct}% off</span>
                </div>
              </div>
              <a
                href={`tel:${SITE.dispatchPhoneE164}`}
                className={`btn ${l.featured ? "btn-primary" : "btn-secondary"} max-lg:w-full`}
              >
                Call to book
              </a>
            </article>
          ))}
        </div>
      )}

      {recentlySold.length > 0 ? (
        <p className="mt-4 text-[14px] text-steel">
          Recently sold:{" "}
          {recentlySold.map((l, i) => (
            <span key={l.id}>
              {i > 0 ? " · " : ""}
              {l.fromCity} → {l.toCity}, {formatUSD(l.priceNow)}, {l.timeToSale}
            </span>
          ))}
        </p>
      ) : null}
    </section>
  );
}
