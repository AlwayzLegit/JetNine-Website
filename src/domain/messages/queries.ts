import { and, asc, desc, eq, gte, inArray, sql as dsql } from "drizzle-orm";
import { db, sql } from "@/db";
import { messages } from "@/db/schema/audit";
import { contactInquiries } from "@/db/schema/contact";
import { members } from "@/db/schema/members";
import { quotes, quoteLegs } from "@/db/schema/quotes";
import { trips, tripLegs } from "@/db/schema/trips";
import { users } from "@/db/schema/users";
import { personName, requestStage, tierWords, tripState } from "@/lib/desk-status";
import { dateRangeWords, routeWords } from "@/components/admin/messages/words";
import type { ThreadMessage } from "@/components/admin/message-thread";
import type { FailedDeliveryRow } from "@/components/admin/failed-delivery-list";
import { isUuid, searchTerm } from "@/domain/common";

/**
 * Messages queries shared by /admin/messages and /api/v1/messages/*: the
 * thread list (one row per quote / trip / member with messages), one
 * thread's messages, the website form inbox, failed deliveries and the
 * phone line's call notes. Client-written text comes back as data.
 */

export type ThreadSubject = "quote" | "trip" | "member";
export const THREAD_SUBJECTS: ThreadSubject[] = ["quote", "trip", "member"];

export function isThreadSubject(v: unknown): v is ThreadSubject {
  return v === "quote" || v === "trip" || v === "member";
}

export type ThreadView = {
  subjectType: ThreadSubject;
  subjectId: string;
  name: string;
  context: string | null;
  linkLabel: string;
  linkHref: string;
  unread: boolean;
  preview: string | null;
  lastAt: Date;
  email: string | null;
  phone: string | null;
  memberId: string | null;
  /** Only call notes / voicemails on the thread — "☎" initial. */
  callOnly: boolean;
};

export type VoiceCallRow = {
  id: string;
  from_number: string | null;
  started_at: Date;
  duration_seconds: number | null;
  outcome: string | null;
  summary: string | null;
  escalation_reason: string | null;
  recording_url: string | null;
  returning_caller: boolean;
  message_reason: string | null;
  message_callback: string | null;
};

export type InquiryRow = {
  id: string;
  reason: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  fromText: string | null;
  toText: string | null;
  dateText: string | null;
  paxText: string | null;
  notes: string | null;
  memberId: string | null;
  status: string;
  handledAt: Date | null;
  createdAt: Date;
  handledByEmail: string | null;
};

/** Case-insensitive "any of these fields contains q"; an empty q matches everything. */
export function matchesSearch(q: string, ...fields: (string | null | undefined)[]): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return fields.some((f) => f && f.toLowerCase().includes(needle));
}

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const arr = m.get(k) ?? [];
    arr.push(r);
    m.set(k, arr);
  }
  return m;
}

type LegRow = {
  fromCity: string | null;
  fromName: string | null;
  fromIata: string | null;
  toCity: string | null;
  toName: string | null;
  toIata: string | null;
  departDate: string | null;
};

/** "Los Angeles → Aspen · Oct 3–5" or null when the legs are missing. */
function tripContext(legs: LegRow[]): string | null {
  const route = routeWords(legs);
  if (!route) return null;
  const dates = dateRangeWords(legs[0]?.departDate, legs[legs.length - 1]?.departDate);
  return dates ? `${route} · ${dates}` : route;
}

// ─── Threads ─────────────────────────────────────────────────────────────

export type ThreadList = {
  /** Threads matching `q` (all of them when q is empty), newest first. */
  threads: ThreadView[];
  /** Threads with an unread inbound message, before the search filter. */
  unread: number;
};

