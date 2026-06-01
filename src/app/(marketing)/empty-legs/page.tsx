import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { Reveal } from "@/components/reveal";
import { LegsBoard } from "@/components/empty-legs/legs-board";
import { WatchlistForm } from "@/components/empty-legs/watchlist-form";
import { emptyLegs } from "@/db/schema/empty-legs";
import { operators } from "@/db/schema/operators";
import { aircraft } from "@/db/schema/aircraft";
import type { EmptyLegView } from "@/lib/empty-legs";

export const dynamic = "force-dynamic";
export const revalidate = 60; // refresh every minute

export const metadata: Metadata = pageMetadata({
  title: "Empty legs",
  description:
    "Repositioning legs at up to 60% off. Live board, updated every fifteen minutes from operator dispatch.",
  path: "/empty-legs",
  image: "/images/programs/reposition-sector.webp",
  imageAlt: "JetNine empty legs — repositioning flight-path arcs over coastline",
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

export default async function EmptyLegsPage() {
  const legs = await getLiveLegs();
  const s = liveStats(legs);

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
            <Reveal as="h1" stagger={1} className="display-xl max-w-[14ch]">
              Repositioning legs. Up to 60% off.
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
              Live · last update 4 min ago
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

      <LegsBoard legs={legs} />

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

      {/* ─── Watchlist form ─── */}
      <section className="border-t border-ink-3 bg-ink-2 py-32 max-md:py-20">
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
          </div>
          <Reveal stagger={1} className="mx-auto max-w-[820px] rounded-[4px] border border-ink-3 bg-ink p-8 sm:p-10">
            <WatchlistForm />
          </Reveal>
        </div>
      </section>
    </>
  );
}
