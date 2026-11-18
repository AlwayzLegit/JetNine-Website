/** A thread longer than this keeps its newest messages. */
export const THREAD_LIMIT = 500;
import type { Quote, QuoteLeg } from "@/db/schema/quotes";
import { messageStore } from "@/domain/messages/store";
import { requestStore } from "@/domain/requests/store";
import {
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
import { isUuid, likePattern, searchTerm } from "@/domain/common";

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
  const pattern = q ? likePattern(q) : null;

  const store = requestStore();
  const rows = await store.listRows({ bookedSince, closedSince, pattern, limit });
  const ids = rows.map((r) => r.id);

  // Legs + option counts for every row in two queries (no N+1).
  const [legRows, optionRows] = ids.length
    ? await Promise.all([store.legsFor(ids), store.optionCountsFor(ids)])
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
  const rows = await messageStore().thread(subjectType, subjectId, THREAD_LIMIT);
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
  const store = requestStore();
  const quote = await store.getQuote(id);
  if (!quote) return null;

  const [parts, thread] = await Promise.all([store.requestParts(quote, now), loadThread("quote", id)]);
  const { legs, memberRows, dispatchers, assignee, timesFlown, holds, conflicts, sourcedOptions: sourcedRows } = parts;

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
  for (const c of conflicts) {
    if (c.relatedQuoteId === id) continue;
    (otherHolds[c.aircraftId] ??= []).push(c.quoteCode);
  }

  const totalDistanceNm = legs.reduce((sum, l) => sum + (l.distanceNm ?? 0), 0);
  const longestLegNm = legs.reduce((max, l) => Math.max(max, l.distanceNm ?? 0), 0);

  // Candidate aircraft in our own network: requested category + enough
  // seats + enough range, operator not suspended/banned/on hold. Preferred
  // partners first, then ARG/US tier, then Wyvern. Cap at 8.
  const candidates: CandidateAircraft[] = quote.requestedCategory
    ? await store.candidates({ category: quote.requestedCategory, pax: quote.paxCount, longestLegNm })
    : [];

  return {
    quote,
    legs,
    member,
    memberRoster,
    dispatchers,
    assignee,
    timesFlown,
    messages: thread,
    holds,
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
