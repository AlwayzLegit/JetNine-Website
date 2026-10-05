"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ensureIdempotencyKey,
  isAircraftComplete,
  isContactComplete,
  isMissionComplete,
  useQuoteStore,
  type TripType,
} from "@/lib/quote-store";
import { computeIndicative, formatHours, CRUISE_KT } from "@/lib/quote-pricing";
import { getFleetEntry } from "@/lib/fleet";
import { track } from "@/lib/analytics";
import { submitQuote } from "@/app/quote/actions";
import { formatLegDate, legEndpoint } from "@/components/quote/trip-summary";
import { PanelHeader, QuotePanel } from "@/components/quote/quote-panel";
import { StepFooter } from "@/components/quote/step-footer";
import { ReviewSection } from "@/components/quote/review-section";
import { ReviewSubmitCard, type SubmitError } from "@/components/quote/review-submit-card";
import { bestTimeLabel, methodSummary } from "@/components/quote/contact-options";
import { useReplyPromiseMinutes } from "@/components/quote/reply-promise";
import { replyPromiseWords } from "@/lib/desk-status";

const CABIN_LABELS: Record<string, string> = {
  wifi: "Wi-Fi",
  attendant: "Flight attendant",
  lavatory: "Enclosed lavatory",
  standup: "Stand-up cabin",
  lieflat: "Lie-flat seating",
  pet: "Pet-friendly",
};

const CATERING_DESC: Record<string, string> = {
  standard: "Cold platters · snacks · bar",
  plus: "Hot meals · premium bar",
  premium: "Chef-prepared menu",
  custom: "Custom — quoted separately",
};

const GROUND_DESC: Record<string, { label: string; sub: string }> = {
  none: { label: "None — self-arrange", sub: "No ground transport requested." },
  sedan: { label: "Black sedan", sub: "Both legs · ~$180/leg" },
  suv: { label: "SUV / Sprinter", sub: "Both legs · ~$280/leg" },
};

// The reply time follows the desk setting (Settings › Notifications),
// handed down from the quote layout.
function reassurance(minutes: number): string[] {
  return [
    `Quote back ${replyPromiseWords(minutes)}`,
    "ARG/US Platinum operators only",
    "No commitment until accepted",
  ];
}

function nextSteps(minutes: number) {
  const w = minutes === 60 ? "Within an hour" : `Within ${minutes} min`;
  return NEXT_STEPS.map((n, i) => (i === 1 ? { ...n, w } : n));
}

const NEXT_STEPS = [
  {
    t: "Dispatch picks up your request",
    b: "A senior dispatcher (not a chatbot, not a queue) reviews your mission and starts sourcing aircraft.",
    w: "Within 5 min",
  },
  {
    t: "Quote returned with 3–5 specific aircraft",
    b: "Each option has a tail number, operator, year, photos, all-in price, and availability window.",
    w: "Within 30 min",
  },
  {
    t: "You pick & we hold the aircraft",
    b: "No commitment until you accept. We can hold an option for up to 4 hours while you decide.",
    w: "Your pace",
  },
  {
    t: "Confirmation, contract, take-off",
    b: "Trip sheet, ground transport details, & private terminal instructions delivered. Most clients fly within a week of first quote.",
    w: "Same week",
  },
];