export async function listThreads(opts: { q?: string } = {}): Promise<ThreadList> {
  const q = searchTerm(opts.q);

  // One row per (subject_type, subject_id), newest first.
  const threadAgg = await db
    .select({
      subjectType: messages.subjectType,
      subjectId: messages.subjectId,
      lastAt: dsql<string>`max(${messages.occurredAt})`,
      unread: dsql<number>`count(*) filter (where ${messages.direction} = 'in' and ${messages.isRead} = false)::int`,
      spoken: dsql<number>`count(*) filter (where ${messages.channel} not in ('call', 'voicemail'))::int`,
    })
    .from(messages)
    .where(inArray(messages.subjectType, THREAD_SUBJECTS))
    .groupBy(messages.subjectType, messages.subjectId)
    .orderBy(desc(dsql`max(${messages.occurredAt})`))
    .limit(100);

  const threadIds = threadAgg.map((t) => t.subjectId);
  const quoteIds = threadAgg.filter((t) => t.subjectType === "quote").map((t) => t.subjectId);
  const tripIds = threadAgg.filter((t) => t.subjectType === "trip").map((t) => t.subjectId);
  const memberIds = threadAgg.filter((t) => t.subjectType === "member").map((t) => t.subjectId);

  const [latest, quoteRows, quoteLegRows, tripRows, tripLegRows, memberRows] = await Promise.all([
    threadIds.length
      ? db
          .selectDistinctOn([messages.subjectType, messages.subjectId], {
            subjectType: messages.subjectType,
            subjectId: messages.subjectId,
            direction: messages.direction,
            preview: messages.preview,
            body: messages.body,
          })
          .from(messages)
          .where(and(inArray(messages.subjectType, THREAD_SUBJECTS), inArray(messages.subjectId, threadIds)))
          .orderBy(messages.subjectType, messages.subjectId, desc(messages.occurredAt))
      : Promise.resolve([]),
    quoteIds.length
      ? db
          .select({
            id: quotes.id,
            status: quotes.status,
            memberId: quotes.memberId,
            contactSnapshot: quotes.contactSnapshot,
          })
          .from(quotes)
          .where(inArray(quotes.id, quoteIds))
      : Promise.resolve([]),
    quoteIds.length
      ? db
          .select({
            quoteId: quoteLegs.quoteId,
            fromCity: quoteLegs.fromCity,
            fromName: quoteLegs.fromName,
            fromIata: quoteLegs.fromIata,
            toCity: quoteLegs.toCity,
            toName: quoteLegs.toName,
            toIata: quoteLegs.toIata,
            departDate: quoteLegs.departDate,
          })
          .from(quoteLegs)
          .where(inArray(quoteLegs.quoteId, quoteIds))
          .orderBy(asc(quoteLegs.legNumber))
      : Promise.resolve([]),
    tripIds.length
      ? db
          .select({
            id: trips.id,
            status: trips.status,
            memberId: trips.memberId,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
            phone: users.phoneE164,
          })
          .from(trips)
          .innerJoin(members, eq(members.id, trips.memberId))
          .innerJoin(users, eq(users.id, members.userId))
          .where(inArray(trips.id, tripIds))
      : Promise.resolve([]),
    tripIds.length
      ? db
          .select({
            tripId: tripLegs.tripId,
            fromCity: tripLegs.fromCity,
            fromName: tripLegs.fromName,
            fromIata: tripLegs.fromIata,
            toCity: tripLegs.toCity,
            toName: tripLegs.toName,
            toIata: tripLegs.toIata,
            departDate: tripLegs.departDate,
          })
          .from(tripLegs)
          .where(inArray(tripLegs.tripId, tripIds))
          .orderBy(asc(tripLegs.legNumber))
      : Promise.resolve([]),
    memberIds.length
      ? db
          .select({
            id: members.id,
            tier: members.tier,
            firstName: users.firstName,
            lastName: users.lastName,
            email: users.email,
            phone: users.phoneE164,
            mobile: members.mobileE164,
          })
          .from(members)
          .innerJoin(users, eq(users.id, members.userId))
          .where(inArray(members.id, memberIds))
      : Promise.resolve([]),
  ]);

  const latestByKey = new Map(latest.map((m) => [`${m.subjectType}:${m.subjectId}`, m]));
  const quoteById = new Map(quoteRows.map((r) => [r.id, r]));
  const tripById = new Map(tripRows.map((r) => [r.id, r]));
  const memberById = new Map(memberRows.map((r) => [r.id, r]));
  const legsByQuote = groupBy(quoteLegRows, (l) => l.quoteId);
  const legsByTrip = groupBy(tripLegRows, (l) => l.tripId);

  const threads: ThreadView[] = [];
  for (const t of threadAgg) {
    if (!isThreadSubject(t.subjectType)) continue;
    const last = latestByKey.get(`${t.subjectType}:${t.subjectId}`);
    const lastText = (last?.preview ?? last?.body ?? "").replace(/\s+/g, " ").trim();
    const preview = lastText ? (last?.direction === "out" ? `You: ${lastText}` : lastText) : null;
    const base = {
      subjectType: t.subjectType,
      subjectId: t.subjectId,
      unread: t.unread > 0,
      preview,
      // Raw aggregates come back as strings from the driver.
      lastAt: new Date(t.lastAt),
      callOnly: t.spoken === 0,
    };
    if (t.subjectType === "quote") {
      const qr = quoteById.get(t.subjectId);
      if (!qr) continue;
      const legs = legsByQuote.get(qr.id) ?? [];
      const c = qr.contactSnapshot;
      threads.push({
        ...base,
        name: personName(c?.firstName, c?.lastName),
        context: tripContext(legs) ?? requestStage(qr.status).label,
        linkLabel: "Open request",
        linkHref: `/admin/requests/${qr.id}`,
        email: c?.email ?? null,
        phone: c?.phoneE164 ?? null,
        memberId: qr.memberId,
      });
    } else if (t.subjectType === "trip") {
      const tr = tripById.get(t.subjectId);
      if (!tr) continue;
      const legs = legsByTrip.get(tr.id) ?? [];
      threads.push({
        ...base,
        name: personName(tr.firstName, tr.lastName),
        context: tripContext(legs) ?? tripState(tr.status).label,
        linkLabel: "Open trip",
        linkHref: `/admin/trips/${tr.id}`,
        email: tr.email,
        phone: tr.phone,
        memberId: tr.memberId,
      });
    } else {
      const mr = memberById.get(t.subjectId);
      if (!mr) continue;
      threads.push({
        ...base,
        name: personName(mr.firstName, mr.lastName),
        context: tierWords(mr.tier),
        linkLabel: "Open client",
        linkHref: `/admin/clients/${mr.id}`,
        email: mr.email,
        phone: mr.mobile ?? mr.phone,
        memberId: mr.id,
      });
    }
  }

  return {
    threads: q ? threads.filter((t) => matchesSearch(q, t.name, t.email, t.context)) : threads,
    unread: threads.filter((t) => t.unread).length,
  };
}

