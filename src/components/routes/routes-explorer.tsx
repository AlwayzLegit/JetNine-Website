"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { LightWindow } from "@/components/light/window";
import { ICONS, Icon } from "./icons";
import { RoutePlanForm, RouteQuoteButton } from "./quote-actions";
import type { RouteCard } from "./route-data";

type Region = "all" | "us" | "intl";
const REGIONS: { key: Region; label: string }[] = [
  { key: "all", label: "All routes" },
  { key: "us", label: "U.S. routes" },
  { key: "intl", label: "International" },
];
const ALIAS: Record<string, string> = {
  "New York": "nyc teterboro jfk",
  "Los Angeles": "la lax van nuys",
  London: "lon luton heathrow",
  "Los Cabos": "cabo",
  Nassau: "bahamas",
};
const INITIAL = 8;

const haystack = (city: string, iata: string, name: string) =>
  [city, iata, name, ALIAS[city] ?? ""].join(" ").toLowerCase();

/** One route card (image, lane, example airports, summary, links). */
export function RouteCardView({ r, quick = true, className = "" }: { r: RouteCard; quick?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const href = `/routes/${r.slug}`;
  return (
    <article className={`flex flex-col border border-line bg-surface ${className}`}>
      <Link href={href} aria-label={`${r.from} to ${r.to} route guide`} className="relative block aspect-[16/7] overflow-hidden bg-surface-2">
        <Image src={r.img} alt="" fill sizes="(max-width: 768px) 100vw, 400px" className="object-cover transition-transform duration-500 hover:scale-[1.02]" />
      </Link>
      <div className="flex flex-1 flex-col px-[14px] pb-[14px] pt-3">
        <h3 className="font-serif text-[22px] leading-[1.1]">
          <Link href={href} className="hover:text-gold">
            {r.from} → {r.to}
          </Link>
        </h3>
        <p className="mt-1 text-[12px] text-steel">
          Example airports: {r.fromIata} → {r.toIata} · {r.distance}
          {r.hours ? ` · about ${r.hours}` : ""}
        </p>
        <p className="mt-[2px] text-[13px]">{r.summary}</p>
        {r.fromPrice ? (
          <p className="mt-[6px] text-[12px] text-steel">
            Indicative from <b className="text-bone">{r.fromPrice}</b> one way, whole aircraft
          </p>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-3 pt-[10px]">
          <Link href={href} className="whitespace-nowrap text-[13px] font-bold text-gold">
            View route guide <span aria-hidden="true">→</span>
          </Link>
          {quick ? (
            <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-[6px] border-0 bg-transparent p-0 text-[13px] font-bold text-bone">
              <Icon d={ICONS.plus} className="h-4 w-4" />
              Quick view
            </button>
          ) : null}
        </div>
      </div>
      {quick ? (
        <LightWindow open={open} onClose={() => setOpen(false)} variant="drawer">
          <div className="relative -mx-[clamp(16px,4vw,32px)] -mt-11 aspect-[16/7] overflow-hidden bg-surface-2">
            <Image src={r.img} alt="" fill sizes="440px" className="object-cover" />
          </div>
          <h2 className="title-app mt-[18px] !text-[30px] !leading-[1.12]">
            {r.from} → {r.to}
          </h2>
          <p className="mt-1 font-serif text-[16px]">
            Example pairing: {r.fromName} ({r.fromIata}) → {r.toName} ({r.toIata})
          </p>
          <p className="mt-1 text-[13px] text-steel">{r.note}</p>
          <div className="mt-4 flex flex-col gap-[10px]">
            {[
              { d: ICONS.plane, t: "Airport options", b: "Explore airport choices and confirm what works for your trip." },
              { d: ICONS.bag, t: "Cabin and baggage needs", b: "Match aircraft to your passengers and baggage." },
              { d: ICONS.cloud, t: "Nonstop suitability", b: "Review weather, operating conditions and alternatives." },
            ].map((row) => (
              <div key={row.t} className="grid grid-cols-[26px_minmax(0,1fr)] items-center gap-3 rounded-[3px] border border-line bg-ink px-[14px] py-3">
                <Icon d={row.d} />
                <span>
                  <b className="block text-[14px]">{row.t}</b>
                  <span className="text-[12px] text-steel">{row.b}</span>
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-steel">Aircraft, weather and passenger load affect routing.</p>
          <div className="mt-[14px] flex flex-wrap gap-[10px]">
            <Link href={href} className="btn btn-secondary btn-sm">
              View full route guide <span aria-hidden="true">→</span>
            </Link>
            <RouteQuoteButton from={r.fromIata} to={r.toIata} label="Plan this route" className="btn btn-primary btn-sm" context={`routes-hub-quick:${r.slug}`} />
          </div>
        </LightWindow>
      ) : null}
    </article>
  );
}

/**
 * The hub body of Light - Routes: the overlapping "Find a route" bar,
 * the filterable "Routes to explore." grid beside the sticky Plan-your-
 * flight aside. Filtering is live; every lane stays in the HTML.
 */
export function RoutesExplorer({ cards, aside }: { cards: RouteCard[]; aside: ReactNode }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [region, setRegion] = useState<Region>("all");
  const [showAll, setShowAll] = useState(false);
  const [result, setResult] = useState("");

  const options = useMemo(() => {
    const set = new Set<string>();
    for (const c of cards) {
      set.add(c.from);
      set.add(c.to);
    }
    return [...set].sort();
  }, [cards]);

  const q1 = from.trim().toLowerCase();
  const q2 = to.trim().toLowerCase();
  const matches = cards.filter((c) => {
    if (region === "us" && c.intl) return false;
    if (region === "intl" && !c.intl) return false;
    const a = haystack(c.from, c.fromIata, c.fromName);
    const b = haystack(c.to, c.toIata, c.toName);
    const fwd = (!q1 || a.includes(q1)) && (!q2 || b.includes(q2));
    const rev = (!q1 || b.includes(q1)) && (!q2 || a.includes(q2));
    return fwd || rev;
  });
  const filtering = Boolean(q1 || q2 || region !== "all");
  const collapsed = !filtering && !showAll;

  function onFind(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!q1 && !q2) return setResult("");
    const pair = `${from.trim() || "Anywhere"} → ${to.trim() || "anywhere"}`;
    setResult(
      matches.length
        ? `${pair} · ${matches.length} route guide${matches.length === 1 ? "" : "s"} below. Either direction is the same lane; final airports are confirmed in your proposal.`
        : `${pair} · no guide yet. Request options below for a trip-specific review.`,
    );
  }

  function clearFilters() {
    setFrom("");
    setTo("");
    setRegion("all");
    setResult("");
  }

  return (
    <>
      <div className="container-jn relative z-[5] -mt-12">
        <form onSubmit={onFind} className="border border-line bg-white px-5 py-4 shadow-[0_14px_40px_rgba(18,35,46,.12)]">
          <datalist id="route-cities">
            {options.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
          <div className="flex flex-wrap items-end gap-3">
            <h2 className="mb-2 min-w-0 max-w-full flex-[1_1_130px] font-serif text-[24px]">Find a route</h2>
            <label className="flex min-w-0 flex-[999_1_140px] flex-col gap-[5px] text-[12px] font-bold">
              <span>From</span>
              <span className="flex h-10 items-center rounded-[3px] border border-line bg-white px-[10px]">
                <input list="route-cities" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="City or airport" className="min-w-0 flex-1 border-0 bg-transparent text-[14px] font-normal text-bone outline-none" />
                {from ? (
                  <button type="button" onClick={() => setFrom("")} aria-label="Clear from" className="border-0 bg-transparent p-0 text-[18px] leading-none text-steel">×</button>
                ) : null}
              </span>
            </label>
            <button
              type="button"
              onClick={() => {
                setFrom(to);
                setTo(from);
              }}
              aria-label="Swap from and to"
              className="flex h-10 w-11 flex-none items-center justify-center rounded-[3px] border border-line bg-white text-bone"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-[18px] w-[18px]">
                <path d={ICONS.swap} />
              </svg>
            </button>
            <label className="flex min-w-0 flex-[999_1_140px] flex-col gap-[5px] text-[12px] font-bold">
              <span>To</span>
              <span className="flex h-10 items-center rounded-[3px] border border-line bg-white px-[10px]">
                <input list="route-cities" value={to} onChange={(e) => setTo(e.target.value)} placeholder="City or airport" className="min-w-0 flex-1 border-0 bg-transparent text-[14px] font-normal text-bone outline-none" />
                {to ? (
                  <button type="button" onClick={() => setTo("")} aria-label="Clear to" className="border-0 bg-transparent p-0 text-[18px] leading-none text-steel">×</button>
                ) : null}
              </span>
            </label>
            <button type="submit" className="btn h-10 max-w-full flex-none border-gold bg-gold px-[18px] text-[14px] font-bold text-white hover:text-white">
              Find route guides <span aria-hidden="true">→</span>
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4 text-[12px] text-steel">
            <span>
              Prefer to browse one city?{" "}
              <Link href="/private-jet-charter" className="whitespace-nowrap font-bold text-gold underline underline-offset-[3px]">
                Explore city guides →
              </Link>
            </span>
            <span className="flex flex-wrap items-center gap-2">
              {REGIONS.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  aria-pressed={region === r.key}
                  onClick={() => setRegion(r.key)}
                  className={[
                    "h-7 rounded-full border px-3 text-[12px]",
                    region === r.key ? "border-clearance bg-clearance text-white" : "border-line bg-white text-bone",
                  ].join(" ")}
                >
                  {r.label}
                </button>
              ))}
              <button type="button" onClick={clearFilters} className="border-0 bg-transparent px-1 text-[12px] text-steel underline">
                Clear filters
              </button>
            </span>
          </div>
          {result ? (
            <div role="status" className="mt-3 flex items-center gap-[10px] rounded-[3px] border border-line bg-surface-2 px-3 py-[10px] text-[13px]">
              <span aria-hidden="true">✓</span>
              <span className="text-steel">{result}</span>
              <button type="button" onClick={() => setResult("")} aria-label="Dismiss" className="ml-auto border-0 bg-transparent text-[18px] leading-none text-steel">×</button>
            </div>
          ) : null}
        </form>
      </div>

      <div className="container-jn flex flex-wrap items-start gap-7 pt-6">
        <section className="min-w-0 flex-[1.7_1_520px]">
          <h2 className="font-serif text-[30px] leading-[1.1]">Routes to explore.</h2>
          <p className="mt-1 text-[13px] text-steel">Planning examples. Aircraft, airports and availability confirmed for your trip.</p>
          <div className="mt-3 grid gap-[14px] [grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr))]">
            {/* Collapsed lanes stay in the HTML (display:none) so every guide is linked. */}
            {matches.map((c, i) => (
              <RouteCardView key={c.slug} r={c} className={collapsed && i >= INITIAL ? "hidden" : ""} />
            ))}
          </div>
          {matches.length === 0 ? (
            <p className="mt-3 border border-line bg-surface p-[14px] text-[13px] text-steel">
              No example route matches yet. Send the city pair, dates and passenger details for a trip-specific review.
            </p>
          ) : null}
          {collapsed && matches.length > INITIAL ? (
            <div className="mt-4 text-center">
              <button type="button" onClick={() => setShowAll(true)} className="btn btn-secondary btn-sm">
                Show all {matches.length} routes <span aria-hidden="true">↓</span>
              </button>
            </div>
          ) : null}
          <p className="mt-[10px] text-[12px] text-steel">Routes are not scheduled services. Final airports and routing are confirmed in your proposal.</p>
        </section>
        <div className="min-w-0 max-w-full flex-[1_1_300px] self-stretch">
          <aside className="sticky top-[84px] flex flex-col gap-[14px]">
            <RoutePlanForm from={from} to={to} context="routes-hub" />
            {aside}
          </aside>
        </div>
      </div>
    </>
  );
}
