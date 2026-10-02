import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { RequestHeader } from "@/components/request/request-header";
import { Timeline, type TimelineStep } from "@/components/request/timeline";
import { OptionRow } from "@/components/request/option-row";
import { ContactCard, TripCard } from "@/components/request/side-cards";
import { getCurrentUser } from "@/lib/auth";
import { SITE } from "@/lib/constants";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  formatClock,
  formatDay,
  formatLongDay,
  loadRequestByToken,
  relativeTime,
  timeOfDay,
  tripTypeWords,
  type RequestView,
} from "@/lib/request-page";
import { STATUS_TOKEN_RE } from "@/lib/request-status";

export const dynamic = "force-dynamic";

const HOLD_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
});

export default async function RequestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!STATUS_TOKEN_RE.test(token)) notFound();

  // Tokens are 192-bit random, so guessing is hopeless; the limiter just
  // keeps a scraper from turning the lookup into load.
  try {
    const hdrs = await headers();
    const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (ip) {
      const rl = await checkRateLimit(`request_view:${ip}`, { max: 120, windowSeconds: 300 });
      if (!rl.ok) {
        return (
          <>
            <RequestHeader signedIn={false} />
            <main id="main-content" className="container-jn py-24 text-center">
              <h1 className="title-section">Too many requests.</h1>
              <p className="mt-4 text-[17px] text-bone-2">Wait a minute and reload this page.</p>
            </main>
          </>
        );
      }
    }
  } catch {
    // no request scope — proceed
  }

  let view: RequestView | null = null;
  let user: Awaited<ReturnType<typeof getCurrentUser>> = null;
  try {
    [view, user] = await Promise.all([loadRequestByToken(token), getCurrentUser().catch(() => null)]);
  } catch (err) {
    // Database unreachable — an honest holding page beats a crash. The
    // link stays valid; the request itself is safe on the desk.
    console.error("[request] lookup failed", err);
    return (
      <>
        <RequestHeader signedIn={false} />
        <main id="main-content" className="container-jn py-24 text-center">
          <p className="eyebrow">Your request</p>
          <h1 className="title-section mx-auto max-w-[20ch]">We can&rsquo;t load this right now.</h1>
          <p className="mx-auto mt-4 max-w-[48ch] text-[17px] leading-[1.6] text-bone-2">
            Your request is safe with dispatch. Reload in a minute, or call {SITE.dispatchPhone} and
            we&rsquo;ll read it to you.
          </p>
        </main>
      </>
    );
  }
  if (!view) notFound();

  const first = view.legs[0];
  const last = view.legs.length > 1 ? view.legs[view.legs.length - 1] : null;
  const title = first
    ? `${first.fromCity ?? first.fromIata ?? "—"} → ${last && view.tripType === "multi_leg" ? last.toCity ?? last.toIata ?? "—" : first.toCity ?? first.toIata ?? "—"}`
    : "Your request";
  const words = tripTypeWords(view.tripType);
  const received = formatDay(view.receivedAt.toISOString().slice(0, 10));
  const outWords = first ? [formatDay(first.departDate), timeOfDay(first.departTime)].filter(Boolean).join(" ") : null;
  const backWords =
    view.tripType === "round" && last
      ? [formatDay(last.departDate), timeOfDay(last.departTime)].filter(Boolean).join(" ")
      : null;

  return (
    <>
      <RequestHeader signedIn={Boolean(user)} />
      <main
        id="main-content"
        className="container-jn grid items-start gap-10 py-14 max-md:py-8 lg:grid-cols-[minmax(0,1fr)_340px]"
      >
        <div>
          <p className="text-[15px] text-steel">
            Quote request {view.code} · {received} · {view.paxCount} passengers · {words}
          </p>
          <h1 className="title-section mt-2">{title}</h1>
          {outWords ? (
            <p className="mt-3 text-[17px] text-bone-2">
              Leaving {outWords}
              {backWords ? ` · back ${backWords}` : ""}
            </p>
          ) : null}

          {view.stage === "received" ? <ReceivedStage view={view} /> : null}
          {view.stage === "options" ? <OptionsStage view={view} /> : null}
          {view.stage === "chosen" ? <ChosenStage view={view} /> : null}
          {view.stage === "booked" ? <BookedStage view={view} /> : null}
          {view.stage === "closed" ? <ClosedStage view={view} /> : null}
        </div>

        <aside className="flex flex-col gap-4">
          <ContactCard view={view} />
          <TripCard view={view} />
        </aside>
      </main>
    </>
  );
}

