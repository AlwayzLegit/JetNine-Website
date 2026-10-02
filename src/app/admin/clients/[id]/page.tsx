import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import type { ReactNode } from "react";
import { db } from "@/db";
import { members } from "@/db/schema/members";
import { users } from "@/db/schema/users";
import { staff } from "@/db/schema/staff";
import { aircraft } from "@/db/schema/aircraft";
import { airports } from "@/db/schema/airports";
import { memberPreferences, memberLanes, companions, memberDocuments } from "@/db/schema/member-prefs";
import { memberships, reserveTransactions } from "@/db/schema/memberships";
import { trips, tripLegs } from "@/db/schema/trips";
import { invoices } from "@/db/schema/invoices";
import { quotes, quoteLegs } from "@/db/schema/quotes";
import { formatUSD } from "@/lib/quote-pricing";
import { formatDay, relativeTime } from "@/lib/request-page";
import {
  invoiceWords,
  isCardOrReserve,
  passengersWords,
  personName,
  requestStage,
  tierWords,
  tripState,
} from "@/lib/desk-status";
import { ContactButtons, DeskCard, DeskHeader, DeskPage, DotSentence, StatusPill } from "@/components/admin/desk-ui";
import { ReserveTxForm } from "@/components/admin/reserve-tx-form";
import {
  ACCOUNT_STATUS_WORDS,
  DOC_WORDS,
  RELATION_WORDS,
  cabinChips,
  cateringWords,
  dayAndClock,
  groundWords,
  isReserveProgram,
  ledgerKindWords,
  monthYear,
  privacyChips,
  reachWords,
  routeFromLegs,
  shortDay,
  shortStamp,
} from "@/components/admin/clients/client-words";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const INVOICE_KIND_WORDS: Record<string, string> = {
  charter: "Charter",
  credit: "Credit",
  refund: "Refund",
  top_up: "Deposit",
  renewal: "Renewal",
};

const PAST_TRIP_STATUSES = ["wheels_down", "completed", "cancelled_wx", "cancelled_other"] as const;

