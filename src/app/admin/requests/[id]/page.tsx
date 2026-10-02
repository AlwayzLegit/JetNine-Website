import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, gte, ne, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { quotes, quoteLegs } from "@/db/schema/quotes";
import { staff } from "@/db/schema/staff";
import { users } from "@/db/schema/users";
import { aircraft } from "@/db/schema/aircraft";
import { operators } from "@/db/schema/operators";
import { messages } from "@/db/schema/audit";
import { members } from "@/db/schema/members";
import { trips } from "@/db/schema/trips";
import { aircraftScheduleBlocks } from "@/db/schema/schedule-blocks";
import { sourcedOptions } from "@/db/schema/sourced-option";
import { ContactButtons, DeskCard, DeskHeader, DeskPage, StatusPill } from "@/components/admin/desk-ui";
import { StatusSelect } from "@/components/admin/status-select";
import { MemberAttach, type MemberOption } from "@/components/admin/member-attach";
import { DispatcherAssign } from "@/components/admin/dispatcher-assign";
import { ConvertQuoteButton } from "@/components/admin/convert-quote-button";
import { MessageThread, type ThreadMessage } from "@/components/admin/message-thread";
import { MarkThreadRead } from "@/components/admin/mark-thread-read";
import { SoftHoldButton } from "@/components/admin/soft-hold-button";
import { SoftHoldList, type HeldAircraft } from "@/components/admin/soft-hold-list";
import { SourcedOptions, type SourcedOptionRow } from "@/components/admin/sourced-options";
import { postQuoteMessage } from "@/app/admin/requests/[id]/actions";
import { DEFAULT_MARKUP_PCT } from "@/lib/constants";
import { statusPath } from "@/lib/request-status";
import { isE164, toE164 } from "@/lib/phone";
import {
  passengersWords,
  personName,
  replyDueLine,
  requestStage,
  tierWords,
} from "@/lib/desk-status";
import { CATEGORY_PLAIN, formatDay, formatMinutes } from "@/lib/request-page";
import {
  airportWords,
  bestTimeWords,
  contactMethodsWords,
  dayPart,
  estimateFlightMinutes,
  fromWords,
  namelessWords,
  routeWords,
  sourceWords,
  stampWords,
  toWords,
  tripLeadWords,
} from "@/components/admin/requests/words";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const CABIN_LABELS: Record<string, string> = {
  wifi: "Wi-Fi",
  attendant: "Flight attendant",
  lavatory: "Enclosed lavatory",
  standup: "Stand-up cabin",
  lieflat: "Lie-flat seating",
  pet: "Pet-friendly",
};

const GROUND_LABEL: Record<string, string> = {
  none: "No ground transport",
  sedan: "Black sedan",
  suv_sprinter: "SUV / Sprinter",
  custom: "Custom ground transport",
};

const CATERING_LABEL: Record<string, string> = {
  standard: "Standard catering",
  plus: "Plus catering",
  premium: "Premium catering",
  custom: "Custom catering",
};

const ARGUS_WORDS: Record<string, string> = {
  platinum: "ARG/US Platinum",
  gold: "ARG/US Gold",
  silver: "ARG/US Silver",
};

