import Image from "next/image";
import Link from "next/link";
import { SITE } from "@/lib/constants";
import { CATEGORY_IMAGE, formatLongDay } from "@/lib/request-page";
import { dotClass } from "./quotes-status";
import { aircraftWords, departClock, legDurationWords, tripStatusWords } from "./trips-status";

export type UpcomingTrip = {
  id: string;
  code: string;
  status: string;
  paxCount: number;
  route: string;
  leg: {
    departDate: string | null;
    departTime: string | null;
    scheduledDepAt: Date | null;
    scheduledArrAt: Date | null;
    fromName: string | null;
    fromIata: string | null;
  } | null;
  aircraft: { makeModel: string; category: string | null; seats: number | null } | null;
};

/**
 * The next trip written as a sentence (Account.dc.html): Fraunces route,
 * "Friday, October 3 · departs 9:00 AM · about 2 h", a dl of the four
 * facts the member actually needs, three 44px buttons and the square fleet
 * photo. On phones the photo sits on top as a 140px strip.
 */
export function UpcomingTripCard({ trip }: { trip: UpcomingTrip }) {
  const status = tripStatusWords(trip.status);
  const clock = trip.leg ? departClock(trip.leg.departTime, trip.leg.scheduledDepAt) : null;
  const when = [
    formatLongDay(trip.leg?.departDate),
    clock ? `departs ${clock}` : null,
    trip.leg ? legDurationWords(trip.leg.scheduledDepAt, trip.leg.scheduledArrAt) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const img = trip.aircraft?.category ? CATEGORY_IMAGE[trip.aircraft.category] : null;
  const aircraft = aircraftWords(trip.aircraft);
  const where = trip.leg?.fromName
    ? `${trip.leg.fromName}${trip.leg.fromIata ? ` (${trip.leg.fromIata})` : ""}. `
    : "";

  return (
    <article className="card mt-2.5 grid gap-6 overflow-hidden p-7 max-md:p-0 md:grid-cols-[minmax(0,1fr)_160px]">
      <div className="max-md:p-5">
        <h2 className="title-app text-[32px] max-md:text-[26px]">{trip.route}</h2>
        {when ? <p className="mt-2 text-[17px] text-bone">{when}</p> : null}
        <dl className="dl-jn mt-[18px] gap-x-4 gap-y-2">
          <dt>Aircraft</dt>
          <dd>{aircraft ?? "Being finalised — dispatch confirms it before you fly"}</dd>
          <dt>Where to go</dt>
          <dd>
            {where}Arrive 15 minutes before. Dispatch sends the exact terminal address before you fly.
          </dd>
          <dt>Passengers</dt>
          <dd>
            {trip.paxCount} ·{" "}
            <Link href={`/account/trips/${trip.id}`} className="text-link">
              add names
            </Link>
          </dd>
          <dt>Status</dt>
          <dd className="flex items-center gap-2">
            <span className={dotClass(status.tone)} aria-hidden="true" />
            {status.text}
          </dd>
        </dl>
        <div className="mt-5 flex flex-wrap gap-2.5 max-md:grid max-md:grid-cols-2">
          <Link href={`/account/trips/${trip.id}`} className="btn btn-secondary">
            Trip details
          </Link>
          <a href={`sms:${SITE.dispatchPhoneE164}`} className="btn btn-secondary">
            Message dispatch
          </a>
          <a href={`tel:${SITE.dispatchPhoneE164}`} className="btn btn-secondary max-md:col-span-2">
            Call dispatch
          </a>
        </div>
      </div>
      <div className="overflow-hidden rounded-control bg-surface-2 max-md:order-first max-md:h-[140px] max-md:rounded-none md:aspect-square">
        {img ? (
          <Image src={img} alt="" width={400} height={400} className="h-full w-full object-cover" />
        ) : null}
      </div>
    </article>
  );
}

export function NoUpcomingTrip() {
  return (
    <div className="card mt-2.5 p-7 max-md:p-5">
      <h2 className="title-card-sm text-bone">Nothing booked yet.</h2>
      <p className="mt-2 text-bone-2">
        When dispatch confirms a flight it shows up here with the time, the aircraft and where to go.
      </p>
      <Link href="/quote/mission" className="btn btn-primary mt-5">
        Request a quote <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
