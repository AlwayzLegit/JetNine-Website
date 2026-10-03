import { and, asc, desc, eq, ilike, inArray, notInArray, or, sql } from "drizzle-orm";
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
import { formatDay } from "@/lib/request-format";
import {
  invoiceWords,
  isCardOrReserve,
  passengersWords,
  personName,
  requestStage,
  tierWords,
  tripState,
} from "@/lib/desk-status";
import {
  cabinChips,
  cateringWords,
  dayAndClock,
  flightsWords,
  groundWords,
  isReserveProgram,
  monthYear,
  prefsLine,
  privacyChips,
  reachWords,
  routeFromLegs,
  shortDay,
} from "@/components/admin/clients/client-words";
import type { ClientRow } from "@/components/admin/clients/clients-table";
import { isUuid, likePattern, searchTerm } from "@/domain/common";

/**
 * Client (member) queries shared by /admin/clients and /api/v1/clients.
 * Everything here is facts (ids, statuses, dates, numbers) plus the plain
 * words the desk already renders; nothing server-only is imported so the
 * route registry still loads under tsx.
 */

export const CLIENT_TABS = ["all", "recent", "card", "new"] as const;
export type ClientTab = (typeof CLIENT_TABS)[number];

export function isClientTab(v: unknown): v is ClientTab {
  return typeof v === "string" && (CLIENT_TABS as readonly string[]).includes(v);
}

const PAST_TRIP_STATUSES = ["wheels_down", "completed", "cancelled_wx", "cancelled_other"] as const;

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

const LEG_COLUMNS = {
  tripId: tripLegs.tripId,
  fromIata: tripLegs.fromIata,
  fromCity: tripLegs.fromCity,
  fromName: tripLegs.fromName,
  toIata: tripLegs.toIata,
  toCity: tripLegs.toCity,
  toName: tripLegs.toName,
  departDate: tripLegs.departDate,
  departTime: tripLegs.departTime,
};

type TripLegFacts = {
  tripId: string;
  fromIata: string | null;
  fromCity: string | null;
  fromName: string | null;
  toIata: string | null;
  toCity: string | null;
  toName: string | null;
  departDate: string | null;
  departTime: string | null;
};

// ─── List ────────────────────────────────────────────────────────────────

export type ClientListItem = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  accountStatus: string;
  memberSince: string | null;
  tierSince: string | null;
  /** Active membership program, falling back to the member's tier. */
  program: string;
  isMember: boolean;
  isReserve: boolean;
  membership: {
    program: string;
    since: string | null;
    renews: string | null;
    ends: string | null;
  } | null;
  flights: number;
  /** Sum of paid/due/overdue invoices. Stripped by the API without the money scope. */
  lifetimeUsd: number | null;
  lastFlownOn: string | null;
  nextTrip: {
    id: string;
    status: string;
    paxCount: number | null;
    departDate: string | null;
    route: string | null;
  } | null;
  openRequests: number;
  reserveUsd: number;
  flewRecently: boolean;
  isNew: boolean;
  /** The table row the desk renders (sentences built from the facts above). */
  row: ClientRow;
};

export type ClientList = {
  tab: ClientTab;
  q: string;
  /** Everyone matching the search, before the tab filter. */
  total: number;
  counts: Record<ClientTab, number>;
  /** Clients in the chosen tab. */
  clients: ClientListItem[];
};

