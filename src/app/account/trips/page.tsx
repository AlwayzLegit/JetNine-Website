import Link from "next/link";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { aircraft } from "@/db/schema/aircraft";
import { trips, tripLegs } from "@/db/schema/trips";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { getMemberByUserId } from "@/lib/member";
import { USD, formatDay } from "@/lib/request-page";
import { SITE } from "@/lib/constants";
import {
  BTN_LINE,
  BTN_NAVY_LINE,
  BTN_PRIMARY,
  EmptyPanel,
  Eyebrow,
  PANEL,
  PageHead,
  SectionTitle,
  TILE,
  UnderLink,
} from "@/components/account/panel";
import { dotClass, todayISO } from "@/components/account/quotes-status";
import { MISSION_WORDS, isUpcoming, nextLeg, routeWords, tripStatusWords } from "@/components/account/trips-status";

export const dynamic = "force-dynamic";

export default async function AccountTripsPage() {
  await requireUser("/account/trips");
  const user = await getCurrentUser();
  if (!user) return null;

  const member = await getMemberByUserId(user.id);

  if (!member) {
    return (
      <>
        <PageHead title="Trips" sub="Past, upcoming and in the air — all in one place." />
        <EmptyPanel
          title="No trips on file yet."
          action={
            <Link href="/quote/mission" className={BTN_PRIMARY}>
              Request a quote <span aria-hidden="true">→</span>
            </Link>
          }
        >
          You&rsquo;re signed in, but dispatch hasn&rsquo;t set up your member profile yet. That happens
          when you book your first flight — until then, start with a quote.
        </EmptyPanel>
      </>
    );
  }

  const rows = await db
    .select({
      id: trips.id,
      tripCode: trips.tripCode,
      status: trips.status,
      paxCount: trips.paxCount,
      missionType: trips.missionType,
      revenueUsd: trips.revenueUsd,
      createdAt: trips.createdAt,
      aircraft: aircraft.makeModel,
    })
    .from(trips)
    .leftJoin(aircraft, eq(aircraft.id, trips.aircraftId))
    .where(eq(trips.memberId, member.id))
    .orderBy(desc(trips.createdAt))
    .limit(50);

  const ids = rows.map((r) => r.id);
  const legs = ids.length
    ? await db
        .select({
          tripId: tripLegs.tripId,
          legNumber: tripLegs.legNumber,
          fromIata: tripLegs.fromIata,
          toIata: tripLegs.toIata,
          fromCity: tripLegs.fromCity,
          toCity: tripLegs.toCity,
          departDate: tripLegs.departDate,
        })
        .from(tripLegs)
        .where(inArray(tripLegs.tripId, ids))
        .orderBy(asc(tripLegs.legNumber))
    : [];
  const legsByTrip = new Map<string, typeof legs>();
  for (const l of legs) {
    const arr = legsByTrip.get(l.tripId) ?? [];
    arr.push(l);
    legsByTrip.set(l.tripId, arr);
  }
  const legsOf = (id: string) => legsByTrip.get(id) ?? [];

  const today = todayISO();
  const upcoming = rows
    .filter((t) => isUpcoming(t.status, legsOf(t.id), today))
    .sort((a, b) =>
      (nextLeg(legsOf(a.id), today)?.departDate ?? "9999").localeCompare(
        nextLeg(legsOf(b.id), today)?.departDate ?? "9999",
      ),
    );
  const upcomingIds = new Set(upcoming.map((t) => t.id));
  const past = rows
    .filter((t) => !upcomingIds.has(t.id))
    .sort((a, b) => (legsOf(b.id)[0]?.departDate ?? "").localeCompare(legsOf(a.id)[0]?.departDate ?? ""));

  const summary =
    rows.length === 0
      ? "Nothing booked yet."
      : upcoming.length === 0
        ? "Nothing coming up — your past flights are below."
        : `${upcoming.length === 1 ? "One trip" : `${upcoming.length} trips`} coming up.`;

  const lead = upcoming[0] ?? null;
  const restUpcoming = upcoming.slice(1);

  return (
    <>
      <PageHead title="Trips" sub={`${summary} Everything you need on the day is under each trip.`} />

      {rows.length === 0 ? (
        <EmptyPanel
          title="No trips yet."
          action={
            <Link href="/quote/mission" className={BTN_PRIMARY}>
              Request a quote <span aria-hidden="true">→</span>
            </Link>
          }
        >
          Send a quote request and pick one of the options dispatch sends back — the trip shows up here the
          moment it&rsquo;s booked.
        </EmptyPanel>
      ) : (
        <>
          {lead ? (
            <LeadTrip trip={lead} legs={legsOf(lead.id)} today={today} />
          ) : (
            <EmptyPanel
              title="Nothing coming up."
              action={
                <Link href="/quote/mission" className={BTN_PRIMARY}>
                  Request a quote <span aria-hidden="true">→</span>
                </Link>
              }
            >
              Your next flight shows up here with the time, the aircraft and where to go.
            </EmptyPanel>
          )}

          {restUpcoming.length > 0 ? (
            <>
              <SectionTitle className="mt-6">Also coming up</SectionTitle>
              <TripList rows={restUpcoming} legsOf={legsOf} today={today} />
            </>
          ) : null}

          <SectionTitle className="mt-6">Past flights</SectionTitle>
          {past.length === 0 ? (
            <EmptyPanel className="mt-2.5">No past trips yet.</EmptyPanel>
          ) : (
            <TripList rows={past} legsOf={legsOf} today={today} past />
          )}
        </>
      )}
    </>
  );
}

