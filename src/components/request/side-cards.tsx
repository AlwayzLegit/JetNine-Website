import { SITE } from "@/lib/constants";
import { formatDay, timeOfDay, type RequestView } from "@/lib/request-page";

export function ContactCard({ view }: { view: RequestView }) {
  const name = view.dispatcher?.displayName ?? "JetNine dispatch";
  const initial = name.trim().charAt(0).toUpperCase() || "J";
  const phone = view.dispatcher?.directLineE164 ?? SITE.dispatchPhoneE164;
  return (
    <div className="card p-6">
      <div className="label-jn text-[13px]">Your JetNine contact</div>
      <div className="mt-2.5 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 font-semibold text-clearance">
          {initial}
        </span>
        <div>
          <div className="text-[17px] font-medium text-bone">{name}</div>
          <div className="text-[14px] text-success">Available now</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <a href={`tel:${phone}`} className="btn btn-secondary px-0">
          Call
        </a>
        <a href={`sms:${SITE.dispatchPhoneE164}`} className="btn btn-secondary px-0">
          Text
        </a>
        <a href={`mailto:${SITE.email}?subject=${encodeURIComponent(view.code)}`} className="btn btn-secondary px-0">
          Email
        </a>
      </div>
    </div>
  );
}

export function TripCard({ view }: { view: RequestView }) {
  const first = view.legs[0];
  const last = view.legs.length > 1 ? view.legs[view.legs.length - 1] : null;
  const out = first
    ? [formatDay(first.departDate), timeOfDay(first.departTime)].filter(Boolean).join(", ")
    : null;
  const back =
    view.tripType === "round" && last
      ? [formatDay(last.departDate), timeOfDay(last.departTime)].filter(Boolean).join(", ")
      : null;
  return (
    <div className="card p-6">
      <div className="label-jn text-[13px]">Your trip</div>
      <dl className="dl-jn mt-2.5">
        <dt>From</dt>
        <dd>
          {first?.fromCity ?? first?.fromIata ?? "—"}
          {first?.fromName ? <span className="text-steel"> ({first.fromName})</span> : null}
        </dd>
        <dt>To</dt>
        <dd>
          {first?.toCity ?? first?.toIata ?? "—"}
          {first?.toName ? <span className="text-steel"> ({first.toName})</span> : null}
        </dd>
        {view.tripType === "multi_leg" && view.legs.length > 1 ? (
          <>
            <dt>Legs</dt>
            <dd>
              {view.legs.map((l) => `${l.fromCity ?? l.fromIata ?? "—"} → ${l.toCity ?? l.toIata ?? "—"}`).join(" · ")}
            </dd>
          </>
        ) : null}
        {out ? (
          <>
            <dt>Out</dt>
            <dd>{out}</dd>
          </>
        ) : null}
        {back ? (
          <>
            <dt>Back</dt>
            <dd>{back}</dd>
          </>
        ) : null}
        <dt>Passengers</dt>
        <dd>{view.paxCount}</dd>
        {view.notes ? (
          <>
            <dt>Notes</dt>
            <dd className="whitespace-pre-line">{view.notes}</dd>
          </>
        ) : null}
      </dl>
      <a
        href={`mailto:${SITE.email}?subject=${encodeURIComponent(`${view.code} — change to my request`)}`}
        className="text-link mt-3.5 inline-block text-[15px]"
      >
        Change something
      </a>
    </div>
  );
}
