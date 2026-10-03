import { and, asc, desc, eq, gt, gte, inArray, ne, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/db";

/** A thread longer than this keeps its newest messages. */
export const THREAD_LIMIT = 500;
import { quotes, quoteLegs, type Quote, type QuoteLeg } from "@/db/schema/quotes";
import { members } from "@/db/schema/members";
import { staff } from "@/db/schema/staff";
import { users } from "@/db/schema/users";
import { aircraft } from "@/db/schema/aircraft";
import { operators } from "@/db/schema/operators";
import { messages } from "@/db/schema/audit";
import { trips } from "@/db/schema/trips";
import { aircraftScheduleBlocks } from "@/db/schema/schedule-blocks";
import { sourcedOptions } from "@/db/schema/sourced-option";
import {
  OPEN_REQUEST_STATUSES,
  REQUEST_TABS,
  replyDueLine,
  requestStage,
  type RequestStageInfo,
  type RequestStageKey,
} from "@/lib/desk-status";
import type { ThreadMessage } from "@/components/admin/message-thread";
import type { HeldAircraft } from "@/components/admin/soft-hold-list";
import type { SourcedOptionRow } from "@/components/admin/sourced-options";
import type { MemberOption } from "@/components/admin/member-attach";
import { NOT_SMOKE, isUuid, isoParam, likePattern, searchTerm } from "@/domain/common";

/**
 * Requests (quotes) as the desk reads them. Shared by /admin/requests and
 * /api/v1/requests. Loaders return facts plus the plain-word groupings the
 * pages already compute; they never throw for a bad id (they return null).
 *
 * Keep this file free of server-only imports: the API registry is loaded
 * under tsx by scripts/check-api.mts.
 */

// ─── List ────────────────────────────────────────────────────────────────

export const STAGE_ORDER: RequestStageKey[] = ["reply", "working", "sent", "booked", "closed"];
export const BOOKED_WINDOW_DAYS = 14;
export const CLOSED_WINDOW_DAYS = 30;
export const ROW_LIMIT = 200;

export const REQUEST_LIST_TABS = ["reply", "working", "sent", "booked", "closed", "all"] as const;
export type RequestListTab = (typeof REQUEST_LIST_TABS)[number];

export function normalizeRequestTab(tab: string | undefined): RequestListTab {
  return tab && (REQUEST_LIST_TABS as readonly string[]).includes(tab) ? (tab as RequestListTab) : "reply";
}

export type RequestListLeg = Pick<
  QuoteLeg,
  | "quoteId"
  | "legNumber"
  | "fromIata"
  | "fromCity"
  | "fromName"
  | "toIata"
  | "toCity"
  | "toName"
  | "departDate"
  | "departTime"
>;

export type RequestOptionCounts = { total: number; sent: number };

export type RequestListItem = {
  id: string;
  quoteCode: string;
  status: string;
  source: string;
  tripType: "one_way" | "round" | "multi_leg";
  paxCount: number;
  notes: string | null;
  contactSnapshot: Quote["contactSnapshot"];
  memberId: string | null;
  memberTier: string | null;
  receivedAt: Date;
  slaDeadlineAt: Date;
  respondedAt: Date | null;
  acceptedAt: Date | null;
  updatedAt: Date;
  convertedTripId: string | null;
  dispatcherName: string | null;
  /** Plain-word stage for the status (requestStage). */
  stage: RequestStageKey;
  legs: RequestListLeg[];
  options: RequestOptionCounts;
};

export type RequestListGroup = { key: RequestStageKey; title: string; items: RequestListItem[] };

export type RequestListTabInfo = { key: string; label: string; count?: number };

export type RequestList = {
  tab: RequestListTab;
  q: string;
  /** Groups in stage order for the chosen tab, non-empty only. */
  groups: RequestListGroup[];
  /** The tab strip with counts per stage (the "All" tab has none). */
  tabs: RequestListTabInfo[];
  /** Stage keys that have rows on this tab, in stage order. */
  visibleStages: RequestStageKey[];
  /** Rows per stage across every tab (what the tab counts come from). */
  counts: Record<RequestStageKey, number>;
  /** Rows matched before grouping; `truncated` when the row limit cut them. */
  total: number;
  truncated: boolean;
};

/**
 * Open requests, bookings from the last 14 days and closed requests from
 * the last 30 days, grouped by stage. Search covers the contact's name and
 * email and any leg's city, airport name or code.
 */
export async function listRequests(args: {
  tab?: string;
  q?: string;
  now?: Date;
  limit?: number;
}): Promise<RequestList> {
  const now = args.now ?? new Date();
  const tab = normalizeRequestTab(args.tab);
  const q = searchTerm(args.q);
  const limit = Math.min(Math.max(args.limit ?? ROW_LIMIT, 1), ROW_LIMIT);

  const bookedSince = new Date(now.getTime() - BOOKED_WINDOW_DAYS * 86_400_000);
  const closedSince = new Date(now.getTime() - CLOSED_WINDOW_DAYS * 86_400_000);
  const openOrRecentlyBooked = or(
    inArray(quotes.status, [...OPEN_REQUEST_STATUSES]),
    and(
      inArray(quotes.status, ["accepted", "converted"]),
      sql`coalesce(${quotes.acceptedAt}, ${quotes.updatedAt}) >= ${isoParam(bookedSince)}::timestamptz`,
    ),
    // Closed (declined / expired / cancelled) stays findable for a month.
    and(
      inArray(quotes.status, ["declined", "expired", "cancelled"]),
      sql`${quotes.updatedAt} >= ${isoParam(closedSince)}::timestamptz`,
    ),
  );

  const pattern = q ? likePattern(q) : null;
  const search = pattern
    ? or(
        sql`${quotes.contactSnapshot}->>'firstName' ilike ${pattern}`,
        sql`${quotes.contactSnapshot}->>'lastName' ilike ${pattern}`,
        sql`(${quotes.contactSnapshot}->>'firstName' || ' ' || ${quotes.contactSnapshot}->>'lastName') ilike ${pattern}`,
        sql`${quotes.contactSnapshot}->>'email' ilike ${pattern}`,
        sql`exists (
          select 1 from ${quoteLegs}
          where ${quoteLegs.quoteId} = ${quotes.id}
            and (
              ${quoteLegs.fromCity} ilike ${pattern} or ${quoteLegs.toCity} ilike ${pattern}
              or ${quoteLegs.fromName} ilike ${pattern} or ${quoteLegs.toName} ilike ${pattern}
              or ${quoteLegs.fromIata} ilike ${pattern} or ${quoteLegs.toIata} ilike ${pattern}
            )
        )`,
      )
    : undefined;

  const rows = await db
    .select({
      id: quotes.id,
      quoteCode: quotes.quoteCode,
      status: quotes.status,
      source: quotes.source,
      tripType: quotes.tripType,
      paxCount: quotes.paxCount,
      notes: quotes.notes,
      contactSnapshot: quotes.contactSnapshot,
      memberId: quotes.memberId,
      memberTier: members.tier,
      receivedAt: quotes.receivedAt,
      slaDeadlineAt: quotes.slaDeadlineAt,
      respondedAt: quotes.respondedAt,
      acceptedAt: quotes.acceptedAt,
      updatedAt: quotes.updatedAt,
      convertedTripId: quotes.convertedTripId,
      dispatcherName: staff.displayName,
    })
    .from(quotes)
    .leftJoin(members, eq(members.id, quotes.memberId))
    .leftJoin(staff, eq(staff.id, quotes.assignedDispatcherId))
    .where(and(NOT_SMOKE, openOrRecentlyBooked, search))
    .orderBy(desc(quotes.receivedAt))
    .limit(limit);

  const ids = rows.map((r) => r.id);

  // Legs + option counts for every row in two queries (no N+1).
  const [legRows, optionRows] = ids.length
    ? await Promise.all([
        db
          .select({
            quoteId: quoteLegs.quoteId,
            legNumber: quoteLegs.legNumber,
            fromIata: quoteLegs.fromIata,
            fromCity: quoteLegs.fromCity,
            fromName: quoteLegs.fromName,
            toIata: quoteLegs.toIata,
            toCity: quoteLegs.toCity,
            toName: quoteLegs.toName,
            departDate: quoteLegs.departDate,
            departTime: quoteLegs.departTime,
          })
          .from(quoteLegs)
          .where(inArray(quoteLegs.quoteId, ids))
          .orderBy(asc(quoteLegs.legNumber)),
        db
          .select({
            quoteId: sourcedOptions.quoteId,
            total: sql<number>`count(*)::int`,
            sent: sql<number>`count(*) filter (where ${sourcedOptions.status} in ('sent_to_client', 'accepted'))::int`,
          })
          .from(sourcedOptions)
          .where(inArray(sourcedOptions.quoteId, ids))
          .groupBy(sourcedOptions.quoteId),
      ])
    : [[] as RequestListLeg[], [] as { quoteId: string; total: number; sent: number }[]];

  const legsByQuote = new Map<string, RequestListLeg[]>();
  for (const l of legRows) {
    const arr = legsByQuote.get(l.quoteId) ?? [];
    arr.push(l);
    legsByQuote.set(l.quoteId, arr);
  }
  const optionsByQuote = new Map(optionRows.map((o) => [o.quoteId, { total: o.total, sent: o.sent }]));

  const items: RequestListItem[] = rows.map((r) => ({
    ...r,
    stage: requestStage(r.status).key,
    legs: legsByQuote.get(r.id) ?? [],
    options: optionsByQuote.get(r.id) ?? { total: 0, sent: 0 },
  }));

  // Group by stage, in stage order. Needs-a-reply sorts by deadline so the
  // most overdue row is on top; every other group reads newest first.
  const byStage = new Map<RequestStageKey, RequestListItem[]>();
  for (const it of items) {
    const arr = byStage.get(it.stage) ?? [];
    arr.push(it);
    byStage.set(it.stage, arr);
  }
  byStage.get("reply")?.sort((a, b) => a.slaDeadlineAt.getTime() - b.slaDeadlineAt.getTime());

  const counts = Object.fromEntries(STAGE_ORDER.map((k) => [k, byStage.get(k)?.length ?? 0])) as Record<
    RequestStageKey,
    number
  >;

  const tabs: RequestListTabInfo[] = [
    ...REQUEST_TABS.map((t) => ({ ...t, count: counts[t.key] })),
    { key: "closed", label: "Closed", count: counts.closed },
    { key: "all", label: "All" },
  ];

  const visibleStages = STAGE_ORDER.filter(
    (k) => (tab === "all" ? k !== "closed" : k === tab) && counts[k] > 0,
  );

  const groups: RequestListGroup[] = visibleStages.map((key) => {
    const group = byStage.get(key) ?? [];
    return { key, title: requestStage(group[0].status).group, items: group };
  });

  return { tab, q, groups, tabs, visibleStages, counts, total: items.length, truncated: items.length >= limit };
}

// ─── Threads (shared with trips) ─────────────────────────────────────────

/** The CRM thread for one quote or trip, oldest first, as the thread UI reads it. */
export async function loadThread(subjectType: "quote" | "trip", subjectId: string): Promise<ThreadMessage[]> {
  const rows = await db
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
    .where(and(eq(messages.subjectType, subjectType), eq(messages.subjectId, subjectId)))
    .orderBy(desc(messages.occurredAt))
    .limit(THREAD_LIMIT);
  rows.reverse(); // oldest first, newest THREAD_LIMIT kept

  return rows.map((m) => ({
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
}

// ─── One request ─────────────────────────────────────────────────────────

export type RequestMember = MemberOption & { status: string; tier: string | null };

export type StaffOption = { id: string; displayName: string };

export type CandidateAircraft = {
  id: string;
  tailNumber: string;
  makeModel: string;
  yearManufactured: number | null;
  seats: number;
  rangeNm: number;
  speedKt: number | null;
  wifiType: string | null;
  baseIcao: string | null;
  status: string;
  operatorId: string;
  operatorName: string;
  isPreferred: boolean;
  argusRating: string | null;
  wyvernWingman: boolean | null;
};

export type RequestBundle = {
  quote: Quote;
  legs: QuoteLeg[];
  /** The linked client record, if any (kept even when the member is paused). */
  member: RequestMember | null;
  /** Active members for the link picker (UI only). */
  memberRoster: MemberOption[];
  /** Dispatchers for the assign picker (UI only). */
  dispatchers: StaffOption[];
  assignee: StaffOption | null;
  /** Trips the linked client has flown (null when no client is linked). */
  timesFlown: number | null;
  messages: ThreadMessage[];
  /** Soft holds placed for this request. */
  holds: HeldAircraft[];
  /** Soft holds other requests have on the same aircraft: aircraftId → quote codes. */
  otherHolds: Record<string, string[]>;
  /** Aircraft in our own network that fit the request (UI only). */
  candidates: CandidateAircraft[];
  sourcedOptions: SourcedOptionRow[];
  totalDistanceNm: number;
  longestLegNm: number;
  stage: RequestStageInfo;
  replyDue: ReturnType<typeof replyDueLine>;
};

/** Everything the one-request page shows. Null for a bad id or no such quote. */
export async function getRequest(id: string, now: Date = new Date()): Promise<RequestBundle | null> {
  if (!isUuid(id)) return null;
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
  if (!quote) return null;

  const [legs, memberRows, dispatchers, assigneeRows, flownRows, thread, heldRows, conflictRows, sourcedRows] =
    await Promise.all([
      db.select().from(quoteLegs).where(eq(quoteLegs.quoteId, id)).orderBy(asc(quoteLegs.legNumber)),
      // Full roster: the picker shows active members; the linked row may be paused.
      db
        .select({
          id: members.id,
          memberCode: members.memberCode,
          preferredName: members.preferredName,
          legalName: members.legalName,
          status: members.status,
          tier: members.tier,
        })
        .from(members)
        .orderBy(asc(members.memberCode)),
      db
        .select({ id: staff.id, displayName: staff.displayName })
        .from(staff)
        .innerJoin(users, eq(users.id, staff.userId))
        .where(eq(users.role, "dispatcher")),
      quote.assignedDispatcherId
        ? db
            .select({ id: staff.id, displayName: staff.displayName })
            .from(staff)
            .where(eq(staff.id, quote.assignedDispatcherId))
            .limit(1)
        : Promise.resolve([] as StaffOption[]),
      quote.memberId
        ? db
            .select({ n: sql<number>`count(*)::int` })
            .from(trips)
            .where(
              and(
                eq(trips.memberId, quote.memberId),
                notInArray(trips.status, ["draft", "cancelled_wx", "cancelled_other"]),
              ),
            )
        : Promise.resolve([] as { n: number }[]),
      loadThread("quote", id),
      db
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
        .orderBy(asc(aircraftScheduleBlocks.startAt)),
      db
        .select({
          aircraftId: aircraftScheduleBlocks.aircraftId,
          relatedQuoteId: aircraftScheduleBlocks.relatedQuoteId,
          quoteCode: quotes.quoteCode,
        })
        .from(aircraftScheduleBlocks)
        .innerJoin(quotes, eq(quotes.id, aircraftScheduleBlocks.relatedQuoteId))
        // Only holds still in force; a request's old holds are no longer a conflict.
        .where(and(eq(aircraftScheduleBlocks.kind, "hold"), gt(aircraftScheduleBlocks.endAt, now))),
      db
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
        .orderBy(asc(sourcedOptions.optionNumber)),
    ]);

  const toOption = (m: (typeof memberRows)[number]): MemberOption => ({
    id: m.id,
    memberCode: m.memberCode,
    label: m.preferredName ?? m.legalName ?? "—",
  });
  const memberRoster = memberRows.filter((m) => m.status === "active").map(toOption);
  const linkedRow = quote.memberId ? memberRows.find((m) => m.id === quote.memberId) : undefined;
  const member: RequestMember | null = linkedRow
    ? { ...toOption(linkedRow), status: linkedRow.status, tier: linkedRow.tier }
    : null;

  const otherHolds: Record<string, string[]> = {};
  for (const c of conflictRows) {
    if (c.relatedQuoteId === id) continue;
    (otherHolds[c.aircraftId] ??= []).push(c.quoteCode);
  }

  const totalDistanceNm = legs.reduce((sum, l) => sum + (l.distanceNm ?? 0), 0);
  const longestLegNm = legs.reduce((max, l) => Math.max(max, l.distanceNm ?? 0), 0);

  // Candidate aircraft in our own network: requested category + enough
  // seats + enough range, operator not suspended/banned/on hold. Preferred
  // partners first, then ARG/US tier, then Wyvern. Cap at 8.
  const candidates: CandidateAircraft[] = quote.requestedCategory
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
            gte(aircraft.rangeNm, longestLegNm),
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

  return {
    quote,
    legs,
    member,
    memberRoster,
    dispatchers,
    assignee: assigneeRows[0] ?? null,
    timesFlown: quote.memberId ? (flownRows[0]?.n ?? 0) : null,
    messages: thread,
    holds: heldRows,
    otherHolds,
    candidates,
    sourcedOptions: sourcedRows,
    totalDistanceNm,
    longestLegNm,
    stage: requestStage(quote.status),
    replyDue: replyDueLine(quote.slaDeadlineAt, quote.status, now),
  };
}

// ─── Money ───────────────────────────────────────────────────────────────

export const OPTION_MONEY_FIELDS = ["operatorCostUsd", "markupType", "markupValue", "dispatcherNotes"] as const;

export type SourcedOptionPublic = Omit<SourcedOptionRow, (typeof OPTION_MONEY_FIELDS)[number]>;

/** A copy of `obj` without `keys`. */
export function omitKeys<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Omit<T, K> {
  const copy: Partial<T> = { ...obj };
  for (const k of keys) delete copy[k];
  return copy as Omit<T, K>;
}

/** A sourced option without operator cost, markup or dispatcher notes. */
export function withoutOptionMoney(o: SourcedOptionRow): SourcedOptionPublic {
  return omitKeys(o, OPTION_MONEY_FIELDS);
}