function legTitle(tripType: TripType, i: number): string {
  if (tripType === "roundtrip") return i === 0 ? "Outbound" : "Return";
  if (tripType === "oneway") return "Outbound";
  return i === 0 ? "Outbound" : `Leg ${i + 1}`;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Step 4 of the quote flow — "Last look, then we send it." */
export function ReviewStep() {
  const router = useRouter();
  const s = useQuoteStore();
  const replyMinutes = useReplyPromiseMinutes();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  // Set the moment the server says ok. We reset the draft right after,
  // which would otherwise trip the prerequisite guard and bounce the
  // user to /quote/mission while the push to the status page is in flight.
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current) return;
    if (!isMissionComplete(s)) router.replace("/quote/mission");
    else if (!isAircraftComplete(s)) router.replace("/quote/aircraft");
    else if (!isContactComplete(s)) router.replace("/quote/contact");
  }, [s, router]);

  const fleet = getFleetEntry(s.category);
  const totalDistance = s.legs.reduce((sum, l) => sum + (l.distanceNm ?? 0), 0);
  const totalHours =
    totalDistance > 0 ? totalDistance / CRUISE_KT[s.category] + 0.4 * s.legs.length : 0;
  const indicative = computeIndicative({
    category: s.category,
    legs: s.legs,
    catering: s.catering,
    ground: s.ground,
  });

  const cabinEntries = Object.entries(s.cabin) as [keyof typeof s.cabin, boolean][];
  const extras = [
    s.kids ? plural(s.kids, "kid", "kids") : null,
    s.pets ? plural(s.pets, "pet", "pets") : null,
    s.bags ? plural(s.bags, "extra bag", "extra bags") : null,
  ].filter(Boolean);

  const categoryName = fleet
    ? fleet.slug === "turboprop"
      ? fleet.name
      : `${fleet.name} jet`
    : s.category;
  const categorySub = fleet
    ? `~${fleet.speedKt} kt · ${fleet.rangeNm.toLocaleString()} nm range · ${fleet.pax} passengers`
    : "";

  async function onSubmit() {
    setSubmitting(true);
    setSubmitError(null);

    // Idempotency token — generated once and reused across retries so a
    // network drop after the server inserted but before responding doesn't
    // create a duplicate quote row.
    ensureIdempotencyKey();

    // Strip the action functions before sending to the Server Action — they
    // aren't serializable. submitQuote only needs the plain data shape.
    const {
      setTripType, setPax, updateLeg, addLeg, removeLeg, swapLeg,
      setCategory, toggleCabin, setCatering, setGround, setExtra, setNotes,
      setAccount, setContactField, toggleMethod, setBestTime, setSource,
      toggleConsent, submit, reset,
      ...draft
    } = s;
    void setTripType; void setPax; void updateLeg; void addLeg; void removeLeg;
    void swapLeg; void setCategory; void toggleCabin; void setCatering;
    void setGround; void setExtra; void setNotes; void setAccount;
    void setContactField; void toggleMethod; void setBestTime; void setSource;
    void toggleConsent; void submit; void reset;

    try {
      const result = await submitQuote(draft);
      if (result.ok) {
        submitted.current = true;
        track("quote_submitted", {
          tripType: draft.tripType,
          legs: draft.legs.length,
          pax: draft.pax,
          category: draft.category,
          deduped: result.deduped ?? false,
        });
        // Wipe the persisted draft so back-nav or a new tab starts fresh,
        // then hand off to the "Your request" page. The button stays in
        // its sending state until the navigation lands.
        s.reset();
        router.push(result.statusUrl);
        return;
      }
      setSubmitError({ code: result.error, retryAfterMs: result.retryAfterMs });
    } catch (e) {
      console.error(e);
      setSubmitError({ code: "NETWORK" });
    }
    setSubmitting(false);
  }

  return (
    <QuotePanel>
      <PanelHeader step={4} title="Last look, then we send it.">
        Everything you&rsquo;ve given us. Edit any section if something needs changing — the rest
        of your work is preserved. When you submit, dispatch picks it up immediately and returns
        specific aircraft &amp; pricing {replyPromiseWords(replyMinutes)}.
      </PanelHeader>

      {/* Indicative range — the prototype's sand box, at review size. */}
      <section className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] items-end gap-x-6 gap-y-3 rounded-[3px] bg-surface-2 px-5 py-4">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-gold">
            Indicative range
          </div>
          <div className="mt-1 font-serif text-[clamp(28px,4.4vw,36px)] leading-[1.05] text-bone">
            {indicative?.formatted ?? "$ — – $ —"}
          </div>
          <p className="mt-2 text-[13px] leading-[1.5] text-steel">
            All-in pricing. Fuel, taxes, FET (7.5%), repositioning, crew, catering &amp; ground
            transport included. Final pricing locks once a specific aircraft is selected.
          </p>
        </div>
        <ul className="flex flex-col gap-1 text-[13px] text-bone sm:text-right">
          {reassurance(replyMinutes).map((t) => (
            <li key={t}>
              <span aria-hidden className="mr-1.5 text-gold">
                ✓
              </span>
              {t}
            </li>
          ))}
        </ul>
      </section>

      {/* 1 · Mission */}
      <ReviewSection title="1 · Mission" editHref="/quote/mission" editLabel="Edit mission">
        <ul className="mt-3 flex flex-col gap-2">
          {s.legs.map((l, i) => (
            <li
              key={l.id}
              className="grid grid-cols-1 gap-1 rounded-[3px] border border-line px-4 py-3 sm:grid-cols-[96px_minmax(0,1fr)_auto] sm:items-center sm:gap-4"
            >
              <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-gold">
                {legTitle(s.tripType, i)}
              </span>
              <span className="text-[15px] text-bone">
                {legEndpoint(l.fromCity, l.fromIata)} <span className="text-steel">→</span>{" "}
                {legEndpoint(l.toCity, l.toIata)}
              </span>
              <span className="text-[13px] text-steel sm:text-right">
                {formatLegDate(l.date) ?? "—"} · {l.time ?? "—"} depart
                <br className="max-sm:hidden" />
                <span className="sm:hidden"> · </span>
                {l.distanceNm ? `${l.distanceNm.toLocaleString()} nm` : "—"}
              </span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 grid grid-cols-3 gap-3">
          {[
            ["Passengers", String(s.pax)],
            ["Total distance", `${totalDistance.toLocaleString()} nm`],
            ["Total flight time", totalHours > 0 ? formatHours(totalHours) : "—"],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-[12px] text-steel">{k}</dt>
              <dd className="mt-0.5 font-serif text-[clamp(20px,3vw,24px)] leading-[1.15] text-bone">{v}</dd>
            </div>
          ))}
        </dl>
      </ReviewSection>

      {/* 2 · Aircraft & preferences */}
      <ReviewSection
        title="2 · Aircraft & preferences"
        editHref="/quote/aircraft"
        editLabel="Edit aircraft and preferences"
      >
        <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-2">
          {[
            { k: "Category", v: categoryName, sub: categorySub },
            {
              k: "Catering",
              v: s.catering[0].toUpperCase() + s.catering.slice(1),
              sub: CATERING_DESC[s.catering],
            },
            { k: "Ground transport", v: GROUND_DESC[s.ground].label, sub: GROUND_DESC[s.ground].sub },
            {
              k: "Extras",
              v: extras.length ? extras.join(" · ") : "None",
              sub: "Crew briefed in advance",
            },
          ].map((c) => (
            <div key={c.k} className="rounded-[3px] border border-line px-4 py-3">
              <div className="text-[12px] text-steel">{c.k}</div>
              <div className="mt-0.5 text-[15px] font-semibold leading-[1.35] text-bone">{c.v}</div>
              <div className="text-[13px] text-steel">{c.sub}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 text-[12px] text-steel">Cabin preferences</div>
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {cabinEntries.map(([k, on]) => (
            <li
              key={k}
              className={[
                "inline-flex h-7 items-center rounded-pill border px-2.5 text-[13px]",
                on ? "border-clearance text-bone" : "border-line text-steel",
              ].join(" ")}
            >
              {on ? `✓ ${CABIN_LABELS[k]}` : `${CABIN_LABELS[k]} — not requested`}
            </li>
          ))}
        </ul>

        <div className="mt-3 text-[12px] text-steel">Notes for dispatch</div>
        <div className="mt-1.5 rounded-[3px] border border-line px-4 py-3 text-[14px] text-steel">
          {s.notes ? <p className="whitespace-pre-line text-bone">{s.notes}</p> : "No notes added."}
        </div>
      </ReviewSection>

      {/* 3 · Contact */}
      <ReviewSection title="3 · Contact" editHref="/quote/contact" editLabel="Edit contact">
        <dl className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-x-6 gap-y-3 text-[15px] text-bone">
          {[
            ["Name", `${s.firstName} ${s.lastName}`.trim() || "—"],
            ["Company", s.company || "—"],
            ["Email", s.email || "—"],
            ["Phone", s.phone ? `${s.phoneCountry} ${s.phone}` : "—"],
            ["Reach me by", methodSummary(s.methods)],
            ["Best time", bestTimeLabel(s.bestTime)],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-[12px] text-steel">{k}</dt>
              <dd className="mt-0.5 break-words">{v}</dd>
            </div>
          ))}
        </dl>
      </ReviewSection>

      {/* What happens next — the prototype's "Request received" timeline. */}
      <section className="mt-7" aria-labelledby="review-next">
        <h2 id="review-next" className="title-card-sm">
          What happens next
        </h2>
        <p className="mt-1 text-[14px] text-steel">Four steps. Most clients fly within a week.</p>
        <ol className="mt-4 flex flex-col">
          {nextSteps(replyMinutes).map((n, i, all) => (
            <li key={n.t} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3.5">
              <div className="flex flex-col items-center">
                <span
                  aria-hidden
                  className={[
                    "flex h-6 w-6 flex-none items-center justify-center rounded-full border-[1.5px] text-[12px] font-semibold",
                    i === 0 ? "border-gold bg-surface text-gold" : "border-line bg-surface text-steel",
                  ].join(" ")}
                >
                  {i + 1}
                </span>
                {i < all.length - 1 ? <span aria-hidden className="w-px flex-1 bg-line" /> : null}
              </div>
              <div className="pb-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-[15px] font-semibold text-bone">{n.t}</span>
                  <span className="whitespace-nowrap text-[13px] text-gold">{n.w}</span>
                </div>
                <div className="mt-0.5 max-w-[60ch] text-[14px] text-steel">{n.b}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <ReviewSubmitCard submitting={submitting} error={submitError} onSubmit={onSubmit} />

      <StepFooter step={4} backHref="/quote/contact" backLabel="← Back to contact" />
    </QuotePanel>
  );
}
