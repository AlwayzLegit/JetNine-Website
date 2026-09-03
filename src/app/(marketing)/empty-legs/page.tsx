import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { Reveal } from "@/components/reveal";
import { LegsBoard } from "@/components/empty-legs/legs-board";
import { WatchlistForm } from "@/components/empty-legs/watchlist-form";
import { emptyLegs } from "@/db/schema/empty-legs";
import { operators } from "@/db/schema/operators";
import { aircraft } from "@/db/schema/aircraft";
import type { EmptyLegView, SoldLegView } from "@/lib/empty-legs";

// ISR, not force-dynamic: force-dynamic overrode the revalidate window and
// also made Next skip the font preloads for this page.
export const revalidate = 60; // refresh every minute

export const metadata: Metadata = pageMetadata({
  title: "Empty Leg Flights — Private Jets Up to 60% Off",
  description:
    "Repositioning legs at up to 60% off. Live board, updated every fifteen minutes from operator dispatch.",
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

function formatDate(d: Date): string {
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const dayName = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const dayNum = d.getDate();
  const month = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  if (sameDay) return `TODAY · ${time}`;
  if (isTomorrow) return `TOMORROW · ${time}`;
  return `${dayName} ${dayNum} ${month} · ${time}`;
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

async function getLiveLegs(): Promise<EmptyLegView[]> {
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
  const out: EmptyLegView[] = [];
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
        date: formatDate(wheelsUp),
        isoDate: wheelsUp.toISOString().slice(0, 10),
        duration: formatDuration(r.flightMinutes),
        seats: r.seats,
        priceWas,
        priceNow,
        discountPct,
        hoursOut,
        operatorBadge,
        featured: discountPct >= 60,
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
    })
    .from(emptyLegs)
    .leftJoin(aircraft, eq(aircraft.id, emptyLegs.aircraftId))
    .innerJoin(operators, eq(operators.id, emptyLegs.operatorId))
    .where(eq(emptyLegs.status, "live"))
    .orderBy(asc(emptyLegs.wheelsUpAt));
}

// Compact relative durations for the sold strip ("14h", "3 days").
function formatSpanShort(ms: number): string {
  const hours = Math.max(1, Math.round(ms / 3_600_000));
  if (hours < 48) return `${hours}h`;
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
    nextHoursOut: next ? `in ${Math.round(next.hoursOut)}h` : "—",
    farthestDays: farthest ? `${Math.round(farthest.hoursOut / 24)} days out` : "—",
    bestDiscount: best ? `${best}% off` : "—",
  };
}

