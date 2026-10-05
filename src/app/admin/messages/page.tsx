import Link from "next/link";
import { initialOf, personName } from "@/lib/desk-status";
import { relativeTime } from "@/lib/request-format";
import { ContactButtons, DESK_MINI_BTN, DeskEmpty, DeskSearch, DeskTabs } from "@/components/admin/desk-ui";
import { MessageThread, type ThreadMessage } from "@/components/admin/message-thread";
import { MarkThreadRead } from "@/components/admin/mark-thread-read";
import { FailedDeliveryList } from "@/components/admin/failed-delivery-list";
import { Bubble } from "@/components/admin/messages/bubble";
import { ThreadRow, type ThreadRowProps } from "@/components/admin/messages/thread-row";
import {
  CALL_OUTCOME_WORDS,
  CONTACT_REASON_WORDS,
  channelSentence,
  durationWords,
  messageWhen,
} from "@/components/admin/messages/words";
import {
  getThread,
  listCallNotes,
  listFailedDeliveries,
  listInquiries,
  listThreads,
  matchesSearch,
  type InquiryRow,
  type ThreadSubject,
  type VoiceCallRow,
} from "@/domain/messages/queries";
import { getApproval, listApprovals, type ApprovalRow } from "@/domain/approvals/queries";
import { getCurrentUser } from "@/lib/auth";
import { ApprovalCard } from "@/components/admin/approval-card";
import { approvalCardData, proposerName } from "@/components/admin/approvals/shape";
import { riskPillWord } from "@/components/admin/messages/words";
import { postThreadMessage } from "./actions";
import { setInquiryStatus } from "./inquiry-actions";

export const dynamic = "force-dynamic";

const BASE = "/admin/messages";
const TABS = ["all", "unread", "approvals", "calls", "form", "problems"] as const;
type Tab = (typeof TABS)[number];
const UUID_RE = /^[0-9a-f-]{36}$/i;

type Props = { searchParams: Promise<{ tab?: string; q?: string; t?: string; show?: string }> };

type Selection = { kind: ThreadSubject | "call" | "form" | "approval"; id: string } | null;

