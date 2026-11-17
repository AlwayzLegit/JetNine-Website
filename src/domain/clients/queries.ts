import { memberStore, type TripLegFacts } from "@/domain/members/store";
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

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

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

  // One store call: profile + active membership + preferences, with the
  // per-client aggregates the table and the preview need (trip count, lifetime
  // revenue, last flown date, next trip, open requests, reserve balance).
  const store = memberStore();
  const rows = await store.listClientRows(q ? likePattern(q) : null, today);

  // The next trip for everyone who has one: passengers + legs for the route.
  const nextIds = rows.flatMap((r) => (r.nextTripId ? [r.nextTripId] : []));
  const { trips: nextTrips, legs: nextLegs } = await store.nextTripFacts(nextIds);
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

  const store = memberStore();
  const memberRow = await store.clientHead(id);
  if (!memberRow) return null;

  const {
    dispatcher,
    prefs,
    lanes,
    companions: companionsList,
    documents,
    programs,
    balance,
    trips: tripsList,
    openTrips,
    invoices: invoicesList,
    quotes: quotesList,
    lifetimeInvoiced,
    ledger,
  } = await store.clientBody(id, memberRow.primaryDispatcherId);

  const activeProgram = programs.find((p) => p.status === "active") ?? null;

  const tripIds = Array.from(new Set([...tripsList.map((t) => t.id), ...openTrips.map((t) => t.id)]));
  const quoteIds = quotesList.map((q) => q.id);
  // Lanes are stored as ICAO pairs; the desk reads them as cities.
  const laneIcaos = Array.from(new Set(lanes.flatMap((l) => [l.fromIcao, l.toIcao])));

  const { legs: legRows, quoteLegs: quoteLegRows, laneAirports } = await store.clientLegFacts(tripIds, quoteIds, laneIcaos);

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

  const nextAircraftModel = nextTrip?.aircraftId ? await store.aircraftModel(nextTrip.aircraftId) : null;

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
        aircraft: nextAircraftModel,
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
