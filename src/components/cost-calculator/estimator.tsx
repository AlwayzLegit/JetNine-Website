"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { AIRPORTS, distanceNm, findAirport, searchAirports, type Airport } from "@/lib/airports";
import { computeIndicative, formatHours, type Indicative } from "@/lib/quote-pricing";
import type { AircraftCategorySlug } from "@/lib/fleet";
import { useQuoteStore, type TripType } from "@/lib/quote-store";
import { seedQuote } from "@/lib/start-quote";
import { track } from "@/lib/analytics";
import { LightWindow } from "@/components/light/window";
import { Icon, type IconName } from "./icons";
import { ExtrasWindow, TaxesWindow } from "./windows";

export type CalcCategory = {
  slug: AircraftCategorySlug;
  name: string;
  pax: number;
  rangeNm: number;
  href: string;
  imageUrl?: string;
};

const PAX = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16];
const TRIPS: { key: TripType; label: string }[] = [
  { key: "oneway", label: "One way" },
  { key: "roundtrip", label: "Round trip" },
  { key: "multileg", label: "Multi-city" },
];
const GOLD_BTN = "btn border-gold bg-gold text-white hover:border-gold hover:bg-gold hover:opacity-90";

const label = (a: Airport) => `${a.name} (${a.iata})`;

/** "Van Nuys (VNY)", "VNY", "KVNY" or "Aspen" → an airport in the catalog. */
function resolve(text: string): Airport | undefined {
  const m = /\(([A-Z0-9_]{3,6})\)/.exec(text);
  if (m) {
    const hit = findAirport(m[1]);
    if (hit) return hit;
  }
  return findAirport(text) ?? searchAirports(text, 1)[0];
}

type Estimate = {
  from: Airport;
  to: Airport;
  trip: TripType;
  pax: number;
  cat: AircraftCategorySlug;
  ind: Indicative;
};

/** Same indicative engine the quote wizard uses (src/lib/quote-pricing.ts). */
function estimate(from: Airport, to: Airport, trip: TripType, pax: number, cat: AircraftCategorySlug): Estimate | null {
  const nm = distanceNm(from, to);
  const legs = [{ id: "out", fromIata: from.iata, toIata: to.iata, distanceNm: nm }];
  if (trip === "roundtrip") legs.push({ id: "back", fromIata: to.iata, toIata: from.iata, distanceNm: nm });
  const ind = computeIndicative({ category: cat, legs });
  return ind ? { from, to, trip, pax, cat, ind } : null;
}

type Prefs = { suitcases: number; carryons: number; oversized: string[]; pets: boolean; wifi: boolean; mobility: boolean; sleep: boolean; notes: string };
const DEFAULT_PREFS: Prefs = { suitcases: 2, carryons: 4, oversized: [], pets: false, wifi: true, mobility: false, sleep: false, notes: "" };

function prefsSummary(p: Prefs) {
  const items = [`${p.suitcases} suitcases`, `${p.carryons} carry-ons`, ...p.oversized.map((o) => o.toLowerCase())];
  if (p.pets) items.push("pets");
  return items.join(", ");
}

function prefsNotes(p: Prefs) {
  const lines = [`Bags: ${p.suitcases} suitcases, ${p.carryons} carry-ons.`];
  if (p.oversized.length) lines.push(`Oversized: ${p.oversized.join(", ")}.`);
  const cabin = [p.wifi && "Wi-Fi", p.mobility && "mobility assistance", p.sleep && "sleeping arrangement"].filter(Boolean);
  if (cabin.length) lines.push(`Cabin priorities: ${cabin.join(", ")}.`);
  if (p.notes.trim()) lines.push(p.notes.trim());
  return lines.join(" ");
}

type Win = null | "compare" | "bags" | "assumptions" | "taxes" | "extras";

