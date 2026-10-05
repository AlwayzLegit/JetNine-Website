import { SITE } from "@/lib/constants";
import { formatDay, timeOfDay, type RequestView } from "@/lib/request-page";

// Right-column cards of the "Your request" page (Your request.dc): 1px
// line boxes with a 20px serif title, 18px/20px padding.

const BOX = "rounded-[3px] border border-line bg-surface px-5 py-[18px]";
const SMALL_BTN =
  "flex h-9 items-center justify-center rounded-[2px] border border-line bg-surface text-[13px] text-bone transition-colors hover:border-steel max-md:h-11";

export function ContactCard({ view }: { view: RequestView }) {
  const name = view.dispatcher?.displayName ?? "JetNine dispatch";
  const initial = name.trim().charAt(0).toUpperCase() || "J";
  const phone = view.dispatcher?.directLineE164 ?? SITE.dispatchPhoneE164;
  return (
    <div className={BOX}>
      <h2 className="font-serif text-[20px] leading-[1.2] text-bone">Your JetNine contact</h2>
      <div className="mt-3 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 font-semibold text-gold">
          {initial}
        </span>
        <div>
          <div className="text-[15px] font-semibold text-bone">{name}</div>
          <div className="text-[13px] text-success">Available now</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <a href={`tel:${phone}`} className={SMALL_BTN}>
          Call
        </a>
        <a href={`sms:${SITE.dispatchPhoneE164}`} className={SMALL_BTN}>
          Text
        </a>
        <a href={`mailto:${SITE.email}?subject=${encodeURIComponent(view.code)}`} className={SMALL_BTN}>
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
    <div className={BOX}>
      <h2 className="font-serif text-[20px] leading-[1.2] text-bone">Your trip</h2>
      <dl className="mt-3 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-2 text-[14px]">
        <dt className="text-steel">From</dt>
        <dd className="text-bone">
          {first?.fromCity ?? first?.fromIata ?? "—"}
          {first?.fromName ? <span className="text-steel"> ({first.fromName})</span> : null}
        </dd>
        <dt className="text-steel">To</dt>
        <dd className="text-bone">
          {first?.toCity ?? first?.toIata ?? "—"}
          {first?.toName ? <span className="text-steel"> ({first.toName})</span> : null}
        </dd>
        {view.tripType === "multi_leg" && view.legs.length > 1 ? (
          <>
            <dt className="text-steel">Legs</dt>
            <dd className="text-bone">
              {view.legs.map((l) => `${l.fromCity ?? l.fromIata ?? "—"} → ${l.toCity ?? l.toIata ?? "—"}`).join(" · ")}
            </dd>
          </>
        ) : null}
        {out ? (
          <>
            <dt className="text-steel">Out</dt>
            <dd className="text-bone">{out}</dd>
          </>
        ) : null}
        {back ? (
          <>
            <dt className="text-steel">Back</dt>
            <dd className="text-bone">{back}</dd>
          </>
        ) : null}
        <dt className="text-steel">Passengers</dt>
        <dd className="text-bone">{view.paxCount}</dd>
        {view.notes ? (
          <>
            <dt className="text-steel">Notes</dt>
            <dd className="whitespace-pre-line break-words text-bone">{view.notes}</dd>
          </>
        ) : null}
      </dl>
      <a
        href={`mailto:${SITE.email}?subject=${encodeURIComponent(`${view.code} — change to my request`)}`}
        className="mt-3 inline-flex min-h-11 items-center text-[14px] text-bone underline underline-offset-[3px] hover:text-gold"
      >
        Change something
      </a>
    </div>
  );
}

// What the all-in price covers — the site's own all-in list (quote review
// step and pricing copy), not the prototype's sample list.
const INCLUDED = [
  "Fuel and all flight time",
  "Repositioning the aircraft",
  "Crew",
  "Federal excise tax (7.5%) and taxes",
  "Standard catering",
];

export function IncludedCard() {
  return (
    <div className={BOX}>
      <h2 className="font-serif text-[20px] leading-[1.2] text-bone">What&rsquo;s included in every price</h2>
      <ul className="mt-2.5 flex flex-col gap-1.5 text-[13px] text-bone">
        {INCLUDED.map((i) => (
          <li key={i} className="flex items-center gap-2">
            <span aria-hidden className="text-gold">
              ✓
            </span>
            {i}
          </li>
        ))}
      </ul>
      <p className="mt-2.5 text-[12px] text-steel">Each total is the whole trip — nothing added later.</p>
    </div>
  );
}

export function NotifiedCard({ view }: { view: RequestView }) {
  const who = view.dispatcher?.displayName ?? "Dispatch";
  return (
    <div className={BOX}>
      <h2 className="font-serif text-[20px] leading-[1.2] text-bone">{who} has been notified</h2>
      <p className="mt-2 text-[14px] leading-[1.5] text-steel">
        Your choice is with the desk. You&rsquo;ll hear from us by email as soon as the operator
        confirms.
      </p>
    </div>
  );
}
