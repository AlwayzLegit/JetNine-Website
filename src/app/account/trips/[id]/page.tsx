import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { trips, tripLegs } from "@/db/schema/trips";
import { invoices } from "@/db/schema/invoices";
import { aircraft } from "@/db/schema/aircraft";
import { operators } from "@/db/schema/operators";
import { staff } from "@/db/schema/staff";
import { messages } from "@/db/schema/audit";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { SITE } from "@/lib/constants";
import { getMemberByUserId } from "@/lib/member";
import { USD, formatDay } from "@/lib/request-page";
import { DispatcherCard } from "@/components/account/overview-aside";
import { dotClass } from "@/components/account/quotes-status";
import { TripLegCard } from "@/components/account/trips-leg-card";
import { MISSION_WORDS, aircraftWords, routeWords, tripStatusWords } from "@/components/account/trips-status";

const CHANNEL_WORDS: Record<string, string> = {
  inapp: "Portal note",
  email: "Email",
  sms: "Text message",
  call: "Phone call",
  voicemail: "Voicemail",
  system: "Update",
};

const INVOICE_WORDS: Record<string, string> = {
  draft: "Being prepared",
  due: "Due",
  paid: "Paid",
  overdue: "Overdue",
  credit: "Credit",
  void: "Cancelled",
};