export default async function RequestPage({ params }: Props) {
  const { id } = await params;
  const now = new Date();

  const [quote] = await db.select().from(quotes).where(eq(quotes.id, id));
  if (!quote) notFound();

  // Member linkage — roster for the link control plus the currently linked
  // row (kept separate from the active-only options so a paused member
  // still displays on an old request).
  const memberRows = await db
    .select({
      id: members.id,
      memberCode: members.memberCode,
      preferredName: members.preferredName,
      legalName: members.legalName,
      status: members.status,
      tier: members.tier,
    })
    .from(members)
    .orderBy(asc(members.memberCode));
  const toOption = (m: (typeof memberRows)[number]): MemberOption => ({
    id: m.id,
    memberCode: m.memberCode,
    label: m.preferredName ?? m.legalName ?? "—",
  });
  const memberOptions = memberRows.filter((m) => m.status === "active").map(toOption);
  const linkedMemberRow = quote.memberId ? memberRows.find((m) => m.id === quote.memberId) : undefined;
  const linkedMember = linkedMemberRow ? toOption(linkedMemberRow) : null;

  const legs = await db
    .select()
    .from(quoteLegs)
    .where(eq(quoteLegs.quoteId, id))
    .orderBy(asc(quoteLegs.legNumber));

  // Dispatcher options + current assignment.
  const dispatchers = await db
    .select({ id: staff.id, displayName: staff.displayName })
    .from(staff)
    .innerJoin(users, eq(users.id, staff.userId))
    .where(eq(users.role, "dispatcher"));

  let assigned: { id: string; displayName: string } | null = null;
  if (quote.assignedDispatcherId) {
    const [row] = await db
      .select({ id: staff.id, displayName: staff.displayName })
      .from(staff)
      .where(eq(staff.id, quote.assignedDispatcherId));
    assigned = row ?? null;
  }

  // How many times a linked client has flown with us.
  let flownCount: number | null = null;
  if (quote.memberId) {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(trips)
      .where(
        and(
          eq(trips.memberId, quote.memberId),
          notInArray(trips.status, ["draft", "cancelled_wx", "cancelled_other"]),
        ),
      );
    flownCount = row?.n ?? 0;
  }

  const cabinFlags = (quote.cabinPrefs ?? {}) as Record<string, boolean>;
  const activeCabin = Object.entries(cabinFlags)
    .filter(([, v]) => v)
    .map(([k]) => CABIN_LABELS[k] ?? k);

  const contact = quote.contactSnapshot ?? null;
  const first = contact?.firstName?.trim() || null;
  const name = personName(contact?.firstName, contact?.lastName, namelessWords(quote.source));
  // Post-launch rows store E.164 already; legacy rows need the dial code.
  const phone = contact?.phoneE164
    ? isE164(contact.phoneE164)
      ? contact.phoneE164
      : (toE164(contact.phoneE164, contact.phoneCountry) ?? `${contact.phoneCountry ?? ""}${contact.phoneE164}`)
    : null;
  const email = contact?.email?.trim() || null;

  const totalDistance = legs.reduce((sum, l) => sum + (l.distanceNm ?? 0), 0);
  const longestLeg = legs.reduce((max, l) => Math.max(max, l.distanceNm ?? 0), 0);

  // ── Messages thread (subject_type='quote') ──
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
    .where(and(eq(messages.subjectType, "quote"), eq(messages.subjectId, id)))
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

  // ── Active soft holds for this request ──
  const heldRows = await db
    .select({
      blockId: aircraftScheduleBlocks.id,
      aircraftId: aircraftScheduleBlocks.aircraftId,
      startAt: aircraftScheduleBlocks.startAt,
      endAt: aircraftScheduleBlocks.endAt,
      tailNumber: aircraft.tailNumber,
      makeModel: aircraft.makeModel,
    })
    .from(aircraftScheduleBlocks)
    .innerJoin(aircraft, eq(aircraft.id, aircraftScheduleBlocks.aircraftId))
    .where(and(eq(aircraftScheduleBlocks.relatedQuoteId, id), eq(aircraftScheduleBlocks.kind, "hold")))
    .orderBy(asc(aircraftScheduleBlocks.startAt));

  const heldAircraft: HeldAircraft[] = heldRows.map((h) => ({
    blockId: h.blockId,
    aircraftId: h.aircraftId,
    tailNumber: h.tailNumber,
    makeModel: h.makeModel,
    startAt: h.startAt,
    endAt: h.endAt,
  }));
  const heldIds = new Set(heldAircraft.map((h) => h.aircraftId));

  // ── Active soft holds on candidates by OTHER requests ──
  const conflictRows = await db
    .select({
      aircraftId: aircraftScheduleBlocks.aircraftId,
      relatedQuoteId: aircraftScheduleBlocks.relatedQuoteId,
      quoteCode: quotes.quoteCode,
    })
    .from(aircraftScheduleBlocks)
    .innerJoin(quotes, eq(quotes.id, aircraftScheduleBlocks.relatedQuoteId))
    .where(eq(aircraftScheduleBlocks.kind, "hold"));

  const otherHoldsByAircraft = new Map<string, string[]>();
  for (const c of conflictRows) {
    if (c.relatedQuoteId === id) continue;
    const arr = otherHoldsByAircraft.get(c.aircraftId) ?? [];
    arr.push(c.quoteCode);
    otherHoldsByAircraft.set(c.aircraftId, arr);
  }

  // ── Candidate aircraft in our own network ──
  // Match by requested category + enough seats + enough range. Operator must
  // not be suspended/banned/on hold. Preferred partners first, then ARG/US
  // tier, then Wyvern. Cap at 8.
  const candidates = quote.requestedCategory
    ? await db
        .select({
          id: aircraft.id,
          tailNumber: aircraft.tailNumber,
          makeModel: aircraft.makeModel,
          yearManufactured: aircraft.yearManufactured,
          seats: aircraft.seats,
          rangeNm: aircraft.rangeNm,
          speedKt: aircraft.speedKt,
          wifiType: aircraft.wifiType,
          baseIcao: aircraft.baseIcao,
          status: aircraft.status,
          operatorId: aircraft.operatorId,
          operatorName: operators.name,
          isPreferred: operators.isPreferred,
          argusRating: operators.argusRating,
          wyvernWingman: operators.wyvernWingman,
        })
        .from(aircraft)
        .innerJoin(operators, eq(operators.id, aircraft.operatorId))
        .where(
          and(
            eq(aircraft.category, quote.requestedCategory),
            eq(aircraft.status, "available"),
            gte(aircraft.seats, quote.paxCount),
            gte(aircraft.rangeNm, longestLeg),
            ne(operators.status, "suspended"),
            ne(operators.status, "banned"),
            ne(operators.status, "hold"),
          ),
        )
        .orderBy(
          desc(operators.isPreferred),
          sql`case ${operators.argusRating}
            when 'platinum' then 0
            when 'gold' then 1
            when 'silver' then 2
            else 3 end`,
          desc(operators.wyvernWingman),
          asc(aircraft.tailNumber),
        )
        .limit(8)
    : [];

  // ── Sourced options (Avinode paste-ins) ──
  const sourcedRows = await db
    .select({
      id: sourcedOptions.id,
      optionNumber: sourcedOptions.optionNumber,
      avinodeRef: sourcedOptions.avinodeRef,
      aircraftType: sourcedOptions.aircraftType,
      tailNumber: sourcedOptions.tailNumber,
      isFloatingFleet: sourcedOptions.isFloatingFleet,
      yearOfMake: sourcedOptions.yearOfMake,
      category: sourcedOptions.category,
      paxCapacity: sourcedOptions.paxCapacity,
      refurbInteriorYear: sourcedOptions.refurbInteriorYear,
      refurbExteriorYear: sourcedOptions.refurbExteriorYear,
      operatorNameRaw: sourcedOptions.operatorNameRaw,
      operatorMatched: sourcedOptions.operatorMatched,
      safetyFloorPassed: sourcedOptions.safetyFloorPassed,
      positioningTimeMin: sourcedOptions.positioningTimeMin,
      positioningAirport: sourcedOptions.positioningAirport,
      totalFlightTimeMin: sourcedOptions.totalFlightTimeMin,
      operatorCostUsd: sourcedOptions.operatorCostUsd,
      markupType: sourcedOptions.markupType,
      markupValue: sourcedOptions.markupValue,
      clientPriceUsd: sourcedOptions.clientPriceUsd,
      isChosen: sourcedOptions.isChosen,
      status: sourcedOptions.status,
      dispatcherNotes: sourcedOptions.dispatcherNotes,
    })
    .from(sourcedOptions)
    .where(eq(sourcedOptions.quoteId, id))
    .orderBy(asc(sourcedOptions.optionNumber));
  const sourced: SourcedOptionRow[] = sourcedRows;

  // ── Words ──
  const stage = requestStage(quote.status);
  const due = replyDueLine(quote.slaDeadlineAt, quote.status, now);
  const pillText = due ? `${stage.label} · ${due.text.replace(/^Reply /, "")}` : stage.label;
  const pillTone = due?.tone === "danger" ? "danger" : stage.dot;

  const route = routeWords(legs);
  const title = route ? `${name} · ${route}` : name;
  const lead = tripLeadWords(legs, quote.tripType, passengersWords(quote.paxCount));

  const outLeg = legs[0] ?? null;
  const backLeg = quote.tripType === "round" && legs.length > 1 ? legs[legs.length - 1] : null;
  const isMulti = quote.tripType === "multi_leg";

  const paxLine = [
    String(quote.paxCount),
    quote.childrenCount ? `${quote.childrenCount} ${quote.childrenCount === 1 ? "child" : "children"}` : null,
    quote.petsCount ? `${quote.petsCount} pet${quote.petsCount === 1 ? "" : "s"}` : null,
    quote.extraBagsCount ? `${quote.extraBagsCount} extra bag${quote.extraBagsCount === 1 ? "" : "s"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const flying = [
    formatMinutes(estimateFlightMinutes(totalDistance, legs.length, quote.requestedCategory)),
    totalDistance ? `${totalDistance.toLocaleString()} nm` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const extras = [
    CATERING_LABEL[quote.cateringTier ?? "standard"],
    GROUND_LABEL[quote.groundOption ?? "sedan"],
    ...activeCabin,
  ].join(" · ");

  const methods = contactMethodsWords(quote.contactMethods);
  const bestTime = bestTimeWords(quote.bestTime);
  const prefersLine = methods
    ? `Prefers ${methods}${bestTime ? ` · ${bestTime}` : ""}`
    : bestTime
      ? `Reach them ${bestTime.replace(/^best /, "")}`
      : "No contact preference given";

  const flownLine = linkedMemberRow
    ? flownCount
      ? `Flown with us ${flownCount} time${flownCount === 1 ? "" : "s"} · ${tierWords(linkedMemberRow.tier)}`
      : `Hasn't flown with us yet · ${tierWords(linkedMemberRow.tier)}`
    : contact?.account === "returning"
      ? "Says they've flown with us before · not linked to a client record yet"
      : "New client";

  // Stage strip: 1 add options → 2 send → 3 they pick → 4 confirm.
  // 0 = closed (nothing current), 5 = everything done (converted).
  const currentStep =
    stage.key === "reply" || stage.key === "working"
      ? sourced.length >= 2
        ? 2
        : 1
      : stage.key === "sent"
        ? 3
        : stage.key === "booked"
          ? quote.status === "converted"
            ? 5
            : 4
          : 0;
  const steps = [
    "Add 2–3 options",
    `Send them to ${first ?? "the client"}`,
    `${first ?? "They"} pick${first ? "s" : ""} one`,
    "Confirm → becomes a Trip",
  ];

  const consentYes = [
    quote.consentBroker ? "broker disclosure and terms" : null,
    quote.consentContact ? "contact on the channels they picked" : null,
    quote.consentMarketing ? "empty-leg and seasonal offers" : null,
  ].filter(Boolean);
  const consentNo = [
    !quote.consentBroker ? "broker disclosure" : null,
    !quote.consentContact ? "contact" : null,
    !quote.consentMarketing ? "offers" : null,
  ].filter(Boolean);

  const history: string[] = [
    `Received by ${sourceWords(quote.source)} · ${stampWords(quote.receivedAt) ?? "time unknown"}`,
  ];
  if (assigned) history.push(`Routed to ${assigned.displayName}`);
  if (quote.status !== "submitted") history.push(`Now: ${stage.label}`);
  if (quote.respondedAt) history.push(`First reply · ${stampWords(quote.respondedAt)}`);
  if (quote.acceptedAt) history.push(`Booked · ${stampWords(quote.acceptedAt)}`);

  return (
    <DeskPage>
      <DeskHeader
        back={{ href: "/admin/requests", label: "All requests" }}
        title={title}
        lead={lead}
        actions={
          <>
            <StatusPill tone={pillTone}>{pillText}</StatusPill>
            <ContactButtons phone={phone} email={email} />
          </>
        }
      />

      {/* Stage strip */}
      <ol className="card mt-6 grid grid-cols-1 gap-3 px-5 py-3.5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        {steps.map((label, idx) => {
          const n = idx + 1;
          const state =
            currentStep === 0 ? "future" : n < currentStep ? "done" : n === currentStep ? "current" : "future";
          return (
            <li
              key={label}
              aria-current={state === "current" ? "step" : undefined}
              className={`flex items-center gap-2.5 ${state === "future" ? "text-steel" : "text-bone"}`}
            >
              <span
                aria-hidden="true"
                className={[
                  "flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-[13px]",
                  state === "done"
                    ? "bg-clearance font-semibold text-ink"
                    : state === "current"
                      ? "border-2 border-gold font-semibold"
                      : "border border-line-2",
                ].join(" ")}
              >
                {state === "done" ? "✓" : n}
              </span>
              <span className={state === "current" ? "font-medium" : ""}>{label}</span>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 grid grid-cols-1 items-start gap-5 lg:grid-cols-[230px_minmax(320px,1fr)_260px]">
        {/* ─── The trip ─── */}
        <DeskCard title="The trip" className="min-w-0">
          <dl className="dl-jn mt-2.5">
            {isMulti ? (
              legs.map((l) => (
                <LegRows key={l.id} leg={l} />
              ))
            ) : outLeg ? (
              <>
                <dt>From</dt>
                <dd>
                  {fromWords(outLeg)}
                  <Sub>{airportWords(outLeg.fromName, outLeg.fromIata)}</Sub>
                </dd>
                <dt>To</dt>
                <dd>
                  {toWords(outLeg)}
                  <Sub>{airportWords(outLeg.toName, outLeg.toIata)}</Sub>
                </dd>
                <dt>Out</dt>
                <dd>{whenWords(outLeg.departDate, outLeg.departTime)}</dd>
                {backLeg ? (
                  <>
                    <dt>Back</dt>
                    <dd>{whenWords(backLeg.departDate, backLeg.departTime)}</dd>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <dt>Route</dt>
                <dd className="text-steel">Not set yet</dd>
              </>
            )}
            <dt>Passengers</dt>
            <dd>{paxLine}</dd>
            {quote.requestedCategory ? (
              <>
                <dt>Aircraft</dt>
                <dd>{CATEGORY_PLAIN[quote.requestedCategory] ?? quote.requestedCategory}</dd>
              </>
            ) : null}
            {flying ? (
              <>
                <dt>Flying</dt>
                <dd>{flying}</dd>
              </>
            ) : null}
            <dt>Extras</dt>
            <dd>{extras}</dd>
            {quote.notes ? (
              <>
                <dt>Notes</dt>
                <dd className="whitespace-pre-line">{quote.notes}</dd>
              </>
            ) : null}
          </dl>
          {quote.statusToken ? (
            <a
              href={statusPath(quote.statusToken)}
              target="_blank"
              rel="noreferrer"
              className="text-link mt-3 inline-block text-[14px]"
            >
              Client&rsquo;s page <span aria-hidden="true">↗</span>
            </a>
          ) : null}

          {/* The client */}
          <div className="mt-[18px] border-t border-line pt-4">
            <h3 className="label-jn text-[13px]">{first ?? "The client"}</h3>
            <p className="mt-2 text-[15px] leading-[1.5] text-bone">
              {prefersLine}
              {phone || email ? (
                <>
                  <br />
                  <span className="text-bone-2">{[phone, email].filter(Boolean).join(" · ")}</span>
                </>
              ) : null}
              <br />
              {flownLine}
              {contact?.company ? (
                <>
                  <br />
                  <span className="text-[14px] text-steel">{contact.company}</span>
                </>
              ) : null}
            </p>
            <details className="mt-3">
              <summary className="text-link cursor-pointer list-none text-[14px]">
                {linkedMember ? "Linked client record" : "Link to a client record"}
              </summary>
              <div className="mt-3">
                <MemberAttach
                  quoteId={quote.id}
                  current={linkedMember}
                  options={memberOptions}
                  locked={Boolean(quote.convertedTripId)}
                />
              </div>
            </details>
            {linkedMember ? (
              <Link href={`/admin/clients/${linkedMember.id}`} className="text-link mt-2.5 inline-block text-[14px]">
                Client page
              </Link>
            ) : null}
          </div>
        </DeskCard>

        {/* ─── Options to send ─── */}
        <SourcedOptions
          quoteId={quote.id}
          initial={sourced}
          defaultMarkupPct={DEFAULT_MARKUP_PCT}
          clientFirstName={first}
          quoteStatus={quote.status}
          avinode={{
            paxCount: quote.paxCount,
            requestedCategory: quote.requestedCategory,
            legs: legs.map((l) => ({
              fromIcao: l.fromIcao,
              toIcao: l.toIcao,
              departDate: l.departDate,
              departTime: l.departTime,
            })),
          }}
        >
          <details>
            <summary className="text-link cursor-pointer list-none text-[14px]">Our fleet matches and holds</summary>
            <div className="mt-3.5 flex flex-col gap-5">
              <div>
                <h3 className="label-jn text-[13px]">
                  Fleet matches
                  {candidates.length ? <span className="text-steel-dim"> · {candidates.length}</span> : null}
                </h3>
                {!quote.requestedCategory ? (
                  <p className="mt-2 text-[14px] text-steel">
                    No aircraft category on this request, so there is nothing to match yet.
                  </p>
                ) : candidates.length === 0 ? (
                  <p className="mt-2 text-[14px] text-bone-2">
                    Nothing in our network fits this trip. Widen the category or source it from Avinode.
                  </p>
                ) : (
                  <ul className="mt-2.5 flex flex-col gap-2">
                    {candidates.map((c) => {
                      const held = heldIds.has(c.id);
                      const racing = otherHoldsByAircraft.get(c.id);
                      const facts = [
                        c.operatorName,
                        c.argusRating && c.argusRating !== "none" ? ARGUS_WORDS[c.argusRating] ?? null : null,
                        c.wyvernWingman ? "Wyvern" : null,
                        `${c.seats} seats`,
                        `${c.rangeNm.toLocaleString()} nm range`,
                      ]
                        .filter(Boolean)
                        .join(" · ");
                      return (
                        <li
                          key={c.id}
                          className={`rounded-control border bg-ink px-4 py-3 ${
                            held ? "border-dashed border-clearance" : "border-line"
                          }`}
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <div className="text-[15px] text-bone">
                              {c.makeModel}
                              <span className="text-steel">
                                {c.yearManufactured ? ` · ${c.yearManufactured}` : ""} · {c.tailNumber}
                              </span>
                            </div>
                            {c.isPreferred ? <span className="pill">Preferred partner</span> : null}
                          </div>
                          <div className="mt-0.5 text-[13px] text-steel">{facts}</div>
                          {racing?.length ? (
                            <div className="mt-1 text-[13px] text-gold">Also held for {racing.join(", ")}</div>
                          ) : null}
                          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
                            <Link href={`/admin/aircraft/${c.id}`} className="text-link text-[14px]">
                              Open this aircraft
                            </Link>
                            <SoftHoldButton quoteId={quote.id} aircraftId={c.id} alreadyHeld={held} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {quote.requestedCategory && candidates.length ? (
                  <p className="mt-2.5 text-[13px] text-steel">
                    Preferred partners first, then ARG/US tier and Wyvern. A hold shows on the planner.
                  </p>
                ) : null}
              </div>
              <div>
                <h3 className="label-jn text-[13px]">
                  Holds
                  {heldAircraft.length ? <span className="text-steel-dim"> · {heldAircraft.length}</span> : null}
                </h3>
                <div className="mt-2.5">
                  <SoftHoldList quoteId={quote.id} initial={heldAircraft} />
                </div>
              </div>
            </div>
          </details>
        </SourcedOptions>

        {/* ─── Conversation ─── */}
        <div id="conversation" className="min-w-0 scroll-mt-6">
          <DeskCard title="Conversation">
            <div className="mt-3">
              <MarkThreadRead subjectType="quote" subjectId={quote.id} />
              <MessageThread
                now={now}
                initial={thread}
                defaultEmail={email}
                defaultPhone={phone}
                postAction={postQuoteMessage.bind(null, quote.id)}
                composerHint={first ? `Reply to ${first}…` : "Reply to the client…"}
                clientName={first ?? name}
                compact
              />
            </div>

            <details className="mt-5 border-t border-line pt-4">
              <summary className="text-link cursor-pointer list-none text-[14px]">Desk tools</summary>
              <div className="mt-4 flex flex-col gap-4">
                <StatusSelect quoteId={quote.id} current={quote.status} />
                <DispatcherAssign quoteId={quote.id} current={assigned} dispatchers={dispatchers} />
                <ConvertQuoteButton
                  quoteId={quote.id}
                  alreadyConvertedTripId={quote.convertedTripId}
                  status={quote.status}
                />
                <div className="flex flex-col gap-1.5 text-[13px] leading-[1.5] text-steel">
                  <p>
                    Reference {quote.quoteCode} · came in by {sourceWords(quote.source)} · received{" "}
                    {stampWords(quote.receivedAt) ?? "—"}
                  </p>
                  <p>
                    {consentYes.length ? `Agreed to ${consentYes.join(", ")}.` : "No consents on file."}
                    {consentNo.length ? ` Did not agree to ${consentNo.join(", ")}.` : ""}
                  </p>
                  <ul className="flex flex-col gap-0.5">
                    {history.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </details>
          </DeskCard>
        </div>
      </div>
    </DeskPage>
  );
}

/** 13px steel line under a city in the trip dl. */
function Sub({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <>
      <br />
      <span className="text-[13px] text-steel">{children}</span>
    </>
  );
}

/** "Fri Oct 3, morning" */
function whenWords(date: string | null, time: string | null): string {
  const d = formatDay(date);
  if (!d) return "Date not set";
  const p = dayPart(time);
  return p ? `${d}, ${p}` : d;
}

/** One multi-leg row: "Leg 2 · City → City, Fri Oct 3, morning" */
function LegRows({ leg }: { leg: typeof quoteLegs.$inferSelect }) {
  return (
    <>
      <dt>Leg {leg.legNumber}</dt>
      <dd>
        {fromWords(leg)} → {toWords(leg)}
        <Sub>
          {whenWords(leg.departDate, leg.departTime)}
          {leg.fromIata || leg.toIata ? ` · ${leg.fromIata ?? "—"} → ${leg.toIata ?? "—"}` : ""}
        </Sub>
      </dd>
    </>
  );
}
