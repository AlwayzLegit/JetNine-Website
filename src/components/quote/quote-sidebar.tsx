"use client";

import { useQuoteStore } from "@/lib/quote-store";
import { computeIndicative, formatHours, CRUISE_KT } from "@/lib/quote-pricing";
import { getFleetEntry } from "@/lib/fleet";

const TRIP_LABEL = { roundtrip: "ROUND TRIP", oneway: "ONE WAY", multileg: "MULTI-LEG" };

type Props = {
  step: 1 | 2 | 3;
};

export function QuoteSidebar({ step }: Props) {
  const s = useQuoteStore();
  const totalDistance = s.legs.reduce((sum, l) => sum + (l.distanceNm ?? 0), 0);
  const totalHours = totalDistance > 0 ? totalDistance / CRUISE_KT[s.category] + 0.4 * s.legs.length : 0;
  const indicative = computeIndicative({
    category: s.category,
    legs: s.legs,
    catering: s.catering,
    ground: s.ground,
  });
  const fleet = getFleetEntry(s.category);

  const activeToggles = (Object.entries(s.cabin) as [keyof typeof s.cabin, boolean][])
    .filter(([, v]) => v)
    .map(([k]) => k);

  const hasRoute = s.legs.some((l) => l.fromIata && l.toIata);

  return (
    <aside className="sticky top-32 self-start rounded-[4px] border border-ink-3 bg-ink-2 p-7">
      <div className="mb-6 flex items-baseline justify-between">
        <p className="caption">— Mission preview</p>
        <span className="rounded-[2px] bg-ink-3 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-clearance">
          {TRIP_LABEL[s.tripType]}
        </span>
      </div>

      {/* Itinerary */}
      <div className="border-t border-ink-3 pt-5">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">Itinerary</span>
        {!hasRoute ? (
          <p className="mt-3 text-[13px] leading-[1.5] text-steel">No route entered yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {s.legs.map((l, i) => (
              <li key={l.id} className="grid grid-cols-[auto_1fr] items-baseline gap-3 text-[13px]">
                <span className="font-mono text-[10px] tracking-[0.04em] text-steel">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <div className="font-serif text-bone">
                    {l.fromIata ?? "—"} <span className="text-steel">→</span> {l.toIata ?? "—"}
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
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">Details</span>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
          <dt className="font-mono text-[10px] uppercase tracking-[0.04em] text-steel">Passengers</dt>
          <dd className="text-right font-mono text-[12px] tracking-[0.04em] text-bone">{s.pax}</dd>
          <dt className="font-mono text-[10px] uppercase tracking-[0.04em] text-steel">Distance</dt>
          <dd className="text-right font-mono text-[12px] tracking-[0.04em] text-bone">
            {totalDistance > 0 ? `${totalDistance.toLocaleString()} NM` : "—"}
          </dd>
          <dt className="font-mono text-[10px] uppercase tracking-[0.04em] text-steel">Est. time</dt>
          <dd className="text-right font-mono text-[12px] tracking-[0.04em] text-bone">
            {totalHours > 0 ? formatHours(totalHours) : "—"}
          </dd>
          {step >= 2 && (
            <>
              <dt className="font-mono text-[10px] uppercase tracking-[0.04em] text-steel">Aircraft</dt>
              <dd className="text-right font-mono text-[11px] uppercase tracking-[0.06em] text-bone">
                {fleet?.shortName.toUpperCase() ?? s.category.toUpperCase()}
              </dd>
              <dt className="font-mono text-[10px] uppercase tracking-[0.04em] text-steel">Catering</dt>
              <dd className="text-right font-mono text-[11px] uppercase tracking-[0.06em] text-bone">
                {s.catering.toUpperCase()}
              </dd>
              <dt className="font-mono text-[10px] uppercase tracking-[0.04em] text-steel">Ground</dt>
              <dd className="text-right font-mono text-[11px] uppercase tracking-[0.06em] text-bone">
                {s.ground === "none" ? "—" : s.ground === "suv" ? "SUV / SPRINTER" : "BLACK SEDAN"}
              </dd>
            </>
          )}
        </dl>
      </div>

      {/* Cabin preferences (step 2+) */}
      {step >= 2 && (
        <div className="mt-6 border-t border-ink-3 pt-5">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
            Preferences
          </span>
          {activeToggles.length === 0 && s.kids === 0 && s.pets === 0 && s.bags === 0 && !s.notes ? (
            <p className="mt-3 text-[13px] leading-[1.5] text-steel">No extras yet.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2 text-[13px] leading-[1.5] text-bone">
              {activeToggles.map((k) => (
                <li key={k} className="grid grid-cols-[auto_1fr] items-baseline gap-2">
                  <span className="text-clearance">✓</span>
                  <span className="capitalize">{k}</span>
                </li>
              ))}
              {s.kids > 0 && (
                <li className="grid grid-cols-[auto_1fr] items-baseline gap-2">
                  <span className="text-clearance">·</span>
                  <span>{s.kids} children</span>
                </li>
              )}
              {s.pets > 0 && (
                <li className="grid grid-cols-[auto_1fr] items-baseline gap-2">
                  <span className="text-clearance">·</span>
                  <span>{s.pets} pets</span>
                </li>
              )}
              {s.bags > 0 && (
                <li className="grid grid-cols-[auto_1fr] items-baseline gap-2">
                  <span className="text-clearance">·</span>
                  <span>{s.bags} extra bags</span>
                </li>
              )}
              {s.notes && (
                <li className="grid grid-cols-[auto_1fr] items-baseline gap-2">
                  <span className="text-clearance">·</span>
                  <span>Custom notes</span>
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      {/* Contact (step 3+) */}
      {step >= 3 && (
        <div className="mt-6 border-t border-ink-3 pt-5">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">Contact</span>
          <dl className="mt-3 grid grid-cols-1 gap-2 text-[12px]">
            <dt className="font-mono text-[10px] uppercase tracking-[0.04em] text-steel">Name</dt>
            <dd className="text-bone">
              {(s.firstName + " " + s.lastName).trim().toUpperCase() || "—"}
            </dd>
            <dt className="font-mono text-[10px] uppercase tracking-[0.04em] text-steel">Email</dt>
            <dd className="font-mono text-[11px] tracking-[0.04em] text-bone-2">{s.email || "—"}</dd>
            <dt className="font-mono text-[10px] uppercase tracking-[0.04em] text-steel">Phone</dt>
            <dd className="font-mono text-[11px] tracking-[0.04em] text-bone-2">
              {s.phone ? `${s.phoneCountry} ${s.phone}` : "—"}
            </dd>
          </dl>
        </div>
      )}

      {/* Indicative */}
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
          {fleet
            ? `${fleet.shortName} · ~${formatHours(totalHours || 0)} total flight time. Fuel, taxes, FET, repos & crew included.`
            : "Pick a category to refine the estimate. Final pricing comes with specific airframes in step 04."}
        </p>
      </div>
    </aside>
  );
}
