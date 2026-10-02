import Link from "next/link";
import { and, asc, desc, eq, gte, inArray, sql as dsql } from "drizzle-orm";
import { db, sql } from "@/db";
import { messages } from "@/db/schema/audit";
import { contactInquiries } from "@/db/schema/contact";
import { members } from "@/db/schema/members";
import { quotes, quoteLegs } from "@/db/schema/quotes";
import { trips, tripLegs } from "@/db/schema/trips";
import { users } from "@/db/schema/users";
import { initialOf, personName, requestStage, tierWords, tripState } from "@/lib/desk-status";
import { relativeTime } from "@/lib/request-page";
import { ContactButtons, DeskEmpty, DeskSearch, DeskTabs } from "@/components/admin/desk-ui";
import { MessageThread, type ThreadMessage } from "@/components/admin/message-thread";
import { MarkThreadRead } from "@/components/admin/mark-thread-read";
import { FailedDeliveryList, type FailedDeliveryRow } from "@/components/admin/failed-delivery-list";
import { Bubble } from "@/components/admin/messages/bubble";
import { ThreadRow, type ThreadRowProps } from "@/components/admin/messages/thread-row";
import {
  CALL_OUTCOME_WORDS,
  CONTACT_REASON_WORDS,
  channelSentence,
  dateRangeWords,
  durationWords,
  messageWhen,
  routeWords,
} from "@/components/admin/messages/words";
import { postThreadMessage } from "./actions";
import { setInquiryStatus } from "./inquiry-actions";

export const dynamic = "force-dynamic";

const BASE = "/admin/messages";
const TABS = ["all", "unread", "calls", "form", "problems"] as const;
type Tab = (typeof TABS)[number];
type ThreadSubject = "quote" | "trip" | "member";
const THREAD_SUBJECTS: ThreadSubject[] = ["quote", "trip", "member"];
const UUID_RE = /^[0-9a-f-]{36}$/i;

type Props = { searchParams: Promise<{ tab?: string; q?: string; t?: string; show?: string }> };

