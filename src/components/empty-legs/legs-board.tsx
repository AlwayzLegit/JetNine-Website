"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState, type FormEvent } from "react";
import { CATEGORY_LABELS, formatUSD, type EmptyLegView, type SoldLegView } from "@/lib/empty-legs";
import { SITE } from "@/lib/constants";
import { seedQuote } from "@/lib/start-quote";
import { WindowButton } from "@/components/light/window";

// Coast buckets for the filter. Derived on the server from the departure
// airport's state / country (see the page), null when the airport sits in
// neither list — those legs only show under "Anywhere".
export type BoardRegion = "west" | "east" | "intl" | null;

export type BoardLeg = EmptyLegView & {
  /** "Today", "Tomorrow", "Thu, Oct 2". */
  day: string;
  /** "4:30 PM". */
  time: string;
  region: BoardRegion;
};

type Region = "all" | "soon" | "west" | "east" | "intl";
type Cat = "all" | EmptyLegView["category"];

const REGIONS: { id: Region; label: string }[] = [
  { id: "all", label: "Anywhere" },
  { id: "soon", label: "Next 48 hours" },
  { id: "west", label: "West coast" },
  { id: "east", label: "East coast" },
  { id: "intl", label: "International" },
];

const CAT_ORDER: EmptyLegView["category"][] = ["turboprop", "light", "midsize", "supermid", "heavy", "ultra"];

// Category photo for the listing thumbnail — the board has no per-leg
// imagery, and a city photo would imply a place we can't promise.
const CAT_IMG: Record<EmptyLegView["category"], string> = {
  turboprop: "/images/light/turboprop-twin.webp",
  light: "/images/light/jet-light.webp",
  midsize: "/images/light/jet-midsize.webp",
  supermid: "/images/light/cabin-supermid.webp",
  heavy: "/images/light/jet-heavy.webp",
  ultra: "/images/light/jet-ultra-flight.webp",
};

const PAX = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16];

// The empty-state CTA hands the visitor's search to the watchlist form
// (beside the board) so "we'll text you" starts pre-filled from what they
// just asked for.
export const WATCHLIST_PREFILL_EVENT = "jn:watchlist-prefill";
export type WatchlistPrefill = { from?: string; to?: string; earliest?: string; latest?: string };