/** Threads with at least one unread inbound message. */
export async function unreadCount(): Promise<number> {
  const [row] = await db
    .select({
      n: dsql<number>`count(distinct (${messages.subjectType}, ${messages.subjectId}))::int`,
    })
    .from(messages)
    .where(
      and(inArray(messages.subjectType, THREAD_SUBJECTS), eq(messages.direction, "in"), eq(messages.isRead, false)),
    );
  return row?.n ?? 0;
}

// ─── One thread ──────────────────────────────────────────────────────────

export type Thread = {
  subjectType: ThreadSubject;
  subjectId: string;
  messages: ThreadMessage[];
};

/** Every message on a quote / trip / member thread, oldest first. Null for a bad id or an empty thread. */
export async function getThread(kind: string, id: string): Promise<Thread | null> {
  if (!isThreadSubject(kind) || !isUuid(id)) return null;
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
    .where(and(eq(messages.subjectType, kind), eq(messages.subjectId, id)))
    .orderBy(asc(messages.occurredAt));
  if (rows.length === 0) return null;
  return {
    subjectType: kind,
    subjectId: id,
    messages: rows.map((m) => ({
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
    })),
  };
}

// ─── Website form ────────────────────────────────────────────────────────

/** Contact inquiries, newest first: open ones only unless `show` is "all". */
export async function listInquiries(opts: { show?: string } = {}): Promise<InquiryRow[]> {
  const showHandled = opts.show === "all";
  return db
    .select({
      id: contactInquiries.id,
      reason: contactInquiries.reason,
      firstName: contactInquiries.firstName,
      lastName: contactInquiries.lastName,
      email: contactInquiries.email,
      phone: contactInquiries.phone,
      fromText: contactInquiries.fromText,
      toText: contactInquiries.toText,
      dateText: contactInquiries.dateText,
      paxText: contactInquiries.paxText,
      notes: contactInquiries.notes,
      memberId: contactInquiries.memberId,
      status: contactInquiries.status,
      handledAt: contactInquiries.handledAt,
      createdAt: contactInquiries.createdAt,
      handledByEmail: users.email,
    })
    .from(contactInquiries)
    .leftJoin(users, eq(users.id, contactInquiries.handledByUserId))
    .where(showHandled ? undefined : eq(contactInquiries.status, "new"))
    .orderBy(desc(contactInquiries.createdAt))
    .limit(100);
}

