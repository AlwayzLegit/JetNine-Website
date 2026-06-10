"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ensureIdempotencyKey,
  isAircraftComplete,
  isContactComplete,
  isMissionComplete,
  useQuoteStore,
} from "@/lib/quote-store";
import { SavedIndicator } from "@/components/quote/saved-indicator";
import { StoreHydrationGate } from "@/components/quote/store-hydration";
import { computeIndicative, formatHours, CRUISE_KT } from "@/lib/quote-pricing";
import { getFleetEntry } from "@/lib/fleet";
import { submitQuote } from "../actions";
import { track } from "@/lib/analytics";

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

export default function ReviewStep() {
  return (
    <StoreHydrationGate>
      <ReviewStepInner />
    </StoreHydrationGate>
  );
}

function ReviewStepInner() {
  const router = useRouter();
  const s = useQuoteStore();
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [ref, setRef] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    // Skip the prerequisite guard once we're showing the confirmation —
    // we intentionally clear the draft on success, which would otherwise
    // immediately bounce the user back to /quote/mission.
    if (showSuccess) return;
    if (!isMissionComplete(s)) router.replace("/quote/mission");
    else if (!isAircraftComplete(s)) router.replace("/quote/aircraft");
    else if (!isContactComplete(s)) router.replace("/quote/contact");
  }, [s, router, showSuccess]);

  const fleet = getFleetEntry(s.category);
  const totalDistance = s.legs.reduce((sum, l) => sum + (l.distanceNm ?? 0), 0);
  const totalHours = totalDistance > 0 ? totalDistance / CRUISE_KT[s.category] + 0.4 * s.legs.length : 0;
  const indicative = computeIndicative({
    category: s.category,
    legs: s.legs,
    catering: s.catering,
    ground: s.ground,
  });

  const activeCabin = (Object.entries(s.cabin) as [keyof typeof s.cabin, boolean][])
    .filter(([, v]) => v)
    .map(([k]) => k);
  const inactiveCabin = (Object.entries(s.cabin) as [keyof typeof s.cabin, boolean][])
    .filter(([, v]) => !v)
    .map(([k]) => k);

  const methodList = (["email", "phone", "sms"] as const)
    .filter((k) => s.methods[k])
    .map((k) => (k === "sms" ? "SMS" : k[0].toUpperCase() + k.slice(1)))
    .join(" + ");

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
        setRef(result.ref);
        setShowSuccess(true);
        track("quote_submitted", {
          tripType: draft.tripType,
          legs: draft.legs.length,
          pax: draft.pax,
          category: draft.category,
          deduped: result.deduped ?? false,
        });
        // Wipe the persisted draft so back-nav or a new tab starts fresh.
        // The success overlay reads `ref` from local state, so clearing
        // the store doesn't blank the confirmation UI.
        s.reset();
      } else if (result.error === "RATE_LIMITED") {
        const mins = result.retryAfterMs
          ? Math.max(1, Math.ceil(result.retryAfterMs / 60_000))
          : 5;
        setSubmitError(`RATE_LIMITED · try again in ~${mins} min`);
      } else {
        setSubmitError(result.error);
      }
    } catch (e) {
      console.error(e);
      setSubmitError("NETWORK");
    } finally {
      setSubmitting(false);
    }
  }

  // Lock body scroll while success overlay is open
  useEffect(() => {
    if (showSuccess) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [showSuccess]);

  return (
    <div className="container-jn py-12 lg:py-16">
      <div className="mx-auto max-w-[1100px]">
        <header className="mb-12">
          <p className="caption mb-4">— Step 04 · Review</p>
          <h1 className="display-l max-w-[20ch]">Last look, then we send it.</h1>
          <p className="mt-5 max-w-[68ch] text-[17px] leading-[1.55] text-bone-2">
            Everything you&rsquo;ve given us. Edit any section if something needs changing — the
            rest of your work is preserved. When you submit, dispatch picks it up immediately and
            returns specific airframes &amp; pricing within 30 minutes.
          </p>
        </header>

        {/* Price banner */}
        <div className="mb-10 rounded-[4px] border border-clearance bg-[rgba(232,226,210,0.04)] p-8">
          <div className="grid grid-cols-1 items-end gap-8 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-clearance">
                — Indicative range
              </span>
              <div
                className="mt-3 font-serif text-[56px] font-light leading-none tracking-tight text-bone"
                style={{ letterSpacing: "-0.02em" }}
              >
                {indicative?.formatted ?? "$ — – $ —"}
              </div>
              <p className="mt-5 max-w-[68ch] text-[14px] leading-[1.65] text-bone-2">
                All-in pricing. Fuel, taxes, FET (7.5%), repositioning, crew, catering &amp; ground
                transport included. Final pricing locks once a specific airframe is selected.
              </p>
            </div>
            <ul className="flex flex-col gap-3 text-right">
              {[
                "Quote returned in < 30 min",
                "ARG/US PLATINUM operators only",
                "No commitment until accepted",
              ].map((t) => (
                <li
                  key={t}
                  className="font-mono text-[11px] uppercase tracking-[0.12em] text-bone-2"
                >
                  — {t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Block n="01" title="Mission" editHref="/quote/mission">
          <ul className="flex flex-col gap-4">
            {s.legs.map((l, i) => (
              <li
                key={l.id}
                className="grid grid-cols-1 items-center gap-4 rounded-[3px] border border-ink-3 bg-ink-2 p-5 md:grid-cols-[auto_1fr_auto]"
              >
                <span className="rounded-[2px] bg-ink-3 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-clearance">
                  {String(i + 1).padStart(2, "0")}{" "}
                  {s.tripType === "roundtrip"
                    ? i === 0
                      ? "Outbound"
                      : "Return"
                    : s.tripType === "multileg"
                      ? i === 0
                        ? "Outbound"
                        : `Sector ${String(i + 1).padStart(2, "0")}`
                      : "Outbound"}
                </span>
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
                  <div>
                    <div className="font-serif text-[22px] font-light leading-tight text-bone">
                      {l.fromIata}
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-bone-2">
                      {l.fromCity}
                    </div>
                  </div>
                  <span className="text-clearance">— ✈ —</span>
                  <div className="text-right">
                    <div className="font-serif text-[22px] font-light leading-tight text-bone">
                      {l.toIata}
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-bone-2">
                      {l.toCity}
                    </div>
                  </div>
                </div>
                <div className="text-right font-mono text-[11px] uppercase tracking-[0.06em] text-bone-2">
                  <div>{l.date}</div>
                  <div>{l.time} depart</div>
                  <div className="text-clearance">
                    {l.distanceNm?.toLocaleString()} NM
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-6 grid grid-cols-1 gap-6 border-t border-ink-3 pt-6 md:grid-cols-3">
            {[
              ["Passengers", String(s.pax)],
              ["Total distance", `${totalDistance.toLocaleString()} NM`],
              ["Total flight time", formatHours(totalHours)],
            ].map(([lbl, val]) => (
              <div key={lbl}>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                  — {lbl}
                </span>
                <div
                  className="mt-2 font-serif text-[28px] font-light leading-none tracking-tight text-bone"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  {val}
                </div>
              </div>
            ))}
          </div>
        </Block>

        <Block n="02" title="Aircraft & preferences" editHref="/quote/aircraft">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[
              {
                k: "Category",
                v: `${fleet?.name ?? s.category} jet`,
                sub: `~${fleet?.speedKt} KT · ${fleet?.rangeNm.toLocaleString()} NM range · ${fleet?.pax} PAX`,
              },
              { k: "Catering", v: s.catering[0].toUpperCase() + s.catering.slice(1), sub: CATERING_DESC[s.catering] },
              { k: "Ground transport", v: GROUND_DESC[s.ground].label, sub: GROUND_DESC[s.ground].sub },
              {
                k: "Extras",
                v:
                  s.kids + s.pets + s.bags === 0
                    ? "None"
                    : [
                        s.kids ? `${s.kids} kids` : null,
                        s.pets ? `${s.pets} pets` : null,
                        s.bags ? `${s.bags} extra bags` : null,
                      ]
                        .filter(Boolean)
                        .join(" · "),
                sub: "Crew briefed in advance",
              },
            ].map((c) => (
              <div key={c.k} className="rounded-[3px] border border-ink-3 bg-ink-2 p-5">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                  — {c.k}
                </span>
                <div className="mt-2 font-serif text-[20px] font-normal leading-tight text-bone">
                  {c.v}
                </div>
                <div className="mt-1 font-mono text-[10px] tracking-[0.04em] text-bone-2">
                  {c.sub}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
              — Cabin preferences
            </span>
            <div className="mt-3 flex flex-wrap gap-2">
              {activeCabin.map((k) => (
                <span
                  key={k}
                  className="rounded-full border border-clearance bg-[rgba(232,226,210,0.08)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-clearance"
                >
                  ✓ {CABIN_LABELS[k]}
                </span>
              ))}
              {inactiveCabin.map((k) => (
                <span
                  key={k}
                  className="rounded-full border border-ink-3 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-steel"
                >
                  {CABIN_LABELS[k]} — not requested
                </span>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
              — Notes for dispatch
            </span>
            <div className="mt-3 rounded-[3px] border border-ink-3 bg-ink-2 p-5">
              {s.notes ? (
                <p className="whitespace-pre-line italic text-[14px] leading-[1.65] text-bone">
                  {s.notes}
                </p>
              ) : (
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-steel">
                  — No notes added.
                </p>
              )}
            </div>
          </div>
        </Block>

        <Block n="03" title="Contact" editHref="/quote/contact">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[
              ["Name", `${s.firstName} ${s.lastName}`],
              ["Company", s.company || "—"],
              ["Email", s.email],
              ["Phone", `${s.phoneCountry} ${s.phone}`],
              ["Reach me by", methodList],
              [
                "Best time",
                s.bestTime === "any"
                  ? "Any time"
                  : s.bestTime[0].toUpperCase() + s.bestTime.slice(1),
              ],
            ].map(([k, v]) => (
              <div key={k} className="border-b border-ink-3 pb-4">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                  — {k}
                </span>
                <div
                  className={[
                    "mt-2",
                    k === "Email" || k === "Phone"
                      ? "font-mono text-[14px] tracking-[0.04em] text-bone"
                      : "font-serif text-[20px] font-normal leading-tight text-bone",
                  ].join(" ")}
                >
                  {v}
                </div>
              </div>
            ))}
          </div>
        </Block>

        {/* What happens next */}
        <section className="mb-12 rounded-[4px] border border-ink-3 bg-ink-2 p-10">
          <div className="mb-8 flex items-baseline gap-4">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-clearance">
              04
            </span>
            <h2 className="font-serif text-[24px] font-normal leading-tight tracking-tight text-bone">
              What happens next
            </h2>
          </div>
          <p className="mb-8 max-w-[64ch] text-[15px] leading-[1.65] text-bone-2">
            Four steps. Most clients fly within a week.
          </p>
          <ol className="relative ml-6 flex flex-col gap-7 border-l border-ink-3 pl-8">
            {[
              { t: "Dispatch picks up your request", b: "A senior dispatcher (not a chatbot, not a queue) reviews your mission and starts sourcing aircraft.", w: "Within 5 min" },
              { t: "Quote returned with 3–5 specific airframes", b: "Each option has a tail number, operator, year, photos, all-in price, and availability window.", w: "< 30 min" },
              { t: "You pick & we hold the airframe", b: "No commitment until you accept. We can hold an option for up to 4 hours while you decide.", w: "Your pace" },
              { t: "Confirmation, contract, take-off", b: "Trip sheet, ground transport details, & FBO instructions delivered. Most clients fly within a week of first quote.", w: "Same week" },
            ].map((s, i) => (
              <li key={s.t} className="relative">
                <span
                  aria-hidden
                  className="absolute -left-[42px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-clearance font-mono text-[10px] text-ink"
                >
                  {String(i + 1)}
                </span>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                  <div>
                    <h3 className="font-serif text-[17px] text-bone">{s.t}</h3>
                    <p className="mt-1 max-w-[56ch] text-[13px] leading-[1.6] text-bone-2">
                      {s.b}
                    </p>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-clearance md:text-right">
                    {s.w}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Submit */}
        <section className="rounded-[4px] border border-clearance bg-ink-2 p-10">
          <h3 className="font-serif text-[28px] font-normal leading-tight tracking-tight text-bone">
            Send it to dispatch.
          </h3>
          <p className="mt-3 max-w-[72ch] text-[15px] leading-[1.65] text-bone-2">
            By submitting, you agree to the{" "}
            <Link href="/legal#part-295" className="text-clearance underline underline-offset-2">
              Part 295 broker disclosure
            </Link>{" "}
            &amp;{" "}
            <Link href="/legal#agreement" className="text-clearance underline underline-offset-2">
              terms of service
            </Link>
            . Quote requests are not commitments — you&rsquo;ll review specific airframes and
            pricing before anything is booked.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-6">
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting}
              className="btn btn-primary btn-lg disabled:cursor-wait disabled:opacity-60"
            >
              {submitting ? "Sending…" : "Submit quote request"} <span className="arrow">→</span>
            </button>
            {submitError ? (
              <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--error)]">
                — {submitError} · try again or call dispatch
              </span>
            ) : null}
          </div>
        </section>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-ink-3 pt-8">
          <SavedIndicator />
          <Link href="/quote/contact" className="btn btn-ghost">
            ← Back to contact
          </Link>
        </div>
      </div>

      {/* Success overlay */}
      {showSuccess && ref ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(7,8,10,0.96)] backdrop-blur-md">
          <div className="mx-6 w-full max-w-[640px] rounded-[4px] border border-clearance bg-ink-2 p-12 text-center">
            <div
              aria-hidden
              className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full border-2 border-clearance text-[28px] text-clearance"
            >
              ✓
            </div>
            <p className="caption mb-4">— Submitted</p>
            <h2 className="font-serif text-[40px] font-light leading-tight tracking-tight text-bone">
              Off to dispatch.
            </h2>
            <p className="mx-auto mt-5 max-w-[52ch] text-[15px] leading-[1.65] text-bone-2">
              A senior dispatcher will reach out within 30 minutes with three to five specific
              airframes for your mission. Confirmation is in your inbox.
            </p>
            <div className="mx-auto mt-8 inline-block rounded-[3px] border border-ink-3 bg-ink px-6 py-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                — Quote ref
              </span>
              <div className="mt-1 font-mono text-[18px] tracking-[0.06em] text-clearance">
                {ref}
              </div>
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link href="/" className="btn btn-secondary">
                Back to home
              </Link>
              <Link href="/aircraft" className="btn btn-primary">
                Explore aircraft <span className="arrow">→</span>
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Block({
  n,
  title,
  editHref,
  children,
}: {
  n: string;
  title: string;
  editHref: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <header className="mb-6 flex items-baseline justify-between border-b border-ink-3 pb-3">
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-clearance">
            {n}
          </span>
          <h2 className="font-serif text-[24px] font-normal leading-tight tracking-tight text-bone">
            {title}
          </h2>
        </div>
        <Link
          href={editHref}
          className="font-mono text-[11px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-clearance"
        >
          Edit →
        </Link>
      </header>
      {children}
    </section>
  );
}
