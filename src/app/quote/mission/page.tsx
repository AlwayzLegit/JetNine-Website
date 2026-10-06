"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { findAirport, distanceNm, type Airport } from "@/lib/airports";
import { isMissionComplete, useQuoteStore, type TripType } from "@/lib/quote-store";
import { IndicativeRange } from "@/components/quote/trip-summary";
import { PanelHeader, PanelLabel, QuotePanel } from "@/components/quote/quote-panel";
import { AirportInput } from "@/components/quote/airport-input";
import { CompactField, COMPACT_INPUT_CLASS } from "@/components/quote/compact-field";
import { StepFooter } from "@/components/quote/step-footer";
import { StoreHydrationGate } from "@/components/quote/store-hydration";
import { useReplyPromiseWords } from "@/components/quote/reply-promise";

// Prototype order and wording (Quote.dc): One-way · Round-trip · Multi-city.
const TRIP_TYPES: { id: TripType; label: string }[] = [
  { id: "oneway", label: "One-way" },
  { id: "roundtrip", label: "Round-trip" },
  { id: "multileg", label: "Multi-city" },
];

const COMMON_ROUTES = [
  { from: "VNY", to: "JFK" },
  { from: "LAX", to: "LAS" },
  { from: "TEB", to: "PBI" },
  { from: "JFK", to: "LTN" },
  { from: "VNY", to: "ASE" },
];

const MAX_LEGS = 6;

function paxHint(pax: number): string {
  if (pax <= 7) return "Light or midsize jet · plenty of room with full baggage.";
  if (pax <= 9) return "Midsize or super-mid jet · room to stand and stretch.";
  return "Heavy or ultra long range · the whole group, with beds.";
}

function legTitle(tripType: TripType, i: number): string {
  if (i === 0) return "Outbound";
  if (tripType === "roundtrip") return "Return";
  return `Leg ${i + 1}`;
}

export default function MissionStep() {
  return (
    <>
      <StoreHydrationGate>
        <MissionStepInner />
      </StoreHydrationGate>
      <HowQuotingWorks />
    </>
  );
}

