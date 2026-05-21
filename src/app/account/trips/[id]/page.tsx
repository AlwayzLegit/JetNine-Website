import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { trips, tripLegs } from "@/db/schema/trips";
import { invoices } from "@/db/schema/invoices";
import { aircraft } from "@/db/schema/aircraft";
import { operators } from "@/db/schema/operators";
import { messages } from "@/db/schema/audit";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { getMemberByUserId } from "@/lib/member";
import { formatUSD } from "@/lib/quote-pricing";

const CHANNEL_LABEL: Record<string, string> = {
  inapp: "Portal",
  email: "Email",
  sms: "SMS",
  call: "Call",
  voicemail: "Voicemail",
  system: "System",
};

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

export default async function AccountTripDetailPage({ params }: Props) {
  const { id } = await params;
  await requireUser(`/account/trips/${id}`);
  const user = await getCurrentUser();
  if (!user) return null;

  const member = await getMemberByUserId(user.id);
  if (!member) notFound();

  // Owner-only: explicit eq on member_id so members can't peek at other
  // trips even by guessing UUIDs.
  const [trip] = await db
    .select()
    .from(trips)
    .where(and(eq(trips.id, id), eq(trips.memberId, member.id)));
  if (!trip) notFound();

  const legs = await db
    .select()
    .from(tripLegs)
    .where(eq(tripLegs.tripId, id))
    .orderBy(asc(tripLegs.legNumber));

  const [tripInvoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.tripId, id));

  const [acRow] = trip.aircraftId
    ? await db
        .select({
          tailNumber: aircraft.tailNumber,
          makeModel: aircraft.makeModel,
          yearManufactured: aircraft.yearManufactured,
        })
        .from(aircraft)
        .where(eq(aircraft.id, trip.aircraftId))
    : [];

  const [opRow] = trip.operatorId
    ? await db
        .select({ name: operators.name })
        .from(operators)
        .where(eq(operators.id, trip.operatorId))
    : [];

  // Dispatcher-authored thread, visible to the member as a read-only timeline.
  // We only surface outbound messages (direction='out' = dispatch → member);
  // any internal notes stay invisible from this surface.
  const memberThread = await db
    .select({
      id: messages.id,
      channel: messages.channel,
      body: messages.body,
      preview: messages.preview,
      occurredAt: messages.occurredAt,
    })
    .from(messages)
    .where(
      and(
        eq(messages.subjectType, "trip"),
        eq(messages.subjectId, id),
        eq(messages.direction, "out"),
      ),
    )
    .orderBy(asc(messages.occurredAt));

  const totalDistance = legs.reduce((sum, l) => sum + (l.distanceNm ?? 0), 0);

  return (
    <section className="container-jn py-12">
      <header className="mb-10 border-b border-ink-3 pb-6">
        <Link
          href="/account/trips"
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-clearance"
        >
          ← All trips
        </Link>
        <div className="mt-4 flex flex-wrap items-baseline gap-4">
          <span
            className="font-serif text-[44px] font-light leading-none tracking-tight text-bone"
            style={{ letterSpacing: "-0.02em" }}
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
        </div>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-bone-2">
          {trip.missionType.replace(/_/g, " ")} · {trip.paxCount} pax · {legs.length} leg
          {legs.length === 1 ? "" : "s"} · {totalDistance.toLocaleString()} NM
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="caption mb-4">— Itinerary</h2>
            <ul className="flex flex-col gap-3">
              {legs.map((l) => (
                <li key={l.id} className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
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
                      <div className="font-serif text-[28px] font-light leading-none text-bone">
                        {l.fromIata ?? "—"}
                      </div>
                      <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-bone-2">
                        {l.fromCity ?? "—"}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-clearance">
                        — ✈ —
                      </div>
                      <div className="mt-1 font-mono text-[10px] tracking-[0.04em] text-bone-2">
                        {l.distanceNm ? `${l.distanceNm.toLocaleString()} NM` : "—"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-serif text-[28px] font-light leading-none text-bone">
                        {l.toIata ?? "—"}
                      </div>
                      <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-bone-2">
                        {l.toCity ?? "—"}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {trip.notesMember ? (
            <section className="rounded-[4px] border-l-2 border-clearance bg-ink-2 p-6">
              <h2 className="caption mb-3">— Notes from dispatch</h2>
              <p className="whitespace-pre-line italic text-[14px] leading-[1.65] text-bone">
                {trip.notesMember}
              </p>
            </section>
          ) : null}

          {memberThread.length > 0 ? (
            <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
              <h2 className="caption mb-4">— Updates from dispatch</h2>
              <ul className="flex flex-col gap-4">
                {memberThread.map((m) => (
                  <li
                    key={m.id}
                    className="border-l-2 border-clearance pl-4"
                  >
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-clearance">
                        {CHANNEL_LABEL[m.channel] ?? m.channel}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
                        {m.occurredAt
                          ? m.occurredAt
                              .toISOString()
                              .slice(0, 16)
                              .replace("T", " ") + " UTC"
                          : "—"}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[14px] leading-[1.6] text-bone">
                      {m.body ?? m.preview ?? ""}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
                — Read-only · reply by hitting the dispatcher on the phone, email, or SMS thread you
                were originally contacted on.
              </p>
            </section>
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <h2 className="caption mb-4">— Aircraft</h2>
            {acRow ? (
              <>
                <div className="font-serif text-[22px] font-normal leading-tight text-bone">
                  {acRow.makeModel}
                </div>
                <div className="mt-1 font-mono text-[12px] tracking-[0.04em] text-clearance">
                  {acRow.tailNumber}
                  {acRow.yearManufactured ? ` · ${acRow.yearManufactured}` : ""}
                </div>
              </>
            ) : (
              <p className="text-[13px] leading-[1.55] text-bone-2">
                Specific aircraft being finalized. Trip sheet emails the moment it&rsquo;s locked.
              </p>
            )}
            {opRow ? (
              <p className="mt-4 border-t border-ink-3 pt-4 font-mono text-[10px] uppercase tracking-[0.08em] text-bone-2">
                Operated by <span className="text-bone">{opRow.name}</span> · FAA Part 135
              </p>
            ) : null}
          </section>

          {tripInvoice ? (
            <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
              <h2 className="caption mb-4">— Invoice</h2>
              <div className="flex items-baseline justify-between">
                <Link
                  href={`/account/invoices`}
                  className="font-mono text-[12px] tracking-[0.04em] text-clearance transition-colors hover:underline"
                >
                  {tripInvoice.invoiceCode}
                </Link>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-bone-2">
                  {tripInvoice.status}
                </span>
              </div>
              <div
                className="mt-4 font-serif text-[36px] font-light leading-none tracking-tight text-bone"
                style={{ letterSpacing: "-0.02em" }}
              >
                {tripInvoice.totalUsd ? formatUSD(tripInvoice.totalUsd) : "Pending"}
              </div>
              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.08em] text-bone-2">
                All-in · FET (7.5%) + segment fee included
              </p>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}
