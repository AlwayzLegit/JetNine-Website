"use client";

import { useQuoteStore } from "@/lib/quote-store";
import { computeIndicative, formatHours, CRUISE_KT } from "@/lib/quote-pricing";

const TRIP_LABEL: Record<string, string> = {
  roundtrip: "ROUND TRIP",
  oneway: "ONE WAY",
  multileg: "MULTI-LEG",
};

export function MissionSidebar() {
  const tripType = useQuoteStore((s) => s.tripType);
  const legs = useQuoteStore((s) => s.legs);
  const pax = useQuoteStore((s) => s.pax);
  const category = useQuoteStore((s) => s.category);

  const totalDistance = legs.reduce((sum, l) => sum + (l.distanceNm ?? 0), 0);
  const speed = CRUISE_KT[category];
  const totalHours = totalDistance > 0 ? totalDistance / speed + 0.4 * legs.length : 0;
  const indicative = computeIndicative({ category, legs });

  const hasRoute = legs.some((l) => l.fromIata && l.toIata);

  return (
    <aside className="sticky top-32 self-start rounded-[4px] border border-ink-3 bg-ink-2 p-7">
      <div className="mb-6 flex items-baseline justify-between">
        <p className="caption">— Mission preview</p>
        <span className="rounded-[2px] bg-ink-3 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-clearance">
          {TRIP_LABEL[tripType]}
        </span>
      </div>

      {/* Itinerary */}
      <div className="border-t border-ink-3 pt-5">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
          Itinerary
        </span>
        {!hasRoute ? (
          <p className="mt-3 text-[13px] leading-[1.5] text-steel">
            Add a from / to to preview your route.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {legs.map((l, i) => (
              <li
                key={l.id}
                className="grid grid-cols-[auto_1fr] items-baseline gap-3 text-[13px]"
              >
                <span className="font-mono text-[10px] tracking-[0.04em] text-steel">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <div className="font-serif text-bone">
                    {(l.fromIata ?? "—")} <span className="text-steel">→</span>{" "}
                    {(l.toIata ?? "—")}
                  </div>
                  {(l.fromCity || l.toCity) && (
                    <div className="font-mono text-[10px] tracking-[0.04em] text-bone-2">
                      {l.fromCity ?? "—"} · {l.toCity ?? "—"}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Details */}
      <div className="mt-6 border-t border-ink-3 pt-5">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
          Details
        </span>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
          <dt className="font-mono text-[10px] uppercase tracking-[0.04em] text-steel">Passengers</dt>
          <dd className="text-right font-mono text-[12px] tracking-[0.04em] text-bone">{pax}</dd>

          <dt className="font-mono text-[10px] uppercase tracking-[0.04em] text-steel">Total legs</dt>
          <dd className="text-right font-mono text-[12px] tracking-[0.04em] text-bone">
            {legs.length}
          </dd>

          <dt className="font-mono text-[10px] uppercase tracking-[0.04em] text-steel">
            Est. distance
          </dt>
          <dd className="text-right font-mono text-[12px] tracking-[0.04em] text-bone">
            {totalDistance > 0 ? `${totalDistance.toLocaleString()} NM` : "—"}
          </dd>

          <dt className="font-mono text-[10px] uppercase tracking-[0.04em] text-steel">
            Est. total time
          </dt>
          <dd className="text-right font-mono text-[12px] tracking-[0.04em] text-bone">
            {totalHours > 0 ? formatHours(totalHours) : "—"}
          </dd>
        </dl>
      </div>

      {/* Indicative range */}
      <div className="mt-6 border-t border-ink-3 pt-5">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
          — Indicative range
        </span>
        <div
          className="mt-3 font-serif text-[28px] font-light leading-tight tracking-tight text-bone"
          style={{ letterSpacing: "-0.01em" }}
        >
          {indicative?.formatted ?? "$ — – $ —"}
        </div>
        <p className="mt-4 text-[12px] leading-[1.55] text-bone-2">
          Final pricing surfaces with specific airframes in step 04. JetNine quotes are all-in:
          fuel, taxes, FET, repos, crew.
        </p>
      </div>
    </aside>
  );
}
