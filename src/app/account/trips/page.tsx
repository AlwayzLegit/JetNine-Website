import Link from "next/link";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { aircraft } from "@/db/schema/aircraft";
import { trips, tripLegs } from "@/db/schema/trips";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { getMemberByUserId } from "@/lib/member";
import { USD, formatDay } from "@/lib/request-page";
import { SectionHead } from "@/components/account/overview-section";
import { dotClass, todayISO } from "@/components/account/quotes-status";
import { isUpcoming, nextLeg, routeWords, tripStatusWords } from "@/components/account/trips-status";

export const dynamic = "force-dynamic";

export default async function AccountTripsPage() {
  await requireUser("/account/trips");
  const user = await getCurrentUser();
  if (!user) return null;

  const member = await getMemberByUserId(user.id);

  if (!member) {
    return (
      <>
        <h1 className="title-app">Your trips</h1>
        <p className="mt-2.5 text-[17px] text-bone-2">Past, upcoming and in the air — all in one place.</p>
        <div className="card mt-8 p-7 max-md:p-5">
          <h2 className="title-card-sm text-bone">No trips on file yet.</h2>
          <p className="mt-2 max-w-[56ch] text-bone-2">
            You&rsquo;re signed in, but dispatch hasn&rsquo;t set up your member profile yet. That happens
            when you book your first flight — until then, start with a quote.
          </p>
          <Link href="/quote/mission" className="btn btn-primary mt-5">
            Request a quote <span aria-hidden="true">→</span>
          </Link>
        </div>
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

  return (
    <>
      <h1 className="title-app">Your trips</h1>
      <p className="mt-2.5 text-[17px] text-bone-2">{summary}</p>

      {rows.length === 0 ? (
        <div className="card mt-8 p-7 max-md:p-5">
          <h2 className="title-card-sm text-bone">No trips yet.</h2>
          <p className="mt-2 max-w-[56ch] text-bone-2">
            Send a quote request and pick one of the options dispatch sends back — the trip shows up
            here the moment it&rsquo;s booked.
          </p>
          <Link href="/quote/mission" className="btn btn-primary mt-5">
            Request a quote <span aria-hidden="true">→</span>
          </Link>
        </div>
      ) : (
        <>
          <SectionHead label="Upcoming" className="mt-8" />
          {upcoming.length === 0 ? (
            <div className="card mt-2.5 flex flex-wrap items-center justify-between gap-4 px-6 py-[18px] max-md:px-4">
              <p className="text-[15px] text-bone-2">Nothing coming up.</p>
              <Link href="/quote/mission" className="btn btn-secondary btn-sm">
                Request a quote <span aria-hidden="true">→</span>
              </Link>
            </div>
          ) : (
            <TripList rows={upcoming} legsOf={legsOf} today={today} />
          )}

          <SectionHead label="Past" className="mt-7" />
          {past.length === 0 ? (
            <div className="card mt-2.5 px-6 py-[18px] max-md:px-4">
              <p className="text-[15px] text-bone-2">No past trips yet.</p>
            </div>
          ) : (
            <TripList rows={past} legsOf={legsOf} today={today} />
          )}
        </>
      )}
    </>
  );
}

type Row = {
  id: string;
  status: string;
  paxCount: number;
  revenueUsd: number | null;
  aircraft: string | null;
};
type Leg = { fromIata: string | null; toIata: string | null; fromCity: string | null; toCity: string | null; departDate: string | null };

function TripList({ rows, legsOf, today }: { rows: Row[]; legsOf: (id: string) => Leg[]; today: string }) {
  return (
    <ul className="card mt-2.5 overflow-hidden">
      {rows.map((t) => {
        const legs = legsOf(t.id);
        const date = formatDay(nextLeg(legs, today)?.departDate ?? legs[0]?.departDate);
        const status = tripStatusWords(t.status);
        const meta = [date, t.aircraft, `${t.paxCount} passenger${t.paxCount === 1 ? "" : "s"}`].filter(Boolean).join(" · ");
        return (
          <li key={t.id} className="border-b border-line-faint last:border-b-0">
            <Link
              href={`/account/trips/${t.id}`}
              className="grid items-center gap-x-6 gap-y-2 px-6 py-4 transition-colors hover:bg-surface-2 max-md:px-4 md:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div className="min-w-0">
                <div className="text-[17px] font-medium text-bone">
                  {routeWords(legs)}
                  {meta ? <span className="font-normal text-steel"> · {meta}</span> : null}
                </div>
                <div className="mt-1 flex items-center gap-2 text-[15px] text-bone-2">
                  <span className={dotClass(status.tone)} aria-hidden="true" />
                  <span>{status.text}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-[15px] max-md:justify-between">
                {t.revenueUsd != null ? <span className="text-bone">{USD.format(t.revenueUsd)}</span> : null}
                <span className="text-bone-2">Details →</span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