export async function listClients(
  opts: { tab?: string; q?: string; now?: Date } = {},
): Promise<ClientList> {
  const now = opts.now ?? new Date();
  const q = searchTerm(opts.q);
  const tab: ClientTab = isClientTab(opts.tab) ? opts.tab : "all";
  const today = now.toISOString().slice(0, 10);
  const recentCutoff = new Date(now.getTime() - 90 * 86_400_000).toISOString().slice(0, 10);

  // One join: profile + active membership + preferences, with the per-client
  // aggregates the table and the preview need (trip count, lifetime revenue,
  // last flown date, next trip, open requests, reserve balance).
  const like = likePattern(q);
  const rows = await db
    .select({
      id: members.id,
      tier: members.tier,
      status: members.status,
      memberSince: members.memberSince,
      tierSince: members.tierSince,
      mobileE164: members.mobileE164,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phoneE164: users.phoneE164,
      tripCount: sql<number>`(
        select count(*)::int from public.trips t where t.member_id = ${members.id}
      )`,
      lifetimeUsd: sql<number>`(
        select coalesce(sum(i.total_usd), 0)::int from public.invoices i
        where i.member_id = ${members.id} and i.status in ('paid','due','overdue')
      )`,
      lastFlownOn: sql<string | null>`(
        select max(l.depart_date)::text from public.trip_legs l
        join public.trips t on t.id = l.trip_id
        where t.member_id = ${members.id}
          and l.depart_date < ${today}::date
          and t.status not in ('draft','cancelled_wx','cancelled_other')
      )`,
      nextTripId: sql<string | null>`(
        select t.id::text from public.trips t
        join public.trip_legs l on l.trip_id = t.id
        where t.member_id = ${members.id}
          and l.depart_date >= ${today}::date
          and t.status not in ('wheels_down','completed','cancelled_wx','cancelled_other')
        order by l.depart_date asc limit 1
      )`,
      openRequests: sql<number>`(
        select count(*)::int from public.quotes q
        where q.member_id = ${members.id}
          and q.status in ('submitted','triaged','sourcing','options_sent','held')
      )`,
      reserveUsd: sql<number>`(
        select coalesce(sum(r.amount_usd), 0)::int from public.reserve_transactions r
        where r.member_id = ${members.id}
      )`,
      program: memberships.program,
      programSince: memberships.activatedOn,
      programRenews: memberships.nextRenewalDate,
      programEnds: memberships.expiresOn,
      prefs: memberPreferences,
    })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .leftJoin(memberships, and(eq(memberships.memberId, members.id), eq(memberships.status, "active")))
    .leftJoin(memberPreferences, eq(memberPreferences.memberId, members.id))
    .where(
      q
        ? or(
            ilike(users.firstName, like),
            ilike(users.lastName, like),
            ilike(users.email, like),
            ilike(members.legalName, like),
            ilike(members.preferredName, like),
            ilike(members.companyName, like),
          )
        : undefined,
    )
    .orderBy(asc(users.lastName), asc(users.firstName))
    .limit(200);

  // The next trip for everyone who has one: passengers + legs for the route.
  const nextIds = rows.flatMap((r) => (r.nextTripId ? [r.nextTripId] : []));
  const [nextTrips, nextLegs] = nextIds.length
    ? await Promise.all([
        db
          .select({ id: trips.id, paxCount: trips.paxCount, status: trips.status })
          .from(trips)
          .where(inArray(trips.id, nextIds)),
        db.select(LEG_COLUMNS).from(tripLegs).where(inArray(tripLegs.tripId, nextIds)).orderBy(asc(tripLegs.legNumber)),
      ])
    : [[], []];
  const nextById = new Map(nextTrips.map((t) => [t.id, t]));
  const nextLegsById = new Map<string, TripLegFacts[]>();
  for (const l of nextLegs) nextLegsById.set(l.tripId, [...(nextLegsById.get(l.tripId) ?? []), l]);

  const clients: ClientListItem[] = rows.map((r) => {
    const program = r.program ?? r.tier;
    const isMember = isCardOrReserve(program);
    const reserve = isReserveProgram(program);
    const legs = r.nextTripId ? (nextLegsById.get(r.nextTripId) ?? []) : [];
    const nextLeg = legs.find((l) => l.departDate != null && l.departDate >= today) ?? legs[0] ?? null;
    const nextTrip = r.nextTripId ? nextById.get(r.nextTripId) : null;
    const nextDate = nextLeg?.departDate ?? null;
    const flewRecently = Boolean(r.lastFlownOn && r.lastFlownOn >= recentCutoff) || nextDate === today;

    const flightNote = nextTrip
      ? nextDate === today
        ? "flying today"
        : nextDate
          ? `next: ${shortDay(nextDate, now)}`
          : "next trip being set up"
      : r.openRequests > 0
        ? "request open"
        : r.lastFlownOn
          ? `last: ${shortDay(r.lastFlownOn, now)}`
          : null;

    const since = monthYear(r.programSince ?? r.tierSince);
    const memberNote = !isMember
      ? null
      : reserve
        ? `${formatUSD(r.reserveUsd)} left`
        : since
          ? `since ${since}`
          : null;

    const renews = monthYear(r.programRenews);
    const ends = monthYear(r.programEnds);
    const membership = isMember
      ? [
          tierWords(program),
          reserve ? `${formatUSD(r.reserveUsd)} left` : null,
          renews ? `renews ${renews}` : ends ? `until ${ends}` : since ? `since ${since}` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : "No membership";

    const route = routeFromLegs(legs);
    const nextFlight = nextTrip
      ? [route ?? "Route being set up", nextDate === today ? "today" : formatDay(nextDate), passengersWords(nextTrip.paxCount)]
          .filter(Boolean)
          .join(" · ")
      : r.openRequests > 0
        ? `Nothing booked · ${plural(r.openRequests, "request")} open`
        : "Nothing booked";

    const name = personName(r.firstName, r.lastName, r.email);
    const phone = r.mobileE164 ?? r.phoneE164 ?? null;
    const row: ClientRow = {
      id: r.id,
      name,
      email: r.email,
      phone,
      flights: flightsWords(r.tripCount),
      flightNote,
      spent: r.lifetimeUsd ? formatUSD(r.lifetimeUsd) : "—",
      member: isMember ? tierWords(program) : "None",
      memberNote,
      isMember,
      nextFlight,
      notes: prefsLine(r.prefs),
      membership,
    };

    return {
      id: r.id,
      name,
      email: r.email,
      phone,
      firstName: r.firstName,
      lastName: r.lastName,
      accountStatus: r.status,
      memberSince: r.memberSince,
      tierSince: r.tierSince,
      program,
      isMember,
      isReserve: reserve,
      membership: r.program
        ? { program: r.program, since: r.programSince, renews: r.programRenews, ends: r.programEnds }
        : null,
      flights: r.tripCount,
      lifetimeUsd: r.lifetimeUsd,
      lastFlownOn: r.lastFlownOn,
      nextTrip: nextTrip
        ? { id: nextTrip.id, status: nextTrip.status, paxCount: nextTrip.paxCount, departDate: nextDate, route }
        : null,
      openRequests: r.openRequests,
      reserveUsd: r.reserveUsd,
      flewRecently,
      isNew: r.tripCount === 0,
      row,
    };
  });

  const counts: Record<ClientTab, number> = {
    all: clients.length,
    recent: clients.filter((c) => c.flewRecently).length,
    card: clients.filter((c) => c.isMember).length,
    new: clients.filter((c) => c.isNew).length,
  };
  const visible = clients.filter((c) =>
    tab === "recent" ? c.flewRecently : tab === "card" ? c.isMember : tab === "new" ? c.isNew : true,
  );

  return { tab, q, total: clients.length, counts, clients: visible };
}

// ─── One client ──────────────────────────────────────────────────────────

export type PrefBlock = { label: string; text?: string | null; chips?: string[] };

export type ClientDetail = Awaited<ReturnType<typeof loadClient>>;

export async function getClient(id: string, now = new Date()): Promise<NonNullable<ClientDetail> | null> {
  if (!isUuid(id)) return null;
  return loadClient(id, now);
}

async function loadClient(id: string, now: Date) {
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
  if (!memberRow) return null;

  const [
    dispatcherRows,
    prefRows,
    lanes,
    companionsList,
    documents,
    programs,
    balanceRows,
    tripsList,
    openTrips,
    invoicesList,
    quotesList,
    lifetimeRows,
    ledger,
  ] = await Promise.all([
    memberRow.primaryDispatcherId
      ? db
          .select({ displayName: staff.displayName, status: staff.status })
          .from(staff)
          .where(eq(staff.id, memberRow.primaryDispatcherId))
      : Promise.resolve([]),
    db.select().from(memberPreferences).where(eq(memberPreferences.memberId, id)),
    db.select().from(memberLanes).where(eq(memberLanes.memberId, id)).orderBy(desc(memberLanes.frequencyPerYear)),
    // Explicit columns: birth dates and encrypted KTNs never leave the database here.
    db
      .select({
        id: companions.id,
        relation: companions.relation,
        legalName: companions.legalName,
        apisComplete: companions.apisComplete,
        ccOnItinerary: companions.ccOnItinerary,
        speciesBreed: companions.speciesBreed,
        weightLb: companions.weightLb,
        notes: companions.notes,
        createdAt: companions.createdAt,
      })
      .from(companions)
      .where(eq(companions.memberId, id))
      .orderBy(asc(companions.legalName)),
    db
      .select({
        id: memberDocuments.id,
        docType: memberDocuments.docType,
        countryIso2: memberDocuments.countryIso2,
        expiresOn: memberDocuments.expiresOn,
        isPrimary: memberDocuments.isPrimary,
      })
      .from(memberDocuments)
      .where(eq(memberDocuments.memberId, id))
      .orderBy(desc(memberDocuments.isPrimary), asc(memberDocuments.docType)),
    db.select().from(memberships).where(eq(memberships.memberId, id)).orderBy(desc(memberships.activatedOn)),
    db
      .select({ balance: sql<number>`coalesce(sum(${reserveTransactions.amountUsd}), 0)::int` })
      .from(reserveTransactions)
      .where(eq(reserveTransactions.memberId, id)),
    db
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
      .limit(10),
    // Everything still to fly, to pick the next trip for "Upcoming".
    db
      .select({
        id: trips.id,
        tripCode: trips.tripCode,
        status: trips.status,
        paxCount: trips.paxCount,
        revenueUsd: trips.revenueUsd,
        aircraftId: trips.aircraftId,
      })
      .from(trips)
      .where(and(eq(trips.memberId, id), notInArray(trips.status, [...PAST_TRIP_STATUSES]))),
    db
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
      .limit(10),
    db
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
      .limit(10),
    db
      .select({ total: sql<number>`coalesce(sum(${invoices.totalUsd}), 0)::int` })
      .from(invoices)
      .where(and(eq(invoices.memberId, id), inArray(invoices.status, ["paid", "due", "overdue"]))),
    db
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
      .limit(8),
  ]);

  const dispatcher = dispatcherRows[0] ?? null;
  const prefs = prefRows[0] ?? null;
  const activeProgram = programs.find((p) => p.status === "active") ?? null;
  const balance = balanceRows[0]?.balance ?? 0;
  const lifetimeInvoiced = lifetimeRows[0]?.total ?? 0;

  const tripIds = Array.from(new Set([...tripsList.map((t) => t.id), ...openTrips.map((t) => t.id)]));
  const quoteIds = quotesList.map((q) => q.id);
  // Lanes are stored as ICAO pairs; the desk reads them as cities.
  const laneIcaos = Array.from(new Set(lanes.flatMap((l) => [l.fromIcao, l.toIcao])));

  const [legRows, quoteLegRows, laneAirports] = await Promise.all([
    tripIds.length
      ? db.select(LEG_COLUMNS).from(tripLegs).where(inArray(tripLegs.tripId, tripIds)).orderBy(asc(tripLegs.legNumber))
      : Promise.resolve([] as TripLegFacts[]),
    quoteIds.length
      ? db
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
          .where(inArray(quoteLegs.quoteId, quoteIds))
          .orderBy(asc(quoteLegs.legNumber))
      : Promise.resolve([]),
    laneIcaos.length
      ? db
          .select({ icao: airports.icao, city: airports.city, name: airports.name })
          .from(airports)
          .where(inArray(airports.icao, laneIcaos))
      : Promise.resolve([]),
  ]);

  const legsByTrip = new Map<string, TripLegFacts[]>();
  for (const l of legRows) legsByTrip.set(l.tripId, [...(legsByTrip.get(l.tripId) ?? []), l]);
  const legsOf = (tripId: string) => legsByTrip.get(tripId) ?? [];
  const nextLegOf = (tripId: string) => {
    const legs = legsOf(tripId);
    return legs.find((l) => l.departDate != null && l.departDate >= today) ?? legs[0] ?? null;
  };

  const legsByQuote = new Map<string, typeof quoteLegRows>();
  for (const l of quoteLegRows) legsByQuote.set(l.quoteId, [...(legsByQuote.get(l.quoteId) ?? []), l]);

  const cityOf = new Map(laneAirports.map((a) => [a.icao, a.city || a.name]));
  const laneCity = (icao: string) => cityOf.get(icao) ?? icao;

  const upcomingTrips = openTrips
    .filter((t) => {
      const legs = legsOf(t.id);
      if (legs.every((l) => l.departDate == null)) return true; // dates not set yet
      const next = nextLegOf(t.id)?.departDate;
      return next != null && next >= today;
    })
    .sort((a, b) => (nextLegOf(a.id)?.departDate ?? "9999").localeCompare(nextLegOf(b.id)?.departDate ?? "9999"));
  const nextTrip = upcomingTrips[0] ?? null;

  const [nextAircraft] = nextTrip?.aircraftId
    ? await db.select({ makeModel: aircraft.makeModel }).from(aircraft).where(eq(aircraft.id, nextTrip.aircraftId)).limit(1)
    : [];

  // ── Words ─────────────────────────────────────────────────────────────
  const displayName = personName(memberRow.firstName, memberRow.lastName, memberRow.email);
  const phone = memberRow.mobileE164 ?? memberRow.phoneE164 ?? null;
  const program = activeProgram?.program ?? memberRow.tier;
  const isMember = isCardOrReserve(program);
  const isReserve = isReserveProgram(program);
  const memberSince = monthYear(memberRow.memberSince);
  const lead = [memberRow.email, phone, memberSince ? `Member since ${memberSince}` : null, tierWords(program)]
    .filter(Boolean)
    .join(" · ");

  const prefBlocks: PrefBlock[] = prefs
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
  const upcoming = nextTrip
    ? {
        ...nextTrip,
        legs: legsOf(nextTrip.id),
        route: routeFromLegs(legsOf(nextTrip.id)),
        departDate: nextLeg?.departDate ?? null,
        departTime: nextLeg?.departTime ?? null,
        isToday: nextLeg?.departDate === today,
        when: nextLeg ? dayAndClock(nextLeg.departDate, nextLeg.departTime) : null,
        state: tripState(nextTrip.status),
        aircraft: nextAircraft?.makeModel ?? null,
      }
    : null;

  const requests = quotesList.map((q) => {
    const legs = legsByQuote.get(q.id) ?? [];
    return { ...q, legs, route: routeFromLegs(legs), departDate: legs[0]?.departDate ?? null, stage: requestStage(q.status) };
  });
  const hasOpenRequest = requests.some((r) => r.stage.key !== "closed" && r.stage.key !== "booked");

  return {
    member: {
      id: memberRow.id,
      memberCode: memberRow.memberCode,
      legalName: memberRow.legalName,
      preferredName: memberRow.preferredName,
      firstName: memberRow.firstName,
      lastName: memberRow.lastName,
      name: displayName,
      email: memberRow.email,
      phone,
      mobileE164: memberRow.mobileE164,
      phoneE164: memberRow.phoneE164,
      role: memberRow.role,
      tier: memberRow.tier,
      tierSince: memberRow.tierSince,
      memberSince: memberRow.memberSince,
      status: memberRow.status,
      companyName: memberRow.companyName,
      roleTitle: memberRow.roleTitle,
      twoFactorEnabled: memberRow.twoFactorEnabled,
      marketingOptIn: memberRow.marketingOptIn,
      lifetimeTripsCache: memberRow.lifetimeTripsCache,
      lifetimeHoursCache: memberRow.lifetimeHoursCache,
      primaryDispatcherId: memberRow.primaryDispatcherId,
    },
    words: { displayName, lead, memberSince, program, isMember, isReserve, programWords: tierWords(program) },
    dispatcher,
    prefs,
    prefBlocks,
    lanes: lanes.map((l) => ({ ...l, fromCity: laneCity(l.fromIcao), toCity: laneCity(l.toIcao) })),
    companions: companionsList,
    documents,
    programs,
    activeProgram,
    balance,
    trips: tripsList.map((t) => {
      const legs = legsOf(t.id);
      const first = nextLegOf(t.id);
      return { ...t, legs, route: routeFromLegs(legs), departDate: first?.departDate ?? null, state: tripState(t.status) };
    }),
    upcoming,
    requests,
    hasOpenRequest,
    invoices: invoicesList.map((i) => ({
      ...i,
      route: i.tripId ? routeFromLegs(legsOf(i.tripId)) : null,
      words: i.status === "credit" ? { text: "Credit", tone: "steel" as const } : invoiceWords(i.status, i.dueOn, now),
    })),
    lifetimeInvoiced,
    ledger,
  };
}
