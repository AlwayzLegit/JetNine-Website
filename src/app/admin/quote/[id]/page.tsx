import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, gte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { quotes, quoteLegs } from "@/db/schema/quotes";
import { staff } from "@/db/schema/staff";
import { users } from "@/db/schema/users";
import { aircraft } from "@/db/schema/aircraft";
import { operators } from "@/db/schema/operators";
import { StatusSelect } from "@/components/admin/status-select";
import { DispatcherAssign } from "@/components/admin/dispatcher-assign";
import { ConvertQuoteButton } from "@/components/admin/convert-quote-button";
import { formatUSD } from "@/lib/quote-pricing";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const CABIN_LABELS: Record<string, string> = {
  wifi: "Wi-Fi",
  attendant: "Flight attendant",
  lavatory: "Enclosed lavatory",
  standup: "Stand-up cabin",
  lieflat: "Lie-flat seating",
  pet: "Pet-friendly",
};

const GROUND_LABEL: Record<string, string> = {
  none: "None — self-arrange",
  sedan: "Black sedan",
  suv_sprinter: "SUV / Sprinter",
  custom: "Custom",
};

const CATERING_LABEL: Record<string, string> = {
  standard: "Standard",
  plus: "Plus",
  premium: "Premium",
  custom: "Custom",
};