export function Estimator({ categories }: { categories: CalcCategory[] }) {
  const router = useRouter();
  const [trip, setTrip] = useState<TripType>("oneway");
  const [from, setFrom] = useState("Van Nuys (VNY)");
  const [to, setTo] = useState("Teterboro (TEB)");
  const [date, setDate] = useState("");
  const [pax, setPax] = useState(6);
  const [cat, setCat] = useState<AircraftCategorySlug>("supermid");
  const [est, setEst] = useState<Estimate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [win, setWin] = useState<Win>(null);

  // The published example shown before the first calculation — priced by
  // the same engine, so it can never disagree with a real estimate.
  const sample = useMemo(() => {
    const a = findAirport("VNY");
    const b = findAirport("TEB");
    return a && b ? estimate(a, b, "oneway", 6, "supermid") : null;
  }, []);

  const shown = est ?? sample;
  const catOf = (slug: AircraftCategorySlug) => categories.find((c) => c.slug === slug);
  const shownCat = shown ? catOf(shown.cat) : undefined;
  const fit = useMemo(() => {
    if (!shown || !shownCat) return null;
    if (shownCat.pax < shown.pax) return `${shownCat.name} cabins seat up to ${shownCat.pax}. Choose a larger category for ${shown.pax} passengers.`;
    if (shownCat.rangeNm < distanceNm(shown.from, shown.to)) return `This leg is beyond typical ${shownCat.name.toLowerCase()} range — expect a fuel stop, or choose a larger category.`;
    return null;
  }, [shown, shownCat]);

  const reset = () => setEst(null);

  function calculate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const a = resolve(from);
    const b = resolve(to);
    if (!a || !b) {
      setError(`We couldn't match ${!a ? "the departure" : "the arrival"} airport. Try a city or three-letter code, e.g. VNY.`);
      return;
    }
    if (a.iata === b.iata) {
      setError("Departure and arrival are the same airport.");
      return;
    }
    setError(null);
    setFrom(label(a));
    setTo(label(b));
    const next = estimate(a, b, trip, pax, cat);
    setEst(next);
    track("cost_calculator_estimated", { from: a.iata, to: b.iata, trip, pax, category: cat });
  }

  /** Seed the quote wizard with the calculator's inputs and open it. */
  function requestQuote() {
    const a = resolve(from);
    const b = resolve(to);
    seedQuote({ trip, pax, from: a?.iata ?? from, to: b?.iata ?? to, depart: date || undefined });
    const store = useQuoteStore.getState();
    store.setCategory(cat);
    if (prefs) {
      store.setExtra("bags", prefs.suitcases + prefs.carryons);
      store.setExtra("pets", prefs.pets ? 1 : 0);
      store.setNotes(prefsNotes(prefs));
    }
    track("quote_launcher_submitted", { context: "cost-calculator" });
    router.push("/quote/mission");
  }

  const tripLower = (shown ? TRIPS.find((t) => t.key === shown.trip)?.label : "One way")?.toLowerCase();
  const range = shown?.ind.formatted ?? "—";
  const hours = shown ? formatHours(shown.ind.hours) : "";
  const panelNote = est
    ? `Based on about ${hours} of flight time${est.trip === "roundtrip" ? " across both legs" : ""} at the ${shownCat?.name.toLowerCase()} category rate.${est.trip === "multileg" ? " First leg only — add further legs in your quote." : ""} Your date and aircraft have not been priced.`
    : "Illustrative JetNine route example. Your date and aircraft have not been priced.";

  const quoteLink = (text: string, className = "text-link border-0 bg-transparent p-0 text-[13px] font-bold") => (
    <button type="button" onClick={requestQuote} className={`cursor-pointer ${className}`}>
      {text}
    </button>
  );

  return (
    <div id="estimate" className="container-jn scroll-mt-[84px] pt-[22px]">
      <datalist id="calc-airports">
        {AIRPORTS.filter((a) => /^[A-Z]{3}$/.test(a.iata)).map((a) => (
          <option key={a.iata} value={label(a)}>
            {a.city}
          </option>
        ))}
      </datalist>
      <div className="flex flex-wrap border border-line">
        {/* ── Form ── */}
        <form onSubmit={calculate} className="min-w-0 bg-white px-6 pb-[18px] pt-[22px] [flex:999_1_420px] max-sm:px-4">
          <h2 className="font-serif text-[28px] leading-[1.1]">Estimate your trip</h2>
          <div role="radiogroup" aria-label="Trip type" className="mt-[14px] grid auto-cols-[minmax(0,1fr)] grid-flow-col overflow-hidden rounded-[3px] border border-line">
            {TRIPS.map((t, i) => (
              <button
                key={t.key}
                type="button"
                role="radio"
                aria-checked={trip === t.key}
                onClick={() => {
                  setTrip(t.key);
                  reset();
                }}
                className={`h-9 cursor-pointer border-0 text-[13px] ${i ? "border-l border-line" : ""} ${trip === t.key ? "bg-clearance font-bold text-white" : "bg-white text-bone"}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-[14px] grid gap-x-[14px] gap-y-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
            <Field label="From" htmlFor="calc-from">
              <span className="flex h-10 items-center rounded-[3px] border border-line bg-white px-[10px] focus-within:border-bone">
                <input
                  id="calc-from"
                  list="calc-airports"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    reset();
                  }}
                  placeholder="City or airport"
                  autoComplete="off"
                  className="min-w-0 flex-1 border-0 bg-transparent text-[14px] text-bone outline-none"
                />
                <Icon name="search" size={16} stroke="var(--steel)" />
              </span>
            </Field>
            <Field label="To" htmlFor="calc-to">
              <span className="flex h-10 items-center rounded-[3px] border border-line bg-white px-[10px] focus-within:border-bone">
                <input
                  id="calc-to"
                  list="calc-airports"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    reset();
                  }}
                  placeholder="City or airport"
                  autoComplete="off"
                  className="min-w-0 flex-1 border-0 bg-transparent text-[14px] text-bone outline-none"
                />
                <Icon name="search" size={16} stroke="var(--steel)" />
              </span>
            </Field>
            <Field label="Departure date" htmlFor="calc-date">
              <input
                id="calc-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10 w-full rounded-[3px] border border-line bg-white px-[10px] text-[14px] text-bone outline-none focus:border-bone"
              />
            </Field>
            <Field label="Passengers" htmlFor="calc-pax">
              <select
                id="calc-pax"
                value={pax}
                onChange={(e) => {
                  setPax(Number(e.target.value));
                  reset();
                }}
                className="h-10 w-full rounded-[3px] border border-line bg-white px-2 text-[14px] text-bone"
              >
                {PAX.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
            <div className="col-span-full flex min-w-0 flex-col gap-[5px] text-[12px] font-bold">
              <span className="flex justify-between">
                <label htmlFor="calc-cat">Aircraft category</label>
                <button type="button" onClick={() => setWin("compare")} className="cursor-pointer border-0 bg-transparent p-0 text-[12px] font-bold text-gold underline underline-offset-[3px]">
                  Compare aircraft →
                </button>
              </span>
              <select
                id="calc-cat"
                value={cat}
                onChange={(e) => {
                  setCat(e.target.value as AircraftCategorySlug);
                  reset();
                }}
                className="h-10 w-full rounded-[3px] border border-line bg-white px-2 text-[14px] font-normal text-bone"
              >
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setWin("bags")}
            className={`mt-3 flex h-10 w-full cursor-pointer items-center justify-between rounded-[3px] border border-line bg-[#FBFAF7] px-3 text-left text-[13px] ${prefs ? "text-bone" : "text-steel"}`}
          >
            <span className="truncate">{prefs ? prefsSummary(prefs) : "Bags, pets and cabin needs (optional)"}</span>
            <span aria-hidden="true" className="text-[16px] text-bone">
              +
            </span>
          </button>
          {error ? (
            <p role="alert" className="mt-3 text-[13px] font-bold text-[var(--danger)]">
              {error}
            </p>
          ) : null}
          <button type="submit" className={`${GOLD_BTN} mt-[14px] h-[46px] w-full text-[15px] font-bold`}>
            Calculate my estimate →
          </button>
          <p className="mt-2 text-center text-[12px] text-steel">A planning estimate does not reserve an aircraft.</p>
          <div className="-mx-6 -mb-[18px] mt-4 flex flex-wrap justify-center gap-x-7 gap-y-2 border-t border-line bg-[#FBFAF7] px-6 py-3 text-[13px] max-sm:-mx-4 max-sm:px-4">
            <Link href="/guides/private-jet-charter-cost" className="text-link whitespace-nowrap font-bold">
              How estimates work →
            </Link>
            <span aria-hidden="true" className="text-line">
              |
            </span>
            {quoteLink("Prefer a written quote? →")}
          </div>
        </form>

        {/* ── Result panel ── */}
        <aside aria-live="polite" className="on-navy flex min-w-0 max-w-full flex-col bg-navy px-6 py-[22px] text-white [flex:1_1_300px] max-sm:px-4">
          <p className="text-[12px] font-bold uppercase tracking-[.2em] text-gold-light">
            {est ? "Your planning range · not live pricing" : "Published example · not live pricing"}
          </p>
          <h2 className="mt-2 font-serif text-[22px] leading-[1.1]">{est ? "Planning range for your inputs" : "Sample planning range"}</h2>
          <div className="mt-[6px] font-serif text-[clamp(32px,8vw,40px)] leading-none">{range}</div>
          <div className="mt-1 text-[12px] text-navy-on-2">USD · whole aircraft · {tripLower}</div>
          <div className="mt-[14px] border-t border-[rgba(255,255,255,.25)] pt-3 font-serif text-[20px]">
            {shown ? `${shown.from.iata} → ${shown.to.iata}` : ""}
          </div>
          <div className="text-[13px] text-navy-on-2">
            {shownCat?.name} · {shown?.pax} passengers
          </div>
          <p className="mt-[10px] text-[12px] leading-[1.5] text-navy-on-2">{panelNote}</p>
          {fit ? <p className="mt-2 text-[12px] font-bold leading-[1.5] text-gold-light">{fit}</p> : null}
          <div className="mt-[14px] border-t border-[rgba(255,255,255,.25)] pt-3">
            <p className="mb-[6px] text-[13px] font-bold">Confirm in your written quote</p>
            {(
              [
                ["Aircraft & positioning", "plane", "assumptions"],
                ["Taxes & airport charges", "dollar", "taxes"],
                ["Extras & cancellation terms", "doc", "extras"],
              ] as [string, IconName, Win][]
            ).map(([l, ic, w]) => (
              <button
                key={l}
                type="button"
                onClick={() => setWin(w)}
                className="flex w-full cursor-pointer items-center gap-[10px] border-0 border-t border-[rgba(255,255,255,.15)] bg-transparent py-[9px] text-left text-[13px] text-white"
              >
                <Icon name={ic} size={18} stroke="#fff" />
                <span className="flex-1">{l}</span>
                <span aria-hidden="true">›</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={requestQuote} className="btn btn-on-navy mt-auto h-11 w-full text-[14px] max-[1100px]:mt-4">
            Request my exact quote →
          </button>
          <button type="button" onClick={() => setWin("assumptions")} className="mt-[10px] cursor-pointer self-start border-0 bg-transparent p-0 text-[13px] text-white underline underline-offset-4">
            View pricing assumptions
          </button>
        </aside>
      </div>

      {/* ── Windows ── */}
      <LightWindow
        open={win === "compare"}
        onClose={() => setWin(null)}
        title="Compare the cabin for your trip"
        sub="Explore cabin space and range to find the right fit for your group and priorities."
      >
        <CompareCabins categories={categories} current={cat} pax={pax} onUse={(k) => { setCat(k); reset(); setWin(null); }} />
      </LightWindow>

      <LightWindow open={win === "bags"} onClose={() => setWin(null)} variant="drawer" title="Make room for what matters." sub="Tell us what you’re bringing so we can match the right aircraft to your trip.">
        <BagsForm
          initial={prefs ?? DEFAULT_PREFS}
          onSave={(p) => {
            setPrefs(p);
            setWin(null);
          }}
        />
      </LightWindow>

      <LightWindow open={win === "assumptions"} onClose={() => setWin(null)} variant="drawer" title="What sits behind the estimate?" sub="Here’s what we consider for this estimate and what may affect the total.">
        <p className="eyebrow mt-3">{est ? "Your planning estimate" : "Illustrative example"}</p>
        <div className="on-navy rounded-[3px] bg-navy px-5 py-[18px] text-white">
          <div className="font-serif text-[34px] leading-none">{range}</div>
          <div className="mt-[2px] text-[12px] text-navy-on-2">USD · whole aircraft · {tripLower}</div>
          <div className="mt-3 border-t border-[rgba(255,255,255,.2)] pt-3 font-serif text-[18px]">
            {shown ? `${label(shown.from)} → ${label(shown.to)}` : ""}
          </div>
          <div className="text-[13px] text-navy-on-2">
            {shownCat?.name} · {shown?.pax} passengers · about {hours} flight time
          </div>
          <div className="mt-3 flex gap-2 rounded-[3px] bg-[rgba(255,255,255,.1)] px-3 py-[10px] text-[12px] leading-[1.45]">
            <Icon name="info" size={16} stroke="#fff" />
            {est ? "Planning estimate for your inputs. Your date and aircraft have not been priced." : "Published route example. Your date and aircraft have not been priced."}
          </div>
        </div>
        <p className="mt-3 text-[13px] leading-[1.5] text-steel">
          The range is the category hourly rate × great-circle flight time (plus taxi and climb-out per leg), with standard catering and a sedan transfer per leg, shown −15% / +20% around the midpoint.
        </p>
        <div className="mt-4 grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
          <AssumptionCol title="Inputs" icon="doc" items={[["pin", "Route"], ["calendar", "Travel date"], ["people", "Passenger count"], ["plane", "Aircraft category"]]} />
          <AssumptionCol title="Confirm in your quote" icon="check" items={[["plane", "Aircraft and positioning"], ["dollar", "Taxes and airport charges"], ["people", "Crew and requested services"]]} />
          <AssumptionCol title="Could change the total" icon="info" items={[["cloud", "Weather-related services"], ["swap", "Itinerary changes"], ["gear", "Optional upgrades"]]} />
        </div>
        <div className="mt-[18px] flex flex-wrap items-center justify-between gap-[10px]">
          <Link href="/guides/private-jet-charter-cost" className="text-link text-[13px] font-bold">
            How estimates work →
          </Link>
          <span className="flex flex-wrap gap-[10px]">
            <button type="button" onClick={() => setWin(null)} className="btn btn-secondary btn-sm">
              Edit trip
            </button>
            {quoteLink("Request a written quote →", `${GOLD_BTN} btn-sm`)}
          </span>
        </div>
      </LightWindow>

      <LightWindow open={win === "taxes"} onClose={() => setWin(null)} variant="drawer" title="Taxes and airport charges" sub="These fees vary by route, airport and country. Confirm which items apply to your trip and how they appear in your written quote.">
        <TaxesWindow
          footer={
            <button type="button" onClick={() => setWin(null)} className="text-link cursor-pointer border-0 bg-transparent p-0 text-[13px] font-bold">
              ← Return to my estimate
            </button>
          }
        />
      </LightWindow>

      <LightWindow open={win === "extras"} onClose={() => setWin(null)} variant="drawer" title="Before you accept the quote" sub="Review these common items so you know what is included, what may be extra, and how changes are handled.">
        <ExtrasWindow footer={quoteLink("Add a question to my request →", `${GOLD_BTN} h-11 w-full`)} />
      </LightWindow>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-[5px] text-[12px] font-bold">
      <label htmlFor={htmlFor}>{label}</label>
      <div className="font-normal">{children}</div>
    </div>
  );
}

function AssumptionCol({ title, icon, items }: { title: string; icon: IconName; items: [IconName, string][] }) {
  return (
    <div>
      <b className="flex items-center gap-2 text-[13px]">
        <Icon name={icon} size={18} />
        {title}
      </b>
      {items.map(([i, l]) => (
        <div key={l} className="flex items-center gap-2 py-[6px] text-[13px] text-steel">
          <Icon name={i} size={16} />
          {l}
        </div>
      ))}
    </div>
  );
}

function CompareCabins({
  categories,
  current,
  pax,
  onUse,
}: {
  categories: CalcCategory[];
  current: AircraftCategorySlug;
  pax: number;
  onUse: (k: AircraftCategorySlug) => void;
}) {
  const [sel, setSel] = useState(current);
  const chosen = categories.find((c) => c.slug === sel);
  return (
    <>
      <div role="radiogroup" aria-label="Aircraft category" className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,130px),1fr))]">
        {categories.map((c) => {
          const on = c.slug === sel;
          return (
            <button
              key={c.slug}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setSel(c.slug)}
              className={`cursor-pointer rounded-[3px] border p-3 text-left text-bone ${on ? "border-gold bg-[#FBFAF7]" : "border-line bg-white"}`}
            >
              <span className="flex items-center gap-2 text-[14px] font-bold">
                <span className={`h-4 w-4 rounded-full border shadow-[inset_0_0_0_3px_#fff] ${on ? "border-gold bg-gold" : "border-line bg-white"}`} />
                {c.name}
              </span>
              {c.imageUrl ? (
                <span className="relative mt-[10px] block aspect-[16/10] overflow-hidden bg-surface-2">
                  <Image src={c.imageUrl} alt="" fill sizes="200px" className="object-cover" />
                </span>
              ) : null}
              <b className="mt-[10px] block text-[12px]">Seats · range</b>
              <span className="block text-[12px] leading-[1.4] text-steel">
                Up to {c.pax} passengers · about {c.rangeNm.toLocaleString("en-US")} nm
              </span>
              {c.pax < pax ? <span className="mt-1 block text-[12px] font-bold text-gold">Too small for {pax} passengers</span> : null}
            </button>
          );
        })}
      </div>
      <p className="mt-[14px] flex items-center gap-2 text-[12px] text-steel">
        <Icon name="plane" size={18} />
        Compare specific aircraft, not category labels alone.
      </p>
      <div className="mt-[14px] flex flex-wrap items-center justify-between gap-3">
        <Link href="/aircraft" className="text-link text-[13px] font-bold">
          Explore all six categories →
        </Link>
        <button type="button" onClick={() => onUse(sel)} className={`${GOLD_BTN} btn-sm`}>
          Use {chosen?.name.toLowerCase()} →
        </button>
      </div>
    </>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-[10px] text-[14px]">
      <span>{label}</span>
      <span className="flex items-center gap-[10px]">
        <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} onClick={() => onChange(Math.max(0, value - 1))} className="h-8 w-8 cursor-pointer rounded-full border border-line bg-white text-[16px]">
          −
        </button>
        <span className="w-6 text-center font-bold" aria-live="polite">
          {value}
        </span>
        <button type="button" aria-label={`More ${label.toLowerCase()}`} onClick={() => onChange(Math.min(30, value + 1))} className="h-8 w-8 cursor-pointer rounded-full border border-line bg-white text-[16px]">
          +
        </button>
      </span>
    </div>
  );
}

function BagsForm({ initial, onSave }: { initial: Prefs; onSave: (p: Prefs) => void }) {
  const [p, setP] = useState<Prefs>(initial);
  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => setP((s) => ({ ...s, [k]: v }));
  return (
    <div className="mt-[14px] flex flex-col gap-3">
      <div className="relative aspect-[16/8] overflow-hidden bg-surface-2">
        <Image src="/images/light/cabin-baggage.webp" alt="" fill sizes="440px" className="object-cover" />
      </div>
      <Stepper label="Suitcases" value={p.suitcases} onChange={(n) => set("suitcases", n)} />
      <Stepper label="Carry-on bags" value={p.carryons} onChange={(n) => set("carryons", n)} />
      <div>
        <p className="mb-[6px] text-[12px] font-bold">Oversized items</p>
        <div className="flex flex-wrap gap-2">
          {["Golf clubs", "Skis", "Other"].map((l) => {
            const on = p.oversized.includes(l);
            return (
              <button
                key={l}
                type="button"
                aria-pressed={on}
                onClick={() => set("oversized", on ? p.oversized.filter((x) => x !== l) : [...p.oversized, l])}
                className={`chip chip-sm ${on ? "!border-gold !bg-gold" : ""}`}
              >
                {on ? "✓ " : ""}
                {l}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid gap-[14px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
        <div>
          <p className="mb-[6px] text-[12px] font-bold">Pets</p>
          <label className="flex cursor-pointer items-center gap-[10px] text-[13px]">
            <input type="checkbox" checked={p.pets} onChange={(e) => set("pets", e.target.checked)} className="h-[18px] w-[18px] accent-[var(--gold)]" />
            Traveling with pets?
          </label>
        </div>
        <div>
          <p className="mb-[2px] text-[12px] font-bold">Cabin priorities</p>
          {(
            [
              ["wifi", "Wi-Fi"],
              ["mobility", "Mobility assistance"],
              ["sleep", "Sleeping arrangement"],
            ] as const
          ).map(([k, l]) => (
            <label key={k} className="flex cursor-pointer items-center gap-[10px] py-1 text-[13px]">
              <input type="checkbox" checked={p[k]} onChange={(e) => set(k, e.target.checked)} className="h-[18px] w-[18px] accent-[var(--gold)]" />
              {l}
            </label>
          ))}
        </div>
      </div>
      <p className="text-[12px] leading-[1.45] text-steel">Add dimensions and weight for large items. Features depend on the aircraft offered.</p>
      <div className="field-jn">
        <label htmlFor="calc-notes">Additional notes (optional)</label>
        <textarea id="calc-notes" rows={2} value={p.notes} onChange={(e) => set("notes", e.target.value)} placeholder="e.g. item dimensions, special requests" />
      </div>
      <button type="button" onClick={() => onSave(p)} className={`${GOLD_BTN} h-11 w-full`}>
        Save trip preferences →
      </button>
    </div>
  );
}