// On-page FAQ + FAQPage schema. Questions mirror what people actually
// search around empty legs; answers keep the site's claims (up to 60%
// off, 15-minute refresh) so no page contradicts another.
const EMPTY_LEG_FAQ: { q: string; a: string }[] = [
  {
    q: "What is an empty leg flight?",
    a: "A positioning flight. An aircraft dropped a charter passenger somewhere and has to fly home — or to its next pickup — empty. That flight is for sale at a steep discount because the operator flies it either way. Same airframe, same crew, same service; the only difference is the price and that the schedule is fixed.",
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
    a: "No — that's the trade. Empty legs are date- and route-locked because the aircraft is already scheduled to fly that sector. Departure typically holds within an hour of the listed time. If you need flexibility, a regular on-demand quote is the right tool.",
  },
  {
    q: "What happens if the empty leg cancels?",
    a: "If the outbound charter that created the leg falls through, the leg falls through with it. Your payment is refunded in full and you receive a credit toward a regular charter. We recommend a backup plan for anything time-critical.",
  },
  {
    q: "How do the SMS alerts work?",
    a: "Set a watchlist with your city pair and date window. We match it against the live board every fifteen minutes and text you the moment a leg fits — one SMS per match, no marketing blasts, cancel any time.",
  },
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
      {/* ─── Page header w/ live card ─── */}
      <header className="border-b border-ink-3 bg-ink pt-[200px] pb-24 max-md:pt-[140px] max-md:pb-16">
        <div className="container-jn grid items-end gap-16 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <Reveal className="mb-6 inline-flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.16em] text-bone-2">
              <span className="block h-px w-8 bg-clearance" />
              Empty legs · live board
            </Reveal>
            {/* Live count in the H1 — the "Search 4,792 Empty Leg Flights"
                credibility device from the page that ranks #1 for this
                query. Server-rendered on every visit, so the number is
                real and crawlable. Falls back to the evergreen headline
                when the board is empty. */}
            <Reveal as="h1" stagger={1} className="display-xl max-w-[14ch]">
              {s.count > 0
                ? `${s.count} empty leg${s.count === 1 ? "" : "s"}, live now.`
                : "Empty leg flights. Up to 60% off."}
            </Reveal>
            <Reveal as="p" stagger={2} className="mt-8 max-w-[58ch] text-[18px] leading-[1.55] text-bone-2">
              When an aircraft has dropped a passenger somewhere and needs to fly home empty, that
              flight is for sale. Date-locked, route-locked, but priced like nothing else in the air.
              Updated every fifteen minutes from operator dispatch.
            </Reveal>
          </div>

          <Reveal stagger={2} className="rounded-[4px] border border-ink-3 bg-ink-2 p-8">
            <div className="mb-6 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inset-0 animate-ping rounded-full bg-clearance opacity-75" />
                <span className="relative h-2 w-2 rounded-full bg-clearance" />
              </span>
              Live board · refreshed on every visit
            </div>
            <div
              className="font-serif text-[88px] font-light leading-none tracking-tight text-bone"
              style={{ fontVariationSettings: '"opsz" 144' }}
            >
              {s.count}
            </div>
            <p className="mt-5 max-w-[34ch] text-[14px] leading-[1.55] text-bone-2">
              Available repositioning legs across the network. Some priced at less than the
              equivalent first-class commercial fare.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-4 border-t border-ink-3 pt-5 text-[11px]">
              {[
                ["Departing", s.nextHoursOut],
                ["Furthest", s.farthestDays],
                ["Best disc.", s.bestDiscount],
              ].map(([lbl, val]) => (
                <div key={lbl} className="flex flex-col gap-1">
                  <span className="font-mono uppercase tracking-[0.12em] text-steel">{lbl}</span>
                  <span className="font-mono tracking-[0.04em] text-bone">{val}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </header>

      <LegsBoard legs={legs} recentlySold={recentlySold} />

      {/* ─── How it works ─── */}
      <section className="border-t border-ink-3 py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-16 grid items-end gap-12 lg:grid-cols-[1fr_1.6fr]">
            <Reveal>
              <p className="caption">— How it works</p>
            </Reveal>
            <div>
              <Reveal as="h2" stagger={1} className="display-m max-w-[22ch]">
                Repositioning legs are the deal of the year.
              </Reveal>
              <Reveal as="p" stagger={2} className="mt-6 max-w-[62ch] text-[18px] leading-[1.55] text-bone-2">
                If your dates and route are flexible, you can fly the same airframe at a fraction of
                the on-demand charter price. Three things to know before you book.
              </Reveal>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                n: "01",
                k: "DATES & ROUTE LOCKED",
                h: "Take it as scheduled.",
                p: "Empty legs are positioning flights — the aircraft is already going there, with or without you. Departure window typically holds within an hour of the listed time. The route is the route; no diversion to a different city.",
              },
              {
                n: "02",
                k: "CANCEL RISK",
                h: "If the original trip falls through, so does yours.",
                p: "The reason the leg exists is that an outbound charter is bringing the aircraft to that city. If that outbound cancels, the empty leg cancels too. Your payment is fully refunded and you get a credit toward a regular charter, but you'll need a backup plan.",
              },
              {
                n: "03",
                k: "FIRST CALL WINS",
                h: "One booking per leg.",
                p: "Empty legs aren't held — they're sold the moment a confirmation comes through. The list updates every fifteen minutes; if you see one you want, call the dispatch line and we'll lock it on the spot. No soft-hold, no waitlist.",
              },
            ].map((c, i) => (
              <Reveal
                key={c.n}
                stagger={(i as 0 | 1 | 2)}
                className="rounded-[4px] border border-ink-3 bg-ink-2 p-10"
              >
                <div className="mb-6 flex items-baseline gap-4">
                  <span className="font-mono text-[42px] font-light leading-none text-clearance">
                    {c.n}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
                    — {c.k}
                  </span>
                </div>
                <h3 className="font-serif text-[22px] font-normal leading-[1.25] tracking-tight text-bone">
                  {c.h}
                </h3>
                <p className="mt-3 text-[15px] leading-[1.6] text-bone-2">{c.p}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="border-t border-ink-3 bg-ink py-32 max-md:py-20">
        <script
          type="application/ld+json"
          // Build-time stringified site copy — not user-controlled.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
        <div className="container-jn">
          <div className="mb-14">
            <Reveal>
              <p className="caption mb-6">— Before you book</p>
            </Reveal>
            <Reveal as="h2" stagger={1} className="display-m max-w-[24ch]">
              Empty legs, answered straight.
            </Reveal>
          </div>
          <div className="grid grid-cols-1 gap-x-12 gap-y-10 md:grid-cols-2">
            {EMPTY_LEG_FAQ.map((f) => (
              <Reveal key={f.q} className="border-t border-ink-3 pt-6">
                <h3 className="font-serif text-[19px] font-normal leading-[1.3] tracking-tight text-bone">
                  {f.q}
                </h3>
                <p className="mt-3 max-w-[62ch] text-[15px] leading-[1.6] text-bone-2">{f.a}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Watchlist form ─── */}
      {/* scroll-mt clears the fixed 80px header when the board's empty-state
          CTA jumps here via the #watchlist anchor. */}
      <section id="watchlist" className="scroll-mt-24 border-t border-ink-3 bg-ink-2 py-32 max-md:py-20">
        <div className="container-jn">
          <div className="mb-12">
            <Reveal>
              <p className="caption mb-6">— Watchlist</p>
            </Reveal>
            <Reveal as="h2" stagger={1} className="display-m max-w-[24ch]">
              Set a route. We&rsquo;ll text when one shows up.
            </Reveal>
            <Reveal as="p" stagger={2} className="mt-6 max-w-[68ch] text-[18px] leading-[1.55] text-bone-2">
              If the lanes you fly are predictable, this is the simplest way to get the discount.
              Tell us the city pair and date window, we&rsquo;ll match against the live board every
              fifteen minutes, and SMS the moment something fits. No spam, only matches.
            </Reveal>
            {/* No competitor offers route alerts at all — spell the
                mechanics out as scannable proof, not just prose. */}
            <Reveal stagger={2} as="ul" className="mt-8 grid max-w-[820px] grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                "Matched against the live board every 15 minutes",
                "One SMS per match — never a marketing blast",
                "First-call advantage: the text lands the moment the leg lists",
                "No fees, no account required, cancel with one reply",
              ].map((b) => (
                <li key={b} className="flex items-start gap-3 text-[14px] leading-[1.5] text-bone-2">
                  <span aria-hidden className="mt-[3px] font-mono text-[12px] text-clearance">✓</span>
                  {b}
                </li>
              ))}
            </Reveal>
          </div>
          <Reveal stagger={1} className="mx-auto max-w-[820px] rounded-[4px] border border-ink-3 bg-ink p-8 sm:p-10">
            <WatchlistForm />
          </Reveal>
        </div>
      </section>
    </>
  );
}