function parseSelection(t: string | undefined): Selection {
  if (!t) return null;
  const i = t.indexOf(":");
  if (i < 1) return null;
  const kind = t.slice(0, i);
  const id = t.slice(i + 1);
  if (!UUID_RE.test(id)) return null;
  if (kind === "quote" || kind === "trip" || kind === "member" || kind === "call" || kind === "form" || kind === "approval") {
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

export default async function MessagesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const now = new Date();
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "all";
  const q = (sp.q ?? "").trim();
  const showHandled = sp.show === "all";
  const keep = { q: q || undefined, show: showHandled ? "all" : undefined };

  const [{ threads, unread: unreadTotal }, calls, inquiries, failed, pendingApprovals, decidedApprovals, user] = await Promise.all([
    listThreads({ q }),
    listCallNotes(),
    listInquiries({ show: sp.show }),
    listFailedDeliveries(now),
    listApprovals({ status: ["pending"], limit: 200 }),
    // The quiet "Decided recently" group only loads on its own tab.
    tab === "approvals" ? listApprovals({ status: ["executed", "failed", "rejected", "expired"], limit: 20 }) : Promise.resolve([] as ApprovalRow[]),
    getCurrentUser(),
  ]);
  const role = user?.role ?? "";

  // ── Search + tab filter ──
  const visibleThreads = threads; // listThreads already applied the search
  const unreadThreads = visibleThreads.filter((t) => t.unread);
  const visibleCalls = calls.filter((c) => matchesSearch(q, c.from_number, c.summary));
  const visibleInquiries = inquiries.filter((i) =>
    matchesSearch(q, `${i.firstName} ${i.lastName}`, i.email, i.fromText, i.toText),
  );
  const visibleFailed = failed.filter((f) => matchesSearch(q, f.name, f.toAddress));
  const approvalMatches = (a: ApprovalRow) => matchesSearch(q, a.summary, a.requestedByName, a.subjectCode);
  const visiblePending = pendingApprovals.filter(approvalMatches);
  const visibleDecided = decidedApprovals.filter(approvalMatches);

  const tabs = [
    { key: "all", label: "All" },
    { key: "unread", label: "Unread", count: unreadTotal },
    { key: "approvals", label: "Needs your OK", count: pendingApprovals.length },
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
    else if (tab === "approvals" && visiblePending[0]) selection = { kind: "approval", id: visiblePending[0].id };
  }
  const selKey = selection ? `${selection.kind}:${selection.id}` : null;
  const rowHref = (key: string) => href({ tab: tab === "all" ? undefined : tab, ...keep, t: key });

  // ── Left list rows ──
  let rows: ThreadRowProps[] = [];
  let decidedRows: ThreadRowProps[] = [];
  let emptyWords = "Nothing here yet.";
  const approvalRow = (a: ApprovalRow): ThreadRowProps => {
    const key = `approval:${a.id}`;
    const who = proposerName(a);
    return {
      href: rowHref(key),
      selected: key === selKey,
      initial: initialOf(who),
      name: a.summary,
      context: `Proposed by ${who}`,
      preview: a.status === "pending" ? a.reason?.replace(/\s+/g, " ").trim() || null : decidedWords(a),
      when: relativeTime(a.status === "pending" ? a.createdAt : a.decidedAt ?? a.createdAt, now),
      unread: a.status === "pending",
      tag: riskPillWord(a.risk),
    };
  };
  if (tab === "approvals") {
    rows = visiblePending.map(approvalRow);
    decidedRows = visibleDecided.map(approvalRow);
    emptyWords = q ? `Nothing matches “${q}”.` : "Nothing waiting on you.";
  } else if (tab === "all" || tab === "unread") {
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
    selection && selection.kind !== "call" && selection.kind !== "form" && selection.kind !== "approval"
      ? threads.find((t) => t.subjectType === selection!.kind && t.subjectId === selection!.id) ?? null
      : null;
  const selectedCall = selection?.kind === "call" ? calls.find((c) => c.id === selection!.id) ?? null : null;
  const selectedInquiry = selection?.kind === "form" ? inquiries.find((i) => i.id === selection!.id) ?? null : null;
  const selectedApproval =
    selection?.kind === "approval"
      ? [...pendingApprovals, ...decidedApprovals].find((a) => a.id === selection!.id) ?? (await getApproval(selection.id))
      : null;

  const thread: ThreadMessage[] = selectedThread
    ? ((await getThread(selectedThread.subjectType, selectedThread.subjectId))?.messages ?? [])
    : [];

  return (
    <div className="min-w-0 max-w-[1296px] px-4 pb-10 pt-5 md:px-7 md:pt-[22px] lg:flex lg:h-screen lg:flex-col">
      <h1 className="font-serif text-[clamp(32px,4vw,40px)] font-normal leading-[1.05] text-bone md:mt-3">Messages</h1>
      <p className="mt-1.5 text-[14px] text-steel">Texts, emails and call notes, one thread per client.</p>
      <div className="mt-[18px] border border-line bg-[#FBFAF7] lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[340px_minmax(0,1fr)] lg:overflow-hidden">
      {/* Left: list */}
      <section className="flex min-h-0 flex-col border-line lg:border-r">
        <div className="flex flex-col gap-2.5 border-b border-line px-3.5 py-3">
          <div className="[&_form]:w-full [&_input]:!w-full">
            <DeskSearch width="100%" placeholder="Search a name" defaultValue={q} hidden={{ tab: tab === "all" ? undefined : tab, show: keep.show }} />
          </div>
          <DeskTabs variant="chips" items={tabs} current={tab} base={BASE} keep={keep} />
        </div>
        <div className="max-h-[60vh] min-h-0 flex-1 overflow-y-auto lg:max-h-none">
          {tab === "form" ? (
            <div className="flex justify-end px-3.5 py-1.5">
              <Link href={href({ tab: "form", q: keep.q, show: showHandled ? undefined : "all" })} className="text-[13px] text-steel transition-colors hover:text-bone">
                {showHandled ? "Open only" : "Show handled too"}
              </Link>
            </div>
          ) : null}
          {rows.length === 0 ? (
            <p className="px-3.5 py-8 text-center text-[14px] text-steel">{emptyWords}</p>
          ) : (
            rows.map((r, i) => <ThreadRow key={`${r.href}#${i}`} {...r} />)
          )}
          {decidedRows.length > 0 ? (
            <>
              <h2 className="px-3.5 pb-1.5 pt-5 text-[12px] font-bold uppercase tracking-[0.2em] text-gold">Decided recently</h2>
              {decidedRows.map((r, i) => (
                <ThreadRow key={`${r.href}#d${i}`} {...r} />
              ))}
            </>
          ) : null}
        </div>
      </section>

      {/* Right: conversation */}
      <section className="flex min-h-[420px] flex-col border-t border-line lg:min-h-0 lg:border-t-0">
        {selectedThread ? (
          <>
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 md:px-[18px]">
              <div className="min-w-0">
                <div className="font-serif text-[20px] leading-[1.2] text-bone">{selectedThread.name}</div>
                <div className="text-[12px] text-steel">
                  {selectedThread.context ? <>{selectedThread.context} · </> : null}
                  <Link href={selectedThread.linkHref} className="text-link">
                    {selectedThread.linkLabel}
                  </Link>
                </div>
              </div>
              <div className="flex gap-1.5">
                {selectedThread.phone ? (
                  <a href={`tel:${selectedThread.phone}`} className={DESK_MINI_BTN}>
                    Call
                  </a>
                ) : null}
                {selectedThread.memberId && selectedThread.subjectType !== "member" ? (
                  <Link href={`/admin/clients/${selectedThread.memberId}`} className={DESK_MINI_BTN}>
                    Client page
                  </Link>
                ) : null}
              </div>
            </header>
            <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-4 md:px-[18px]">
              <MarkThreadRead subjectType={selectedThread.subjectType} subjectId={selectedThread.subjectId} />
              <MessageThread
                now={now}
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
        ) : selectedApproval ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-[18px]">
            <div className="max-w-[720px]">
              <ApprovalCard key={`${selectedApproval.id}:${selectedApproval.status}`} data={approvalCardData(selectedApproval, { now, role })} />
              <p className="mt-4 text-[13px] leading-[1.5] text-steel">
                The assistant asked before acting. Approve and it goes ahead as you; reject with a note and it learns for next time.
              </p>
            </div>
          </div>
        ) : tab === "approvals" ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <DeskEmpty
              title="Nothing waiting on you."
              body="When the assistant wants to contact a client or change something that matters, it asks here first."
              className="w-full max-w-[440px]"
            />
          </div>
        ) : tab === "problems" ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-[18px]">
            <h2 className="font-serif text-[20px] text-bone">Problems</h2>
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
    </div>
  );
}

// ─── Panes ────────────────────────────────────────────────────────────────

/** One line under a decided proposal in the list. */
function decidedWords(a: ApprovalRow): string {
  switch (a.status) {
    case "executed":
      return `Approved${a.decidedByName ? ` by ${a.decidedByName}` : ""} and done`;
    case "failed":
      return "Approved but it did not go through";
    case "rejected":
      return `Rejected${a.decidedByName ? ` by ${a.decidedByName}` : ""}${a.decisionNote ? `: ${a.decisionNote}` : ""}`;
    case "expired":
      return "Expired before anyone decided";
    default:
      return "Being carried out now";
  }
}

function CallPane({ call, now }: { call: VoiceCallRow; now: Date }) {
  const startedAt = new Date(call.started_at);
  const duration = durationWords(call.duration_seconds);
  const outcome = CALL_OUTCOME_WORDS[call.outcome ?? ""] ?? (call.outcome ? call.outcome.replace(/_/g, " ") : "Call in progress");
  const context = [outcome, duration, call.returning_caller ? "returning caller" : null].filter(Boolean).join(" · ");
  const summary = call.summary ?? call.escalation_reason ?? "No summary was recorded.";
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 md:px-[18px]">
        <div className="min-w-0">
          <div className="font-serif text-[20px] leading-[1.2] text-bone">{call.from_number ?? "Unknown number"}</div>
          <div className="text-[12px] text-steel">{context}</div>
        </div>
        {call.from_number ? <ContactButtons phone={call.from_number} /> : null}
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 md:px-[18px]">
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
        <p className="mt-auto border-t border-line pt-3 text-[13px] text-steel">
          Call notes come from the phone line. To follow up, call back or start a request.
        </p>
      </div>
    </>
  );
}

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
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 md:px-[18px]">
        <div className="min-w-0">
          <div className="font-serif text-[20px] leading-[1.2] text-bone">{name}</div>
          <div className="text-[12px] text-steel">
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
        <ContactButtons phone={inquiry.phone} email={inquiry.email} />
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 md:px-[18px]">
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
          className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3"
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