type Row = {
  id: string;
  tripCode: string;
  status: string;
  paxCount: number;
  missionType: string;
  revenueUsd: number | null;
  aircraft: string | null;
};
type Leg = { fromIata: string | null; toIata: string | null; fromCity: string | null; toCity: string | null; departDate: string | null };

const shortDay = (d: string | null | undefined) => formatDay(d)?.replace(/^\w+, /, "") ?? null;

/** The next trip as the bronze-bordered panel with fact tiles (Light - Account "Trips"). */
function LeadTrip({ trip, legs, today }: { trip: Row; legs: Leg[]; today: string }) {
  const next = nextLeg(legs, today) ?? legs[0];
  const status = tripStatusWords(trip.status);
  const facts: [string, React.ReactNode][] = [
    ["Departs", formatDay(next?.departDate) ?? "Date to be confirmed"],
    [
      legs.length > 1 ? "Legs" : "Route",
      legs.length > 1
        ? legs
            .map((l) => `${l.fromCity ?? l.fromIata ?? "—"} → ${l.toCity ?? l.toIata ?? "—"} · ${shortDay(l.departDate) ?? "date tbc"}`)
            .join("; ")
        : routeWords(legs),
    ],
    ["Aircraft", trip.aircraft ?? "Being finalised — dispatch confirms it before you fly"],
    ["Passengers", `${trip.paxCount}${MISSION_WORDS[trip.missionType] ? ` · ${MISSION_WORDS[trip.missionType]}` : ""}`],
    [
      "Status",
      <span key="s" className="flex items-center gap-2">
        <span className={dotClass(status.tone)} aria-hidden="true" />
        {status.text}
      </span>,
    ],
    ["Price", trip.revenueUsd != null ? `${USD.format(trip.revenueUsd)} total · invoice under Invoices` : "Confirmed with your booking"],
  ];
  return (
    <section className={`${PANEL} mt-[22px] !border-gold px-6 py-[22px] max-md:px-5`}>
      <Eyebrow>Upcoming{next?.departDate ? ` · ${formatDay(next.departDate)}` : ""}</Eyebrow>
      <h2 className="mt-2 font-serif text-[clamp(26px,5vw,30px)] font-normal leading-[1.1] text-bone">{routeWords(legs)}</h2>
      <dl className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-4">
        {facts.map(([k, v]) => (
          <div key={k} className={`${TILE} px-3.5 py-3`}>
            <dt className="text-[12px] text-steel">{k}</dt>
            <dd className="mt-0.5 text-[14px] leading-[1.45] text-bone">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-[18px] flex flex-wrap gap-2.5">
        <Link href={`/account/trips/${trip.id}`} className={BTN_NAVY_LINE}>
          Trip details and where to go
        </Link>
        <a
          href={`mailto:${SITE.email}?subject=${encodeURIComponent(`${trip.tripCode} — passenger names`)}`}
          className={BTN_LINE}
        >
          Add passenger names
        </a>
      </div>
      <p className="mt-3 text-[12px] text-steel">
        Names and ID details are shared only with the operating carrier. Changes close to departure: call dispatch.
      </p>
    </section>
  );
}

function TripList({
  rows,
  legsOf,
  today,
  past = false,
}: {
  rows: Row[];
  legsOf: (id: string) => Leg[];
  today: string;
  past?: boolean;
}) {
  return (
    <ul className={`${PANEL} mt-2.5`}>
      {rows.map((t) => {
        const legs = legsOf(t.id);
        const date = shortDay(nextLeg(legs, today)?.departDate ?? legs[0]?.departDate);
        const status = tripStatusWords(t.status);
        const meta = [date, t.aircraft, `${t.paxCount} passenger${t.paxCount === 1 ? "" : "s"}`].filter(Boolean).join(" · ");
        return (
          <li
            key={t.id}
            className="flex flex-wrap items-center gap-x-6 gap-y-1.5 border-t border-line px-[18px] py-3 text-[14px] first:border-t-0"
          >
            <div className="min-w-0 flex-[999_1_240px]">
              <Link href={`/account/trips/${t.id}`} className="font-serif text-[17px] text-bone transition-colors hover:text-gold">
                {routeWords(legs)}
              </Link>
              {meta ? <span className="text-steel"> · {meta}</span> : null}
              {!past || t.status !== "completed" ? (
                <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-bone-2">
                  <span className={dotClass(status.tone)} aria-hidden="true" />
                  {status.text}
                </span>
              ) : null}
            </div>
            {t.revenueUsd != null ? <span className="flex-none text-bone">{USD.format(t.revenueUsd)}</span> : null}
            <UnderLink href={`/account/trips/${t.id}`} className="flex-none">
              Details
            </UnderLink>
            {past ? (
              <UnderLink href="/quote/mission" className="flex-none">
                Book again
              </UnderLink>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
