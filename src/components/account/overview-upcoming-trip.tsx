import Image from "next/image";
import Link from "next/link";
import { SITE } from "@/lib/constants";
import { formatLongDay } from "@/lib/request-page";
import { BTN_LINE, BTN_NAVY_LINE, BTN_PRIMARY, Eyebrow, PANEL } from "./panel";
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
 * "Next flight" panel (Light - Account overview): bronze eyebrow, 32px
 * serif route, the day as a sentence, a dl of the four facts the member
 * needs, three buttons, and the terminal photo on the right (it wraps
 * under the text on narrow screens).
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
  const aircraft = aircraftWords(trip.aircraft);
  const where = trip.leg?.fromName
    ? `${trip.leg.fromName}${trip.leg.fromIata ? ` (${trip.leg.fromIata})` : ""}. `
    : "";

  return (
    <section className={`${PANEL} mt-[22px] grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]`}>
      <div className="px-6 py-[22px] max-md:px-5">
        <Eyebrow>Next flight</Eyebrow>
        <h2 className="mt-2 font-serif text-[clamp(26px,5vw,32px)] font-normal leading-[1.1] text-bone">{trip.route}</h2>
        {when ? <p className="mt-1.5 text-[15px] text-bone">{when}</p> : null}
        <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-[18px] gap-y-2 text-[14px] leading-[1.5]">
          <dt className="text-steel">Aircraft</dt>
          <dd className="text-bone">{aircraft ?? "Being finalised — dispatch confirms it before you fly"}</dd>
          <dt className="text-steel">Where to go</dt>
          <dd className="text-bone">
            {where}Arrive 15 minutes before. Dispatch sends the exact terminal address before you fly.
          </dd>
          <dt className="text-steel">Passengers</dt>
          <dd className="text-bone">
            {trip.paxCount} ·{" "}
            <Link href={`/account/trips/${trip.id}`} className="underline underline-offset-[3px] hover:text-gold">
              add names
            </Link>
          </dd>
          <dt className="text-steel">Status</dt>
          <dd className="flex items-center gap-2 text-bone">
            <span className={dotClass(status.tone)} aria-hidden="true" />
            {status.text}
          </dd>
        </dl>
        <div className="mt-[18px] flex flex-wrap gap-2.5">
          <Link href={`/account/trips/${trip.id}`} className={BTN_NAVY_LINE}>
            Trip details
          </Link>
          <a href={`sms:${SITE.dispatchPhoneE164}`} className={BTN_LINE}>
            Message dispatch
          </a>
          <a href={`tel:${SITE.dispatchPhoneE164}`} className={BTN_LINE}>
            Call dispatch
          </a>
        </div>
      </div>
      <div className="relative min-h-[220px] bg-surface-2">
        <Image
          src="/images/light/jet-beside-glass-terminal.webp"
          alt=""
          fill
          sizes="(min-width: 1024px) 420px, 100vw"
          className="object-cover"
        />
      </div>
    </section>
  );
}

export function NoUpcomingTrip() {
  return (
    <section className={`${PANEL} mt-[22px] px-6 py-[22px] max-md:px-5`}>
      <Eyebrow>Next flight</Eyebrow>
      <h2 className="mt-2 font-serif text-[26px] font-normal leading-[1.15] text-bone">Nothing booked yet.</h2>
      <p className="mt-1.5 max-w-[56ch] text-[15px] text-steel">
        When dispatch confirms a flight it shows up here with the time, the aircraft and where to go.
      </p>
      <Link href="/quote/mission" className={`${BTN_PRIMARY} mt-4`}>
        Request a quote <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
