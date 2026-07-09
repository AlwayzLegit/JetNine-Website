"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { findAirport, distanceNm, type Airport } from "@/lib/airports";
import {
  isMissionComplete,
  useQuoteStore,
  type TripType,
} from "@/lib/quote-store";
import { MissionSidebar } from "@/components/quote/mission-sidebar";
import { AirportInput } from "@/components/quote/airport-input";
import { SavedIndicator } from "@/components/quote/saved-indicator";
import { StoreHydrationGate } from "@/components/quote/store-hydration";

const TRIP_TYPES: { id: TripType; label: string }[] = [
  { id: "roundtrip", label: "Round trip" },
  { id: "oneway", label: "One way" },
  { id: "multileg", label: "Multi-leg" },
];

const COMMON_ROUTES = [
  { from: "VNY", to: "JFK" },
  { from: "LAX", to: "LAS" },
  { from: "TEB", to: "PBI" },
  { from: "JFK", to: "LTN" },
  { from: "VNY", to: "ASE" },
];

function paxHint(pax: number): string {
  if (pax <= 4) return "Light or midsize jet · plenty of room with full baggage.";
  if (pax <= 8) return "Midsize or super-mid · stand-up cabin, full galley.";
  if (pax <= 12) return "Heavy jet · two cabin zones, dedicated galley & lavatory.";
  return "Ultra-long-range or executive airliner · charter capacity.";
}

export default function MissionStep() {
  return (
    <StoreHydrationGate>
      <MissionStepInner />
    </StoreHydrationGate>
  );
}

