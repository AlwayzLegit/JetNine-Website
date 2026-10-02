import Link from "next/link";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { quotes, quoteLegs } from "@/db/schema/quotes";
import { members } from "@/db/schema/members";
import { staff } from "@/db/schema/staff";
import { sourcedOptions } from "@/db/schema/sourced-option";
import {
  DeskEmpty,
  DeskGroup,
  DeskHeader,
  DeskPage,
  DeskRow,
  DeskSearch,
  DeskTabs,
  type DeskTab,
} from "@/components/admin/desk-ui";
import {
  OPEN_REQUEST_STATUSES,
  REQUEST_TABS,
  onItWords,
  passengersWords,
  personName,
  replyDueLine,
  requestStage,
  type RequestStageKey,
} from "@/lib/desk-status";
import { relativeTime } from "@/lib/request-page";
import { membershipShort, namelessWords, tripSentence } from "@/components/admin/requests/words";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ tab?: string; q?: string }> };

const STAGE_ORDER: RequestStageKey[] = ["reply", "working", "sent", "booked"];
const BOOKED_WINDOW_DAYS = 14;
const ROW_LIMIT = 200;

// Post-deploy smoke tests submit real quotes flagged by a "[SMOKE]" first
// name and a "smoke+…" email (see src/app/quote/actions.ts). Postgres LIKE
// treats "[" literally, so the pattern matches the prefix as typed.
const NOT_SMOKE = sql`not (
  ${quotes.contactSnapshot}->>'firstName' ilike '[SMOKE]%'
  or ${quotes.contactSnapshot}->>'email' ilike 'smoke+%'
)`;

type LegRow = Pick<
  typeof quoteLegs.$inferSelect,
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

export default async function RequestsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const now = new Date();
  const q = (sp.q ?? "").trim().slice(0, 80);
  const tabKeys = new Set<string>([...REQUEST_TABS.map((t) => t.key), "all"]);
  const tab = sp.tab && tabKeys.has(sp.tab) ? sp.tab : "reply";

  const bookedSince = new Date(now.getTime() - BOOKED_WINDOW_DAYS * 86_400_000);
  const openOrRecentlyBooked = or(
    inArray(quotes.status, [...OPEN_REQUEST_STATUSES]),
    and(
      inArray(quotes.status, ["accepted", "converted"]),
      sql`coalesce(${quotes.acceptedAt}, ${quotes.updatedAt}) >= ${bookedSince}`,
    ),
  );

  // Search: contact name / email, or any leg's city, airport name or code.
  const pattern = q ? `%${q.replace(/[%_]/g, "\\$&")}%` : null;
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
    .limit(ROW_LIMIT);

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
    : [[] as LegRow[], [] as { quoteId: string; total: number; sent: number }[]];

  const legsByQuote = new Map<string, LegRow[]>();
  for (const l of legRows) {
    const arr = legsByQuote.get(l.quoteId) ?? [];
    arr.push(l);
    legsByQuote.set(l.quoteId, arr);
  }
  const optionsByQuote = new Map(optionRows.map((o) => [o.quoteId, o]));

  // Group by stage, in stage order. Needs-a-reply sorts by deadline so the
  // most overdue row is on top; every other group reads newest first.
  const byStage = new Map<RequestStageKey, typeof rows>();
  for (const r of rows) {
    const key = requestStage(r.status).key;
    if (key === "closed") continue;
    const arr = byStage.get(key) ?? [];
    arr.push(r);
    byStage.set(key, arr);
  }
  byStage.get("reply")?.sort((a, b) => a.slaDeadlineAt.getTime() - b.slaDeadlineAt.getTime());

  const tabs: DeskTab[] = [
    ...REQUEST_TABS.map((t) => ({ ...t, count: byStage.get(t.key)?.length ?? 0 })),
    { key: "all", label: "All" },
  ];

  const visibleStages = STAGE_ORDER.filter(
    (k) => (tab === "all" || k === tab) && (byStage.get(k)?.length ?? 0) > 0,
  );

  return (
    <DeskPage>
      <DeskHeader
        title="Requests"
        actions={
          <>
            <DeskSearch defaultValue={q} hidden={{ tab: tab !== "reply" ? tab : undefined }} />
            <Link href="/quote/mission" className="btn btn-primary">
              + New request
            </Link>
          </>
        }
      />

      <DeskTabs items={tabs} current={tab} base="/admin/requests" keep={{ q: q || undefined }} className="mt-6" />

      {visibleStages.length === 0 ? (
        q ? (
          <DeskEmpty title="Nothing matches." body={`No requests match “${q}”.`}>
            <Link href="/admin/requests" className="btn btn-secondary btn-sm">
              Clear search
            </Link>
          </DeskEmpty>
        ) : (
          <DeskEmpty title="All caught up." body="No requests need attention right now." />
        )
      ) : (
        visibleStages.map((stageKey) => {
          const group = byStage.get(stageKey) ?? [];
          const title = requestStage(group[0].status).group;
          return (
            <DeskGroup key={stageKey} title={title} count={group.length}>
              {group.map((r) => (
                <RequestRow
                  key={r.id}
                  row={r}
                  legs={legsByQuote.get(r.id) ?? []}
                  options={optionsByQuote.get(r.id) ?? { total: 0, sent: 0 }}
                  now={now}
                />
              ))}
            </DeskGroup>
          );
        })
      )}
    </DeskPage>
  );
}