function ReceivedStage({ view }: { view: RequestView }) {
  const who = view.dispatcher ? `${view.dispatcher.displayName} from JetNine is on it now.` : "A senior dispatcher is on it now.";
  const steps: TimelineStep[] = [
    { title: "Received", note: relativeTime(view.receivedAt), state: "done" },
    { title: "Checking which aircraft are free", note: who, state: "current" },
    { title: "Two or three options with prices, sent to you", note: "Within 30 minutes during operating hours", state: "upcoming" },
    { title: "You pick one — we book it", state: "upcoming" },
  ];
  return (
    <section className="card mt-9 p-8 max-md:p-6">
      <h2 className="text-[26px] font-medium leading-tight text-bone">
        Got it{view.firstName ? `, ${view.firstName}` : ""}. We&rsquo;re on it.
      </h2>
      <p className="mt-2 text-bone-2">
        We emailed you a copy with this link. Here&rsquo;s what happens next.
      </p>
      <Timeline steps={steps} />
      <a href={`tel:${SITE.dispatchPhoneE164}`} className="btn btn-secondary mt-2">
        Questions? Call {SITE.dispatchPhone}
      </a>
    </section>
  );
}

function OptionsStage({ view }: { view: RequestView }) {
  const n = view.options.length;
  const cheapest = [...view.options].sort((a, b) => a.clientPriceUsd - b.clientPriceUsd)[0];
  const holds = view.options.map((o) => o.softHoldExpiry).filter((d): d is Date => Boolean(d));
  const heldUntil = holds.length ? HOLD_FMT.format(new Date(Math.min(...holds.map((d) => d.getTime())))) : null;
  const words = tripTypeWords(view.tripType);
  const count = n === 1 ? "One aircraft that fits" : n === 2 ? "Two aircraft that fit" : n === 3 ? "Three aircraft that fit" : `${n} aircraft that fit`;
  return (
    <section className="mt-9">
      <h2 className="text-[26px] font-medium leading-tight text-bone">Your options are ready</h2>
      <p className="mt-2 text-bone-2">
        {count} your trip. Each price is the total — nothing added later.
        {heldUntil ? ` Held for you until ${heldUntil} Pacific.` : ""}
      </p>
      <div className="mt-6 flex flex-col gap-3">
        {view.options.map((o) => (
          <OptionRow
            key={o.id}
            option={o}
            token={view.token}
            recommended={o.id === cheapest?.id && n > 1}
            tripWords={words}
            chosen={o.isChosen}
            open
          />
        ))}
      </div>
      <p className="mt-5 text-[15px] text-bone-2">
        Not quite right?{" "}
        <a href={`tel:${SITE.dispatchPhoneE164}`} className="text-link-strong">
          Call {view.dispatcher?.displayName ?? "dispatch"}
        </a>{" "}
        or reply to the email — we&rsquo;ll look for something else.
      </p>
    </section>
  );
}

