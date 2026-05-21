import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { trips, tripLegs } from "@/db/schema/trips";
import { invoices } from "@/db/schema/invoices";
import { members } from "@/db/schema/members";
import { users } from "@/db/schema/users";
import { quotes } from "@/db/schema/quotes";
import { aircraft } from "@/db/schema/aircraft";
import { operators } from "@/db/schema/operators";
import { messages } from "@/db/schema/audit";
import { TripStatusSelect } from "@/components/admin/trip-status-select";
import {
  MessageThread,
  type ThreadMessage,
} from "@/components/admin/message-thread";
import { postTripMessage } from "@/app/admin/trip/[id]/actions";
import { formatUSD } from "@/lib/quote-pricing";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const STATUS_CLASS: Record<string, string> = {
  draft: "border-ink-3 text-bone-2",
  confirmed: "border-clearance text-clearance",
  crew_briefed: "border-bone text-bone",
  boarding: "border-bone text-bone",
  airborne: "border-[var(--warn)] text-[var(--warn)]",
  wheels_down: "border-bone-2 text-bone-2",
  completed: "border-[var(--success)] text-[var(--success)]",
  cancelled_wx: "border-[var(--error)] text-[var(--error)]",
  cancelled_other: "border-[var(--error)] text-[var(--error)]",
  diverted: "border-[var(--warn)] text-[var(--warn)]",
  irregular_ops: "border-[var(--error)] text-[var(--error)]",
};

const INVOICE_STATUS_CLASS: Record<string, string> = {
  draft: "border-bone-2 text-bone-2",
  due: "border-[var(--warn)] text-[var(--warn)]",
  overdue: "border-[var(--error)] text-[var(--error)]",
  paid: "border-[var(--success)] text-[var(--success)]",
  credit: "border-clearance text-clearance",
  void: "border-steel text-steel",
};