type Row = {
  id: string;
  status: string;
  source: string;
  tripType: "one_way" | "round" | "multi_leg";
  paxCount: number;
  notes: string | null;
  contactSnapshot: { firstName?: string; lastName?: string } | null;
  memberId: string | null;
  memberTier: string | null;
  receivedAt: Date;
  slaDeadlineAt: Date;
  respondedAt: Date | null;
  acceptedAt: Date | null;
  updatedAt: Date;
  convertedTripId: string | null;
  dispatcherName: string | null;
};

function RequestRow({
  row: r,
  legs,
  options,
  now,
}: {
  row: Row;
  legs: LegRow[];
  options: { total: number; sent: number };
  now: Date;
}) {
  const stage = requestStage(r.status);
  const name = personName(r.contactSnapshot?.firstName, r.contactSnapshot?.lastName, namelessWords(r.source));
  const trip = tripSentence(legs, r.tripType);

  const noteParts: string[] = [];
  const note = r.notes?.replace(/\s+/g, " ").trim();
  if (note) noteParts.push(note.length > 90 ? `${note.slice(0, 89).trimEnd()}…` : note);
  if (r.memberId) {
    const card = membershipShort(r.memberTier);
    noteParts.push(card ? `repeat client · ${card}` : "repeat client");
  }

  const href = `/admin/requests/${r.id}`;
  const received = `Received ${relativeTime(r.receivedAt, now).toLowerCase()}`;

  let line1: string;
  let line2: { text: string; tone: "gold" | "danger" | "steel" | "bone" } | null = null;
  let action: { label: string; href: string; primary: boolean };

  switch (stage.key) {
    case "reply": {
      const due = replyDueLine(r.slaDeadlineAt, r.status, now);
      line1 = received;
      line2 = due ? { text: due.text, tone: due.tone } : null;
      action = { label: "Open", href, primary: true };
      break;
    }
    case "working": {
      line1 = onItWords(r.dispatcherName) ?? received;
      line2 = { text: `${options.total} of 3 options added`, tone: "bone" };
      action = { label: "Continue", href, primary: false };
      break;
    }
    case "sent": {
      const sentAt = r.respondedAt ?? r.updatedAt;
      const n = options.sent || options.total;
      line1 = `${n} option${n === 1 ? "" : "s"} sent · ${relativeTime(sentAt, now).toLowerCase()}`;
      line2 = { text: r.status === "held" ? "Aircraft held for them" : "Waiting on the client", tone: "bone" };
      action = { label: "Nudge", href: `${href}#conversation`, primary: false };
      break;
    }
    default: {
      const bookedAt = r.acceptedAt ?? r.updatedAt;
      line1 = `Booked ${relativeTime(bookedAt, now).toLowerCase()}`;
      line2 = { text: "Now under Trips", tone: "bone" };
      action = r.convertedTripId
        ? { label: "View trip", href: `/admin/trips/${r.convertedTripId}`, primary: false }
        : { label: "Open", href, primary: false };
    }
  }

  const toneClass =
    line2?.tone === "gold"
      ? "text-gold"
      : line2?.tone === "danger"
        ? "text-danger"
        : line2?.tone === "steel"
          ? "text-steel"
          : "text-bone-2";

  return (
    <DeskRow>
      <div className="min-w-0">
        <div className="text-[17px] font-medium text-bone">
          {name} <span className="font-normal text-steel">· {passengersWords(r.paxCount)}</span>
        </div>
        <div className="mt-0.5 text-bone-2">{trip}</div>
        {noteParts.length ? <div className="mt-0.5 text-[14px] text-steel">{noteParts.join(" · ")}</div> : null}
      </div>

      {/* On phones this block sits first in the card (Mobile frame). */}
      <div className="order-first flex flex-wrap gap-x-2 text-[14px] leading-[1.45] text-bone-2 md:order-none md:block">
        <span>{line1}</span>
        {line2 ? <span className={`font-medium ${toneClass} md:block`}>{line2.text}</span> : null}
      </div>

      <Link
        href={action.href}
        className={`btn btn-sm w-full md:w-auto ${action.primary ? "btn-primary" : "btn-secondary"}`}
      >
        {action.label}
      </Link>
    </DeskRow>
  );
}
