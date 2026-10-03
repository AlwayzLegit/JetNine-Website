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
        groups.map((group) => (
          <DeskGroup key={group.key} title={group.title} count={group.items.length}>
            {group.items.map((r) => (
              <RequestRow key={r.id} row={r} legs={r.legs} options={r.options} now={now} />
            ))}
          </DeskGroup>
        ))
      )}
    </DeskPage>
  );
}

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