// ─── Problems ────────────────────────────────────────────────────────────

/** Outbound texts / emails that failed in the last 7 days. */
export async function listFailedDeliveries(now = new Date()): Promise<FailedDeliveryRow[]> {
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const failedRaw = await db
    .select({
      id: messages.id,
      subjectType: messages.subjectType,
      subjectId: messages.subjectId,
      channel: messages.channel,
      toAddress: messages.toAddress,
      preview: messages.preview,
      error: messages.deliveryError,
      occurredAt: messages.occurredAt,
      quoteCode: quotes.quoteCode,
      quoteContact: quotes.contactSnapshot,
      tripCode: trips.tripCode,
      tripFirstName: users.firstName,
      tripLastName: users.lastName,
    })
    .from(messages)
    .leftJoin(quotes, and(eq(messages.subjectType, "quote"), eq(quotes.id, messages.subjectId)))
    .leftJoin(trips, and(eq(messages.subjectType, "trip"), eq(trips.id, messages.subjectId)))
    .leftJoin(members, eq(members.id, trips.memberId))
    .leftJoin(users, eq(users.id, members.userId))
    .where(
      and(eq(messages.deliveryStatus, "failed"), eq(messages.direction, "out"), gte(messages.occurredAt, sevenDaysAgo)),
    )
    .orderBy(desc(messages.occurredAt))
    .limit(50);

  return failedRaw
    .filter((r) => r.subjectType === "quote" || r.subjectType === "trip")
    .map((r) => ({
      id: r.id,
      subjectType: r.subjectType as "quote" | "trip",
      subjectId: r.subjectId,
      subjectCode: r.quoteCode ?? r.tripCode ?? null,
      name:
        (r.subjectType === "quote"
          ? personName(r.quoteContact?.firstName, r.quoteContact?.lastName, "")
          : personName(r.tripFirstName, r.tripLastName, "")) || null,
      channel: r.channel,
      toAddress: r.toAddress,
      preview: r.preview,
      error: r.error,
      occurredAt: r.occurredAt,
    }));
}

// ─── Call notes ──────────────────────────────────────────────────────────

/** The voice agent's log (tables owned by the voice service), newest first. */
export async function listCallNotes(): Promise<VoiceCallRow[]> {
  try {
    const rows = await sql<(Omit<VoiceCallRow, "started_at"> & { started_at: string | Date })[]>`
      select c.id, c.from_number, c.started_at, c.duration_seconds, c.outcome,
             c.summary, c.escalation_reason, c.recording_url, c.returning_caller,
             m.reason as message_reason, m.callback as message_callback
      from public.voice_calls c
      left join lateral (
        select reason, callback from public.voice_messages
        where call_id = c.id
        order by created_at desc limit 1
      ) m on true
      order by c.started_at desc
      limit 50
    `;
    return rows.map((r) => ({ ...r, started_at: new Date(r.started_at) }));
  } catch (err) {
    // The voice tables ship with the voice service's migrations; without
    // them the tab reads empty rather than crashing the desk.
    console.error("[messages] voice query failed", err);
    return [];
  }
}
