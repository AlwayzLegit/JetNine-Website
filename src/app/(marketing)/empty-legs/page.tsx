import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import Image from "next/image";
import Link from "next/link";
import { Breadcrumb } from "@/components/light/breadcrumb";
import { ChecklistWindow } from "@/components/empty-legs/checklist-window";
import { LegsBoard, type BoardLeg, type BoardRegion } from "@/components/empty-legs/legs-board";
import { WatchlistForm } from "@/components/empty-legs/watchlist-form";
import { emptyLegs } from "@/db/schema/empty-legs";
import { operators } from "@/db/schema/operators";
import { aircraft } from "@/db/schema/aircraft";
import { airports } from "@/db/schema/airports";
import { findAirport } from "@/lib/airports";
import { SITE } from "@/lib/constants";
import type { EmptyLegView, SoldLegView } from "@/lib/empty-legs";

// ISR, not force-dynamic: force-dynamic overrode the revalidate window and
// also made Next skip the font preloads for this page.
export const revalidate = 60; // refresh every minute

export const metadata: Metadata = pageMetadata({
  title: "Empty Leg Private Jet Flights & Route Alerts",
  description:
    "Browse available empty leg flights and set alerts for your preferred routes. Review departure dates, aircraft and pricing for flexible private jet travel.",
  path: "/empty-legs",
});

const MARKETING_CATEGORIES: Record<string, EmptyLegView["category"]> = {
  turboprop: "turboprop",
  light: "light",
  midsize: "midsize",
  supermid: "supermid",
  heavy: "heavy",
  ulr: "ultra",
};