type ThreadView = {
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

type VoiceCallRow = {
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

type Selection = { kind: ThreadSubject | "call" | "form"; id: string } | null;

function parseSelection(t: string | undefined): Selection {
  if (!t) return null;
  const i = t.indexOf(":");
  if (i < 1) return null;
  const kind = t.slice(0, i);
  const id = t.slice(i + 1);
  if (!UUID_RE.test(id)) return null;
  if (kind === "quote" || kind === "trip" || kind === "member" || kind === "call" || kind === "form") {
    return { kind, id };
  }
  return null;
}

function href(params: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `${BASE}?${s}` : BASE;
}

function matches(q: string, ...fields: (string | null | undefined)[]): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return fields.some((f) => f && f.toLowerCase().includes(needle));
}

export default async function MessagesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const now = new Date();
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "all";
  const q = (sp.q ?? "").trim();
  const showHandled = sp.show === "all";
  const keep = { q: q || undefined, show: showHandled ? "all" : undefined };

  // ── Threads: one row per (subject_type, subject_id), newest first ──
  const threadAgg = await db
    .select({
      subjectType: messages.subjectType,
      subjectId: messages.subjectId,
      lastAt: dsql<Date>`max(${messages.occurredAt})`,
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
    if (t.subjectType !== "quote" && t.subjectType !== "trip" && t.subjectType !== "member") continue;
    const last = latestByKey.get(`${t.subjectType}:${t.subjectId}`);
    const lastText = (last?.preview ?? last?.body ?? "").replace(/\s+/g, " ").trim();
    const preview = lastText ? (last?.direction === "out" ? `You: ${lastText}` : lastText) : null;
    const base = {
      subjectType: t.subjectType,
      subjectId: t.subjectId,
      unread: t.unread > 0,
      preview,
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

  // ── Call notes: the voice agent's log (tables owned by the voice service) ──
  let calls: VoiceCallRow[] = [];
  try {
    calls = await sql<VoiceCallRow[]>`
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
  } catch (err) {
    // The voice tables ship with the voice service's migrations; without
    // them the tab reads empty rather than crashing the desk.
    console.error("[admin/messages] voice query failed", err);
    calls = [];
  }

  // ── Website form: contact inquiries (open only unless ?show=all) ──
  const inquiries = await db
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

  // ── Problems: outbound texts / emails that failed in the last 7 days ──
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
      and(
        eq(messages.deliveryStatus, "failed"),
        eq(messages.direction, "out"),
        gte(messages.occurredAt, sevenDaysAgo),
      ),
    )
    .orderBy(desc(messages.occurredAt))
    .limit(50);

  const failed: FailedDeliveryRow[] = failedRaw
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

  // ── Search + tab filter ──
  const visibleThreads = threads.filter((t) => matches(q, t.name, t.email, t.context));
  const unreadThreads = visibleThreads.filter((t) => t.unread);
  const visibleCalls = calls.filter((c) => matches(q, c.from_number, c.summary));
  const visibleInquiries = inquiries.filter((i) => matches(q, `${i.firstName} ${i.lastName}`, i.email, i.fromText, i.toText));
  const visibleFailed = failed.filter((f) => matches(q, f.name, f.toAddress));

  const tabs = [
    { key: "all", label: "All" },
    { key: "unread", label: "Unread", count: threads.filter((t) => t.unread).length },
    { key: "calls", label: "Call notes", count: calls.length },
    { key: "form", label: "Website form", count: inquiries.filter((i) => i.status === "new").length },
    { key: "problems", label: "Problems", count: failed.length },
  ];

  // ── Selection: from ?t=, else the first row of the current tab ──
  let selection = parseSelection(sp.t);
  if (!selection) {
    if (tab === "all" && visibleThreads[0]) selection = { kind: visibleThreads[0].subjectType, id: visibleThreads[0].subjectId };
    else if (tab === "unread" && unreadThreads[0]) selection = { kind: unreadThreads[0].subjectType, id: unreadThreads[0].subjectId };
    else if (tab === "calls" && visibleCalls[0]) selection = { kind: "call", id: visibleCalls[0].id };
    else if (tab === "form" && visibleInquiries[0]) selection = { kind: "form", id: visibleInquiries[0].id };
  }
  const selKey = selection ? `${selection.kind}:${selection.id}` : null;
  const rowHref = (key: string) => href({ tab: tab === "all" ? undefined : tab, ...keep, t: key });

  // ── Left list rows ──
  let rows: ThreadRowProps[] = [];
  let emptyWords = "Nothing here yet.";
  if (tab === "all" || tab === "unread") {
    const list = tab === "all" ? visibleThreads : unreadThreads;
    rows = list.map((t) => {
      const key = `${t.subjectType}:${t.subjectId}`;
      return {
        href: rowHref(key),
        selected: key === selKey,
        initial: t.callOnly ? "☎" : initialOf(t.name),
        name: t.name,
        context: t.context,
        preview: t.preview,
        when: relativeTime(t.lastAt, now),
        unread: t.unread,
      };
    });
    emptyWords = tab === "unread" ? "All read." : q ? `Nothing matches “${q}”.` : "No conversations yet.";
  } else if (tab === "calls") {
    rows = visibleCalls.map((c) => {
      const key = `call:${c.id}`;
      const summary = (c.summary ?? c.escalation_reason ?? "").replace(/\s+/g, " ").trim();
      return {
        href: rowHref(key),
        selected: key === selKey,
        initial: "☎",
        name: c.from_number ?? "Unknown number",
        context: summary ? (summary.length > 60 ? `${summary.slice(0, 59)}…` : summary) : CALL_OUTCOME_WORDS[c.outcome ?? ""] ?? "Call",
        preview: c.message_reason ? `Left a message: ${c.message_reason}` : null,
        when: relativeTime(new Date(c.started_at), now),
        unread: c.outcome === "message",
      };
    });
    emptyWords = "No calls logged yet.";
  } else if (tab === "form") {
    rows = visibleInquiries.map((i) => {
      const key = `form:${i.id}`;
      const name = personName(i.firstName, i.lastName);
      const route = i.fromText || i.toText ? `${i.fromText ?? "—"} → ${i.toText ?? "—"}` : null;
      const context = [CONTACT_REASON_WORDS[i.reason] ?? "Something else", route, i.dateText].filter(Boolean).join(" · ");
      return {
        href: rowHref(key),
        selected: key === selKey,
        initial: initialOf(name),
        name,
        context,
        preview: i.notes?.replace(/\s+/g, " ").trim() || null,
        when: relativeTime(i.createdAt, now),
        unread: i.status === "new",
      };
    });
    emptyWords = showHandled ? "Nothing has come in through the contact form yet." : "No open form messages.";
  } else {
    rows = visibleFailed.map((f) => {
      const key = `${f.subjectType}:${f.subjectId}`;
      return {
        href: rowHref(key),
        selected: key === selKey,
        initial: "!",
        name: f.name ?? f.toAddress ?? "Unknown client",
        context: `${channelSentence(f.channel ?? "")} didn't send${f.occurredAt ? ` · ${messageWhen(f.occurredAt, now)}` : ""}`,
        preview: f.error,
        when: f.occurredAt ? relativeTime(f.occurredAt, now) : "",
        tone: "danger" as const,
      };
    });
    emptyWords = "Everything sent.";
  }

  // ── Right pane data ──
  const selectedThread =
    selection && selection.kind !== "call" && selection.kind !== "form"
      ? threads.find((t) => t.subjectType === selection!.kind && t.subjectId === selection!.id) ?? null
      : null;
  const selectedCall = selection?.kind === "call" ? calls.find((c) => c.id === selection!.id) ?? null : null;
  const selectedInquiry = selection?.kind === "form" ? inquiries.find((i) => i.id === selection!.id) ?? null : null;

  let thread: ThreadMessage[] = [];
  if (selectedThread) {
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
      .where(and(eq(messages.subjectType, selectedThread.subjectType), eq(messages.subjectId, selectedThread.subjectId)))
      .orderBy(asc(messages.occurredAt));
    thread = messageRows.map((m) => ({
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

  return (
    <div className="min-w-0 lg:grid lg:h-screen lg:grid-cols-[380px_minmax(0,1fr)] lg:overflow-hidden">
      {/* Left: list */}
      <section className="flex min-h-0 flex-col border-line-faint lg:border-r">
        <div className="px-5 pt-6 md:px-6 md:pt-7">
          <h1 className="title-app text-bone">Messages</h1>
          <p className="mt-1.5 text-[14px] text-bone-2">Texts, emails and call notes, one thread per client.</p>
          <div className="mt-4 [&_form]:w-full [&_label]:!w-full">
            <DeskSearch width="100%" placeholder="Search a name" defaultValue={q} hidden={{ tab: tab === "all" ? undefined : tab, show: keep.show }} />
          </div>
          <DeskTabs items={tabs} current={tab} base={BASE} keep={keep} className="mt-3" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-2">
          {tab === "form" ? (
            <div className="flex justify-end px-3 pb-1">
              <Link href={href({ tab: "form", q: keep.q, show: showHandled ? undefined : "all" })} className="text-[13px] text-steel transition-colors hover:text-bone">
                {showHandled ? "Open only" : "Show handled too"}
              </Link>
            </div>
          ) : null}
          {rows.length === 0 ? (
            <p className="px-3 py-8 text-center text-[15px] text-bone-2">{emptyWords}</p>
          ) : (
            rows.map((r, i) => <ThreadRow key={`${r.href}#${i}`} {...r} />)
          )}
        </div>
      </section>

      {/* Right: conversation */}
      <section className="flex min-h-0 flex-col border-t border-line-faint lg:border-t-0">
        {selectedThread ? (
          <>
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line-faint px-5 py-5 md:px-8">
              <div className="min-w-0">
                <div className="text-[20px] font-medium text-bone">{selectedThread.name}</div>
                <div className="text-[14px] text-steel">
                  {selectedThread.context ? <>{selectedThread.context} · </> : null}
                  <Link href={selectedThread.linkHref} className="text-link">
                    {selectedThread.linkLabel}
                  </Link>
                </div>
              </div>
              <div className="flex gap-2">
                {selectedThread.phone ? (
                  <a href={`tel:${selectedThread.phone}`} className="btn btn-secondary btn-sm">
                    Call
                  </a>
                ) : null}
                {selectedThread.memberId && selectedThread.subjectType !== "member" ? (
                  <Link href={`/admin/clients/${selectedThread.memberId}`} className="btn btn-secondary btn-sm">
                    Client page
                  </Link>
                ) : null}
              </div>
            </header>
            <div className="flex min-h-0 flex-1 flex-col px-5 pb-6 pt-6 md:px-8">
              <MarkThreadRead subjectType={selectedThread.subjectType} subjectId={selectedThread.subjectId} />
              <MessageThread
                key={`${selectedThread.subjectType}:${selectedThread.subjectId}`}
                initial={thread}
                defaultEmail={selectedThread.email}
                defaultPhone={selectedThread.phone}
                clientName={selectedThread.name}
                postAction={postThreadMessage.bind(null, selectedThread.subjectType, selectedThread.subjectId)}
                disabledNote={selectedThread.subjectType === "member" ? "Reply from the client's request or trip" : undefined}
              />
            </div>
          </>
        ) : selectedCall ? (
          <CallPane call={selectedCall} now={now} />
        ) : selectedInquiry ? (
          <InquiryPane inquiry={selectedInquiry} now={now} />
        ) : tab === "problems" ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 md:px-8">
            <h2 className="text-[20px] font-medium text-bone">Problems</h2>
            <p className="mt-1 text-[14px] text-steel">Texts and emails that didn&rsquo;t send in the last 7 days. Retry sends the same message again.</p>
            <div className="mt-5">
              <FailedDeliveryList initial={failed} now={now} />
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8">
            <DeskEmpty title="Nothing here yet." body={tab === "calls" ? "Calls land here when the phone line is answered." : undefined} className="w-full max-w-[440px]" />
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Panes ────────────────────────────────────────────────────────────────

function CallPane({ call, now }: { call: VoiceCallRow; now: Date }) {
  const startedAt = new Date(call.started_at);
  const duration = durationWords(call.duration_seconds);
  const outcome = CALL_OUTCOME_WORDS[call.outcome ?? ""] ?? (call.outcome ? call.outcome.replace(/_/g, " ") : "Call in progress");
  const context = [outcome, duration, call.returning_caller ? "returning caller" : null].filter(Boolean).join(" · ");
  const summary = call.summary ?? call.escalation_reason ?? "No summary was recorded.";
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line-faint px-5 py-5 md:px-8">
        <div className="min-w-0">
          <div className="text-[20px] font-medium text-bone">{call.from_number ?? "Unknown number"}</div>
          <div className="text-[14px] text-steel">{context}</div>
        </div>
        {call.from_number ? <ContactButtons phone={call.from_number} size="md" /> : null}
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-5 py-6 md:px-8">
        <Bubble
          kind="in"
          meta={
            <>
              Phone answering · {messageWhen(startedAt, now)}
              {call.recording_url ? (
                <>
                  {" · "}
                  <a href={call.recording_url} target="_blank" rel="noreferrer" className="text-link">
                    Listen to recording ↗
                  </a>
                </>
              ) : null}
            </>
          }
        >
          Call summary{duration ? ` (${duration})` : ""}: {summary}
        </Bubble>
        {call.message_reason ? (
          <Bubble kind="note" noteLabel="Only the team sees this" meta={`Phone answering · ${messageWhen(startedAt, now)}`}>
            Left a message: {call.message_reason}
            {call.message_callback ? ` · call back ${call.message_callback}` : ""}
          </Bubble>
        ) : null}
        <p className="mt-auto border-t border-line-faint pt-4 text-[13px] text-steel">
          Call notes come from the phone line. To follow up, call back or start a request.
        </p>
      </div>
    </>
  );
}

type InquiryRow = {
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

function InquiryPane({ inquiry, now }: { inquiry: InquiryRow; now: Date }) {
  const name = personName(inquiry.firstName, inquiry.lastName);
  const reason = CONTACT_REASON_WORDS[inquiry.reason] ?? "Something else";
  const handled = inquiry.status === "handled";
  const facts: [string, string | null][] = [
    ["Reason", reason],
    ["From", inquiry.fromText],
    ["To", inquiry.toText],
    ["When", inquiry.dateText],
    ["Passengers", inquiry.paxText],
    ["Email", inquiry.email],
    ["Phone", inquiry.phone],
  ];
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line-faint px-5 py-5 md:px-8">
        <div className="min-w-0">
          <div className="text-[20px] font-medium text-bone">{name}</div>
          <div className="text-[14px] text-steel">
            Website form · {reason}
            {inquiry.memberId ? (
              <>
                {" · "}
                <Link href={`/admin/clients/${inquiry.memberId}`} className="text-link">
                  Open client
                </Link>
              </>
            ) : null}
          </div>
        </div>
        <ContactButtons phone={inquiry.phone} email={inquiry.email} size="md" />
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-5 py-6 md:px-8">
        <Bubble kind="in" meta={`${name.split(" ")[0]} · website form · ${messageWhen(inquiry.createdAt, now)}`}>
          <dl className="dl-jn text-[15px]">
            {facts
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="contents">
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
          {inquiry.notes ? <p className="mt-3 whitespace-pre-line">{inquiry.notes}</p> : null}
        </Bubble>
        {handled ? (
          <p className="text-[13px] text-steel">
            Handled{inquiry.handledByEmail ? ` by ${inquiry.handledByEmail}` : ""}
            {inquiry.handledAt ? ` · ${messageWhen(inquiry.handledAt, now)}` : ""}
          </p>
        ) : null}
        <form
          action={async (formData: FormData) => {
            "use server";
            await setInquiryStatus(formData);
          }}
          className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line-faint pt-4"
        >
          <span className="text-[13px] text-steel">
            {handled ? "Reopen if the client comes back." : "Mark handled once the reply is out."}
          </span>
          <input type="hidden" name="id" value={inquiry.id} />
          <input type="hidden" name="status" value={handled ? "new" : "handled"} />
          <button type="submit" className={handled ? "btn btn-secondary btn-sm" : "btn btn-primary btn-sm"}>
            {handled ? "Reopen" : "Mark handled"}
          </button>
        </form>
      </div>
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

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
