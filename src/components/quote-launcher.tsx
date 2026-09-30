"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useQuoteStore } from "@/lib/quote-store";
import type { AircraftCategorySlug } from "@/lib/fleet";
import { track } from "@/lib/analytics";

/**
 * Compact step-1 of the quote wizard, embeddable on any content page —
 * the audit's highest-leverage conversion pattern (evoJets renders its
 * calculator on every template, context-prefilled; Paramount and VistaJet
 * dead-end visitors at a callback form). Seeds the same sessionStorage
 * store the wizard rehydrates from, then hands off to /quote/mission.
 *
 * Context props let each template prefill what it's about: aircraft
 * category pages pass `category`, route/city content passes from/to.
 */
type Props = {
  heading?: string;
  body?: string;
  /** Prefill origin/destination (IATA or ICAO code). */
  defaultFrom?: string;
  defaultTo?: string;
  /** Seed the wizard's aircraft category (step 2) from page context. */
  category?: AircraftCategorySlug;
  /** Where the launcher is embedded — for analytics. */
  context?: string;
};

function seedStore(opts: {
  from: string;
  to: string;
  date: string;
  pax: number;
  category?: AircraftCategorySlug;
}) {
  const store = useQuoteStore.getState();
  store.setTripType("oneway");
  store.setPax(opts.pax);
  if (opts.category) store.setCategory(opts.category);
  const first = useQuoteStore.getState().legs[0];
  if (first) {
    store.updateLeg(first.id, {
      fromIata: opts.from || undefined,
      toIata: opts.to || undefined,
      date: opts.date || undefined,
    });
  }
}

export function QuoteLauncher({
  heading = "Price this mission now.",
  body = "Route, date, and passenger count — live indicative pricing in four short steps. No callback required.",
  defaultFrom,
  defaultTo,
  category,
  context = "content-page",
}: Props) {
  const router = useRouter();
  const [errors, setErrors] = useState<Partial<Record<"from" | "to" | "depart", true>>>({});

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const from = ((data.get("from") as string) || "").trim().toUpperCase();
    const to = ((data.get("to") as string) || "").trim().toUpperCase();
    const depart = ((data.get("depart") as string) || "").trim();

    const missing: typeof errors = {};
    if (!from) missing.from = true;
    if (!to) missing.to = true;
    if (!depart) missing.depart = true;
    if (Object.keys(missing).length) {
      setErrors(missing);
      return;
    }
    setErrors({});

    seedStore({
      from,
      to,
      date: depart,
      pax: Number(data.get("pax")) || 2,
      category,
    });
    track("quote_launcher_submitted", { context });
    router.push("/quote/mission");
  }

  return (
    <section aria-label="Start a quote" className="section-jn">
      <div className="container-jn">
        <div className="card card-pad grid items-center gap-8 lg:grid-cols-[1fr_1.4fr] max-md:p-5">
          <div>
            <p className="eyebrow">Start a quote</p>
            <h2 className="title-section max-w-[18ch] !text-[clamp(30px,3.2vw,38px)]">{heading}</h2>
            <p className="mt-4 max-w-[46ch] text-[16px] leading-[1.55] text-bone-2">{body}</p>
          </div>
          <form
            noValidate
            onSubmit={onSubmit}
            className="grid grid-cols-1 gap-[10px] sm:grid-cols-2 lg:[grid-template-columns:1.1fr_1.1fr_1fr_0.7fr]"
          >
            <div className={`field-jn ${errors.from ? "error" : ""}`}>
              <label htmlFor="ql-from">From</label>
              <input
                id="ql-from"
                name="from"
                type="text"
                placeholder="Airport code, e.g. VNY"
                autoComplete="off"
                defaultValue={defaultFrom}
              />
            </div>
            <div className={`field-jn ${errors.to ? "error" : ""}`}>
              <label htmlFor="ql-to">To</label>
              <input
                id="ql-to"
                name="to"
                type="text"
                placeholder="Airport code, e.g. ASE"
                autoComplete="off"
                defaultValue={defaultTo}
              />
            </div>
            <div className={`field-jn ${errors.depart ? "error" : ""}`}>
              <label htmlFor="ql-depart">Depart</label>
              <input id="ql-depart" name="depart" type="date" />
            </div>
            <div className="field-jn">
              <label htmlFor="ql-pax">Passengers</label>
              <input id="ql-pax" name="pax" type="number" min={1} max={16} placeholder="2" />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3 pt-1 sm:col-span-2 lg:col-span-4">
              {Object.keys(errors).length ? (
                <span role="alert" className="mr-auto text-[14px] text-danger">
                  Add the route and a date to price it.
                </span>
              ) : null}
              <button type="submit" className="btn btn-primary btn-lg max-md:w-full">
                Price it <span className="arrow">→</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

/**
 * Inline "get an exact quote for this route" link — used by sample-route
 * cost cards. Seeds the wizard with the card's route + category and
 * deep-links in, mirroring evoJets' prefilled calculator URLs.
 */
export function RouteQuoteLink({
  from,
  to,
  category,
  pax = 4,
  label = "Get exact quote",
  className = "btn btn-secondary btn-sm",
}: {
  from: string;
  to: string;
  category: AircraftCategorySlug;
  pax?: number;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        seedStore({ from, to, date: "", pax, category });
        track("quote_launcher_submitted", { context: `route-card:${from}-${to}` });
        router.push("/quote/mission");
      }}
    >
      {label} <span className="arrow">→</span>
    </button>
  );
}
