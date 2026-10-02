import { formatLongDay } from "@/lib/request-page";
import { departClock } from "./trips-status";

export type LegView = {
  id: string;
  legNumber: number;
  fromIata: string | null;
  fromCity: string | null;
  fromName: string | null;
  toIata: string | null;
  toCity: string | null;
  toName: string | null;
  departDate: string | null;
  departTime: string | null;
  scheduledDepAt: Date | null;
  scheduledArrAt: Date | null;
  statusNote: string | null;
};

const CLOCK_LA = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
});

function airport(city: string | null, name: string | null, iata: string | null) {
  const main = city ?? name ?? iata ?? "—";
  const detail = [city ? name : null, iata].filter(Boolean).join(" · ");
  return (
    <>
      {main}
      {detail ? <span className="text-steel"> · {detail}</span> : null}
    </>
  );
}

/**
 * One leg of a trip (trip detail page): the day as a label, "City → City"
 * 22px, departs / lands clocks, from / to airports and the where-to-go
 * sentence from the "Your request" booked stage.
 */
export function TripLegCard({ leg, showNumber }: { leg: LegView; showNumber: boolean }) {
  const dep = departClock(leg.departTime, leg.scheduledDepAt);
  const arr = leg.scheduledArrAt ? CLOCK_LA.format(leg.scheduledArrAt) : null;
  const times = [dep ? `Departs ${dep}` : null, arr ? `lands ${arr}` : null].filter(Boolean).join(" · ");
  return (
    <article className="card p-6 max-md:p-5">
      <div className="label-jn text-[13px]">
        {formatLongDay(leg.departDate) ?? "Date to be confirmed"}
        {showNumber ? ` · leg ${leg.legNumber}` : ""}
      </div>
      <h3 className="mt-1.5 text-[22px] font-medium leading-tight text-bone">
        {leg.fromCity ?? leg.fromIata ?? "—"} → {leg.toCity ?? leg.toIata ?? "—"}
      </h3>
      {times ? <p className="mt-1 text-[17px] text-bone-2">{times}</p> : null}
      <dl className="dl-jn mt-4">
        <dt>From</dt>
        <dd>{airport(leg.fromCity, leg.fromName, leg.fromIata)}</dd>
        <dt>To</dt>
        <dd>{airport(leg.toCity, leg.toName, leg.toIata)}</dd>
      </dl>
      <p className="mt-4 leading-[1.5] text-bone-2">
        <b className="font-medium text-bone">Where to go:</b>{" "}
        {leg.fromName ? `${leg.fromName}${leg.fromIata ? ` (${leg.fromIata})` : ""}. ` : ""}
        Arrive 15 minutes before. Dispatch sends the exact terminal address before you fly.
      </p>
      {leg.statusNote ? <p className="mt-3 text-[15px] text-bone-2">{leg.statusNote}</p> : null}
    </article>
  );
}
