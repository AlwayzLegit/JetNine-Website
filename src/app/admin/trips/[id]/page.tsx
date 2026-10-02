import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { trips, tripLegs } from "@/db/schema/trips";
import { invoices } from "@/db/schema/invoices";
import { members } from "@/db/schema/members";
import { users } from "@/db/schema/users";
import { quotes } from "@/db/schema/quotes";
import { aircraft } from "@/db/schema/aircraft";
import { operators } from "@/db/schema/operators";
import { sourcedOptions } from "@/db/schema/sourced-option";
import { messages } from "@/db/schema/audit";
import { TripStatusSelect } from "@/components/admin/trip-status-select";
import { MessageThread, type ThreadMessage } from "@/components/admin/message-thread";
import { MarkThreadRead } from "@/components/admin/mark-thread-read";
import { postTripMessage } from "@/app/admin/trips/[id]/actions";
import { InvoiceFinalizeForm } from "@/components/admin/invoice-finalize-form";
import { formatUSD } from "@/lib/quote-pricing";
import { formatDay } from "@/lib/request-page";
import { invoiceWords, passengersWords, personName, tierWords, tripState } from "@/lib/desk-status";
import { ContactButtons, DeskCard, DeskHeader, DeskPage, DotSentence, StatusPill } from "@/components/admin/desk-ui";
import {
  aircraftLine,
  cityWords,
  dayKey,
  groundWords,
  legDayWords,
  legDepartClock,
  legRoute,
  legSentence,
  missionWords,
} from "@/components/admin/trips/trip-words";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const STAMP_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function stamp(d: Date | null | undefined): string | null {
  return d ? STAMP_FMT.format(d) : null;
}