function isoDaysAhead(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type Search = { from: string; to: string; earliest: string; pax: number };
const EMPTY_SEARCH: Search = { from: "", to: "", earliest: "", pax: 0 };

function matches(text: string, q: string) {
  return !q || text.toLowerCase().includes(q.trim().toLowerCase());
}

function applyFilters(legs: BoardLeg[], s: Search, region: Region, cat: Cat): BoardLeg[] {
  return legs.filter((l) => {
    if (region === "soon" && l.hoursOut > 48) return false;
    if (region !== "all" && region !== "soon" && l.region !== region) return false;
    if (cat !== "all" && l.category !== cat) return false;
    if (!matches(`${l.fromCity} ${l.fromIata} ${l.fromAirport}`, s.from)) return false;
    if (!matches(`${l.toCity} ${l.toIata} ${l.toAirport}`, s.to)) return false;
    if (s.earliest && l.isoDate < s.earliest) return false;
    if (s.pax && l.seats < s.pax) return false;
    return true;
  });
}

const BRONZE =
  "btn border-gold bg-gold font-bold text-white hover:border-gold hover:bg-gold hover:text-white hover:opacity-90";

export function LegsBoard({
  legs,
  recentlySold = [],
}: {
  legs: BoardLeg[];
  recentlySold?: SoldLegView[];
}) {
  const [draft, setDraft] = useState<Search>(EMPTY_SEARCH);
  const [search, setSearch] = useState<Search>(EMPTY_SEARCH);
  const [region, setRegion] = useState<Region>("all");
  const [cat, setCat] = useState<Cat>("all");
  const filtered = useMemo(() => applyFilters(legs, search, region, cat), [legs, search, region, cat]);
  const cats = CAT_ORDER.filter((c) => legs.some((l) => l.category === c));
  const filtering =
    region !== "all" || cat !== "all" || Boolean(search.from || search.to || search.earliest || search.pax);

  function onSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSearch(draft);
    document.getElementById("listings")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function clear() {
    setDraft(EMPTY_SEARCH);
    setSearch(EMPTY_SEARCH);
    setRegion("all");
    setCat("all");
  }

  function prefillWatchlist() {
    const detail: WatchlistPrefill = {
      from: search.from || undefined,
      to: search.to || undefined,
      ...(region === "soon"
        ? { earliest: isoDaysAhead(0), latest: isoDaysAhead(2) }
        : search.earliest
          ? { earliest: search.earliest }
          : {}),
    };
    window.dispatchEvent(new CustomEvent<WatchlistPrefill>(WATCHLIST_PREFILL_EVENT, { detail }));
  }

  return (
    <>
      <form onSubmit={onSearch} className="border border-line bg-white px-[18px] py-4">
        <h2 className="font-serif text-[28px] leading-[1.1]">Find a match for your plans</h2>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="field-jn min-w-0 flex-[999_1_140px]">
            <label htmlFor="el-from">From</label>
            <input
              id="el-from"
              value={draft.from}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
              placeholder="City or airport"
              autoComplete="off"
            />
          </div>
          <button
            type="button"
            onClick={() => setDraft({ ...draft, from: draft.to, to: draft.from })}
            aria-label="Swap from and to"
            className="h-[46px] min-w-0 flex-[1_1_28px] cursor-pointer border-0 bg-transparent p-0 text-[16px] text-steel"
          >
            ⇄
          </button>
          <div className="field-jn min-w-0 flex-[999_1_140px]">
            <label htmlFor="el-to">To</label>
            <input
              id="el-to"
              value={draft.to}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
              placeholder="City or airport"
              autoComplete="off"
            />
          </div>
          <div className="field-jn min-w-0 flex-[999_1_140px]">
            <label htmlFor="el-date">Departing from</label>
            <input
              id="el-date"
              type="date"
              value={draft.earliest}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDraft({ ...draft, earliest: e.target.value })}
            />
          </div>
          <div className="field-jn min-w-0 flex-[999_1_140px]">
            <label htmlFor="el-pax">Passengers</label>
            <select
              id="el-pax"
              value={draft.pax ? String(draft.pax) : ""}
              onChange={(e) => setDraft({ ...draft, pax: Number(e.target.value) || 0 })}
            >
              <option value="">Any</option>
              {PAX.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={`${BRONZE} h-[46px] max-w-full flex-none whitespace-nowrap px-4 text-[14px]`}>
            Search flights <span aria-hidden="true">→</span>
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
          {REGIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              className="chip chip-sm"
              aria-pressed={region === r.id}
              onClick={() => setRegion(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
        {cats.length > 1 ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
            <button type="button" className="chip chip-sm" aria-pressed={cat === "all"} onClick={() => setCat("all")}>
              Any aircraft
            </button>
            {cats.map((c) => (
              <button key={c} type="button" className="chip chip-sm" aria-pressed={cat === c} onClick={() => setCat(c)}>
                {CATEGORY_LABELS[c]}
              </button>
            ))}
            <button type="button" onClick={clear} className="text-link ml-1 border-0 bg-transparent p-0 text-[13px]">
              Clear filters
            </button>
          </div>
        ) : null}
      </form>

      <section id="listings" className="mt-[22px] scroll-mt-24">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-serif text-[30px] leading-[1.1]">Live empty legs.</h2>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-[3px] text-[12px]">
            <span aria-hidden="true" className="dot dot-success" />
            Live board · refreshed every minute
          </span>
        </div>
        <p className="mt-1 text-[14px] text-steel">
          Whole aircraft, not a seat · price is per flight · first call wins
        </p>

        {filtered.length > 0 ? (
          <div className="mt-3 flex flex-col gap-[10px]">
            {filtered.map((l) => (
              <LegRow key={l.id} leg={l} />
            ))}
          </div>
        ) : (
          <div className="mt-3 border border-line bg-white p-6 text-center max-md:p-5">
            {/* "Every listed leg sold" is only true when legs have in fact
                sold. With an empty board and no fills behind it, saying so
                would claim a trading history the board does not have. */}
            <h3 className="title-card-sm">
              {legs.length > 0
                ? "No legs match that search right now."
                : recentlySold.length > 0
                  ? "The board is clear — every listed leg sold."
                  : "No legs on the board right now."}
            </h3>
            <p className="mx-auto mt-2 max-w-[52ch] text-[14px] text-steel">
              {legs.length > 0
                ? "Try another filter — or set a watchlist and we'll text you when something shows up."
                : recentlySold.length > 0
                  ? "Legs go the moment a confirmation comes through — first call wins. Set a watchlist and we'll text the second one matching your lanes hits the board."
                  : "Repositioning legs surface at short notice and go fast. Set a watchlist with your lanes and dates and the desk will text you when one fits."}
            </p>
            <a href="#watchlist" onClick={prefillWatchlist} className={`${BRONZE} btn-sm mt-4`}>
              Set a watchlist <span aria-hidden="true">→</span>
            </a>
          </div>
        )}

        {recentlySold.length > 0 ? (
          <p className="mt-3 text-[13px] text-steel">
            Recently sold:{" "}
            {recentlySold.map((l, i) => (
              <span key={l.id}>
                {i > 0 ? " · " : ""}
                {l.fromCity} → {l.toCity}, {formatUSD(l.priceNow)}, {l.timeToSale}
              </span>
            ))}
          </p>
        ) : null}
        <p className="mt-2 text-[12px] text-steel">
          One-way charter of the whole aircraft. Return travel is arranged separately.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-[14px] border border-line bg-[#FBFAF7] px-4 py-[14px]">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-surface-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-[22px] w-[22px]">
              <path d="M21 3L3 10.5l7.5 3L13.5 21 21 3zM10.5 13.5L21 3" />
            </svg>
          </span>
          <div className="min-w-0 flex-[999_1_240px]">
            <div className="font-serif text-[20px]">Nothing that fits?</div>
            <div className="text-[13px] text-steel">
              Broaden your dates or airports, set a watchlist, or request an on-demand charter.
            </div>
          </div>
          <div className="flex max-w-full flex-none flex-wrap gap-4 text-[13px]">
            {filtering ? (
              <button type="button" onClick={clear} className="text-link border-0 bg-transparent p-0 text-[13px]">
                Clear filters
              </button>
            ) : null}
            <a href="#watchlist" onClick={prefillWatchlist} className="text-link">
              Set a watchlist
            </a>
            <a href="/quote/mission" className="text-link">
              Request a custom trip →
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

function LegRow({ leg: l }: { leg: BoardLeg }) {
  const router = useRouter();

  function quoteRoute() {
    seedQuote({ trip: "oneway", pax: Math.min(l.seats, 4) || 1, from: l.fromIata, to: l.toIata, depart: l.isoDate });
    router.push("/quote/mission");
  }

  const details = (
    <div className="mt-4">
      <dl className="dl-jn text-[14px]">
        {[
          ["Route", `${l.fromAirport} → ${l.toAirport}`],
          ["Departs", `${l.day} · ${l.time}`],
          ["Flight time", `about ${l.duration}`],
          ["Aircraft", l.aircraft],
          ["Category", CATEGORY_LABELS[l.category]],
          ["Seats", `up to ${l.seats} passengers`],
          ["Operator", `${l.operatorBadge} · safety-audited operator`],
          ["Price", `${formatUSD(l.priceNow)} (was ${formatUSD(l.priceWas)} · ${l.discountPct}% off)`],
          ["Reference", l.code],
        ].map(([k, v]) => (
          <Fragment key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </Fragment>
        ))}
      </dl>
      <ul className="mt-5 flex flex-col gap-2 text-[14px] text-steel">
        {[
          "The date and route are fixed — the aircraft flies this leg either way.",
          "Departure typically holds within an hour of the listed time.",
          "If the trip that created the leg cancels, so does this one — payment is refunded in full.",
          "Confirm the total, the operating carrier and baggage space when you call.",
        ].map((t) => (
          <li key={t} className="grid grid-cols-[auto_1fr] gap-2">
            <span aria-hidden="true" className="text-gold">✓</span>
            {t}
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-wrap gap-3">
        <a href={`tel:${SITE.dispatchPhoneE164}`} className={`${BRONZE} btn-sm`}>
          Call to book · {SITE.dispatchPhone}
        </a>
        <button type="button" onClick={quoteRoute} className="btn btn-secondary btn-sm">
          Quote this route on demand
        </button>
      </div>
    </div>
  );

  return (
    <article
      className={`flex flex-wrap items-center gap-[14px] border bg-white p-[10px] ${l.featured ? "border-gold" : "border-line"}`}
    >
      <div className="relative aspect-[4/3] min-w-0 max-w-full flex-[1_1_96px] overflow-hidden bg-surface-2">
        <Image src={CAT_IMG[l.category]} alt="" fill sizes="(max-width: 640px) 100vw, 140px" className="object-cover" />
      </div>
      <div className="min-w-0 flex-[999_1_140px]">
        <div className="font-serif text-[19px] leading-[1.2]">
          {l.fromCity} → {l.toCity}
        </div>
        <div className="text-[12px] text-steel">
          {l.fromIata} → {l.toIata} · about {l.duration}
        </div>
      </div>
      <div className="min-w-0 flex-[999_1_140px] text-[13px]">
        <span className="font-semibold">{l.day}</span>
        <div className="text-[12px] text-steel">{l.time}</div>
      </div>
      <div className="min-w-0 flex-[999_1_140px] text-[13px]">
        {l.aircraft}
        <div className="text-[12px] text-steel">
          {CATEGORY_LABELS[l.category]} · up to {l.seats} passengers
        </div>
      </div>
      <div className="min-w-0 flex-[999_1_160px]">
        <div className="font-serif text-[20px] leading-none">{formatUSD(l.priceNow)}</div>
        <div className="mt-1 text-[12px] text-steel">
          <span className="line-through">{formatUSD(l.priceWas)}</span> ·{" "}
          <span className="font-semibold text-gold">{l.discountPct}% off</span> · whole aircraft
        </div>
        <div className="mt-[6px] flex flex-wrap items-center gap-[10px]">
          <WindowButton
            label={<>View details →</>}
            className="text-link border-0 bg-transparent p-0 text-[12px]"
            title={`${l.fromCity} to ${l.toCity}`}
            sub={`${l.day} · ${l.time} · ${l.aircraft}`}
            variant="drawer"
          >
            {details}
          </WindowButton>
          <a href={`tel:${SITE.dispatchPhoneE164}`} className={`${BRONZE} h-7 px-[10px] text-[12px]`}>
            Call to book
          </a>
        </div>
      </div>
    </article>
  );
}
