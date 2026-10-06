import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { RequestHeader } from "@/components/request/request-header";
import { ProgressStrip, Timeline, type ProgressState, type TimelineStep } from "@/components/request/timeline";
import { OptionRow } from "@/components/request/option-row";
import { ContactCard, IncludedCard, NotifiedCard, TripCard } from "@/components/request/side-cards";
import { Breadcrumb } from "@/components/light/breadcrumb";
import { getCurrentUser } from "@/lib/auth";
import { SITE } from "@/lib/constants";
import { getReplyPromiseMinutes } from "@/lib/desk-settings";
import { replyPromiseWords } from "@/lib/desk-status";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  CATEGORY_PLAIN,
  USD,
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
              <h1 className="font-serif text-[clamp(32px,6vw,40px)] leading-[1.05] text-bone">Too many requests.</h1>
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
          <h1 className="mx-auto max-w-[20ch] font-serif text-[clamp(32px,6vw,40px)] leading-[1.05] text-bone">We can&rsquo;t load this right now.</h1>
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

  const holds = view.options.map((o) => o.softHoldExpiry).filter((d): d is Date => Boolean(d));
  const heldUntil =
    view.stage === "options" && holds.length
      ? HOLD_FMT.format(new Date(Math.min(...holds.map((d) => d.getTime()))))
      : null;
  const callWho = view.dispatcher?.displayName ? `Call ${view.dispatcher.displayName}` : "Call dispatch";
  const callTel = view.dispatcher?.directLineE164 ?? SITE.dispatchPhoneE164;
  const progress = progressFor(view.stage);
  const signedIn = Boolean(user);

  return (
    <>
      <RequestHeader signedIn={signedIn} />
      <main id="main-content" className="container-jn pb-16 pt-[22px] md:pb-24">
        {signedIn ? (
          <Breadcrumb
            items={[
              { label: "My account", href: "/account" },
              { label: "Quotes", href: "/account" },
              { label: title },
            ]}
          />
        ) : null}

        <div className="mt-3.5 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow !mb-0">
              Your request · {view.code} · sent {received}
            </p>
            <h1 className="mt-2 font-serif text-[clamp(32px,6vw,40px)] font-normal leading-[1.05] text-bone">
              {title}
            </h1>
            <p className="mt-1.5 text-[15px] text-steel">
              {[
                outWords ? `Leaving ${outWords}${backWords ? ` · back ${backWords}` : ""}` : null,
                `${view.paxCount} ${view.paxCount === 1 ? "passenger" : "passengers"}`,
                words,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="text-[13px] text-steel sm:text-right">
            {heldUntil ? (
              <>
                Prices held until <b className="text-bone">{heldUntil} Pacific</b>
                <br />
              </>
            ) : null}
            Questions?{" "}
            <a href={`tel:${callTel}`} className="text-bone underline underline-offset-[3px] hover:text-gold">
              {callWho}
            </a>
          </div>
        </div>

        {progress ? <ProgressStrip steps={progress} /> : null}

        <div className="mt-[22px] flex flex-wrap items-start gap-6">
          <div className="min-w-0 flex-[1_1_560px]">
            {view.stage === "received" ? <ReceivedStage view={view} /> : null}
            {view.stage === "options" ? <OptionsStage view={view} /> : null}
            {view.stage === "chosen" ? <ChosenStage view={view} signedIn={signedIn} /> : null}
            {view.stage === "booked" ? <BookedStage view={view} /> : null}
            {view.stage === "closed" ? <ClosedStage view={view} /> : null}
          </div>

          <aside className="flex min-w-0 flex-[1_1_260px] flex-col gap-3 md:max-w-[320px] lg:sticky lg:top-[calc(var(--header-h)+20px)]">
            {view.stage === "options" ? <IncludedCard /> : null}
            {view.stage === "chosen" ? <NotifiedCard view={view} /> : null}
            <ContactCard view={view} />
            <TripCard view={view} />
          </aside>
        </div>
      </main>
    </>
  );
}

// The four-step strip under the title. Closed requests show none.
function progressFor(stage: RequestView["stage"]): { label: string; state: ProgressState }[] | null {
  const labels = ["Request received", "Options sent", "You choose", "Confirmed in writing"];
  const states: Record<RequestView["stage"], ProgressState[] | null> = {
    received: ["done", "now", "todo", "todo"],
    options: ["done", "done", "now", "todo"],
    chosen: ["done", "done", "done", "now"],
    booked: ["done", "done", "done", "done"],
    closed: null,
  };
  const s = states[stage];
  return s ? labels.map((label, i) => ({ label, state: s[i] })) : null;
}

const STAGE_BOX = "rounded-[3px] border border-line bg-surface px-[clamp(16px,4vw,26px)] py-6";

async function ReceivedStage({ view }: { view: RequestView }) {
  // Reply time from the desk setting (Settings › Notifications).
  const when = replyPromiseWords(await getReplyPromiseMinutes());
  const who = view.dispatcher ? `${view.dispatcher.displayName} from JetNine is on it now.` : "A senior dispatcher is on it now.";
  const steps: TimelineStep[] = [
    { title: "Received", note: relativeTime(view.receivedAt), state: "done" },
    { title: "Checking which aircraft are free", note: who, state: "current" },
    { title: "Two or three options with prices, sent to you", note: `${when.charAt(0).toUpperCase()}${when.slice(1)} during operating hours`, state: "upcoming" },
    { title: "You pick one — we book it", state: "upcoming" },
  ];
  return (
    <section className={STAGE_BOX}>
      <p className="eyebrow !mb-2.5">Request received</p>
      <h2 className="font-serif text-[clamp(28px,4vw,32px)] font-normal leading-[1.1] text-bone">
        Got it{view.firstName ? `, ${view.firstName}` : ""}. We&rsquo;re on it.
      </h2>
      <p className="mt-2 text-[15px] text-steel">
        We emailed you a copy with this link. Here&rsquo;s what happens next.
      </p>
      <Timeline steps={steps} />
      <div className="flex flex-wrap gap-3">
        <a href={`tel:${SITE.dispatchPhoneE164}`} className="btn btn-primary">
          Call dispatch <span aria-hidden="true">↗</span>
        </a>
      </div>
      <p className="mt-3.5 text-[13px] text-steel">
        Questions in the meantime? Call {SITE.dispatchPhone}.
      </p>
    </section>
  );
}

function OptionsStage({ view }: { view: RequestView }) {
  const n = view.options.length;
  const cheapest = [...view.options].sort((a, b) => a.clientPriceUsd - b.clientPriceUsd)[0];
  const words = tripTypeWords(view.tripType);
  const count = n === 1 ? "One aircraft that fits" : n === 2 ? "Two aircraft that fit" : n === 3 ? "Three aircraft that fit" : `${n} aircraft that fit`;
  return (
    <section>
      <h2 className="font-serif text-[28px] font-normal leading-[1.1] text-bone">Your options are ready</h2>
      <p className="mt-1 text-[14px] text-steel">
        {count} your trip. Each price is the total — nothing added later. Pick one and we confirm it
        with the operator.
      </p>
      <div className="mt-3.5 flex flex-col gap-3">
        {view.options.map((o) => (
          <OptionRow
            key={o.id}
            option={o}
            token={view.token}
            code={view.code}
            recommended={o.id === cheapest?.id && n > 1}
            tripWords={words}
            chosen={o.isChosen}
            open
          />
        ))}
      </div>
      <p className="mt-3 text-[12px] text-steel">
        Choosing an aircraft is not yet a booking. We confirm it with the operator first; your
        flight is confirmed in writing after that.
      </p>
      <p className="mt-3 text-[14px] text-bone-2">
        Not quite right?{" "}
        <a href={`tel:${SITE.dispatchPhoneE164}`} className="text-link-strong">
          Call {view.dispatcher?.displayName ?? "dispatch"}
        </a>{" "}
        or reply to the email — we&rsquo;ll look for something else.
      </p>
    </section>
  );
}

function ChosenStage({ view, signedIn }: { view: RequestView; signedIn: boolean }) {
  const chosen = view.chosen;
  const steps: TimelineStep[] = [
    { title: "Received", note: relativeTime(view.receivedAt), state: "done" },
    { title: "Options sent to you", note: view.respondedAt ? relativeTime(view.respondedAt) : null, state: "done" },
    { title: chosen?.aircraftType ? `You chose the ${chosen.aircraftType}` : "You chose an aircraft", note: view.acceptedAt ? relativeTime(view.acceptedAt) : null, state: "done" },
    { title: "We confirm it with the operator and send your receipt", note: "Usually within the hour", state: "current" },
  ];
  const name = chosen ? chosen.aircraftType ?? (chosen.category ? CATEGORY_PLAIN[chosen.category] : null) ?? "Your aircraft" : null;
  return (
    <section className="rounded-[3px] border border-gold bg-surface px-[clamp(16px,4vw,26px)] py-6">
      <p className="eyebrow !mb-0">You chose</p>
      <h2 className="mt-2 font-serif text-[clamp(28px,4vw,32px)] font-normal leading-[1.1] text-bone">
        {chosen && name ? `${name} · ${USD.format(chosen.clientPriceUsd)}` : "Good choice. We’re locking it in."}
      </h2>
      <p className="mt-1.5 text-[14px] text-steel">
        {view.dispatcher?.displayName ?? "Dispatch"} is confirming the aircraft with the operator now. You&rsquo;ll get the
        confirmation and where to go by email.
      </p>
      <Timeline steps={steps} />
      <div className="flex flex-wrap gap-2.5">
        {signedIn ? (
          <Link href="/account" className="btn btn-sm btn-primary">
            Back to my account
          </Link>
        ) : null}
        <a href={`tel:${SITE.dispatchPhoneE164}`} className={signedIn ? "btn btn-sm btn-secondary" : "btn btn-sm btn-primary"}>
          Call {SITE.dispatchPhone}
        </a>
      </div>
      <p className="mt-3 text-[12px] text-steel">
        Your flight is confirmed only once you receive the written confirmation.
      </p>
    </section>
  );
}

function BookedStage({ view }: { view: RequestView }) {
  const trip = view.trip!;
  const legs = trip.legs.length ? trip.legs : [];
  return (
    <section className={STAGE_BOX}>
      <p className="eyebrow !mb-2.5">Confirmed</p>
      <h2 className="font-serif text-[clamp(28px,4vw,32px)] font-normal leading-[1.1] text-bone">You&rsquo;re booked.</h2>
      <p className="mt-1.5 text-[15px] text-steel">
        {trip.aircraft ? `${trip.aircraft}. ` : ""}Trip {trip.code}. Your receipt is in your email.
      </p>
      <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-6">
        {legs.map((l) => {
          const dep = l.departTime ? formatClock(l.departTime) : l.scheduledDepAt ? HOLD_FMT.format(l.scheduledDepAt) : null;
          return (
            <div key={l.legNumber} className="border-t border-line pt-3.5">
              <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-gold">
                {formatLongDay(l.departDate) ?? `Leg ${l.legNumber}`}
              </div>
              <div className="mt-1.5 font-serif text-[24px] leading-[1.15] text-bone">
                {l.fromCity ?? l.fromIata ?? "—"} → {l.toCity ?? l.toIata ?? "—"}
              </div>
              {dep ? <div className="text-[15px] text-bone-2">Departs {dep}</div> : null}
              <p className="mt-2 text-[14px] leading-[1.5] text-steel">
                <b className="font-semibold text-bone">Where to go:</b>{" "}
                {l.fromName ? `${l.fromName}${l.fromIata ? ` (${l.fromIata})` : ""}. ` : ""}
                Dispatch sends the exact terminal address and arrival time before you fly. Arrive 15 minutes before.
              </p>
            </div>
          );
        })}
      </div>
      <div className="mt-6 flex flex-wrap gap-2.5">
        <a href={`tel:${SITE.dispatchPhoneE164}`} className="btn btn-sm btn-primary">
          Call dispatch
        </a>
        <a href={`mailto:${SITE.email}?subject=${encodeURIComponent(`${trip.code} — passenger names`)}`} className="btn btn-sm btn-secondary">
          Add passenger names
        </a>
        <a href={`mailto:${SITE.email}?subject=${encodeURIComponent(`${trip.code} — request a car`)}`} className="btn btn-sm btn-secondary">
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
    <section className={STAGE_BOX}>
      <p className="eyebrow !mb-2.5">Closed</p>
      <h2 className="font-serif text-[clamp(28px,4vw,32px)] font-normal leading-[1.1] text-bone">This request is closed.</h2>
      <p className="mt-1.5 text-[15px] text-steel">{why} Same route, new dates? Start again and dispatch picks it up in minutes.</p>
      <div className="mt-5 flex flex-wrap gap-2.5">
        <Link href="/quote/mission" className="btn btn-primary">
          Start a new request <span aria-hidden="true">↗</span>
        </Link>
        <a href={`tel:${SITE.dispatchPhoneE164}`} className="btn btn-secondary">
          Call {SITE.dispatchPhone}
        </a>
      </div>
    </section>
  );
}