export default async function AdminTripDetailPage({ params }: Props) {
  const { id } = await params;
  const now = new Date();

  const [trip] = await db.select().from(trips).where(eq(trips.id, id));
  if (!trip) notFound();

  const legs = await db
    .select()
    .from(tripLegs)
    .where(eq(tripLegs.tripId, id))
    .orderBy(asc(tripLegs.legNumber));

  const [memberRow] = await db
    .select({
      id: members.id,
      memberCode: members.memberCode,
      tier: members.tier,
      preferredName: members.preferredName,
      legalName: members.legalName,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phoneE164: users.phoneE164,
    })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(eq(members.id, trip.memberId));

  const [tripInvoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.tripId, id));

  const [originatingQuote] = trip.quoteId
    ? await db
        .select({
          id: quotes.id,
          quoteCode: quotes.quoteCode,
          status: quotes.status,
          groundOption: quotes.groundOption,
        })
        .from(quotes)
        .where(eq(quotes.id, trip.quoteId))
    : [];

  const [acRow] = trip.aircraftId
    ? await db
        .select({
          tailNumber: aircraft.tailNumber,
          makeModel: aircraft.makeModel,
          yearManufactured: aircraft.yearManufactured,
          operatorId: aircraft.operatorId,
        })
        .from(aircraft)
        .where(eq(aircraft.id, trip.aircraftId))
    : [];

  const [opRow] = trip.operatorId
    ? await db
        .select({ id: operators.id, name: operators.name, certNumber: operators.certNumber })
        .from(operators)
        .where(eq(operators.id, trip.operatorId))
    : [];

  // The option the client picked on the request fills in the aircraft when
  // the trip row has no aircraft of its own yet.
  const [chosenOption] =
    trip.quoteId && !acRow
      ? await db
          .select({
            aircraftType: sourcedOptions.aircraftType,
            tailNumber: sourcedOptions.tailNumber,
            operatorNameRaw: sourcedOptions.operatorNameRaw,
            totalFlightTimeMin: sourcedOptions.totalFlightTimeMin,
          })
          .from(sourcedOptions)
          .where(eq(sourcedOptions.quoteId, trip.quoteId))
          .orderBy(desc(sourcedOptions.isChosen), asc(sourcedOptions.optionNumber))
          .limit(1)
      : [];

  // ── Messages thread (subject_type='trip') ──
  const messageRows = await db
    .select({
      id: messages.id,
      channel: messages.channel,
      direction: messages.direction,
      fromAddress: messages.fromAddress,
      toAddress: messages.toAddress,
      preview: messages.preview,
      body: messages.body,
      occurredAt: messages.occurredAt,
      fromUserFirstName: users.firstName,
      fromUserEmail: users.email,
      deliveryStatus: messages.deliveryStatus,
      deliveryProvider: messages.deliveryProvider,
      deliveryError: messages.deliveryError,
    })
    .from(messages)
    .leftJoin(users, eq(users.id, messages.fromUserId))
    .where(and(eq(messages.subjectType, "trip"), eq(messages.subjectId, id)))
    .orderBy(asc(messages.occurredAt));

  const thread: ThreadMessage[] = messageRows.map((m) => ({
    id: m.id,
    channel: m.channel,
    direction: m.direction,
    fromLabel: m.fromUserFirstName || m.fromUserEmail || m.fromAddress || null,
    toAddress: m.toAddress,
    preview: m.preview,
    body: m.body,
    occurredAt: m.occurredAt,
    deliveryStatus: m.deliveryStatus,
    deliveryProvider: m.deliveryProvider,
    deliveryError: m.deliveryError,
  }));

  // ── Words ──
  const clientName = personName(
    memberRow?.firstName,
    memberRow?.lastName,
    memberRow?.preferredName ?? memberRow?.legalName ?? memberRow?.email ?? "No name yet",
  );
  const firstName = memberRow?.firstName?.trim() || clientName.split(" ")[0];
  const first = legs[0] ?? null;
  const titleRoute = first
    ? `${cityWords(first.fromCity, first.fromName, first.fromIata)} → ${cityWords(first.toCity, first.toName, first.toIata)}`
    : "Route to confirm";
  const leadParts: string[] = [];
  if (first) {
    const d = legDayWords(first);
    const c = legDepartClock(first);
    if (d || c) leadParts.push([d, c].filter(Boolean).join(", "));
  }
  leadParts.push(passengersWords(trip.paxCount));
  leadParts.push(missionWords(trip.missionType, legs.length));

  const state = tripState(trip.status);
  const craft = aircraftLine({
    makeModel: acRow?.makeModel,
    tailNumber: acRow?.tailNumber,
    operatorName: opRow?.name,
    optionType: chosenOption?.aircraftType,
    optionTail: chosenOption?.tailNumber,
    optionOperator: chosenOption?.operatorNameRaw,
  });
  const ground = groundWords(originatingQuote?.groundOption);

  const inv = tripInvoice ?? null;
  const invWords = inv ? invoiceWords(inv.status, inv.dueOn, now) : null;
  const invoicePaid = inv?.status === "paid";
  const invoiceOpen = inv?.status === "due" || inv?.status === "overdue";
  const dueWords = inv?.dueOn ? formatDay(inv.dueOn) : null;
  const paidWords = inv?.paidOn ? formatDay(inv.paidOn) : null;
  const sentWords = inv?.issuedOn ? formatDay(inv.issuedOn) : null;
  const todayKey = dayKey(now);

  return (
    <DeskPage>
      <DeskHeader
        back={{ href: "/admin/trips", label: "All trips" }}
        title={`${clientName} · ${titleRoute}`}
        lead={leadParts.join(" · ")}
        actions={
          <>
            <StatusPill tone={state.dot}>{state.label}</StatusPill>
            <ContactButtons phone={memberRow?.phoneE164} email={memberRow?.email} />
          </>
        }
      />

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ── Left column ── */}
        <div className="flex min-w-0 flex-col gap-4">
          <DeskCard title="The flight">
            {legs.length === 0 ? (
              <p className="mt-3 text-bone-2">No legs on this trip yet.</p>
            ) : (
              <div className="mt-3 flex flex-col divide-y divide-line-faint">
                {legs.map((l) => (
                  <div key={l.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="text-[17px] font-medium text-bone">{legRoute(l)}</div>
                    <div className="mt-0.5 text-bone-2">{legSentence(l)}</div>
                    <div className="mt-0.5 text-[14px] text-steel">{craft ?? "Aircraft to confirm"}</div>
                    <dl className="dl-jn mt-3.5 text-[14px]">
                      <dt>Departs from</dt>
                      <dd className="text-bone-2">
                        {l.fromName ?? l.fromCity ?? l.fromIata ?? "Airport to confirm"}
                        <span className="text-steel"> · dispatch sends the exact address</span>
                      </dd>
                      <dt>Arrives at</dt>
                      <dd className="text-bone-2">
                        {l.toName ?? l.toCity ?? l.toIata ?? "Airport to confirm"}
                        {ground ? <span className="text-steel"> · {ground}</span> : null}
                      </dd>
                      {l.statusNote ? (
                        <>
                          <dt>Note</dt>
                          <dd className="text-bone-2">{l.statusNote}</dd>
                        </>
                      ) : null}
                    </dl>
                  </div>
                ))}
              </div>
            )}
          </DeskCard>

          <div id="money" className="scroll-mt-6">
          <DeskCard title="Money">
            {!inv || !invWords ? (
              <p className="mt-3 text-bone-2">No invoice on this trip yet.</p>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <DotSentence tone={invWords.tone} className="text-[17px] font-medium text-bone">
                      {invWords.text}
                    </DotSentence>
                    <div className="mt-0.5 text-[14px] text-bone-2">
                      {invoicePaid
                        ? paidWords
                          ? `Paid ${paidWords}`
                          : "Paid"
                        : [
                            sentWords && inv.status !== "draft" ? `Invoice sent ${sentWords}` : null,
                            dueWords ? `due ${dueWords}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "Figures are still being set up"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-serif text-[32px] font-light leading-none text-bone">
                      {inv.totalUsd ? formatUSD(inv.totalUsd) : "—"}
                    </div>
                  </div>
                </div>

                {inv.status === "draft" ? (
                  <div className="mt-5 border-t border-line-faint pt-5">
                    <p className="text-[14px] text-bone-2">
                      Check the figures, then send the invoice. {firstName} gets an email with a Pay
                      button once it is sent.
                    </p>
                    <InvoiceFinalizeForm
                      invoiceId={inv.id}
                      initial={{
                        subtotalUsd: inv.subtotalUsd,
                        fetUsd: inv.fetUsd,
                        segmentFeeUsd: inv.segmentFeeUsd,
                        totalUsd: inv.totalUsd,
                        dueOn: inv.dueOn,
                        notes: inv.notes,
                      }}
                    />
                  </div>
                ) : (
                  <details className="group mt-5 border-t border-line-faint pt-4" open={invoiceOpen}>
                    <summary className="cursor-pointer list-none text-[14px] text-bone-2 transition-colors hover:text-bone">
                      <span className="inline-block w-4 transition-transform group-open:rotate-90">›</span> Breakdown
                    </summary>
                    <dl className="dl-jn mt-3 text-[14px]">
                      <dt>Charter</dt>
                      <dd className="text-bone-2">{inv.subtotalUsd ? formatUSD(inv.subtotalUsd) : "—"}</dd>
                      <dt>Federal excise tax</dt>
                      <dd className="text-bone-2">{inv.fetUsd ? formatUSD(inv.fetUsd) : "—"}</dd>
                      <dt>Segment fees</dt>
                      <dd className="text-bone-2">{inv.segmentFeeUsd ? formatUSD(inv.segmentFeeUsd) : "—"}</dd>
                      <dt>Total</dt>
                      <dd>{inv.totalUsd ? formatUSD(inv.totalUsd) : "—"}</dd>
                      {inv.notes ? (
                        <>
                          <dt>Notes</dt>
                          <dd className="text-bone-2">{inv.notes}</dd>
                        </>
                      ) : null}
                    </dl>
                    <p className="mt-3 text-[13px] text-steel">Figures are locked once the invoice is sent.</p>
                  </details>
                )}
              </>
            )}

            {trip.revenueUsd || trip.operatorCostUsd || trip.marginPct || trip.processorFeeUsd ? (
              <details className="group mt-4 border-t border-line-faint pt-4">
                <summary className="cursor-pointer list-none text-[14px] text-bone-2 transition-colors hover:text-bone">
                  <span className="inline-block w-4 transition-transform group-open:rotate-90">›</span> What JetNine
                  makes on this trip
                </summary>
                <dl className="dl-jn mt-3 text-[14px]">
                  <dt>Client pays</dt>
                  <dd className="text-bone-2">{trip.revenueUsd ? formatUSD(trip.revenueUsd) : "—"}</dd>
                  <dt>Operator cost</dt>
                  <dd className="text-bone-2">{trip.operatorCostUsd ? formatUSD(trip.operatorCostUsd) : "—"}</dd>
                  <dt>Margin</dt>
                  <dd className="text-bone-2">{trip.marginPct ? `${trip.marginPct}%` : "—"}</dd>
                  <dt>Card fees</dt>
                  <dd className="text-bone-2">{trip.processorFeeUsd ? formatUSD(trip.processorFeeUsd) : "—"}</dd>
                </dl>
              </details>
            ) : null}
          </DeskCard>
          </div>

          <div id="conversation" className="scroll-mt-6">
          <DeskCard
            title="Conversation"
            actions={
              <span className="text-[13px] text-steel">
                {thread.length} message{thread.length === 1 ? "" : "s"}
              </span>
            }
          >
            <div className="mt-3">
              <MarkThreadRead subjectType="trip" subjectId={trip.id} />
              <MessageThread
                initial={thread}
                defaultEmail={memberRow?.email ?? null}
                defaultPhone={memberRow?.phoneE164 ?? null}
                postAction={postTripMessage.bind(null, trip.id)}
                composerHint={`Hi ${firstName}, your crew is briefed and departure is still on schedule.`}
                clientName={firstName}
              />
            </div>
          </DeskCard>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="flex min-w-0 flex-col gap-4">
          <DeskCard title={firstName}>
            <div className="mt-3 text-[17px] font-medium text-bone">{clientName}</div>
            <dl className="dl-jn mt-3 text-[14px]">
              {memberRow?.phoneE164 ? (
                <>
                  <dt>Phone</dt>
                  <dd>
                    <a href={`tel:${memberRow.phoneE164}`} className="text-bone-2 transition-colors hover:text-bone">
                      {memberRow.phoneE164}
                    </a>
                  </dd>
                </>
              ) : null}
              {memberRow?.email ? (
                <>
                  <dt>Email</dt>
                  <dd className="min-w-0 break-words">
                    <a href={`mailto:${memberRow.email}`} className="text-bone-2 transition-colors hover:text-bone">
                      {memberRow.email}
                    </a>
                  </dd>
                </>
              ) : null}
              <dt>Membership</dt>
              <dd className="text-bone-2">{tierWords(memberRow?.tier)}</dd>
            </dl>
            <Link href={`/admin/clients/${trip.memberId}`} className="text-link mt-4 inline-block text-[14px]">
              Client page
            </Link>
          </DeskCard>

          <DeskCard title="Desk tools">
            <div className="mt-3">
              <TripStatusSelect tripId={trip.id} current={trip.status} />
            </div>
            <p className="mt-4 text-[13px] text-steel">
              Reference {trip.tripCode || "pending"}
              {originatingQuote ? (
                <>
                  {" · from request "}
                  <Link href={`/admin/requests/${originatingQuote.id}`} className="underline underline-offset-[3px] hover:text-bone">
                    {originatingQuote.quoteCode}
                  </Link>
                </>
              ) : null}
            </p>
            <dl className="dl-jn mt-4 text-[14px]">
              <dt>Crew</dt>
              <dd className="text-bone-2">
                {trip.crewCount} on board{trip.isInternational ? " · international" : ""}
              </dd>
              <dt>Passenger list</dt>
              <dd className="text-bone-2">
                {trip.manifestLockedAt ? `Locked ${stamp(trip.manifestLockedAt)}` : "Still open"}
              </dd>
              {trip.isInternational ? (
                <>
                  <dt>Customs filing</dt>
                  <dd className="text-bone-2">{trip.apisFiledAt ? `Filed ${stamp(trip.apisFiledAt)}` : "Not filed yet"}</dd>
                </>
              ) : null}
              {trip.wheelsUpAt ? (
                <>
                  <dt>Took off</dt>
                  <dd className="text-bone-2">{stamp(trip.wheelsUpAt)}</dd>
                </>
              ) : null}
              {trip.wheelsDownAt ? (
                <>
                  <dt>Landed</dt>
                  <dd className="text-bone-2">{stamp(trip.wheelsDownAt)}</dd>
                </>
              ) : null}
              {trip.etaAt && !trip.wheelsDownAt && dayKey(trip.etaAt) >= todayKey ? (
                <>
                  <dt>Expected landing</dt>
                  <dd className="text-bone-2">{stamp(trip.etaAt)}</dd>
                </>
              ) : null}
            </dl>
            {opRow ? (
              <p className="mt-4 text-[13px] text-steel">
                Operator{" "}
                <Link href={`/admin/operators/${opRow.id}`} className="underline underline-offset-[3px] hover:text-bone">
                  {opRow.name}
                </Link>
                {acRow?.yearManufactured ? ` · aircraft built ${acRow.yearManufactured}` : ""}
              </p>
            ) : null}
            {trip.notesDispatch ? (
              <div className="mt-4 border-t border-line-faint pt-4">
                <div className="text-[13px] text-steel">Dispatch notes</div>
                <p className="mt-1 whitespace-pre-line text-[14px] text-bone-2">{trip.notesDispatch}</p>
              </div>
            ) : null}
            {trip.notesMember ? (
              <div className="mt-4 border-t border-line-faint pt-4">
                <div className="text-[13px] text-steel">From {firstName}</div>
                <p className="mt-1 whitespace-pre-line text-[14px] text-bone-2">{trip.notesMember}</p>
              </div>
            ) : null}
          </DeskCard>
        </div>
      </div>
    </DeskPage>
  );
}