function ChosenStage({ view }: { view: RequestView }) {
  const chosen = view.chosen;
  const steps: TimelineStep[] = [
    { title: "Received", note: relativeTime(view.receivedAt), state: "done" },
    { title: "Options sent to you", note: view.respondedAt ? relativeTime(view.respondedAt) : null, state: "done" },
    { title: chosen?.aircraftType ? `You chose the ${chosen.aircraftType}` : "You chose an aircraft", note: view.acceptedAt ? relativeTime(view.acceptedAt) : null, state: "done" },
    { title: "We confirm it with the operator and send your receipt", note: "Usually within the hour", state: "current" },
  ];
  return (
    <section className="card mt-9 p-8 max-md:p-6">
      <h2 className="text-[26px] font-medium leading-tight text-bone">Good choice. We&rsquo;re locking it in.</h2>
      <p className="mt-2 text-bone-2">
        {view.dispatcher?.displayName ?? "Dispatch"} is confirming the aircraft with the operator now. You&rsquo;ll get the
        confirmation and where to go by email.
      </p>
      <Timeline steps={steps} />
      {chosen ? (
        <div className="mt-2">
          <OptionRow option={chosen} token={view.token} recommended={false} tripWords={tripTypeWords(view.tripType)} chosen open={false} />
        </div>
      ) : null}
    </section>
  );
}

function BookedStage({ view }: { view: RequestView }) {
  const trip = view.trip!;
  const legs = trip.legs.length ? trip.legs : [];
  return (
    <section className="card mt-9 p-8 max-md:p-6">
      <h2 className="text-[26px] font-medium leading-tight text-bone">You&rsquo;re booked.</h2>
      <p className="mt-2 text-bone-2">
        {trip.aircraft ? `${trip.aircraft}. ` : ""}Trip {trip.code}. Your receipt is in your email.
      </p>
      <div className="mt-7 grid gap-7 md:grid-cols-2">
        {legs.map((l) => {
          const dep = l.departTime ? formatClock(l.departTime) : l.scheduledDepAt ? HOLD_FMT.format(l.scheduledDepAt) : null;
          return (
            <div key={l.legNumber}>
              <div className="label-jn text-[13px]">{formatLongDay(l.departDate) ?? `Leg ${l.legNumber}`}</div>
              <div className="mt-1.5 text-[22px] font-medium text-bone">
                {l.fromCity ?? l.fromIata ?? "—"} → {l.toCity ?? l.toIata ?? "—"}
                {dep ? <span className="block text-[17px] font-normal text-bone-2">Departs {dep}</span> : null}
              </div>
              <p className="mt-2.5 leading-[1.5] text-bone-2">
                <b className="font-medium text-bone">Where to go:</b>{" "}
                {l.fromName ? `${l.fromName}${l.fromIata ? ` (${l.fromIata})` : ""}. ` : ""}
                Dispatch sends the exact terminal address and arrival time before you fly. Arrive 15 minutes before.
              </p>
            </div>
          );
        })}
      </div>
      <div className="mt-7 flex flex-wrap gap-3">
        <a href={`tel:${SITE.dispatchPhoneE164}`} className="btn btn-secondary">
          Call dispatch
        </a>
        <a href={`mailto:${SITE.email}?subject=${encodeURIComponent(`${trip.code} — passenger names`)}`} className="btn btn-secondary">
          Add passenger names
        </a>
        <a href={`mailto:${SITE.email}?subject=${encodeURIComponent(`${trip.code} — request a car`)}`} className="btn btn-secondary">
          Request a car
        </a>
      </div>
    </section>
  );
}

function ClosedStage({ view }: { view: RequestView }) {
  const why =
    view.status === "declined"
      ? "This request was closed without a booking."
      : view.status === "expired"
        ? "This request expired before an option was chosen."
        : "This request was cancelled.";
  return (
    <section className="card mt-9 p-8 max-md:p-6">
      <h2 className="text-[26px] font-medium leading-tight text-bone">This request is closed.</h2>
      <p className="mt-2 text-bone-2">{why} Same route, new dates? Start again and dispatch picks it up in minutes.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/quote/mission" className="btn btn-primary">
          Start a new request
        </Link>
        <a href={`tel:${SITE.dispatchPhoneE164}`} className="btn btn-secondary">
          Call {SITE.dispatchPhone}
        </a>
      </div>
    </section>
  );
}