export default async function AdminTripDetailPage({ params }: Props) {
  const { id } = await params;

  const [trip] = await db.select().from(trips).where(eq(trips.id, id));
  if (!trip) notFound();

  const legs = await db
    .select()
    .from(tripLegs)
    .where(eq(tripLegs.tripId, id))
    .orderBy(asc(tripLegs.legNumber));

  const [memberRow] = await db
    .select({
      id: members.id,
      memberCode: members.memberCode,
      tier: members.tier,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phoneE164: users.phoneE164,
    })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(eq(members.id, trip.memberId));

  const [tripInvoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.tripId, id));

  const [originatingQuote] = trip.quoteId
    ? await db
        .select({ id: quotes.id, quoteCode: quotes.quoteCode, status: quotes.status })
        .from(quotes)
        .where(eq(quotes.id, trip.quoteId))
    : [];

  const [acRow] = trip.aircraftId
    ? await db
        .select({
          tailNumber: aircraft.tailNumber,
          makeModel: aircraft.makeModel,
          yearManufactured: aircraft.yearManufactured,
          operatorId: aircraft.operatorId,
        })
        .from(aircraft)
        .where(eq(aircraft.id, trip.aircraftId))
    : [];

  const [opRow] = trip.operatorId
    ? await db
        .select({ id: operators.id, name: operators.name, certNumber: operators.certNumber })
        .from(operators)
        .where(eq(operators.id, trip.operatorId))
    : [];

  // ── Messages thread (subject_type='trip') ──
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
    })
    .from(messages)
    .leftJoin(users, eq(users.id, messages.fromUserId))
    .where(and(eq(messages.subjectType, "trip"), eq(messages.subjectId, id)))
    .orderBy(asc(messages.occurredAt));

  const thread: ThreadMessage[] = messageRows.map((m) => ({
    id: m.id,
    channel: m.channel,
    direction: m.direction,
    fromLabel: m.fromUserFirstName || m.fromUserEmail || m.fromAddress || null,
    toAddress: m.toAddress,
    preview: m.preview,
    body: m.body,
    occurredAt: m.occurredAt,
  }));

  const totalDistance = legs.reduce((sum, l) => sum + (l.distanceNm ?? 0), 0);
  const memberName =
    [memberRow?.firstName, memberRow?.lastName].filter(Boolean).join(" ") ||
    memberRow?.email ||
    "Anonymous";

  return (
    <div className="container-jn py-8">
      {/* Top bar */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-6 border-b border-ink-3 pb-6">
        <div>
          <nav className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
            <Link href="/admin/trip" className="transition-colors hover:text-clearance">
              Trips
            </Link>{" "}
            <span className="text-steel">/</span>{" "}
            <span className="text-bone">Sheet</span>
          </nav>
          <div className="mt-3 flex items-baseline gap-4">
            <span
              className="font-serif text-[36px] font-light leading-none tracking-tight text-bone"
              style={{ letterSpacing: "-0.01em" }}
            >
              {trip.tripCode}
            </span>
            <span
              className={[
                "rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]",
                STATUS_CLASS[trip.status] ?? "border-ink-3 text-bone-2",
              ].join(" ")}
            >
              {trip.status.replace(/_/g, " ")}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
              v{trip.version} · created {trip.createdAt.toISOString().slice(0, 10)}
            </span>
          </div>
        </div>
        <TripStatusSelect tripId={trip.id} current={trip.status} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-6">
          {/* Mission */}
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <h2 className="mb-5 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
              — Mission
            </h2>
            <dl className="grid grid-cols-[140px_1fr] gap-x-6 gap-y-3 text-[13px]">
              <Row k="— Type">
                <span className="font-mono uppercase tracking-[0.08em] text-bone">
                  {trip.missionType.replace(/_/g, " ")}
                </span>
              </Row>
              <Row k="— Pax / crew">
                <span className="font-mono tracking-[0.04em] text-bone">
                  {trip.paxCount} pax · {trip.crewCount} crew
                </span>
              </Row>
              <Row k="— International">
                <span className="text-bone">{trip.isInternational ? "Yes" : "No"}</span>
              </Row>
              <Row k="— Manifest">
                <span className="font-mono text-[11px] tracking-[0.04em] text-bone-2">
                  {trip.manifestLockedAt
                    ? `Locked ${trip.manifestLockedAt.toISOString().slice(0, 16).replace("T", " ")}`
                    : "— Open"}
                </span>
              </Row>
              <Row k="— APIS">
                <span className="font-mono text-[11px] tracking-[0.04em] text-bone-2">
                  {trip.apisFiledAt
                    ? `Filed ${trip.apisFiledAt.toISOString().slice(0, 16).replace("T", " ")}`
                    : trip.isInternational
                      ? "— Required"
                      : "—"}
                </span>
              </Row>
              <Row k="— Wheels up">
                <span className="font-mono text-[11px] tracking-[0.04em] text-bone-2">
                  {trip.wheelsUpAt
                    ? trip.wheelsUpAt.toISOString().slice(0, 16).replace("T", " ")
                    : "—"}
                </span>
              </Row>
              <Row k="— Wheels down">
                <span className="font-mono text-[11px] tracking-[0.04em] text-bone-2">
                  {trip.wheelsDownAt
                    ? trip.wheelsDownAt.toISOString().slice(0, 16).replace("T", " ")
                    : "—"}
                </span>
              </Row>
            </dl>
          </section>

          {/* Legs */}
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <h2 className="mb-5 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
              — Legs ({legs.length} · {totalDistance.toLocaleString()} NM total)
            </h2>
            <ul className="flex flex-col gap-3">
              {legs.map((l) => (
                <li key={l.id} className="rounded-[3px] border border-ink-3 bg-ink p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-clearance">
                      — Leg {String(l.legNumber).padStart(2, "0")}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-bone-2">
                      {l.departDate} · {l.departTime}
                    </span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                    <div>
                      <div className="font-serif text-[24px] font-light leading-none text-bone">
                        {l.fromIata ?? "—"}
                      </div>
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-bone-2">
                        {l.fromCity ?? "—"}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-clearance">
                        — ✈ —
                      </div>
                      <div className="mt-1 font-mono text-[10px] tracking-[0.04em] text-bone-2">
                        {l.distanceNm ? `${l.distanceNm.toLocaleString()} NM` : "—"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-serif text-[24px] font-light leading-none text-bone">
                        {l.toIata ?? "—"}
                      </div>
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-bone-2">
                        {l.toCity ?? "—"}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
              — Sub-tables (manifest · crew · catering · ground) ship in C.3.
            </p>
          </section>

          {/* Member */}
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <h2 className="mb-5 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
              — Member
            </h2>
            <div className="flex items-baseline justify-between">
              <span className="font-serif text-[20px] font-normal text-bone">{memberName}</span>
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-clearance">
                {memberRow?.memberCode ?? "—"} · {memberRow?.tier?.replace(/_/g, " ") ?? "—"}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-[120px_1fr] gap-x-4 gap-y-2 text-[12px]">
              <Row k="— Email">
                <a
                  href={`mailto:${memberRow?.email}`}
                  className="font-mono text-[12px] text-clearance hover:underline"
                >
                  {memberRow?.email ?? "—"}
                </a>
              </Row>
              <Row k="— Phone">
                <span className="font-mono text-[12px] text-bone-2">
                  {memberRow?.phoneE164 ?? "—"}
                </span>
              </Row>
            </dl>
          </section>

          {/* Originating quote */}
          {originatingQuote ? (
            <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
              <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
                — Originating quote
              </h2>
              <Link
                href={`/admin/quote/${originatingQuote.id}`}
                className="flex items-baseline gap-4 font-mono text-[12px] uppercase tracking-[0.08em] text-clearance transition-colors hover:opacity-80"
              >
                {originatingQuote.quoteCode}
                <span className="text-bone-2">→ workbench</span>
              </Link>
            </section>
          ) : null}
        </div>

        {/* Right column: aircraft + financials + invoice */}
        <div className="flex flex-col gap-6">
          {/* Aircraft + operator */}
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <h2 className="mb-5 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
              — Aircraft &amp; operator
            </h2>
            {acRow ? (
              <>
                <div className="font-mono text-[14px] tracking-[0.04em] text-clearance">
                  {acRow.tailNumber}
                </div>
                <div className="mt-1 font-serif text-[18px] leading-tight text-bone">
                  {acRow.makeModel}
                  {acRow.yearManufactured ? (
                    <span className="ml-2 font-mono text-[10px] text-bone-2">
                      · {acRow.yearManufactured}
                    </span>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="text-[12px] text-steel">— Aircraft not assigned yet.</p>
            )}
            <div className="mt-4 border-t border-ink-3 pt-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                — Operator
              </div>
              {opRow ? (
                <Link
                  href={`/admin/operators/${opRow.id}`}
                  className="mt-2 inline-block font-serif text-[16px] text-bone transition-colors hover:text-clearance"
                >
                  {opRow.name}{" "}
                  <span className="font-mono text-[10px] text-bone-2">
                    {opRow.certNumber ? `· ${opRow.certNumber}` : ""}
                  </span>
                </Link>
              ) : (
                <p className="mt-2 text-[12px] text-steel">— Pending sourcing.</p>
              )}
            </div>
          </section>

          {/* Financials */}
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <h2 className="mb-4 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
              — Financials
            </h2>
            <dl className="flex flex-col gap-3 text-[12px]">
              <Row k="— Revenue">
                <span className="font-mono tracking-[0.04em] text-bone">
                  {trip.revenueUsd ? formatUSD(trip.revenueUsd) : "—"}
                </span>
              </Row>
              <Row k="— Operator cost">
                <span className="font-mono tracking-[0.04em] text-bone-2">
                  {trip.operatorCostUsd ? formatUSD(trip.operatorCostUsd) : "—"}
                </span>
              </Row>
              <Row k="— Margin">
                <span className="font-mono tracking-[0.04em] text-clearance">
                  {trip.marginPct ? `${trip.marginPct}%` : "—"}
                </span>
              </Row>
              <Row k="— Processor fee">
                <span className="font-mono tracking-[0.04em] text-bone-2">
                  {trip.processorFeeUsd ? formatUSD(trip.processorFeeUsd) : "—"}
                </span>
              </Row>
            </dl>
          </section>

          {/* Thread */}
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
                — Thread
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-clearance">
                {thread.length} message{thread.length === 1 ? "" : "s"}
              </span>
            </div>
            <MessageThread
              initial={thread}
              defaultEmail={memberRow?.email ?? null}
              defaultPhone={memberRow?.phoneE164 ?? null}
              postAction={postTripMessage.bind(null, trip.id)}
              composerHint="Crew briefed, wheels-up still on schedule. Catering loaded at 0930."
            />
          </section>

          {/* Invoice */}
          {tripInvoice ? (
            <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
              <h2 className="mb-4 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
                — Invoice
              </h2>
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[14px] tracking-[0.04em] text-clearance">
                  {tripInvoice.invoiceCode}
                </span>
                <span
                  className={[
                    "rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]",
                    INVOICE_STATUS_CLASS[tripInvoice.status] ?? "border-ink-3 text-bone-2",
                  ].join(" ")}
                >
                  {tripInvoice.status}
                </span>
              </div>
              <dl className="mt-4 flex flex-col gap-2 text-[12px]">
                <Row k="— Subtotal">
                  <span className="font-mono tracking-[0.04em] text-bone">
                    {tripInvoice.subtotalUsd ? formatUSD(tripInvoice.subtotalUsd) : "—"}
                  </span>
                </Row>
                <Row k="— FET (7.5%)">
                  <span className="font-mono tracking-[0.04em] text-bone-2">
                    {tripInvoice.fetUsd ? formatUSD(tripInvoice.fetUsd) : "—"}
                  </span>
                </Row>
                <Row k="— Segment fee">
                  <span className="font-mono tracking-[0.04em] text-bone-2">
                    {tripInvoice.segmentFeeUsd ? formatUSD(tripInvoice.segmentFeeUsd) : "—"}
                  </span>
                </Row>
                <Row k="— Total">
                  <span className="font-serif text-[20px] font-light text-clearance">
                    {tripInvoice.totalUsd ? formatUSD(tripInvoice.totalUsd) : "—"}
                  </span>
                </Row>
              </dl>
              <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
                — Line-item editor + payment processing ship in C.3.
              </p>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">{k}</dt>
      <dd>{children}</dd>
    </>
  );
}
