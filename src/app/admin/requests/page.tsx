import Link from "next/link";
import {
  DeskEmpty,
  DeskGroup,
  DeskHeader,
  DeskPage,
  DeskRow,
  DeskSearch,
  DeskTabs,
} from "@/components/admin/desk-ui";
import { onItWords, passengersWords, personName, replyDueLine, requestStage } from "@/lib/desk-status";
import { relativeTime } from "@/lib/request-page";
import { membershipShort, namelessWords, tripSentence } from "@/components/admin/requests/words";
import { listRequests, type RequestListItem, type RequestListLeg } from "@/domain/requests/queries";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ tab?: string; q?: string }> };

export default async function RequestsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const now = new Date();
  const { tab, q, groups, tabs, visibleStages } = await listRequests({ tab: sp.tab, q: sp.q, now });

  // Headline sentence (prototype): "2 need a reply — 1 overdue, 1 in
  // progress, 1 waiting on a client." Built from the same counts as the tabs.
  const count = (k: string) => tabs.find((t) => t.key === k)?.count ?? 0;
  const replyGroup = groups.find((g) => g.key === "reply");
  const overdue = replyGroup
    ? replyGroup.items.filter((r) => r.slaDeadlineAt && r.slaDeadlineAt.getTime() < now.getTime()).length
    : 0;
  const headline = `${count("reply")} need${count("reply") === 1 ? "s" : ""} a reply${
    overdue ? ` — ${overdue} overdue` : ""
  }, ${count("working")} in progress, ${count("sent")} waiting on a client.`;

  return (
    <DeskPage>
      <DeskHeader
        title="Requests"
        lead={headline}
        actions={
          <>
            <DeskSearch
              placeholder="Search name or city"
              defaultValue={q}
              hidden={{ tab: tab !== "reply" ? tab : undefined }}
            />
            <Link href="/quote/mission" className="btn btn-primary btn-sm h-11 rounded-[3px] md:h-10">
              + New request
            </Link>
          </>
        }
      />

      <DeskTabs
        variant="band"
        items={tabs}
        current={tab}
        base="/admin/requests"
        keep={{ q: q || undefined }}
        className="mt-6"
      />

      {visibleStages.length === 0 ? (
        q ? (
          <DeskEmpty title="Nothing matches." body={`No requests match “${q}”.`}>
            <Link href="/admin/requests" className="btn btn-secondary btn-sm">
              Clear search
            </Link>
          </DeskEmpty>
        ) : (
          <DeskEmpty title="All caught up." body="Nothing in this list right now." />
        )
      ) : (
        groups.map((group) => (
          <DeskGroup
            key={group.key}
            index={GROUP_INDEX[group.key]}
            title={group.title}
            hint={GROUP_HINT[group.key]}
            className="mt-7"
          >
            {group.items.map((r) => (
              <RequestRow key={r.id} row={r} legs={r.legs} options={r.options} now={now} />
            ))}
          </DeskGroup>
        ))
      )}

      <p className="mt-7 max-w-[80ch] text-[13px] text-steel">
        Replies are due 30 minutes after a request arrives during operating hours. Sourcing happens in Avinode;
        paste the quote into the request to send options.
      </p>
    </DeskPage>
  );
}

/** "01 / Needs a reply" numbering follows the stage order. */
const GROUP_INDEX: Record<string, number> = { reply: 1, working: 2, sent: 3, booked: 4, closed: 5 };
const GROUP_HINT: Record<string, string> = {
  reply: "Most overdue first",
  working: "Sourcing in Avinode",
  sent: "Nudge after 24 hours",
  booked: "Now in Trips",
  closed: "Last 30 days",
};

type Row = RequestListItem;
type LegRow = RequestListLeg;

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
    case "closed": {
      line1 = `Closed ${relativeTime(r.updatedAt, now).toLowerCase()}`;
      line2 = { text: stage.label, tone: "steel" };
      action = { label: "Open", href, primary: false };
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
          : "text-bone";

  return (
    <DeskRow>
      <div className="min-w-0">
        <div className="font-serif text-[21px] leading-[1.2] text-bone">
          {name}{" "}
          <span className="font-sans text-[14px] text-steel">· {passengersWords(r.paxCount)}</span>
        </div>
        <div className="mt-[3px] text-[15px] text-bone">{trip}</div>
        {noteParts.length ? <div className="mt-0.5 text-[14px] text-steel">{noteParts.join(" · ")}</div> : null}
      </div>

      {/* On phones this block sits first in the card (Mobile frame). */}
      <div className="order-first flex flex-wrap gap-x-2 text-[14px] leading-[1.45] md:order-none md:block">
        <span className="text-steel">{line1}</span>
        {line2 ? <span className={`font-semibold ${toneClass} md:mt-0.5 md:block`}>{line2.text}</span> : null}
      </div>

      <Link
        href={action.href}
        className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-[3px] border border-clearance text-[14px] font-semibold transition-colors md:h-[38px] ${
          action.primary
            ? "bg-clearance text-white hover:bg-clearance-hover"
            : "bg-surface text-bone hover:bg-surface-2"
        }`}
      >
        {action.label} <span aria-hidden="true">↗</span>
      </Link>
    </DeskRow>
  );
}
