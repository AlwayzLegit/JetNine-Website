"use client";

import Link from "next/link";
import { useQuoteStore, type TripType } from "@/lib/quote-store";
import { computeIndicative, formatHours, type Leg } from "@/lib/quote-pricing";
import { getFleetEntry } from "@/lib/fleet";

export const TRIP_LABEL: Record<TripType, string> = {
  roundtrip: "round trip",
  oneway: "one way",
  multileg: "multi-city",
};

// "Fri, Oct 3" from a YYYY-MM-DD string. Parsed as local calendar parts
// so a UTC midnight never rolls the day back for US visitors.
export function formatLegDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// "9:00 AM" from HH:MM.
export function formatLegTime(hhmm: string | undefined): string | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function legEndpoint(city: string | undefined, iata: string | undefined): string {
  if (!iata) return "—";
  return city ? `${city} (${iata})` : iata;
}

export function legWhen(l: Leg): string | null {
  const parts = [formatLegDate(l.date), formatLegTime(l.time)].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/**
 * The prototype's sand "Indicative range" box: bronze label over the
 * serif range on the left, the note on the right (stacked on phones).
 * Reads the store and recomputes on every change, like the old sidebar.
 */
export function IndicativeRange({ className = "" }: { className?: string }) {
  const s = useQuoteStore();
  const indicative = computeIndicative({
    category: s.category,
    legs: s.legs,
    catering: s.catering,
    ground: s.ground,
  });
  const fleet = getFleetEntry(s.category);
  const priceText = indicative?.formatted ?? "$ — – $ —";
  const note =
    indicative && fleet
      ? `${fleet.name} · ~${formatHours(indicative.hours)} total flight time. All-in for ${s.pax} ${s.pax === 1 ? "passenger" : "passengers"}: fuel, taxes, FET, repositioning & crew. Exact prices come with specific aircraft.`
      : "Add where you’re flying to see an indicative range. Exact prices come with specific aircraft.";

  return (
    <div
      aria-live="polite"
      className={[
        "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 rounded-[3px] bg-surface-2 px-4 py-3.5",
        className,
      ].join(" ")}
    >
      <div className="min-w-0">
        <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-gold">
          Indicative range
        </div>
        <div className="mt-0.5 font-serif text-[26px] leading-[1.1] text-bone">{priceText}</div>
      </div>
      <p className="max-w-[34ch] text-[13px] leading-[1.5] text-steel sm:text-right">{note}</p>
    </div>
  );
}

/**
 * One-line trip recap with an "Edit" link back to the mission step
 * (Quote.dc step 2): "Los Angeles (VNY) → Aspen (ASE), round trip ·
 * Fri, Oct 3 · 4 passengers". From step 3 on it adds the category.
 */
export function TripSummaryBar({ withCategory = false }: { withCategory?: boolean }) {
  const s = useQuoteStore();
  const first = s.legs[0];
  const fleet = getFleetEntry(s.category);
  const parts = [
    first ? `${legEndpoint(first.fromCity, first.fromIata)} → ${legEndpoint(first.toCity, first.toIata)}, ${TRIP_LABEL[s.tripType]}` : null,
    first ? formatLegDate(first.date) : null,
    `${s.pax} ${s.pax === 1 ? "passenger" : "passengers"}`,
    withCategory && fleet ? fleet.name : null,
  ].filter(Boolean);

  return (
    <div className="mt-4 flex items-center justify-between gap-4 rounded-[3px] border border-line px-4 py-3 text-[14px] text-bone">
      <span className="min-w-0">{parts.join(" · ")}</span>
      <Link
        href="/quote/mission"
        aria-label="Edit trip details"
        className="-my-2 inline-flex min-h-11 flex-none items-center font-semibold text-bone underline underline-offset-[3px] hover:text-gold"
      >
        Edit
      </Link>
    </div>
  );
}