export default async function AdminClientPage({ params }: Props) {
  const { id } = await params;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const [memberRow] = await db
    .select({
      id: members.id,
      memberCode: members.memberCode,
      legalName: members.legalName,
      preferredName: members.preferredName,
      tier: members.tier,
      tierSince: members.tierSince,
      memberSince: members.memberSince,
      status: members.status,
      mobileE164: members.mobileE164,
      companyName: members.companyName,
      roleTitle: members.roleTitle,
      twoFactorEnabled: members.twoFactorEnabled,
      marketingOptIn: members.marketingOptIn,
      lifetimeTripsCache: members.lifetimeTripsCache,
      lifetimeHoursCache: members.lifetimeHoursCache,
      primaryDispatcherId: members.primaryDispatcherId,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phoneE164: users.phoneE164,
      role: users.role,
    })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(eq(members.id, id));
  if (!memberRow) notFound();

  const [dispatcherRow] = memberRow.primaryDispatcherId
    ? await db
        .select({ displayName: staff.displayName, status: staff.status })
        .from(staff)
        .where(eq(staff.id, memberRow.primaryDispatcherId))
    : [];

  const [prefs] = await db.select().from(memberPreferences).where(eq(memberPreferences.memberId, id));

  const lanesList = await db
    .select()
    .from(memberLanes)
    .where(eq(memberLanes.memberId, id))
    .orderBy(desc(memberLanes.frequencyPerYear));

  const companionsList = await db
    .select()
    .from(companions)
    .where(eq(companions.memberId, id))
    .orderBy(asc(companions.legalName));

  const documentsList = await db
    .select({
      id: memberDocuments.id,
      docType: memberDocuments.docType,
      countryIso2: memberDocuments.countryIso2,
      expiresOn: memberDocuments.expiresOn,
      isPrimary: memberDocuments.isPrimary,
    })
    .from(memberDocuments)
    .where(eq(memberDocuments.memberId, id))
    .orderBy(desc(memberDocuments.isPrimary), asc(memberDocuments.docType));

  const programs = await db
    .select()
    .from(memberships)
    .where(eq(memberships.memberId, id))
    .orderBy(desc(memberships.activatedOn));
  const activeProgram = programs.find((p) => p.status === "active") ?? null;

  const [balanceRow] = await db
    .select({
      balance: sql<number>`coalesce(sum(${reserveTransactions.amountUsd}), 0)::int`,
    })
    .from(reserveTransactions)
    .where(eq(reserveTransactions.memberId, id));
  const balance = balanceRow?.balance ?? 0;

  const tripsList = await db
    .select({
      id: trips.id,
      tripCode: trips.tripCode,
      status: trips.status,
      missionType: trips.missionType,
      paxCount: trips.paxCount,
      revenueUsd: trips.revenueUsd,
      aircraftId: trips.aircraftId,
      createdAt: trips.createdAt,
    })
    .from(trips)
    .where(eq(trips.memberId, id))
    .orderBy(desc(trips.createdAt))
    .limit(10);

  // Everything still to fly, to pick the next trip for "Upcoming".
  const openTrips = await db
    .select({
      id: trips.id,
      status: trips.status,
      paxCount: trips.paxCount,
      revenueUsd: trips.revenueUsd,
      aircraftId: trips.aircraftId,
    })
    .from(trips)
    .where(and(eq(trips.memberId, id), notInArray(trips.status, [...PAST_TRIP_STATUSES])));

  const tripIds = Array.from(new Set([...tripsList.map((t) => t.id), ...openTrips.map((t) => t.id)]));
  const legRows = tripIds.length
    ? await db
        .select({
          tripId: tripLegs.tripId,
          fromIata: tripLegs.fromIata,
          fromCity: tripLegs.fromCity,
          fromName: tripLegs.fromName,
          toIata: tripLegs.toIata,
          toCity: tripLegs.toCity,
          toName: tripLegs.toName,
          departDate: tripLegs.departDate,
          departTime: tripLegs.departTime,
        })
        .from(tripLegs)
        .where(inArray(tripLegs.tripId, tripIds))
        .orderBy(asc(tripLegs.legNumber))
    : [];
  const legsByTrip = new Map<string, typeof legRows>();
  for (const l of legRows) legsByTrip.set(l.tripId, [...(legsByTrip.get(l.tripId) ?? []), l]);
  const legsOf = (tripId: string) => legsByTrip.get(tripId) ?? [];
  const nextLegOf = (tripId: string) => {
    const legs = legsOf(tripId);
    return legs.find((l) => l.departDate != null && l.departDate >= today) ?? legs[0] ?? null;
  };

  const upcoming = openTrips
    .filter((t) => {
      const legs = legsOf(t.id);
      if (legs.every((l) => l.departDate == null)) return true; // dates not set yet
      const next = nextLegOf(t.id)?.departDate;
      return next != null && next >= today;
    })
    .sort((a, b) => (nextLegOf(a.id)?.departDate ?? "9999").localeCompare(nextLegOf(b.id)?.departDate ?? "9999"));
  const nextTrip = upcoming[0] ?? null;

  const [nextAircraft] = nextTrip?.aircraftId
    ? await db
        .select({ makeModel: aircraft.makeModel })
        .from(aircraft)
        .where(eq(aircraft.id, nextTrip.aircraftId))
        .limit(1)
    : [];

  const invoicesList = await db
    .select({
      id: invoices.id,
      invoiceCode: invoices.invoiceCode,
      status: invoices.status,
      kind: invoices.kind,
      issuedOn: invoices.issuedOn,
      dueOn: invoices.dueOn,
      totalUsd: invoices.totalUsd,
      tripId: invoices.tripId,
      tripCode: trips.tripCode,
    })
    .from(invoices)
    .leftJoin(trips, eq(trips.id, invoices.tripId))
    .where(eq(invoices.memberId, id))
    .orderBy(desc(invoices.issuedOn))
    .limit(10);

  const quotesList = await db
    .select({
      id: quotes.id,
      quoteCode: quotes.quoteCode,
      status: quotes.status,
      paxCount: quotes.paxCount,
      receivedAt: quotes.receivedAt,
      convertedTripId: quotes.convertedTripId,
    })
    .from(quotes)
    .where(eq(quotes.memberId, id))
    .orderBy(desc(quotes.receivedAt))
    .limit(10);

  const quoteLegRows = quotesList.length
    ? await db
        .select({
          quoteId: quoteLegs.quoteId,
          fromIata: quoteLegs.fromIata,
          fromCity: quoteLegs.fromCity,
          fromName: quoteLegs.fromName,
          toIata: quoteLegs.toIata,
          toCity: quoteLegs.toCity,
          toName: quoteLegs.toName,
          departDate: quoteLegs.departDate,
        })
        .from(quoteLegs)
        .where(
          inArray(
            quoteLegs.quoteId,
            quotesList.map((q) => q.id),
          ),
        )
        .orderBy(asc(quoteLegs.legNumber))
    : [];
  const legsByQuote = new Map<string, typeof quoteLegRows>();
  for (const l of quoteLegRows) legsByQuote.set(l.quoteId, [...(legsByQuote.get(l.quoteId) ?? []), l]);

  const [lifetimeInvoicedRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${invoices.totalUsd}), 0)::int`,
    })
    .from(invoices)
    .where(sql`${invoices.memberId} = ${id} and ${invoices.status} in ('paid','due','overdue')`);
  const lifetimeInvoiced = lifetimeInvoicedRow?.total ?? 0;

  const recentLedger = await db
    .select({
      id: reserveTransactions.id,
      kind: reserveTransactions.kind,
      amountUsd: reserveTransactions.amountUsd,
      description: reserveTransactions.description,
      occurredAt: reserveTransactions.occurredAt,
    })
    .from(reserveTransactions)
    .where(eq(reserveTransactions.memberId, id))
    .orderBy(desc(reserveTransactions.occurredAt))
    .limit(8);

  // Lanes are stored as ICAO pairs; the desk reads them as cities.
  const laneIcaos = Array.from(new Set(lanesList.flatMap((l) => [l.fromIcao, l.toIcao])));
  const laneAirports = laneIcaos.length
    ? await db
        .select({ icao: airports.icao, city: airports.city, name: airports.name })
        .from(airports)
        .where(inArray(airports.icao, laneIcaos))
    : [];
  const cityOf = new Map(laneAirports.map((a) => [a.icao, a.city || a.name]));
  const laneCity = (icao: string) => cityOf.get(icao) ?? icao;

  // ── Words ─────────────────────────────────────────────────────────────
  const displayName = personName(memberRow.firstName, memberRow.lastName, memberRow.email);
  const phone = memberRow.mobileE164 ?? memberRow.phoneE164 ?? null;
  const program = activeProgram?.program ?? memberRow.tier;
  const isMember = isCardOrReserve(program);
  const reserve = isReserveProgram(program);
  const memberSince = monthYear(memberRow.memberSince);
  const lead = [memberRow.email, phone, memberSince ? `Member since ${memberSince}` : null, tierWords(program)]
    .filter(Boolean)
    .join(" · ");

  const prefBlocks: { label: string; text?: string | null; chips?: string[] }[] = prefs
    ? [
        { label: "How to reach them", text: reachWords(prefs) },
        { label: "Cabin", chips: cabinChips(prefs) },
        { label: "Catering", text: cateringWords(prefs) },
        { label: "Ground", text: groundWords(prefs) },
        { label: "Privacy", chips: privacyChips(prefs) },
        { label: "Standing notes", text: prefs.standingCateringNotes },
      ].filter((b) => (b.text ? true : (b.chips?.length ?? 0) > 0))
    : [];

  const nextLeg = nextTrip ? nextLegOf(nextTrip.id) : null;
  const nextRoute = nextTrip ? routeFromLegs(legsOf(nextTrip.id)) : null;
  const nextWhen = nextLeg ? dayAndClock(nextLeg.departDate, nextLeg.departTime) : null;
  const nextState = nextTrip ? tripState(nextTrip.status) : null;

  return (
    <DeskPage>
      <DeskHeader
        back={{ href: "/admin/clients", label: "All clients" }}
        title={displayName}
        lead={
          <>
            {lead}
            <span className="mt-1 block text-[13px] text-steel">
              Reference {memberRow.memberCode}
              {memberRow.companyName
                ? ` · ${memberRow.companyName}${memberRow.roleTitle ? `, ${memberRow.roleTitle}` : ""}`
                : null}
            </span>
          </>
        }
        actions={
          <>
            {memberRow.status !== "active" ? (
              <StatusPill tone={memberRow.status === "closed" ? "danger" : "steel"}>
                Account {ACCOUNT_STATUS_WORDS[memberRow.status]?.toLowerCase() ?? memberRow.status}
              </StatusPill>
            ) : null}
            <ContactButtons phone={phone} email={memberRow.email} size="md" />
          </>
        }
      />

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ── Left column ─────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-4">
          <DeskCard title="Upcoming">
            {nextTrip && nextState ? (
              <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="title-card-sm text-bone">{nextRoute ?? "Route being set up"}</div>
                  <p className="mt-1 text-[15px] text-bone-2">
                    {[
                      nextLeg?.departDate === today ? "Today" : nextWhen,
                      passengersWords(nextTrip.paxCount),
                      nextAircraft?.makeModel ?? null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <DotSentence tone={nextState.dot} className="mt-2 text-[15px] text-bone">
                    {nextState.label}
                  </DotSentence>
                </div>
                <Link href={`/admin/trips/${nextTrip.id}`} className="btn btn-secondary btn-sm">
                  Open the trip
                </Link>
              </div>
            ) : (
              <p className="mt-3 text-[15px] text-steel">
                Nothing booked.
                {quotesList.some((q) => requestStage(q.status).key !== "closed" && requestStage(q.status).key !== "booked")
                  ? " A request is open below."
                  : ""}
              </p>
            )}
          </DeskCard>

          <DeskCard
            title="Trips"
            actions={
              <Link href="/admin/trips" className="text-[14px] text-steel transition-colors hover:text-bone">
                All trips →
              </Link>
            }
          >
            {tripsList.length === 0 ? (
              <p className="mt-3 text-[15px] text-steel">No trips yet.</p>
            ) : (
              <ul className="mt-2">
                {tripsList.map((t) => {
                  const legs = legsOf(t.id);
                  const first = nextLegOf(t.id);
                  const state = tripState(t.status);
                  return (
                    <ListRow key={t.id} href={`/admin/trips/${t.id}`}>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-bone">
                          {routeFromLegs(legs) ?? "Route being set up"}
                        </span>
                        <span className="block text-[14px] text-steel">
                          {[formatDay(first?.departDate), passengersWords(t.paxCount)].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <DotSentence tone={state.dot} className="text-bone-2">
                        {state.label}
                      </DotSentence>
                      <span className="text-right text-bone">{t.revenueUsd ? formatUSD(t.revenueUsd) : "—"}</span>
                    </ListRow>
                  );
                })}
              </ul>
            )}
          </DeskCard>

          <DeskCard
            title="Requests"
            actions={
              <Link href="/admin/requests" className="text-[14px] text-steel transition-colors hover:text-bone">
                All requests →
              </Link>
            }
          >
            {quotesList.length === 0 ? (
              <p className="mt-3 text-[15px] text-steel">No requests yet.</p>
            ) : (
              <ul className="mt-2">
                {quotesList.map((q) => {
                  const legs = legsByQuote.get(q.id) ?? [];
                  const stage = requestStage(q.status);
                  return (
                    <ListRow key={q.id} href={`/admin/requests/${q.id}`}>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-bone">
                          {routeFromLegs(legs) ?? "Route not set"}
                        </span>
                        <span className="block text-[14px] text-steel">
                          {[formatDay(legs[0]?.departDate), passengersWords(q.paxCount)].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <DotSentence tone={stage.dot} className="text-bone-2">
                        {stage.label}
                      </DotSentence>
                      <span className="text-right text-[14px] text-steel">
                        {q.receivedAt ? `Received ${relativeTime(q.receivedAt, now).toLowerCase()}` : ""}
                      </span>
                    </ListRow>
                  );
                })}
              </ul>
            )}
          </DeskCard>

          <DeskCard title="Invoices">
            {invoicesList.length === 0 ? (
              <p className="mt-3 text-[15px] text-steel">Nothing invoiced yet.</p>
            ) : (
              <ul className="mt-2">
                {invoicesList.map((i) => {
                  const words =
                    i.status === "credit" ? { text: "Credit", tone: "steel" as const } : invoiceWords(i.status, i.dueOn, now);
                  const route = i.tripId ? routeFromLegs(legsOf(i.tripId)) : null;
                  return (
                    <ListRow key={i.id}>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-bone">
                          {[INVOICE_KIND_WORDS[i.kind] ?? i.kind, route].filter(Boolean).join(" · ")}
                        </span>
                        <span className="block text-[14px] text-steel">
                          Issued {shortDay(i.issuedOn, now)}
                          {i.dueOn && i.status === "due" ? ` · due ${shortDay(i.dueOn, now)}` : ""}
                        </span>
                      </span>
                      <DotSentence tone={words.tone} className="text-bone-2">
                        {words.text}
                      </DotSentence>
                      <span className="text-right text-bone">{i.totalUsd ? formatUSD(i.totalUsd) : "—"}</span>
                    </ListRow>
                  );
                })}
              </ul>
            )}
          </DeskCard>
        </div>

        {/* ── Right column ────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-4">
          <DeskCard
            title="Good to know"
            actions={
              prefs ? <span className="text-[13px] text-steel">Updated {shortStamp(prefs.updatedAt, now)}</span> : null
            }
          >
            {!prefs ? (
              <p className="mt-3 text-[15px] text-steel">Nothing on file yet. They can set preferences from their account.</p>
            ) : prefBlocks.length === 0 ? (
              <p className="mt-3 text-[15px] text-steel">Nothing beyond the usual defaults.</p>
            ) : (
              <div className="mt-3 flex flex-col gap-4">
                {prefBlocks.map((b) => (
                  <PrefBlock key={b.label} label={b.label}>
                    {b.chips ? (
                      <ChipList items={b.chips} />
                    ) : (
                      <p className="text-[15px] leading-[1.5] text-bone">{b.text}</p>
                    )}
                  </PrefBlock>
                ))}
              </div>
            )}
          </DeskCard>

          <DeskCard title="Who travels with them">
            {companionsList.length === 0 ? (
              <p className="mt-3 text-[15px] text-steel">Nobody added yet.</p>
            ) : (
              <ul className="mt-2 flex flex-col">
                {companionsList.map((c) => {
                  const facts = [
                    RELATION_WORDS[c.relation] ?? c.relation,
                    c.relation === "pet" ? c.speciesBreed : null,
                    c.relation === "pet" && c.weightLb ? `${c.weightLb} lb` : null,
                    c.apisComplete ? "travel details on file" : null,
                    c.ccOnItinerary ? "copied on itineraries" : null,
                  ].filter(Boolean);
                  return (
                    <li key={c.id} className="border-b border-line-faint py-3 last:border-b-0 last:pb-0">
                      <div className="text-[15px] font-medium text-bone">{c.legalName}</div>
                      <div className="text-[14px] text-steel">{facts.join(" · ")}</div>
                      {c.notes ? <div className="mt-0.5 text-[14px] text-bone-2">{c.notes}</div> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </DeskCard>

          <DeskCard title="Usual routes">
            {lanesList.length === 0 ? (
              <p className="mt-3 text-[15px] text-steel">Nothing regular yet.</p>
            ) : (
              <ul className="mt-2 flex flex-col">
                {lanesList.map((l) => {
                  const facts = [
                    l.frequencyPerYear ? `${l.frequencyPerYear} ${l.frequencyPerYear === 1 ? "time" : "times"} a year` : null,
                    l.seasonal ? "seasonal" : null,
                    l.lastFlownAt ? `last flown ${shortDay(l.lastFlownAt, now)}` : null,
                  ].filter(Boolean);
                  return (
                    <li key={l.id} className="border-b border-line-faint py-3 last:border-b-0 last:pb-0">
                      <div className="text-[15px] font-medium text-bone">
                        {laneCity(l.fromIcao)} → {laneCity(l.toIcao)}
                      </div>
                      {facts.length ? <div className="text-[14px] text-steel">{facts.join(" · ")}</div> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </DeskCard>

          <DeskCard title="Membership">
            <div className="mt-3">
              <div className={`text-[17px] font-medium ${isMember ? "text-bone" : "text-steel"}`}>{tierWords(program)}</div>
              {reserve || balance !== 0 ? (
                <>
                  <div className="mt-2 font-serif text-[32px] font-light leading-none text-bone">{formatUSD(balance)}</div>
                  <div className="mt-1 text-[14px] text-steel">left in the reserve</div>
                </>
              ) : !isMember ? (
                <p className="mt-1 text-[14px] text-steel">Pays per flight.</p>
              ) : null}
            </div>

            {activeProgram ? (
              <dl className="dl-jn mt-4 gap-y-2 border-t border-line pt-4">
                <dt>Call-out</dt>
                <dd>{activeProgram.calloutHours} hours</dd>
                <dt>Rates locked</dt>
                <dd>{activeProgram.rateLockMonths} months</dd>
                <dt>Cashback</dt>
                <dd>{Number(activeProgram.cashbackPct)}%</dd>
                <dt>Cardholders</dt>
                <dd>{activeProgram.namedCardholdersLimit === 99 ? "Unlimited" : activeProgram.namedCardholdersLimit}</dd>
                <dt>Since</dt>
                <dd>{monthYear(activeProgram.activatedOn) ?? "—"}</dd>
                {activeProgram.nextRenewalDate ? (
                  <>
                    <dt>Renews</dt>
                    <dd>
                      {monthYear(activeProgram.nextRenewalDate)}
                      {activeProgram.autoRenew ? " · automatically" : ""}
                    </dd>
                  </>
                ) : activeProgram.expiresOn ? (
                  <>
                    <dt>Ends</dt>
                    <dd>{monthYear(activeProgram.expiresOn)}</dd>
                  </>
                ) : null}
              </dl>
            ) : null}

            <div className="mt-5 border-t border-line pt-4">
              <h3 className="text-[13px] font-semibold text-steel">Reserve ledger</h3>
              {recentLedger.length === 0 ? (
                <p className="mt-2 text-[15px] text-steel">No entries yet.</p>
              ) : (
                <ul className="mt-1 flex flex-col">
                  {recentLedger.map((tx) => (
                    <li
                      key={tx.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 border-b border-line-faint py-2.5 last:border-b-0"
                    >
                      <span className="min-w-0">
                        <span className="block text-[15px] text-bone">
                          {shortStamp(tx.occurredAt, now)} · {ledgerKindWords(tx.kind)}
                        </span>
                        {tx.description ? (
                          <span className="block truncate text-[13px] text-steel">{tx.description}</span>
                        ) : null}
                      </span>
                      <span className={`text-[15px] ${tx.amountUsd >= 0 ? "text-success" : "text-bone"}`}>
                        {tx.amountUsd >= 0 ? "+" : "−"}
                        {formatUSD(Math.abs(tx.amountUsd))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <details className="mt-3">
                <summary className="btn btn-secondary btn-sm cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  Add a ledger entry
                </summary>
                <div className="mt-3 rounded-control border border-line bg-surface-2/40 p-4">
                  <ReserveTxForm memberId={memberRow.id} />
                </div>
              </details>
            </div>
          </DeskCard>

          <DeskCard title="Account">
            <dl className="dl-jn mt-3 gap-y-2">
              <dt>Legal name</dt>
              <dd>{memberRow.legalName ?? "—"}</dd>
              <dt>Goes by</dt>
              <dd>{memberRow.preferredName ?? "—"}</dd>
              <dt>Company</dt>
              <dd>
                {memberRow.companyName
                  ? `${memberRow.companyName}${memberRow.roleTitle ? ` · ${memberRow.roleTitle}` : ""}`
                  : "—"}
              </dd>
              <dt>Dispatcher</dt>
              <dd className={dispatcherRow ? "" : "text-steel"}>{dispatcherRow?.displayName ?? "Not assigned"}</dd>
              <dt>Account</dt>
              <dd>{ACCOUNT_STATUS_WORDS[memberRow.status] ?? memberRow.status}</dd>
              <dt>Two-step sign-in</dt>
              <dd>{memberRow.twoFactorEnabled ? "On" : "Off"}</dd>
              <dt>Marketing email</dt>
              <dd>{memberRow.marketingOptIn ? "Yes" : "No"}</dd>
              <dt>Member since</dt>
              <dd>{memberSince ?? "—"}</dd>
              {memberRow.tierSince ? (
                <>
                  <dt>Membership since</dt>
                  <dd>{monthYear(memberRow.tierSince)}</dd>
                </>
              ) : null}
              <dt>Flown with us</dt>
              <dd>
                {memberRow.lifetimeTripsCache} {memberRow.lifetimeTripsCache === 1 ? "flight" : "flights"} ·{" "}
                {memberRow.lifetimeHoursCache} hours
              </dd>
              <dt>Billed to date</dt>
              <dd>{formatUSD(lifetimeInvoiced)}</dd>
            </dl>
          </DeskCard>

          {documentsList.length > 0 ? (
            <DeskCard title="Documents">
              <ul className="mt-2 flex flex-col">
                {documentsList.map((d) => {
                  const expires = monthYear(d.expiresOn);
                  const facts = [
                    d.countryIso2 ?? null,
                    expires ? `expires ${expires}` : null,
                    d.isPrimary ? "primary" : null,
                  ].filter(Boolean);
                  return (
                    <li key={d.id} className="border-b border-line-faint py-3 last:border-b-0 last:pb-0">
                      <div className="text-[15px] font-medium text-bone">{DOC_WORDS[d.docType] ?? d.docType}</div>
                      {facts.length ? <div className="text-[14px] text-steel">{facts.join(" · ")}</div> : null}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-[13px] text-steel">Numbers stay encrypted; only the type and expiry show here.</p>
            </DeskCard>
          ) : null}
        </div>
      </div>
    </DeskPage>
  );
}

/** Route · state · amount row inside a DeskCard; the whole row is the link. */
function ListRow({ href, children }: { href?: string; children: ReactNode }) {
  const cls = "grid grid-cols-1 items-center gap-x-6 gap-y-1 py-3.5 text-[15px] md:grid-cols-[minmax(0,1fr)_200px_110px]";
  return (
    <li className="border-b border-line-faint last:border-b-0">
      {href ? (
        <Link href={href} className={`${cls} -mx-2 rounded-control px-2 transition-colors hover:bg-surface-2/50`}>
          {children}
        </Link>
      ) : (
        <div className={cls}>{children}</div>
      )}
    </li>
  );
}

function PrefBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-[13px] text-steel">{label}</div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function ChipList({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="text-[15px] text-steel">None</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => (
        <span key={it} className="chip chip-sm cursor-default">
          {it}
        </span>
      ))}
    </div>
  );
}
