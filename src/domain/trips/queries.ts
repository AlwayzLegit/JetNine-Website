import { asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { trips, tripLegs, type Trip, type TripLeg } from "@/db/schema/trips";
import { members } from "@/db/schema/members";
import { users } from "@/db/schema/users";
import { aircraft } from "@/db/schema/aircraft";
import { operators } from "@/db/schema/operators";
import { quotes } from "@/db/schema/quotes";
import { invoices, type Invoice } from "@/db/schema/invoices";
import { sourcedOptions } from "@/db/schema/sourced-option";
import { formatDay } from "@/lib/request-format";
import { formatUSD } from "@/lib/quote-pricing";
import { invoiceWords, personName, tripState, type TripStateInfo } from "@/lib/desk-status";
import {
  aircraftLine,
  dayKey,
  groundWords,
  legDayKey,
  legDepartClock,
  legRoute,
  missionWords,
  shiftDayKey,
  type LegLike,
} from "@/components/admin/trips/trip-words";
import type { ThreadMessage } from "@/components/admin/message-thread";
import { isUuid, likePattern, searchTerm } from "@/domain/common";
import { loadThread, omitKeys } from "@/domain/requests/queries";

/**
 * Trips as the desk reads them. Shared by /admin/trips and /api/v1/trips.
 * The list loader returns the shaped rows the page renders (facts plus the
 * plain-word lines built with the pure trip-words helpers) so the API and
 * the page agree on what "upcoming", "flying today" and "to do" mean.
 */

// ─── List ────────────────────────────────────────────────────────────────

export const TRIP_LIST_TABS = ["upcoming", "past", "all"] as const;
export type TripListTab = (typeof TRIP_LIST_TABS)[number];

export const TRIP_TABS: { key: TripListTab; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Flown" },
  { key: "all", label: "All" },
];

export const AIRBORNE_STATUSES = new Set(["boarding", "airborne"]);
export const TRIP_LIST_LIMIT = 100;

export function normalizeTripTab(tab: string | undefined): TripListTab {
  return tab === "past" || tab === "all" ? tab : "upcoming";
}

export type TripListItem = {
  id: string;
  tripCode: string;
  status: string;
  state: TripStateInfo;
  isPast: boolean;
  /** YYYY-MM-DD of the first leg in its own timezone, or null. */
  day: string | null;
  memberId: string;
  quoteId: string | null;
  name: string;
  firstName: string | null;
  phone: string | null;
  pax: number;
  missionType: string;
  route: string;
  craft: string | null;
  todo: string;
  action: string;
  first: LegLike | null;
  flyingToday: boolean;
  ground: string | null;
  invoice: { status: string; issuedOn: string; dueOn: string | null; paidOn: string | null; totalUsd: number | null } | null;
  sortKey: string;
};

export type TripListGroup = { key: string; title: string; items: TripListItem[] };

export type TripList = {
  tab: TripListTab;
  q: string;
  /** Today's LA calendar day (YYYY-MM-DD). */
  today: string;
  /** Every trip matched (before the upcoming/past split). */
  items: TripListItem[];
  upcoming: TripListItem[];
  past: TripListItem[];
  /** Non-empty groups for the tab, in display order. */
  groups: TripListGroup[];
  /** Upcoming trips flying today (empty on the Flown tab). */
  flyingToday: TripListItem[];
  counts: { upcoming: number; past: number };
};

/**
 * The 100 newest trips, split into upcoming / flown by the first leg's day
 * (LA calendar) and status, grouped for the tab. Search covers the client's
 * name and email and the legs' cities.
 */
export async function listTrips(args: { tab?: string; q?: string; now?: Date }): Promise<TripList> {
  const now = args.now ?? new Date();
  const tab = normalizeTripTab(args.tab);
  const q = searchTerm(args.q);
  const today = dayKey(now);
  const in30 = shiftDayKey(today, 30);
  const ago90 = shiftDayKey(today, -90);

  const pat = q ? likePattern(q) : null;
  const where = pat
    ? or(
        ilike(users.firstName, pat),
        ilike(users.lastName, pat),
        ilike(users.email, pat),
        ilike(members.preferredName, pat),
        ilike(members.legalName, pat),
        sql`exists (select 1 from ${tripLegs} tl where tl.trip_id = ${trips.id} and (tl.from_city ilike ${pat} or tl.to_city ilike ${pat}))`,
      )
    : undefined;

  const rows = await db
    .select({
      id: trips.id,
      tripCode: trips.tripCode,
      status: trips.status,
      paxCount: trips.paxCount,
      missionType: trips.missionType,
      wheelsUpAt: trips.wheelsUpAt,
      createdAt: trips.createdAt,
      memberId: trips.memberId,
      quoteId: trips.quoteId,
      memberCode: members.memberCode,
      preferredName: members.preferredName,
      legalName: members.legalName,
      memberEmail: users.email,
      memberPhone: users.phoneE164,
      memberFirstName: users.firstName,
      memberLastName: users.lastName,
      makeModel: aircraft.makeModel,
      tailNumber: aircraft.tailNumber,
      operatorName: operators.name,
      groundOption: quotes.groundOption,
    })
    .from(trips)
    .innerJoin(members, eq(members.id, trips.memberId))
    .innerJoin(users, eq(users.id, members.userId))
    .leftJoin(aircraft, eq(aircraft.id, trips.aircraftId))
    .leftJoin(operators, eq(operators.id, trips.operatorId))
    .leftJoin(quotes, eq(quotes.id, trips.quoteId))
    .where(where)
    .orderBy(desc(trips.createdAt))
    .limit(TRIP_LIST_LIMIT);

  const ids = rows.map((r) => r.id);
  const quoteIds = rows.map((r) => r.quoteId).filter((x): x is string => Boolean(x));

  const [legs, invoiceRows, chosenOptions] = await Promise.all([
    ids.length
      ? db
          .select({
            tripId: tripLegs.tripId,
            legNumber: tripLegs.legNumber,
            fromIata: tripLegs.fromIata,
            fromCity: tripLegs.fromCity,
            fromName: tripLegs.fromName,
            toIata: tripLegs.toIata,
            toCity: tripLegs.toCity,
            toName: tripLegs.toName,
            departDate: tripLegs.departDate,
            departTime: tripLegs.departTime,
            departTz: tripLegs.departTz,
            scheduledDepAt: tripLegs.scheduledDepAt,
            scheduledArrAt: tripLegs.scheduledArrAt,
          })
          .from(tripLegs)
          .where(inArray(tripLegs.tripId, ids))
          .orderBy(asc(tripLegs.legNumber))
      : Promise.resolve([]),
    ids.length
      ? db
          .select({
            tripId: invoices.tripId,
            status: invoices.status,
            issuedOn: invoices.issuedOn,
            dueOn: invoices.dueOn,
            paidOn: invoices.paidOn,
            totalUsd: invoices.totalUsd,
            kind: invoices.kind,
          })
          .from(invoices)
          .where(inArray(invoices.tripId, ids))
          .orderBy(asc(invoices.createdAt))
      : Promise.resolve([]),
    quoteIds.length
      ? db
          .select({
            quoteId: sourcedOptions.quoteId,
            aircraftType: sourcedOptions.aircraftType,
            tailNumber: sourcedOptions.tailNumber,
            operatorNameRaw: sourcedOptions.operatorNameRaw,
          })
          .from(sourcedOptions)
          .where(inArray(sourcedOptions.quoteId, quoteIds))
          .orderBy(desc(sourcedOptions.isChosen), asc(sourcedOptions.optionNumber))
      : Promise.resolve([]),
  ]);

  const legsByTrip = new Map<string, LegLike[]>();
  for (const l of legs) {
    const arr = legsByTrip.get(l.tripId) ?? [];
    arr.push(l);
    legsByTrip.set(l.tripId, arr);
  }
  // The charter invoice drives the to-do line; credits/refunds are noise here.
  const invoiceByTrip = new Map<string, (typeof invoiceRows)[number]>();
  for (const inv of invoiceRows) {
    if (!inv.tripId) continue;
    const prev = invoiceByTrip.get(inv.tripId);
    if (!prev || (prev.kind !== "charter" && inv.kind === "charter")) invoiceByTrip.set(inv.tripId, inv);
  }
  const optionByQuote = new Map<string, (typeof chosenOptions)[number]>();
  for (const o of chosenOptions) if (!optionByQuote.has(o.quoteId)) optionByQuote.set(o.quoteId, o);

  // ── Shape each trip once ──
  const items: TripListItem[] = rows.map((t) => {
    const tripLegRows = legsByTrip.get(t.id) ?? [];
    const first = tripLegRows[0] ?? null;
    const last = tripLegRows[tripLegRows.length - 1] ?? null;
    const day = first ? legDayKey(first) : null;
    const state = tripState(t.status);
    const isPast = state.bucket === "past" || (day !== null && day < today && !AIRBORNE_STATUSES.has(t.status));
    const name = personName(
      t.memberFirstName,
      t.memberLastName,
      t.preferredName ?? t.legalName ?? t.memberEmail ?? "No name yet",
    );
    const option = t.quoteId ? optionByQuote.get(t.quoteId) : undefined;
    const craft = aircraftLine({
      makeModel: t.makeModel,
      tailNumber: t.tailNumber,
      operatorName: t.operatorName,
      optionType: option?.aircraftType,
      optionTail: option?.tailNumber,
      optionOperator: option?.operatorNameRaw,
    });
    const inv = invoiceByTrip.get(t.id);

    let todo = "Nothing to do";
    let action = "Open";
    if (inv) {
      const words = invoiceWords(inv.status, inv.dueOn, now);
      if (inv.status === "paid") {
        todo = inv.totalUsd ? `Paid · ${formatUSD(inv.totalUsd)}` : "Paid";
        if (isPast) action = "Receipt";
      } else if (inv.status === "due" || inv.status === "overdue") {
        const sent = formatDay(inv.issuedOn);
        todo = `${words.text}${sent ? ` · invoice sent ${sent}` : ""} · unpaid`;
        if (words.tone === "danger") action = "Send reminder";
      } else {
        todo = words.text;
      }
    }

    let route = first ? legRoute(first) : "Route to confirm";
    if (!isPast && first) {
      if (t.missionType === "round" && last && last !== first) {
        const back = formatDay(legDayKey(last));
        route += back ? ` · returns ${back}` : " · round trip";
      } else {
        route += ` · ${missionWords(t.missionType, tripLegRows.length)}`;
      }
    }

    const flyingToday = !isPast && (AIRBORNE_STATUSES.has(t.status) || (day !== null && day === today));

    return {
      id: t.id,
      tripCode: t.tripCode,
      status: t.status,
      state,
      isPast,
      day,
      memberId: t.memberId,
      quoteId: t.quoteId,
      name,
      firstName: t.memberFirstName?.trim() || null,
      phone: t.memberPhone,
      pax: t.paxCount,
      missionType: t.missionType,
      route,
      craft,
      todo,
      action,
      first,
      flyingToday,
      ground: groundWords(t.groundOption),
      invoice: inv
        ? { status: inv.status, issuedOn: inv.issuedOn, dueOn: inv.dueOn, paidOn: inv.paidOn, totalUsd: inv.totalUsd }
        : null,
      sortKey: `${day ?? "9999-99-99"} ${first ? legDepartClock(first) ?? "" : ""}`,
    };
  });

  const upcoming = items.filter((i) => !i.isPast).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const past = items.filter((i) => i.isPast).sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  const groups: TripListGroup[] = [];
  if (tab !== "past") {
    groups.push(
      { key: "soon", title: "Next 30 days", items: upcoming.filter((i) => i.day === null || i.day <= in30) },
      { key: "later", title: "Later", items: upcoming.filter((i) => i.day !== null && i.day > in30) },
    );
  }
  if (tab !== "upcoming") {
    groups.push(
      { key: "recent", title: "Flown · last 90 days", items: past.filter((i) => i.day === null || i.day >= ago90) },
      { key: "earlier", title: "Earlier", items: past.filter((i) => i.day !== null && i.day < ago90) },
    );
  }
  const visibleGroups = groups.filter((g) => g.items.length > 0);
  const flyingToday = tab === "past" ? [] : upcoming.filter((i) => i.flyingToday);

  return {
    tab,
    q,
    today,
    items,
    upcoming,
    past,
    groups: visibleGroups,
    flyingToday,
    counts: { upcoming: upcoming.length, past: past.length },
  };
}

// ─── One trip ────────────────────────────────────────────────────────────

export type TripMember = {
  id: string;
  memberCode: string;
  tier: string | null;
  preferredName: string | null;
  legalName: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phoneE164: string | null;
};

export type TripBundle = {
  trip: Trip;
  legs: TripLeg[];
  member: TripMember | null;
  invoice: Invoice | null;
  /** The request this trip came from, if any. */
  quote: { id: string; quoteCode: string; status: string; groundOption: string | null } | null;
  aircraft: { tailNumber: string; makeModel: string; yearManufactured: number | null; operatorId: string } | null;
  operator: { id: string; name: string; certNumber: string | null } | null;
  /** The option the client picked on the request; fills in the aircraft when the trip has none yet. */
  chosenOption: {
    aircraftType: string | null;
    tailNumber: string | null;
    operatorNameRaw: string | null;
    totalFlightTimeMin: number | null;
  } | null;
  messages: ThreadMessage[];
  state: TripStateInfo;
  /** Today's LA calendar day (YYYY-MM-DD), for "expected landing" style checks. */
  today: string;
};

/** Everything the one-trip page shows. Null for a bad id or no such trip. */
export async function getTrip(id: string, now: Date = new Date()): Promise<TripBundle | null> {
  if (!isUuid(id)) return null;
  const [trip] = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
  if (!trip) return null;

  const [legs, memberRows, invoiceRows, quoteRows, acRows, opRows, thread] = await Promise.all([
    db.select().from(tripLegs).where(eq(tripLegs.tripId, id)).orderBy(asc(tripLegs.legNumber)),
    db
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
      .where(eq(members.id, trip.memberId))
      .limit(1),
    db.select().from(invoices).where(eq(invoices.tripId, id)).limit(1),
    trip.quoteId
      ? db
          .select({
            id: quotes.id,
            quoteCode: quotes.quoteCode,
            status: quotes.status,
            groundOption: quotes.groundOption,
          })
          .from(quotes)
          .where(eq(quotes.id, trip.quoteId))
          .limit(1)
      : Promise.resolve([]),
    trip.aircraftId
      ? db
          .select({
            tailNumber: aircraft.tailNumber,
            makeModel: aircraft.makeModel,
            yearManufactured: aircraft.yearManufactured,
            operatorId: aircraft.operatorId,
          })
          .from(aircraft)
          .where(eq(aircraft.id, trip.aircraftId))
          .limit(1)
      : Promise.resolve([]),
    trip.operatorId
      ? db
          .select({ id: operators.id, name: operators.name, certNumber: operators.certNumber })
          .from(operators)
          .where(eq(operators.id, trip.operatorId))
          .limit(1)
      : Promise.resolve([]),
    loadThread("trip", id),
  ]);

  const acRow = acRows[0] ?? null;
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

  return {
    trip,
    legs,
    member: memberRows[0] ?? null,
    invoice: invoiceRows[0] ?? null,
    quote: quoteRows[0] ?? null,
    aircraft: acRow,
    operator: opRows[0] ?? null,
    chosenOption: chosenOption ?? null,
    messages: thread,
    state: tripState(trip.status),
    today: dayKey(now),
  };
}

// ─── Money ───────────────────────────────────────────────────────────────

export const TRIP_MONEY_FIELDS = ["revenueUsd", "operatorCostUsd", "marginPct", "processorFeeUsd"] as const;

export type TripPublic = Omit<Trip, (typeof TRIP_MONEY_FIELDS)[number]>;

/** A trip row without what JetNine makes on it. */
export function withoutTripMoney(t: Trip): TripPublic {
  return omitKeys(t, TRIP_MONEY_FIELDS);
}