// Static copy rendered outside the hydration gate so it's always in the
// server HTML. /quote/mission is the wizard's one indexable step, and the
// form itself only appears after client rehydration — without this block
// the crawlable page is nearly empty (Semrush: low word count). Spans
// both columns of the layout grid, under the form and the sidebar.
function HowQuotingWorks() {
  const when = useReplyPromiseWords();
  return (
    <section aria-labelledby="how-quoting-works" className="mt-12 border-t border-line pt-9">
      <h2 id="how-quoting-works" className="title-card-sm">
        How quoting works
      </h2>
      <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-7 text-[15px] leading-[1.6] text-bone-2">
        <div>
          <h3 className="mb-1.5 text-[16px] font-semibold text-bone">Tell us the trip</h3>
          <p>
            Route, dates, and passenger count are enough to start. Round trip, one way, or
            multi-leg — the form prices each leg as you type and saves your draft automatically,
            so you can come back anytime.
          </p>
        </div>
        <div>
          <h3 className="mb-1.5 text-[16px] font-semibold text-bone">Dispatch goes to work</h3>
          <p>
            A senior dispatcher sources three to five vetted aircraft that fit the trip — ARG/US
            or Wyvern audited operators only — and returns all-in pricing {when} during operating
            hours.
          </p>
        </div>
        <div>
          <h3 className="mb-1.5 text-[16px] font-semibold text-bone">Fly on your terms</h3>
          <p>
            Review the options, pick an aircraft, and confirm. No membership required, and every
            quote is the all-in number — fuel, FET, repositioning, crew, catering, and ground
            included. Questions first? Call dispatch any time.
          </p>
        </div>
      </div>
    </section>
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
  const when = useReplyPromiseWords();
  const minDate = localTodayIso();
  const draft = useQuoteStore();
  const { tripType, legs, pax, setTripType, setPax, updateLeg, addLeg, removeLeg } = draft;
  const [showErrors, setShowErrors] = useState(false);

  const complete = isMissionComplete(draft);
  const error =
    showErrors && !complete
      ? "A few details are missing — each leg needs a from, a to, a date and a time."
      : null;

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

  function onContinue() {
    if (!complete) {
      setShowErrors(true);
      return;
    }
    router.push("/quote/aircraft");
  }

  return (
    <QuotePanel>
      <PanelHeader step={1} title="Where, when, how many.">
        Tell us about your trip — it doesn&rsquo;t have to be perfect; dispatch follows up to
        refine. Every quote returns {when} during operating hours.
      </PanelHeader>

      {/* Trip type — the prototype's full-width three-way switch. */}
      <div
        role="group"
        aria-label="Trip type"
        className="mt-5 grid auto-cols-[minmax(0,1fr)] grid-flow-col overflow-hidden rounded-[3px] border border-line"
      >
        {TRIP_TYPES.map((t, i) => {
          const on = tripType === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTripType(t.id)}
              aria-pressed={on}
              className={[
                "h-10 text-[14px] font-semibold transition-colors max-md:h-11",
                i > 0 ? "border-l border-line" : "",
                on ? "bg-clearance text-white" : "bg-surface text-bone hover:bg-ink",
              ].join(" ")}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-[18px] flex flex-col gap-4">
        {legs.map((l, i) => {
          const isReturn = tripType === "roundtrip" && i === 1;
          return (
            <div key={l.id}>
              <div className="mb-2 flex min-h-[18px] items-center justify-between gap-4">
                <PanelLabel as="h2">{legTitle(tripType, i)}</PanelLabel>
                {i >= 2 ? (
                  <button
                    type="button"
                    onClick={() => removeLeg(l.id)}
                    className="-my-3 inline-flex h-11 items-center text-[13px] text-steel underline underline-offset-[3px] transition-colors hover:text-danger"
                  >
                    Remove leg
                  </button>
                ) : null}
              </div>

              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-3">
                <AirportInput
                  label="From"
                  value={{ iata: l.fromIata, city: l.fromCity, name: l.fromName }}
                  error={showErrors && !l.fromIata}
                  onSelect={(a) => pickAirport(l.id, "from", a)}
                />
                <AirportInput
                  label="To"
                  value={{ iata: l.toIata, city: l.toCity, name: l.toName }}
                  error={showErrors && !l.toIata}
                  onSelect={(a) => pickAirport(l.id, "to", a)}
                />
                <CompactField
                  id={`date-${l.id}`}
                  label={isReturn ? "Return date" : "Departure date"}
                  error={showErrors && !l.date}
                >
                  <input
                    id={`date-${l.id}`}
                    type="date"
                    min={minDate}
                    value={l.date ?? ""}
                    onChange={(e) => updateLeg(l.id, { date: e.target.value })}
                    className={COMPACT_INPUT_CLASS}
                  />
                </CompactField>
                <CompactField
                  id={`time-${l.id}`}
                  label={isReturn ? "Return time" : "Departure time"}
                  error={showErrors && !l.time}
                >
                  <input
                    id={`time-${l.id}`}
                    type="time"
                    value={l.time ?? ""}
                    onChange={(e) => updateLeg(l.id, { time: e.target.value })}
                    className={COMPACT_INPUT_CLASS}
                  />
                </CompactField>
              </div>
            </div>
          );
        })}

        {legs.length < MAX_LEGS ? (
          <button
            type="button"
            onClick={addLeg}
            className="h-10 w-full rounded-[3px] border border-dashed border-line-2 text-[14px] font-semibold text-bone transition-colors hover:border-steel max-md:h-11"
          >
            + Add another leg
          </button>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-steel">Common routes:</span>
          {COMMON_ROUTES.map((r) => {
            const f = findAirport(r.from);
            const t = findAirport(r.to);
            if (!f || !t) return null;
            return (
              <button
                key={`${r.from}-${r.to}`}
                type="button"
                onClick={() => applyPreset(r.from, r.to)}
                className="chip chip-sm max-md:!h-11"
              >
                {f.city} ({f.iata}) → {t.city} ({t.iata})
              </button>
            );
          })}
        </div>

        {/* Passengers — a 40px bordered stepper in the prototype's field
            style, with the size hint beside it. */}
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <div className="flex flex-[1_1_160px] flex-col gap-[5px]">
            <span id="pax-label" className="text-[13px] font-semibold text-bone">
              Passengers
            </span>
            <div
              role="group"
              aria-labelledby="pax-label"
              className="grid h-10 grid-cols-[44px_minmax(0,1fr)_44px] items-stretch overflow-hidden rounded-[3px] border border-line bg-surface max-md:h-11"
            >
              <button
                type="button"
                onClick={() => setPax(pax - 1)}
                disabled={pax <= 1}
                aria-label="Fewer passengers"
                className="border-r border-line text-[18px] text-bone transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:opacity-35"
              >
                −
              </button>
              <span className="flex items-center justify-center text-[15px] text-bone" aria-live="polite">
                {pax}
                <span className="sr-only"> passengers</span>
              </span>
              <button
                type="button"
                onClick={() => setPax(pax + 1)}
                disabled={pax >= 16}
                aria-label="More passengers"
                className="border-l border-line text-[18px] text-bone transition-colors hover:bg-ink disabled:cursor-not-allowed disabled:opacity-35"
              >
                +
              </button>
            </div>
          </div>
          <p className="flex-[999_1_240px] pb-2.5 text-[13px] text-steel">{paxHint(pax)}</p>
        </div>
      </div>

      <IndicativeRange className="mt-[18px]" />

      <StepFooter
        step={1}
        cancelHref="/"
        error={error}
        next={{ label: "Continue to aircraft", onClick: onContinue }}
      />
    </QuotePanel>
  );
}