export default async function QuoteWorkbenchPage({ params }: Props) {
  const { id } = await params;

  const [quote] = await db.select().from(quotes).where(eq(quotes.id, id));
  if (!quote) notFound();

  const legs = await db
    .select()
    .from(quoteLegs)
    .where(eq(quoteLegs.quoteId, id))
    .orderBy(asc(quoteLegs.legNumber));

  // Dispatcher dropdown options + current assignment.
  const dispatchers = await db
    .select({
      id: staff.id,
      displayName: staff.displayName,
    })
    .from(staff)
    .innerJoin(users, eq(users.id, staff.userId))
    .where(eq(users.role, "dispatcher"));

  let assigned: { id: string; displayName: string } | null = null;
  if (quote.assignedDispatcherId) {
    const [row] = await db
      .select({ id: staff.id, displayName: staff.displayName })
      .from(staff)
      .where(eq(staff.id, quote.assignedDispatcherId));
    assigned = row ?? null;
  }

  const cabinFlags = (quote.cabinPrefs ?? {}) as Record<string, boolean>;
  const activeCabin = Object.entries(cabinFlags)
    .filter(([, v]) => v)
    .map(([k]) => CABIN_LABELS[k] ?? k);

  const contact = quote.contactSnapshot ?? null;
  const contactName = contact
    ? `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() || "Anonymous"
    : "Anonymous";

  const totalDistance = legs.reduce((sum, l) => sum + (l.distanceNm ?? 0), 0);
  const longestLeg = legs.reduce((max, l) => Math.max(max, l.distanceNm ?? 0), 0);
  const sla = computeSLA(quote.slaDeadlineAt, quote.status);

  // ── Candidate aircraft for the sourcing column ──
  // Match by requested_category + enough seats + enough range. Operator must
  // not be suspended/banned/hold. Order by ARG/US tier preference, then
  // Wyvern flag, then preferred-partner flag. Cap at 8.
  const candidates = quote.requestedCategory
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
            gte(aircraft.rangeNm, longestLeg),
            ne(operators.status, "suspended"),
            ne(operators.status, "banned"),
            ne(operators.status, "hold"),
          ),
        )
        .orderBy(
          desc(operators.isPreferred),
          // ARG/US: platinum > gold > silver > none
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

  return (
    <div className="container-jn py-8">
      {/* Top bar with crumbs + controls */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-6 border-b border-ink-3 pb-6">
        <div>
          <nav className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
            <Link href="/admin/dispatch" className="transition-colors hover:text-clearance">
              Inbox
            </Link>{" "}
            <span className="text-steel">/</span>{" "}
            <Link href="/admin/dispatch" className="transition-colors hover:text-clearance">
              Quotes
            </Link>{" "}
            <span className="text-steel">/</span>{" "}
            <span className="text-bone">Workbench</span>
          </nav>
          <div className="mt-3 flex items-baseline gap-4">
            <span
              className="font-serif text-[36px] font-light leading-none tracking-tight text-bone"
              style={{ letterSpacing: "-0.01em" }}
            >
              {quote.quoteCode}
            </span>
            <span
              className={[
                "rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]",
                sla.tone === "ok"
                  ? "border-clearance text-clearance"
                  : sla.tone === "warn"
                    ? "border-[var(--warn)] text-[var(--warn)]"
                    : sla.tone === "crit"
                      ? "border-[var(--error)] text-[var(--error)]"
                      : "border-steel text-steel",
              ].join(" ")}
            >
              {sla.label}
            </span>
          </div>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-steel">
            — Source: {quote.source.replace(/_/g, " ")} · received{" "}
            {quote.receivedAt ? quote.receivedAt.toISOString().slice(0, 16).replace("T", " ") : "—"}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <StatusSelect quoteId={quote.id} current={quote.status} />
          <DispatcherAssign
            quoteId={quote.id}
            current={assigned}
            dispatchers={dispatchers}
          />
          <ConvertQuoteButton
            quoteId={quote.id}
            alreadyConvertedTripId={quote.convertedTripId}
            status={quote.status}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_0.8fr_1fr]">
        {/* ─── Mission column ─── */}
        <div className="flex flex-col gap-6">
          {/* Contact */}
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
                — Contact
              </h2>
              <span className="rounded-[2px] border border-ink-3 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-steel">
                {contact?.account === "returning" ? "RETURNING" : "GUEST"}
              </span>
            </div>
            <div className="font-serif text-[24px] font-normal leading-tight text-bone">
              {contactName}
            </div>
            {contact?.company ? (
              <div className="mt-1 text-[13px] text-bone-2">{contact.company}</div>
            ) : null}
            <dl className="mt-5 grid grid-cols-1 gap-3 text-[12px]">
              {contact?.email ? (
                <>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                    — Email
                  </dt>
                  <dd>
                    <a
                      href={`mailto:${contact.email}`}
                      className="font-mono tracking-[0.04em] text-clearance hover:underline"
                    >
                      {contact.email}
                    </a>
                  </dd>
                </>
              ) : null}
              {contact?.phoneE164 ? (
                <>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                    — Phone
                  </dt>
                  <dd>
                    <a
                      href={`tel:${contact.phoneCountry ?? ""}${contact.phoneE164}`}
                      className="font-mono tracking-[0.04em] text-clearance hover:underline"
                    >
                      {contact.phoneCountry} {contact.phoneE164}
                    </a>
                  </dd>
                </>
              ) : null}
              {quote.contactMethods ? (
                <>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                    — Reach by
                  </dt>
                  <dd className="font-mono tracking-[0.04em] text-bone">
                    {(["email", "phone", "sms"] as const)
                      .filter((k) => (quote.contactMethods as Record<string, boolean>)?.[k])
                      .map((k) => (k === "sms" ? "SMS" : k))
                      .join(" + ")}
                  </dd>
                </>
              ) : null}
              {quote.bestTime ? (
                <>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
                    — Best time
                  </dt>
                  <dd className="font-mono tracking-[0.04em] text-bone">
                    {quote.bestTime.replace(/^./, (c) => c.toUpperCase())}
                  </dd>
                </>
              ) : null}
            </dl>
          </section>

          {/* Legs */}
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <h2 className="mb-5 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
              — Legs ({legs.length} · {totalDistance.toLocaleString()} NM total)
            </h2>
            <ul className="flex flex-col gap-3">
              {legs.map((l) => (
                <li
                  key={l.id}
                  className="rounded-[3px] border border-ink-3 bg-ink p-5"
                >
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
          </section>

          {/* Requested profile */}
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <h2 className="mb-5 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
              — Requested profile
            </h2>
            <dl className="grid grid-cols-[120px_1fr] gap-x-6 gap-y-3 text-[12px]">
              <Row k="— Pax">
                <span className="font-mono tracking-[0.04em] text-bone">
                  {quote.paxCount} adults
                  {quote.childrenCount ? ` + ${quote.childrenCount} kids` : ""}
                  {quote.petsCount ? ` + ${quote.petsCount} pets` : ""}
                  {quote.extraBagsCount ? ` · +${quote.extraBagsCount} extra bags` : ""}
                </span>
              </Row>
              <Row k="— Category">
                <span className="font-mono uppercase tracking-[0.08em] text-bone">
                  {quote.requestedCategory ?? "—"}
                </span>
              </Row>
              <Row k="— Cabin">
                {activeCabin.length ? (
                  <span className="text-bone">{activeCabin.join(" · ")}</span>
                ) : (
                  <span className="text-steel">— None requested</span>
                )}
              </Row>
              <Row k="— Catering">
                <span className="text-bone">
                  {CATERING_LABEL[quote.cateringTier ?? "standard"]}
                </span>
              </Row>
              <Row k="— Ground">
                <span className="text-bone">
                  {GROUND_LABEL[quote.groundOption ?? "sedan"]}
                </span>
              </Row>
            </dl>
          </section>

          {/* Member notes */}
          {quote.notes ? (
            <section className="rounded-[4px] border-l-2 border-clearance bg-ink-2 p-6">
              <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-clearance">
                — Member notes
              </h2>
              <p className="whitespace-pre-line italic text-[14px] leading-[1.65] text-bone">
                {quote.notes}
              </p>
            </section>
          ) : null}

          {/* Consent */}
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <h2 className="mb-4 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
              — Consent
            </h2>
            <ul className="flex flex-col gap-2 text-[12px]">
              {[
                ["Part 295 broker disclosure & ToS", quote.consentBroker],
                ["Contact via selected channels", quote.consentContact],
                ["Empty-leg + seasonal promo", quote.consentMarketing],
              ].map(([label, ok]) => (
                <li key={String(label)} className="grid grid-cols-[auto_1fr] items-baseline gap-3">
                  <span
                    className={ok ? "text-[var(--success)]" : "text-steel"}
                    aria-hidden
                  >
                    {ok ? "✓" : "—"}
                  </span>
                  <span className="text-bone-2">{label}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ─── Sourcing column ─── */}
        <div className="flex flex-col gap-6">
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
                — Sourcing · candidates
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-clearance">
                {candidates.length} match{candidates.length === 1 ? "" : "es"}
              </span>
            </div>

            {!quote.requestedCategory ? (
              <p className="text-[13px] leading-[1.6] text-steel">
                — No category requested; dispatcher to confirm.
              </p>
            ) : candidates.length === 0 ? (
              <p className="text-[13px] leading-[1.6] text-bone-2">
                No aircraft in network match this brief. Widen category or contact non-preferred
                operators.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {candidates.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-[3px] border border-ink-3 bg-ink p-4"
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="font-mono text-[12px] tracking-[0.04em] text-clearance">
                        {c.tailNumber}
                      </span>
                      {c.isPreferred ? (
                        <span className="rounded-[2px] bg-clearance px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-ink">
                          Preferred
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 font-serif text-[15px] leading-tight text-bone">
                      {c.makeModel}
                      {c.yearManufactured ? (
                        <span className="ml-2 font-mono text-[10px] text-bone-2">
                          · {c.yearManufactured}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-[12px] text-bone-2">{c.operatorName}</div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-[10px] uppercase tracking-[0.08em]">
                      <span
                        className={[
                          "rounded-[2px] border px-1.5 py-0.5",
                          c.argusRating === "platinum"
                            ? "border-clearance text-clearance"
                            : c.argusRating === "gold"
                              ? "border-[#C9A961] text-[#C9A961]"
                              : "border-bone-2 text-bone-2",
                        ].join(" ")}
                      >
                        ARG/US {c.argusRating}
                      </span>
                      {c.wyvernWingman ? (
                        <span className="rounded-[2px] border border-clearance px-1.5 py-0.5 text-clearance">
                          Wyvern
                        </span>
                      ) : null}
                      <span className="text-bone-2">
                        {c.seats} pax · {c.rangeNm.toLocaleString()} NM
                      </span>
                      <span className="text-steel">· {c.baseIcao ?? "—"}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
              — Sorted by preferred · ARG/US tier · Wyvern. Live availability + soft-hold workflow
              ships with aircraft_schedule_blocks.
            </p>
          </section>

          {/* SLA big card */}
          <section className="rounded-[4px] border border-[var(--warn)] bg-[rgba(184,137,60,0.06)] p-6">
            <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--warn)]">
              — Reply due
            </h2>
            <div
              className="font-serif text-[48px] font-light leading-none tracking-tight text-bone"
              style={{ letterSpacing: "-0.02em" }}
            >
              {sla.label}
            </div>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-bone-2">
              — Target {quote.slaDeadlineAt?.toISOString().slice(11, 16) ?? "—"} UTC
            </p>
          </section>
        </div>

        {/* ─── Pricing + activity ─── */}
        <div className="flex flex-col gap-6">
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <h2 className="mb-4 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
              — Pricing pad
            </h2>
            <dl className="flex flex-col gap-3 text-[12px]">
              <Row k="— Indicative">
                <span className="font-mono tracking-[0.04em] text-bone">
                  {quote.indicativeLowUsd && quote.indicativeHighUsd
                    ? `${formatUSD(quote.indicativeLowUsd)} – ${formatUSD(quote.indicativeHighUsd)}`
                    : "—"}
                </span>
              </Row>
              <Row k="— Margin">
                <span className="font-mono tracking-[0.04em] text-bone">
                  {quote.marginPct ? `${quote.marginPct}%` : "—"}
                </span>
              </Row>
              <Row k="— All-in">
                <span className="font-serif text-[20px] font-light text-clearance">
                  {quote.finalPriceUsd ? formatUSD(quote.finalPriceUsd) : "Pending"}
                </span>
              </Row>
            </dl>
            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
              — Future: line-item builder · margin slider · operator cost ↔ all-in linkage
            </p>
          </section>

          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <h2 className="mb-4 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
              — Reply
            </h2>
            <p className="text-[13px] leading-[1.6] text-bone-2">
              Messaging isn&rsquo;t wired in v1. Reply to the member directly from email; this
              thread will sync once we ship the comms inbox.
            </p>
            {contact?.email ? (
              <a
                href={`mailto:${contact.email}?subject=${encodeURIComponent(
                  `${quote.quoteCode} — your JetNine quote`,
                )}`}
                className="mt-5 inline-flex btn btn-secondary btn-sm"
              >
                Open in email →
              </a>
            ) : null}
          </section>

          {/* Timeline (synthesized) */}
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <h2 className="mb-4 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
              — Timeline
            </h2>
            <ol className="flex flex-col gap-3 text-[12px]">
              {synthTimeline(quote, assigned).map((e, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[70px_1fr] items-baseline gap-3"
                >
                  <span className="font-mono tracking-[0.04em] text-steel">
                    {e.when ? e.when.toISOString().slice(11, 16) : "—"}
                  </span>
                  <span className="text-bone-2">
                    <span className="text-clearance">— {e.actor.toUpperCase()}</span> {e.text}
                  </span>
                </li>
              ))}
            </ol>
          </section>
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

function computeSLA(
  deadline: Date | null,
  status: string,
): { label: string; tone: "ok" | "warn" | "crit" | "lock" } {
  if (!deadline) return { label: "SLA —", tone: "lock" };
  if (["accepted", "declined", "expired", "cancelled", "converted"].includes(status)) {
    return { label: "SLA CLOSED", tone: "lock" };
  }
  const min = Math.round((deadline.getTime() - Date.now()) / 60_000);
  if (min < 0) return { label: `SLA BREACHED · ${Math.abs(min)}m`, tone: "crit" };
  if (min < 5) return { label: `SLA ${min}m`, tone: "crit" };
  if (min < 20) return { label: `SLA ${min}m`, tone: "warn" };
  return { label: `SLA ${min}m`, tone: "ok" };
}

function synthTimeline(
  q: typeof quotes.$inferSelect,
  assigned: { displayName: string } | null,
): { when: Date | null; actor: string; text: React.ReactNode }[] {
  const events: { when: Date | null; actor: string; text: React.ReactNode }[] = [];
  events.push({
    when: q.receivedAt,
    actor: "system",
    text: (
      <>
        Quote submitted via <em className="not-italic text-bone">{q.source.replace(/_/g, " ")}</em>
      </>
    ),
  });
  if (assigned) {
    events.push({
      when: q.updatedAt,
      actor: "system",
      text: (
        <>
          Routed to <em className="not-italic text-bone">{assigned.displayName}</em>
        </>
      ),
    });
  }
  if (q.status !== "submitted") {
    events.push({
      when: q.updatedAt,
      actor: "system",
      text: (
        <>
          Status → <em className="not-italic text-bone">{q.status.replace(/_/g, " ")}</em>
        </>
      ),
    });
  }
  return events;
}