// Day and time as two lines for the board row: "Today" / "4:30 PM",
// "Tomorrow", then "Thu, Oct 2". Sentence case, no codes.
function formatDay(d: Date): { day: string; time: string } {
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  if (sameDay) return { day: "Today", time };
  if (isTomorrow) return { day: "Tomorrow", time };
  const day = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return { day, time };
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

// Region filter buckets. State first (from the airports table), then the
// inline catalog's time zone as a fallback for airports the table has no
// state for. Anything outside the US is international; a US airport in
// neither list (Texas, Illinois…) only shows under "All".
const WEST_STATES = new Set([
  "CA", "OR", "WA", "NV", "AZ", "CO", "UT", "ID", "MT", "WY", "NM", "AK", "HI",
  "CALIFORNIA", "OREGON", "WASHINGTON", "NEVADA", "ARIZONA", "COLORADO", "UTAH", "IDAHO",
  "MONTANA", "WYOMING", "NEW MEXICO", "ALASKA", "HAWAII",
]);
const EAST_STATES = new Set([
  "ME", "NH", "VT", "MA", "RI", "CT", "NY", "NJ", "PA", "DE", "MD", "DC", "VA", "NC", "SC", "GA", "FL",
  "MAINE", "NEW HAMPSHIRE", "VERMONT", "MASSACHUSETTS", "RHODE ISLAND", "CONNECTICUT", "NEW YORK",
  "NEW JERSEY", "PENNSYLVANIA", "DELAWARE", "MARYLAND", "DISTRICT OF COLUMBIA", "VIRGINIA",
  "NORTH CAROLINA", "SOUTH CAROLINA", "GEORGIA", "FLORIDA",
]);

function regionFor(icao: string, country: string | null, state: string | null): BoardRegion {
  const isUs = country ? country.toUpperCase() === "US" : /^[KP]/.test(icao.toUpperCase());
  if (!isUs) return "intl";
  const s = state?.trim().toUpperCase();
  if (s) {
    if (WEST_STATES.has(s)) return "west";
    if (EAST_STATES.has(s)) return "east";
    return null;
  }
  const known = findAirport(icao);
  if (known?.tz === "PT" || known?.tz === "MT") return "west";
  if (known?.tz === "ET") return "east";
  return null;
}

async function getLiveLegs(): Promise<BoardLeg[]> {
  // Wrap the DB query so a transient DB blip (Supabase pause, network
  // hiccup, schema drift) degrades to an empty board instead of a
  // hard 500 on a marketing page. The watchlist + how-it-works
  // sections still render below; the customer can still leave their
  // info. Errors are surfaced to Sentry via console.error in
  // production for postmortems.
  let rows: Awaited<ReturnType<typeof queryLiveLegs>>;
  try {
    rows = await queryLiveLegs();
  } catch (err) {
    console.error("[empty-legs] live board query failed", err);
    return [];
  }

  const now = Date.now();
  const out: BoardLeg[] = [];
  for (const r of rows) {
    // Belt-and-suspenders nulls — wheels_up_at is NOT NULL in the
    // schema but a JSON-round-trip in some Drizzle paths can drop the
    // Date prototype. Same defensive shape for the price fields.
    try {
      const wheelsUp = r.wheelsUpAt instanceof Date ? r.wheelsUpAt : new Date(r.wheelsUpAt);
      const hoursOut = Math.max(0, (wheelsUp.getTime() - now) / 3_600_000);
      const priceWas = r.priceWas ?? 0;
      const priceNow = r.priceNow ?? 0;
      const computedDiscount =
        priceWas > 0 ? Math.round(((priceWas - priceNow) / priceWas) * 100) : 0;
      const discountPct = r.discountPct ?? computedDiscount;
      const operatorBadge = r.wyvernWingman
        ? "Wyvern Wingman ✓"
        : r.argusRating === "platinum"
          ? "ARG/US Plat ✓"
          : `ARG/US ${r.argusRating ?? "—"}`;
      const { day, time } = formatDay(wheelsUp);

      out.push({
        id: r.id,
        code: r.code,
        category: (MARKETING_CATEGORIES[r.category] ?? "midsize") as EmptyLegView["category"],
        aircraft: `${r.makeModel ?? "Aircraft"}${r.yearManufactured ? ` · ${r.yearManufactured}` : ""}`,
        fromIata: r.fromIata ?? r.fromIcao ?? "—",
        fromCity: r.fromCity ?? "—",
        fromAirport: r.fromName ?? r.fromIcao ?? "—",
        toIata: r.toIata ?? r.toIcao ?? "—",
        toCity: r.toCity ?? "—",
        toAirport: r.toName ?? r.toIcao ?? "—",
        date: `${day} · ${time}`,
        day,
        time,
        isoDate: wheelsUp.toISOString().slice(0, 10),
        duration: formatDuration(r.flightMinutes),
        seats: r.seats,
        priceWas,
        priceNow,
        discountPct,
        hoursOut,
        operatorBadge,
        featured: discountPct >= 60,
        region: regionFor(r.fromIcao ?? "", r.fromCountry, r.fromRegion),
      });
    } catch (err) {
      // Skip a single malformed row rather than failing the whole page.
      console.error("[empty-legs] row mapping failed", { code: r.code, err });
    }
  }
  return out;
}

async function queryLiveLegs() {
  return db
    .select({
      id: emptyLegs.id,
      code: emptyLegs.code,
      category: emptyLegs.category,
      fromIata: emptyLegs.fromIata,
      fromIcao: emptyLegs.fromIcao,
      fromCity: emptyLegs.fromCity,
      fromName: emptyLegs.fromName,
      toIata: emptyLegs.toIata,
      toIcao: emptyLegs.toIcao,
      toCity: emptyLegs.toCity,
      toName: emptyLegs.toName,
      wheelsUpAt: emptyLegs.wheelsUpAt,
      flightMinutes: emptyLegs.flightMinutes,
      seats: emptyLegs.seatsAvailable,
      priceWas: emptyLegs.fullCharterRefUsd,
      priceNow: emptyLegs.listedPriceUsd,
      discountPct: emptyLegs.discountPct,
      makeModel: aircraft.makeModel,
      yearManufactured: aircraft.yearManufactured,
      argusRating: operators.argusRating,
      wyvernWingman: operators.wyvernWingman,
      // State + country of the departure airport drive the coast filter.
      fromRegion: airports.region,
      fromCountry: airports.countryIso2,
    })
    .from(emptyLegs)
    .leftJoin(aircraft, eq(aircraft.id, emptyLegs.aircraftId))
    .innerJoin(operators, eq(operators.id, emptyLegs.operatorId))
    .leftJoin(airports, eq(airports.icao, emptyLegs.fromIcao))
    .where(eq(emptyLegs.status, "live"))
    .orderBy(asc(emptyLegs.wheelsUpAt));
}

// Compact relative durations for the sold strip ("14 h", "3 days").
function formatSpanShort(ms: number): string {
  const hours = Math.max(1, Math.round(ms / 3_600_000));
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} days`;
}

// Last few sold legs feed the board's empty state — proof the board
// moves even when nothing is listed right now. Same degrade-to-empty
// posture as the live query: a DB blip must not 500 a marketing page.
async function getRecentlySold(): Promise<SoldLegView[]> {
  let rows;
  try {
    rows = await db
      .select({
        id: emptyLegs.id,
        code: emptyLegs.code,
        category: emptyLegs.category,
        fromIata: emptyLegs.fromIata,
        fromIcao: emptyLegs.fromIcao,
        fromCity: emptyLegs.fromCity,
        toIata: emptyLegs.toIata,
        toIcao: emptyLegs.toIcao,
        toCity: emptyLegs.toCity,
        priceNow: emptyLegs.listedPriceUsd,
        discountPct: emptyLegs.discountPct,
        soldAt: emptyLegs.soldAt,
        boardGoLiveAt: emptyLegs.boardGoLiveAt,
        createdAt: emptyLegs.createdAt,
      })
      .from(emptyLegs)
      .where(eq(emptyLegs.status, "sold"))
      .orderBy(desc(emptyLegs.soldAt))
      .limit(3);
  } catch (err) {
    console.error("[empty-legs] recently-sold query failed", err);
    return [];
  }

  const now = Date.now();
  const out: SoldLegView[] = [];
  for (const r of rows) {
    if (!r.soldAt) continue;
    const soldAt = r.soldAt instanceof Date ? r.soldAt : new Date(r.soldAt);
    const listedAtRaw = r.boardGoLiveAt ?? r.createdAt;
    const listedAt = listedAtRaw instanceof Date ? listedAtRaw : new Date(listedAtRaw);
    out.push({
      id: r.id,
      code: r.code,
      category: (MARKETING_CATEGORIES[r.category] ?? "midsize") as SoldLegView["category"],
      fromIata: r.fromIata ?? r.fromIcao ?? "—",
      fromCity: r.fromCity ?? "—",
      toIata: r.toIata ?? r.toIcao ?? "—",
      toCity: r.toCity ?? "—",
      priceNow: r.priceNow ?? 0,
      discountPct: r.discountPct ?? 0,
      timeToSale: `sold in ${formatSpanShort(soldAt.getTime() - listedAt.getTime())}`,
      soldAgo: `${formatSpanShort(now - soldAt.getTime())} ago`,
    });
  }
  return out;
}

function liveStats(legs: EmptyLegView[]) {
  const sorted = [...legs].sort((a, b) => a.hoursOut - b.hoursOut);
  const next = sorted[0];
  const farthest = sorted[sorted.length - 1];
  const best = legs.reduce((acc, l) => (l.discountPct > acc ? l.discountPct : acc), 0);
  return {
    count: legs.length,
    nextHoursOut: next
      ? next.hoursOut < 1
        ? "under an hour"
        : `in ${Math.round(next.hoursOut)} h`
      : "—",
    farthestDays: farthest ? `${Math.max(1, Math.round(farthest.hoursOut / 24))} days out` : "—",
    bestDiscount: best ? `${best}% off` : "—",
  };
}

// On-page FAQ + FAQPage schema. Questions mirror what people actually
// search around empty legs; answers keep the site's claims (up to 60%
// off, 15-minute refresh) so no page contradicts another.
const EMPTY_LEG_FAQ: { q: string; a: string }[] = [
  {
    q: "What is an empty leg flight?",
    a: "A positioning flight. An aircraft dropped a charter passenger somewhere and has to fly home — or to its next pickup — empty. That flight is for sale at a steep discount because the operator flies it either way. Same aircraft, same crew, same service; the only difference is the price and that the schedule is fixed.",
  },
  {
    q: "How much cheaper is an empty leg than a normal charter?",
    a: "Typically 30–60% off the equivalent on-demand charter price on our board, and occasionally deeper when departure is close. Some legs price below the equivalent first-class commercial fare for the same route.",
  },
  {
    q: "Do I get the entire aircraft?",
    a: "Yes. An empty leg is the whole cabin, not a seat. Bring your party up to the listed seat count — the price is per aircraft, not per person.",
  },
  {
    q: "Can I change the departure time or route?",
    a: "No — that's the trade. Empty legs are date- and route-locked because the aircraft is already scheduled to fly that route. Departure typically holds within an hour of the listed time. If you need flexibility, a regular on-demand quote is the right tool.",
  },
  {
    q: "What happens if the empty leg cancels?",
    a: "If the outbound charter that created the leg falls through, the leg falls through with it. Your payment is refunded in full and you receive a credit toward a regular charter. We recommend a backup plan for anything time-critical.",
  },
  {
    q: "How do the text alerts work?",
    a: "Set a watchlist with your city pair and date window. We match it against the live board every fifteen minutes and text you the moment a leg fits — one text per match, no marketing blasts, cancel any time.",
  },
];

// "Is an empty leg right for your trip?" — the prototype's comparison,
// written to the site's real terms (fixed route, refund on cancel).
const COMPARE: [string, string, string][] = [
  ["Route & timing", "Fixed — the aircraft is already flying it", "Built around your itinerary"],
  ["Availability", "Surfaces at short notice, first call wins", "Sourced for your trip"],
  ["Changes or cancellation", "Cancels if the trip behind it cancels — full refund", "Set by your charter agreement"],
  ["Price", "Typically 30–60% below on-demand", "Quoted for your exact trip"],
  ["Return flight", "Arranged separately", "Can be included in the request"],
];

const CONFIRM = [
  "Exact airports, date and departure window",
  "Operating carrier, aircraft and actual cabin",
  "Complete price, currency, taxes and extras",
  "Cancellation, refund and replacement terms",
  "Baggage, pets and separate return travel",
];

const SOURCES = [
  {
    title: "FAA · Operator verification",
    body: "Check the carrier and aircraft authorization.",
    link: "Read FAA guidance",
    url: "https://www.faa.gov/about/initiatives/safecharteroperations/thinking-chartering-aircraft",
  },
  {
    title: "NBAA · Compare proposals",
    body: "Ask about the complete price and written terms.",
    link: "Open quote checklist",
    url: "https://nbaa.org/flight-department-administration/aircraft-operating-ownership-options/aircraft-charter/",
  },
  {
    title: "DOT / eCFR · Broker roles",
    body: "Understand the broker and operating carrier.",
    link: "Read Part 295",
    url: "https://www.ecfr.gov/current/title-14/chapter-II/subchapter-A/part-295",
  },
];

const WATCHLIST_POINTS = [
  "Matched against the live board every 15 minutes",
  "One text per match — never a marketing blast",
  "No fees, no account required, cancel with one reply",
];

const DOC_ICON = "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6";
const BRONZE =
  "btn border-gold bg-gold font-bold text-white hover:border-gold hover:bg-gold hover:text-white hover:opacity-90";

export default async function EmptyLegsPage() {
  const [legs, recentlySold] = await Promise.all([getLiveLegs(), getRecentlySold()]);
  const s = liveStats(legs);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: EMPTY_LEG_FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      {/* ─── Hero: paper scrim over the photo (Light - Empty legs) ─── */}
      <section className="relative overflow-hidden">
        <Image
          src="/images/light/page-21-hero.webp"
          alt=""
          aria-hidden
          fill
          priority
          sizes="100vw"
          className="object-cover"
          style={{ objectPosition: "70% 50%" }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg,rgba(247,245,240,.98) 0%,rgba(247,245,240,.95) 46%,rgba(247,245,240,.35) 66%,rgba(247,245,240,0) 100%)",
          }}
        />
        {/* Phones: the scrim's clear end sits under the text, so add a flat wash. */}
        <div aria-hidden className="absolute inset-0 bg-[rgba(247,245,240,.78)] md:hidden" />
        <div className="container-jn relative pb-[26px] pt-4">
          <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Empty legs" }]} />
          <h1 className="mt-[14px] font-serif text-[clamp(34px,9vw,52px)] font-normal leading-[1.04] tracking-[-0.01em]">
            Empty Leg Private Jet Flights
          </h1>
          <p className="mt-[6px] font-serif text-[26px] leading-[1.2]">
            {s.count > 0
              ? `${s.count} empty leg${s.count === 1 ? "" : "s"}, live now.`
              : "Up to 60% off. A different way to fly."}
          </p>
          <p className="mt-[10px] max-w-[50ch] text-[16px]">
            When an aircraft has dropped a passenger somewhere and needs to fly home empty, that
            flight is for sale. Date-locked, route-locked, but priced like nothing else in the air.
            The desk posts them as operators release them.
          </p>
          {s.count > 0 ? (
            <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
              {[
                ["Next departs", s.nextHoursOut],
                ["Furthest", s.farthestDays],
                ["Best discount", s.bestDiscount],
              ].map(([lbl, val]) => (
                <div key={lbl} className="flex gap-2">
                  <dt className="text-steel">{lbl}</dt>
                  <dd className="font-semibold">{val}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <a href="#listings" className={`${BRONZE} h-[42px] px-5 text-[14px]`}>
              See the live board <span aria-hidden="true">↓</span>
            </a>
            <a
              href="#watchlist"
              className="btn h-[42px] border-bone bg-[rgba(255,255,255,.7)] px-5 text-[14px] font-bold text-bone hover:bg-white"
            >
              Create a route alert
            </a>
          </div>
          <p className="mt-[10px] text-right text-[12px] text-white [text-shadow:0_1px_2px_rgba(0,0,0,.5)] max-md:hidden">
            Illustrative imagery
          </p>
        </div>
      </section>

      <div className="container-jn mt-[14px]">
        <div className="flex items-center gap-3 bg-surface-2 px-4 py-[10px] text-[13px]">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.6" aria-hidden="true" className="h-[18px] w-[18px] flex-none">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 8h.01" strokeLinecap="round" />
          </svg>
          Empty legs cancel if the trip behind them cancels. Your payment is refunded in full, but
          keep a backup plan for anything time-critical.
        </div>
      </div>

      <div className="container-jn flex flex-wrap items-start gap-[22px] pt-5">
        <div className="min-w-0 flex-[999_1_420px]">
          <LegsBoard legs={legs} recentlySold={recentlySold} />
        </div>

        <aside className="flex min-w-0 max-w-full flex-[1_1_300px] flex-col gap-3">
          {/* scroll-mt clears the sticky header when the board's CTAs jump
              here via the #watchlist anchor. */}
          <div id="watchlist" className="scroll-mt-24 border border-line bg-white p-4">
            <h2 className="font-serif text-[21px] leading-[1.2]">Let the right route find you.</h2>
            <p className="mb-[10px] mt-[2px] text-[12px] text-steel">
              Tell us the city pair and date window. We&rsquo;ll text the moment something fits.
            </p>
            <ul className="mb-3 flex flex-col gap-1 text-[12px] text-steel">
              {WATCHLIST_POINTS.map((b) => (
                <li key={b} className="grid grid-cols-[auto_1fr] gap-2">
                  <span aria-hidden="true" className="text-gold">✓</span>
                  {b}
                </li>
              ))}
            </ul>
            <WatchlistForm />
          </div>
          <div className="on-navy bg-navy p-4">
            <h2 className="font-serif text-[21px] leading-[1.2]">Your timing is essential?</h2>
            <p className="mt-1 text-[13px] text-navy-on-2">
              Compare an on-demand charter built around your itinerary.
            </p>
            <Link
              href="/quote/mission"
              className="btn mt-3 h-[38px] w-full border-white bg-transparent text-[13px] font-bold text-white hover:bg-[rgba(255,255,255,0.08)] hover:text-white"
            >
              Request an on-demand quote →
            </Link>
            <div className="mt-[10px] flex flex-col">
              {[
                ["Compare aircraft", "/aircraft"],
                ["Explore routes", "/routes"],
                ["Charter cost guide", "/guides/private-jet-charter-cost"],
              ].map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  className="flex justify-between border-t border-[rgba(255,255,255,.2)] py-2 text-[13px] text-white hover:text-navy-on-2"
                >
                  <span>{label}</span>
                  <span aria-hidden="true">→</span>
                </Link>
              ))}
              <a
                href={`tel:${SITE.dispatchPhoneE164}`}
                className="flex justify-between border-t border-[rgba(255,255,255,.2)] py-2 text-[13px] text-white hover:text-navy-on-2"
              >
                <span>Call dispatch · {SITE.dispatchPhone}</span>
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        </aside>
      </div>

      {/* ─── Compare ─── */}
      <section className="container-jn pt-7">
        <h2 className="font-serif text-[32px] leading-[1.1]">Is an empty leg right for your trip?</h2>
        <div className="mt-3 border border-line bg-white text-[13px]" role="table" aria-label="Empty leg compared with on-demand charter">
          <div role="row" className="grid bg-surface-2 px-4 py-2 font-bold [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
            <span role="columnheader">Planning question</span>
            <span role="columnheader">Empty leg</span>
            <span role="columnheader">On-demand charter</span>
          </div>
          {COMPARE.map(([q, e, o]) => (
            <div key={q} role="row" className="grid border-t border-surface-2 px-4 py-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))]">
              <span role="cell">{q}</span>
              <span role="cell" className="text-steel">{e}</span>
              <span role="cell" className="text-steel">{o}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Confirm five things ─── */}
      <section className="container-jn grid items-stretch gap-6 pt-[26px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        <div>
          <h2 className="font-serif text-[30px] leading-[1.1]">Before you accept, confirm these five things.</h2>
          <ol className="mt-3 flex flex-col">
            {CONFIRM.map((t, i) => (
              <li key={t} className="grid grid-cols-[40px_minmax(0,1fr)] items-center gap-4 border-b border-surface-2 py-[7px] text-[14px]">
                <span className="flex h-6 items-center justify-center rounded-full bg-surface-2 text-[13px]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="relative min-h-[220px] overflow-hidden bg-surface-2">
          <Image
            src="/images/light/jet-over-golden-clouds.webp"
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 600px"
            className="object-cover"
          />
          <div className="absolute bottom-3 right-3">
            <ChecklistWindow items={CONFIRM} />
          </div>
        </div>
      </section>

      {/* ─── Sources ─── */}
      <section className="container-jn pt-[26px]">
        <h2 className="font-serif text-[30px] leading-[1.1]">Independent guidance for a clearer decision.</h2>
        <div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
          {SOURCES.map((src) => (
            <div key={src.title} className="grid grid-cols-[52px_minmax(0,1fr)] gap-[14px] border border-line bg-white p-4">
              <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-surface-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-6 w-6">
                  <path d={DOC_ICON} />
                </svg>
              </span>
              <div>
                <h3 className="font-serif text-[17px] font-normal">{src.title}</h3>
                <p className="mb-2 mt-[2px] text-[12px] leading-[1.5] text-steel">{src.body}</p>
                <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-link text-[12px]">
                  {src.link} <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-steel">Independent references. No endorsement implied.</p>
      </section>

      {/* ─── FAQ ─── */}
      <section className="container-jn pb-[26px] pt-[22px]">
        <script
          type="application/ld+json"
          // Build-time stringified site copy — not user-controlled.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
        <h2 className="font-serif text-[30px] leading-[1.1]">Empty-leg questions, answered.</h2>
        <div className="mt-3 border border-line bg-white">
          {EMPTY_LEG_FAQ.map((f, i) => (
            <details key={f.q} open={i === 0} className="group border-b border-surface-2 last:border-b-0">
              <summary className="grid cursor-pointer list-none grid-cols-[22px_minmax(0,1fr)] items-center gap-[14px] px-4 py-[10px] [&::-webkit-details-marker]:hidden">
                <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-gold text-[14px] leading-none text-gold">
                  <span className="group-open:hidden">+</span>
                  <span className="hidden group-open:inline">−</span>
                </span>
                <h3 className="font-sans text-[14px] font-bold">{f.q}</h3>
              </summary>
              <p className="pb-3 pl-[52px] pr-4 text-[14px] leading-[1.55] text-steel">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ─── Closing band: paper scrim over the landscape ─── */}
      <section className="relative overflow-hidden bg-surface-2">
        <Image
          src="/images/light/mountain-landscape.webp"
          alt=""
          aria-hidden
          fill
          sizes="100vw"
          className="object-cover opacity-75"
          style={{ objectPosition: "center 60%" }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg,rgba(247,245,240,.96) 0%,rgba(247,245,240,.9) 48%,rgba(247,245,240,.2) 100%)",
          }}
        />
        <div className="container-jn relative flex flex-wrap items-center gap-6 py-[22px]">
          <div>
            <h2 className="font-serif text-[28px] leading-[1.1]">Tell us where you could go.</h2>
            <p className="mt-1 text-[14px]">
              See one you want? Call {SITE.dispatchPhone} and we lock it. First call wins.
            </p>
          </div>
          <a href="#watchlist" className={`${BRONZE} h-[42px] px-5 text-[14px]`}>
            Create a route alert →
          </a>
        </div>
      </section>
    </>
  );
}
