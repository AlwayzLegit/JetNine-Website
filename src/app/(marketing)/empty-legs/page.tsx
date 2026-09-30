import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { PageHero } from "@/components/page-hero";
import { CtaBand } from "@/components/cta-band";
import { LegsBoard, type BoardLeg, type BoardRegion } from "@/components/empty-legs/legs-board";
import { WatchlistForm } from "@/components/empty-legs/watchlist-form";
import { emptyLegs } from "@/db/schema/empty-legs";
import { operators } from "@/db/schema/operators";
import { aircraft } from "@/db/schema/aircraft";
import { airports } from "@/db/schema/airports";
import { findAirport } from "@/lib/airports";
import type { EmptyLegView, SoldLegView } from "@/lib/empty-legs";

// ISR, not force-dynamic: force-dynamic overrode the revalidate window and
// also made Next skip the font preloads for this page.
export const revalidate = 60; // refresh every minute

export const metadata: Metadata = pageMetadata({
  title: "Empty Leg Flights — Private Jets Up to 60% Off",
  description:
    "Repositioning legs at up to 60% off. Posted by the desk as operators release them, with SMS alerts on your lanes.",
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

const HOW_IT_WORKS = [
  {
    k: "Dates & route locked",
    h: "Take it as scheduled.",
    p: "Empty legs are positioning flights — the aircraft is already going there, with or without you. Departure window typically holds within an hour of the listed time. The route is the route; no diversion to a different city.",
  },
  {
    k: "Cancel risk",
    h: "If the original trip falls through, so does yours.",
    p: "The reason the leg exists is that an outbound charter is bringing the aircraft to that city. If that outbound cancels, the empty leg cancels too. Your payment is fully refunded and you get a credit toward a regular charter, but you'll need a backup plan.",
  },
  {
    k: "First call wins",
    h: "One booking per leg.",
    p: "Empty legs aren't held — they're sold the moment a confirmation comes through. If you see one you want, call the dispatch line and we'll lock it on the spot. No soft-hold, no waitlist.",
  },
];

const WATCHLIST_POINTS = [
  "Matched against the live board every 15 minutes",
  "One text per match — never a marketing blast",
  "First-call advantage: the text lands the moment the leg lists",
  "No fees, no account required, cancel with one reply",
];

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
      {/* Live count in the H1 — the "Search 4,792 Empty Leg Flights"
          credibility device from the page that ranks #1 for this query.
          Server-rendered on every visit, so the number is real and
          crawlable. Falls back to the evergreen headline when the board
          is empty. */}
      <PageHero
        eyebrow="Empty legs · live board"
        title={
          s.count > 0
            ? `${s.count} empty leg${s.count === 1 ? "" : "s"}, live now.`
            : "Empty leg flights. Up to 60% off."
        }
      >
        <div className="mt-5 grid items-end gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
          <p className="lead max-w-[58ch]">
            When an aircraft has dropped a passenger somewhere and needs to fly home empty, that
            flight is for sale. Date-locked, route-locked, but priced like nothing else in the air.
            The desk posts them as operators release them.
          </p>

          <div className="card card-pad">
            <div className="flex items-center gap-2.5 text-[14px] text-bone-2">
              <span className="dot dot-success" aria-hidden="true" />
              Live board · refreshed every minute
            </div>
            <div
              className="mt-3 font-serif text-[80px] font-light leading-none text-bone max-md:text-[64px]"
              style={{ fontVariationSettings: '"opsz" 144', letterSpacing: "-0.02em" }}
            >
              {s.count}
            </div>
            <p className="mt-3 text-[15px] text-bone-2">
              Available repositioning legs across the network. Some priced at less than the
              equivalent first-class commercial fare.
            </p>
            <dl className="mt-[18px] grid grid-cols-3 gap-3 border-t border-line pt-4 text-[15px] text-bone">
              {[
                ["Next departs", s.nextHoursOut],
                ["Furthest", s.farthestDays],
                ["Best discount", s.bestDiscount],
              ].map(([lbl, val]) => (
                <div key={lbl}>
                  <dt className="text-[13px] text-steel">{lbl}</dt>
                  <dd>{val}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </PageHero>

      <LegsBoard legs={legs} recentlySold={recentlySold} />

      {/* ─── How it works ─── */}
      <section className="section-jn">
        <div className="container-jn">
          <p className="eyebrow">How it works</p>
          <h2 className="title-section max-w-[22ch]">Repositioning legs are the deal of the year.</h2>
          <p className="mt-4 max-w-[62ch] text-[18px] text-bone-2">
            If your dates and route are flexible, you can fly the same aircraft at a fraction of the
            on-demand charter price. Three things to know before you book.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {HOW_IT_WORKS.map((c) => (
              <div key={c.k} className="card card-pad">
                <p className="text-[13px] font-semibold text-gold">{c.k}</p>
                <h3 className="title-card-sm mt-3 !text-[22px]">{c.h}</h3>
                <p className="mt-2.5 text-bone-2">{c.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Watchlist ─── */}
      {/* scroll-mt clears the sticky header when the board's empty-state
          CTA jumps here via the #watchlist anchor. */}
      <section id="watchlist" className="section-jn scroll-mt-24">
        <div className="container-jn grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div>
            <p className="eyebrow">Watchlist</p>
            <h2 className="title-section">Set a route. We&rsquo;ll text when one shows up.</h2>
            <p className="mt-4 text-[18px] text-bone-2">
              If the lanes you fly are predictable, this is the simplest way to get the discount.
              Tell us the city pair and date window, we&rsquo;ll match against the live board every
              fifteen minutes, and text the moment something fits. No spam, only matches.
            </p>
            {/* No competitor offers route alerts at all — spell the
                mechanics out as scannable proof, not just prose. */}
            <ul className="mt-5 flex flex-col gap-2.5 text-[15px] text-bone-2">
              {WATCHLIST_POINTS.map((b) => (
                <li key={b} className="grid grid-cols-[auto_1fr] gap-2.5">
                  <span aria-hidden="true" className="text-clearance">✓</span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-8 max-md:p-5">
            <WatchlistForm />
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="section-jn">
        <script
          type="application/ld+json"
          // Build-time stringified site copy — not user-controlled.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
        <div className="container-jn">
          <p className="eyebrow">Before you book</p>
          <h2 className="title-section max-w-[24ch]">Empty legs, answered straight.</h2>
          <div className="mt-8 grid grid-cols-1 gap-x-10 gap-y-4 md:grid-cols-2">
            {EMPTY_LEG_FAQ.map((f) => (
              <div key={f.q} className="border-t border-line pt-[18px]">
                <h3 className="text-[19px] font-medium leading-[1.3] text-bone">{f.q}</h3>
                <p className="mt-2 text-bone-2">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBand
        title="See one you want? Call and we lock it."
        body="Empty legs sell the moment a confirmation comes through. The desk picks up in under twenty seconds, every hour of every day."
      />
    </>
  );
}