const WHEN_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
});

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AccountTripDetailPage({ params }: Props) {
  const { id } = await params;
  await requireUser(`/account/trips/${id}`);
  const user = await getCurrentUser();
  if (!user) return null;

  const member = await getMemberByUserId(user.id);
  if (!member) notFound();

  // Owner-only: explicit eq on member_id so members can't peek at other
  // trips even by guessing UUIDs.
  const [trip] = await db
    .select()
    .from(trips)
    .where(and(eq(trips.id, id), eq(trips.memberId, member.id)));
  if (!trip) notFound();

  const legs = await db
    .select()
    .from(tripLegs)
    .where(eq(tripLegs.tripId, id))
    .orderBy(asc(tripLegs.legNumber));

  const [tripInvoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.tripId, id));

  const [acRow] = trip.aircraftId
    ? await db
        .select({
          makeModel: aircraft.makeModel,
          category: aircraft.category,
          seats: aircraft.seats,
          yearManufactured: aircraft.yearManufactured,
        })
        .from(aircraft)
        .where(eq(aircraft.id, trip.aircraftId))
    : [];

  const [opRow] = trip.operatorId
    ? await db
        .select({ name: operators.name })
        .from(operators)
        .where(eq(operators.id, trip.operatorId))
    : [];

  const dispatcherId = trip.assignedDispatcherId ?? member.primaryDispatcherId;
  const [dispatcher] = dispatcherId
    ? await db
        .select({ displayName: staff.displayName, directLineE164: staff.directLineE164 })
        .from(staff)
        .where(eq(staff.id, dispatcherId))
        .limit(1)
    : [];

  // Dispatcher-authored thread, visible to the member as a read-only timeline.
  // We only surface outbound messages (direction='out' = dispatch → member);
  // any internal notes stay invisible from this surface.
  const memberThread = await db
    .select({
      id: messages.id,
      channel: messages.channel,
      body: messages.body,
      preview: messages.preview,
      occurredAt: messages.occurredAt,
    })
    .from(messages)
    .where(
      and(
        eq(messages.subjectType, "trip"),
        eq(messages.subjectId, id),
        eq(messages.direction, "out"),
      ),
    )
    .orderBy(asc(messages.occurredAt));

  const status = tripStatusWords(trip.status);
  const route = routeWords(legs);
  const firstDay = formatDay(legs[0]?.departDate);
  const sentence = [
    firstDay,
    MISSION_WORDS[trip.missionType] ?? null,
    `${trip.paxCount} passenger${trip.paxCount === 1 ? "" : "s"}`,
    legs.length > 1 ? `${legs.length} legs` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const aircraftLine = aircraftWords(acRow ?? null);
  const subject = `${trip.tripCode} — passenger names`;

  return (
    <>
      <Link href="/account/trips" className="text-[15px] text-bone-2 transition-colors hover:text-bone">
        ← All trips
      </Link>
      <h1 className="title-app mt-3">{route}</h1>
      <p className="mt-2.5 text-[17px] text-bone-2">
        {sentence}
        <span className="text-steel"> · trip {trip.tripCode}</span>
      </p>
      <p className="mt-2 flex items-center gap-2 text-[17px] text-bone">
        <span className={dotClass(status.tone)} aria-hidden="true" />
        {status.text}
      </p>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          {legs.length === 0 ? (
            <div className="card p-6 max-md:p-5">
              <p className="text-bone-2">Dispatch is still writing up the legs for this trip. The itinerary lands here first.</p>
            </div>
          ) : (
            legs.map((l) => <TripLegCard key={l.id} leg={l} showNumber={legs.length > 1} />)
          )}

          {trip.notesMember ? (
            <section className="card p-6 max-md:p-5">
              <h2 className="label-jn text-[13px]">Notes from dispatch</h2>
              <p className="mt-2 whitespace-pre-line leading-[1.6] text-bone">{trip.notesMember}</p>
            </section>
          ) : null}

          {memberThread.length > 0 ? (
            <section className="card p-6 max-md:p-5">
              <h2 className="label-jn text-[13px]">Updates from dispatch</h2>
              <ul className="mt-3 flex flex-col gap-4">
                {memberThread.map((m) => (
                  <li key={m.id} className="border-l-2 border-line-2 pl-4">
                    <div className="text-[14px] text-steel">
                      {CHANNEL_WORDS[m.channel] ?? "Update"}
                      {m.occurredAt ? ` · ${WHEN_FMT.format(m.occurredAt)}` : ""}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap leading-[1.6] text-bone">{m.body ?? m.preview ?? ""}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-[14px] text-steel">
                To reply, call or text your dispatcher — this page is read-only.
              </p>
            </section>
          ) : null}

          <div className="flex flex-wrap gap-2.5 max-md:grid max-md:grid-cols-2">
            <a href={`mailto:${SITE.email}?subject=${encodeURIComponent(subject)}`} className="btn btn-secondary">
              Add passenger names
            </a>
            <a href={`mailto:${SITE.email}?subject=${encodeURIComponent(`${trip.tripCode} — request a car`)}`} className="btn btn-secondary">
              Request a car
            </a>
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="card p-6">
            <h2 className="label-jn text-[13px]">The trip</h2>
            <dl className="dl-jn mt-2.5">
              <dt>Aircraft</dt>
              <dd>
                {aircraftLine ?? "Being finalised — dispatch confirms it before you fly"}
                {acRow?.yearManufactured ? <span className="text-steel"> · {acRow.yearManufactured}</span> : null}
              </dd>
              {opRow ? (
                <>
                  <dt>Operated by</dt>
                  <dd>
                    {opRow.name}
                    <span className="text-steel"> · FAA Part 135</span>
                  </dd>
                </>
              ) : null}
              <dt>Passengers</dt>
              <dd>{trip.paxCount}</dd>
              <dt>Status</dt>
              <dd className="flex items-center gap-2">
                <span className={dotClass(status.tone)} aria-hidden="true" />
                {status.text}
              </dd>
            </dl>
          </div>

          {tripInvoice ? (
            <div className="card p-6">
              <h2 className="label-jn text-[13px]">Invoice</h2>
              <div className="mt-2 text-[26px] font-medium leading-tight text-bone">
                {tripInvoice.totalUsd != null ? USD.format(tripInvoice.totalUsd) : "Amount to follow"}
              </div>
              <div className="mt-1 text-[15px] text-bone-2">
                {INVOICE_WORDS[tripInvoice.status] ?? "With dispatch"}
                {tripInvoice.status === "paid" && tripInvoice.paidOn ? ` · ${formatDay(tripInvoice.paidOn)}` : ""}
                {(tripInvoice.status === "due" || tripInvoice.status === "overdue") && tripInvoice.dueOn
                  ? ` · by ${formatDay(tripInvoice.dueOn)}`
                  : ""}
              </div>
              <p className="mt-2 text-[14px] text-steel">
                Everything included — federal excise tax and segment fees.
              </p>
              <Link href="/account/invoices" className="text-link mt-3 inline-block text-[15px]">
                {tripInvoice.status === "due" || tripInvoice.status === "overdue" ? "Pay this invoice" : "All invoices"}
              </Link>
            </div>
          ) : null}

          <DispatcherCard dispatcher={dispatcher ?? null} subject={`${trip.tripCode} — question`} />
        </aside>
      </div>
    </>
  );
}