// Local-calendar today for the date pickers' floor. Local (not UTC) so a
// late-evening US visitor can still pick their same-day date; the server
// re-validates with an anywhere-on-earth floor.
function localTodayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function MissionStepInner() {
  const router = useRouter();
  const minDate = localTodayIso();
  const tripType = useQuoteStore((s) => s.tripType);
  const legs = useQuoteStore((s) => s.legs);
  const pax = useQuoteStore((s) => s.pax);
  const draft = useQuoteStore();

  const setTripType = useQuoteStore((s) => s.setTripType);
  const setPax = useQuoteStore((s) => s.setPax);
  const updateLeg = useQuoteStore((s) => s.updateLeg);
  const addLeg = useQuoteStore((s) => s.addLeg);
  const removeLeg = useQuoteStore((s) => s.removeLeg);

  const canContinue = isMissionComplete(draft);

  function pickAirport(legId: string, side: "from" | "to", a: Airport) {
    const leg = legs.find((l) => l.id === legId);
    if (!leg) return;
    const patch =
      side === "from"
        ? { fromIata: a.iata, fromCity: a.city, fromName: a.name }
        : { toIata: a.iata, toCity: a.city, toName: a.name };
    updateLeg(legId, patch);

    // Compute distance if both ends known
    const fromCode = side === "from" ? a.iata : leg.fromIata;
    const toCode = side === "to" ? a.iata : leg.toIata;
    if (fromCode && toCode) {
      const fromA = findAirport(fromCode);
      const toA = findAirport(toCode);
      if (fromA && toA) {
        updateLeg(legId, { distanceNm: distanceNm(fromA, toA) });
      }
    }
  }

  function applyPreset(from: string, to: string) {
    const f = findAirport(from);
    const t = findAirport(to);
    if (!f || !t) return;
    const dist = distanceNm(f, t);
    updateLeg(legs[0].id, {
      fromIata: f.iata,
      fromCity: f.city,
      fromName: f.name,
      toIata: t.iata,
      toCity: t.city,
      toName: t.name,
      distanceNm: dist,
    });
    if (tripType === "roundtrip" && legs[1]) {
      updateLeg(legs[1].id, {
        fromIata: t.iata,
        fromCity: t.city,
        fromName: t.name,
        toIata: f.iata,
        toCity: f.city,
        toName: f.name,
        distanceNm: dist,
      });
    }
  }

  return (
    <div className="container-jn py-12 lg:py-16">
      <div className="grid gap-10 lg:grid-cols-[1fr_380px] lg:gap-12">
        {/* min-w-0: grid items default to min-width:auto, so a wide child
            (or a native date/time input's intrinsic min width) can drag the
            single mobile column past the viewport and clip text. */}
        <div className="min-w-0">
          <header className="mb-10">
            <p className="caption mb-4">— Step 01 · Mission</p>
            <h1 className="display-l max-w-[18ch]">Where, when, how many.</h1>
            <p className="mt-5 max-w-[60ch] text-[17px] leading-[1.55] text-bone-2">
              The basics. The more precise the better — but it doesn&rsquo;t have to be perfect.
              Dispatch will follow up to refine. Every quote returns within 30 minutes during
              operating hours.
            </p>
          </header>

          {/* Trip type segmented */}
          <div className="mb-10">
            <p className="caption mb-3">— Trip type</p>
            <div className="inline-flex rounded-[2px] border border-ink-3 bg-ink-2 p-1">
              {TRIP_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTripType(t.id)}
                  className={[
                    "rounded-[2px] px-5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors",
                    tripType === t.id
                      ? "bg-clearance text-ink"
                      : "text-bone-2 hover:text-bone",
                  ].join(" ")}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Legs */}
          <div className="mb-10 flex flex-col gap-5">
            {legs.map((l, i) => {
              const label =
                tripType === "roundtrip"
                  ? i === 0
                    ? "Outbound"
                    : "Return"
                  : tripType === "multileg"
                    ? i === 0
                      ? "Outbound"
                      : `Sector ${String(i + 1).padStart(2, "0")}`
                    : "Outbound";
              return (
                <section
                  key={l.id}
                  className="rounded-[4px] border border-ink-3 bg-ink-2 p-7"
                >
                  <header className="mb-5 flex items-center justify-between">
                    <div className="flex items-baseline gap-3">
                      <span className="rounded-[2px] bg-ink-3 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-clearance">
                        LEG {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-bone-2">
                        {label}
                      </span>
                    </div>
                    {tripType === "multileg" && legs.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeLeg(l.id)}
                        className="font-mono text-[10px] uppercase tracking-[0.12em] text-bone-2 transition-colors hover:text-[var(--error)]"
                      >
                        Remove
                      </button>
                    ) : null}
                  </header>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <AirportInput
                      label={i === 0 ? "From" : "From"}
                      value={{ iata: l.fromIata, city: l.fromCity, name: l.fromName }}
                      onSelect={(a) => pickAirport(l.id, "from", a)}
                    />
                    <AirportInput
                      label="To"
                      value={{ iata: l.toIata, city: l.toCity, name: l.toName }}
                      onSelect={(a) => pickAirport(l.id, "to", a)}
                    />
                    <div className="field-jn">
                      <label htmlFor={`date-${i}`}>
                        {tripType === "roundtrip" && i === 1 ? "Return date" : "Depart date"}
                      </label>
                      <input
                        id={`date-${i}`}
                        type="date"
                        min={minDate}
                        value={l.date ?? ""}
                        onChange={(e) => updateLeg(l.id, { date: e.target.value })}
                      />
                    </div>
                    <div className="field-jn">
                      <label htmlFor={`time-${i}`}>
                        {tripType === "roundtrip" && i === 1 ? "Return time" : "Depart time"}
                      </label>
                      <input
                        id={`time-${i}`}
                        type="time"
                        value={l.time ?? ""}
                        onChange={(e) => updateLeg(l.id, { time: e.target.value })}
                      />
                    </div>
                  </div>

                  {l.distanceNm ? (
                    <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-clearance">
                      — {l.distanceNm.toLocaleString()} NM great-circle
                    </p>
                  ) : null}
                </section>
              );
            })}

            {tripType === "multileg" || legs.length < 5 ? (
              <button
                type="button"
                onClick={addLeg}
                className="rounded-[4px] border border-dashed border-ink-3 bg-transparent px-5 py-4 font-mono text-[11px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:border-clearance hover:text-bone"
              >
                + Add another leg
              </button>
            ) : null}
          </div>

          {/* Common routes */}
          <div className="mb-10">
            <p className="caption mb-3">— Common routes</p>
            <div className="flex flex-wrap gap-2">
              {COMMON_ROUTES.map((r) => (
                <button
                  key={`${r.from}-${r.to}`}
                  type="button"
                  onClick={() => applyPreset(r.from, r.to)}
                  className="rounded-full border border-ink-3 bg-ink-2 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:border-clearance hover:text-bone"
                >
                  {r.from} → {r.to}
                </button>
              ))}
            </div>
          </div>

          {/* Pax */}
          <div className="rounded-[4px] border border-ink-3 bg-ink-2 p-7">
            <p className="caption mb-2">— Passengers</p>
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={() => setPax(pax - 1)}
                disabled={pax <= 1}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-ink-3 font-mono text-[14px] text-bone transition-colors hover:border-clearance disabled:opacity-30"
              >
                −
              </button>
              <div className="flex items-baseline gap-3">
                <span
                  className="font-serif text-[64px] font-light leading-none text-bone"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  {pax}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-bone-2">
                  PAX
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPax(pax + 1)}
                disabled={pax >= 16}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-ink-3 font-mono text-[14px] text-bone transition-colors hover:border-clearance disabled:opacity-30"
              >
                +
              </button>
              <input
                type="range"
                min={1}
                max={16}
                step={1}
                value={pax}
                onChange={(e) => setPax(Number(e.target.value))}
                aria-label="Passengers"
                aria-valuenow={pax}
                aria-valuemin={1}
                aria-valuemax={16}
                aria-valuetext={`${pax} passenger${pax === 1 ? "" : "s"}`}
                className="flex-1 accent-clearance"
              />
            </div>
            <p className="mt-4 text-[13px] leading-[1.55] text-bone-2">{paxHint(pax)}</p>
          </div>

          {/* Step actions */}
          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-ink-3 pt-8">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-clearance">
                Step 01 of 04
              </span>
              <SavedIndicator />
            </div>
            <div className="flex items-center gap-6">
              <Link href="/" className="btn btn-ghost">
                Cancel
              </Link>
              <button
                type="button"
                disabled={!canContinue}
                onClick={() => router.push("/quote/aircraft")}
                className="btn btn-primary btn-lg disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue to aircraft <span className="arrow">→</span>
              </button>
            </div>
          </div>
        </div>

        <MissionSidebar />
      </div>
    </div>
  );
}
