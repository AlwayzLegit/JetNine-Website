"use client";

import { useQuoteStore, type TripType } from "@/lib/quote-store";
import { computeIndicative, formatHours, type Leg } from "@/lib/quote-pricing";
import { getFleetEntry } from "@/lib/fleet";

const TRIP_LABEL: Record<TripType, string> = {
  roundtrip: "Round trip",
  oneway: "One way",
  multileg: "Multi-leg",
};

const CATERING_NAME = { standard: "Standard", plus: "Plus", premium: "Premium", custom: "Custom" } as const;
const GROUND_SHORT = { none: "—", sedan: "Black sedan", suv: "SUV / Sprinter" } as const;

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

function legWhen(l: Leg): string | null {
  const parts = [formatLegDate(l.date), formatLegTime(l.time)].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

type Props = {
  step: 1 | 2 | 3 | 4;
};

// "Your trip so far" — the sticky right column of every quote step. Reads
// the store itself and recomputes distance, flight time and the indicative
// range on every change. Rows grow with the step: Aircraft / Catering /
// Ground from step 2, Contact from step 3. Hidden below `lg`; a compact
// range card takes its place at the end of the form on phones.
export function QuoteSidebar({ step }: Props) {
  const s = useQuoteStore();
  const totalDistance = s.legs.reduce((sum, l) => sum + (l.distanceNm ?? 0), 0);
  const indicative = computeIndicative({
    category: s.category,
    legs: s.legs,
    catering: s.catering,
    ground: s.ground,
  });
  const fleet = getFleetEntry(s.category);
  const hasRoute = s.legs.some((l) => l.fromIata && l.toIata);
  const priceText = indicative?.formatted ?? "$ — – $ —";
  const timeText = indicative ? `~${formatHours(indicative.hours)}` : "—";
  const priceNote =
    indicative && fleet
      ? `${fleet.name} · ${timeText} total flight time. Fuel, taxes, FET, repositioning & crew included. Final pricing comes with specific aircraft.`
      : "Add where you're flying to see an indicative range. Final pricing comes with specific aircraft.";
  const fullName = `${s.firstName} ${s.lastName}`.trim();

  return (
    <>
      <aside
        aria-label="Your trip so far"
        className="card self-start p-6 max-lg:hidden lg:sticky lg:top-[calc(var(--header-h)+88px)]"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[13px] font-semibold text-steel">Your trip so far</h2>
          <span className="text-[12px] font-semibold text-clearance">{TRIP_LABEL[s.tripType]}</span>
        </div>

        <ul className="mt-3 flex flex-col gap-1.5">
          {hasRoute ? (
            s.legs.map((l) => (
              <li key={l.id} className="text-[16px] text-bone">
                {legEndpoint(l.fromCity, l.fromIata)} <span className="text-steel">→</span>{" "}
                {legEndpoint(l.toCity, l.toIata)}
                <span className="block text-[13px] text-steel">{legWhen(l) ?? "Date and time to come"}</span>
              </li>
            ))
          ) : (
            <li className="text-[15px] text-steel">Add a from and a to to see your route.</li>
          )}
        </ul>

        <dl className="mt-4 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 border-t border-line pt-4 text-[15px]">
          <dt className="text-steel">Passengers</dt>
          <dd className="text-right text-bone">{s.pax}</dd>
          <dt className="text-steel">Distance</dt>
          <dd className="text-right text-bone">
            {totalDistance > 0 ? `${totalDistance.toLocaleString("en-US")} nm` : "—"}
          </dd>
          <dt className="text-steel">Flight time</dt>
          <dd className="text-right text-bone">{timeText}</dd>
          {step >= 2 ? (
            <>
              <dt className="text-steel">Aircraft</dt>
              <dd className="text-right text-bone">{fleet?.name ?? "—"}</dd>
              <dt className="text-steel">Catering</dt>
              <dd className="text-right text-bone">{CATERING_NAME[s.catering]}</dd>
              <dt className="text-steel">Ground</dt>
              <dd className="text-right text-bone">{GROUND_SHORT[s.ground]}</dd>
            </>
          ) : null}
        </dl>

        {step >= 3 ? (
          <div className="mt-4 border-t border-line pt-4 text-[15px]">
            <div className="text-[13px] text-steel">Contact</div>
            <div className="mt-1 text-bone">{fullName || "—"}</div>
            <div className="break-words text-[14px] text-bone-2">{s.email || "—"}</div>
          </div>
        ) : null}

        <div className="mt-4 border-t border-line pt-4">
          <div className="text-[13px] font-semibold text-steel">Indicative range</div>
          <div className="mt-1.5 font-serif text-[30px] font-light leading-[1.1] text-bone">{priceText}</div>
          <p className="mt-2.5 text-[14px] text-bone-2">{priceNote}</p>
        </div>
      </aside>

      {/* Phones and tablets: the range as a compact card at the end of the
          form (Mobile.dc "Quote step 1"), since the column is hidden. */}
      <div className="card flex items-center justify-between gap-4 px-4 py-3.5 lg:hidden">
        <div className="min-w-0">
          <div className="text-[13px] text-steel">Indicative range</div>
          <div className="font-serif text-[22px] font-light leading-[1.15] text-bone">{priceText}</div>
        </div>
        <div className="text-right text-[13px] text-steel">
          {TRIP_LABEL[s.tripType]}
          <br />
          {indicative ? `${timeText} in the air` : `${s.pax} passengers`}
        </div>
      </div>
    </>
  );
}
