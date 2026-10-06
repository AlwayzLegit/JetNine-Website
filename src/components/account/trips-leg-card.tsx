import { formatLongDay } from "@/lib/request-page";
import { Eyebrow, PANEL, TILE } from "./panel";
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
 * One leg of a trip (trip detail page), in the Light - Account "Trips"
 * grammar: bronze day eyebrow, serif "City → City", the clocks, then
 * From / To / Where to go as fact tiles.
 */
export function TripLegCard({ leg, showNumber }: { leg: LegView; showNumber: boolean }) {
  const dep = departClock(leg.departTime, leg.scheduledDepAt);
  const arr = leg.scheduledArrAt ? CLOCK_LA.format(leg.scheduledArrAt) : null;
  const times = [dep ? `Departs ${dep}` : null, arr ? `lands ${arr}` : null].filter(Boolean).join(" · ");
  return (
    <article className={`${PANEL} px-6 py-5 max-md:px-5`}>
      <Eyebrow>
        {formatLongDay(leg.departDate) ?? "Date to be confirmed"}
        {showNumber ? ` · leg ${leg.legNumber}` : ""}
      </Eyebrow>
      <h2 className="mt-1.5 font-serif text-[26px] font-normal leading-[1.15] text-bone">
        {leg.fromCity ?? leg.fromIata ?? "—"} → {leg.toCity ?? leg.toIata ?? "—"}
      </h2>
      {times ? <p className="mt-1 text-[15px] text-bone">{times}</p> : null}
      <dl className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-3">
        <div className={`${TILE} px-3.5 py-3`}>
          <dt className="text-[12px] text-steel">From</dt>
          <dd className="mt-0.5 text-[14px] leading-[1.45] text-bone">{airport(leg.fromCity, leg.fromName, leg.fromIata)}</dd>
        </div>
        <div className={`${TILE} px-3.5 py-3`}>
          <dt className="text-[12px] text-steel">To</dt>
          <dd className="mt-0.5 text-[14px] leading-[1.45] text-bone">{airport(leg.toCity, leg.toName, leg.toIata)}</dd>
        </div>
        <div className={`${TILE} px-3.5 py-3`}>
          <dt className="text-[12px] text-steel">Where to go</dt>
          <dd className="mt-0.5 text-[14px] leading-[1.45] text-bone">
            {leg.fromName ? `${leg.fromName}${leg.fromIata ? ` (${leg.fromIata})` : ""}. ` : ""}
            Arrive 15 minutes before. Dispatch sends the exact terminal address before you fly.
          </dd>
        </div>
      </dl>
      {leg.statusNote ? <p className="mt-3 text-[14px] text-bone-2">{leg.statusNote}</p> : null}
    </article>
  );
}
