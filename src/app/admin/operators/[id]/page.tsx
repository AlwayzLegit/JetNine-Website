import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { operators, operatorContacts } from "@/db/schema/operators";
import { aircraft } from "@/db/schema/aircraft";
import { trips } from "@/db/schema/trips";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const STATUS_CLASS: Record<string, string> = {
  active: "border-[var(--success)] text-[var(--success)]",
  audit_due: "border-[var(--warn)] text-[var(--warn)]",
  hold: "border-bone-2 text-bone-2",
  suspended: "border-[var(--error)] text-[var(--error)]",
  banned: "border-[var(--error)] text-[var(--error)]",
};

const ARGUS_CLASS: Record<string, string> = {
  platinum: "border-clearance text-clearance",
  gold: "border-[#C9A961] text-[#C9A961]",
  silver: "border-bone-2 text-bone-2",
  none: "border-steel text-steel",
};

const AIRCRAFT_STATUS_CLASS: Record<string, string> = {
  available: "border-[var(--success)] text-[var(--success)]",
  aog: "border-[var(--error)] text-[var(--error)]",
  maint: "border-[var(--warn)] text-[var(--warn)]",
  sold: "border-steel text-steel",
};

const TRIP_STATUS_CLASS: Record<string, string> = {
  confirmed: "border-clearance text-clearance",
  airborne: "border-[var(--warn)] text-[var(--warn)]",
  completed: "border-[var(--success)] text-[var(--success)]",
  cancelled_wx: "border-[var(--error)] text-[var(--error)]",
  cancelled_other: "border-[var(--error)] text-[var(--error)]",
};

function daysUntil(date: Date | string | null): number | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  return Math.round((d.getTime() - Date.now()) / 86_400_000);
}

function renewalTone(days: number | null): "ok" | "warn" | "crit" | "lock" {
  if (days === null) return "lock";
  if (days < 0) return "crit";
  if (days < 60) return "warn";
  return "ok";
}

const TONE: Record<string, string> = {
  ok: "text-bone",
  warn: "text-[var(--warn)]",
  crit: "text-[var(--error)]",
  lock: "text-steel",
};

export default async function AdminOperatorDetailPage({ params }: Props) {
  const { id } = await params;

  const [op] = await db.select().from(operators).where(eq(operators.id, id));
  if (!op) notFound();

  const contacts = await db
    .select()
    .from(operatorContacts)
    .where(eq(operatorContacts.operatorId, id))
    .orderBy(desc(operatorContacts.isEscalation), asc(operatorContacts.name));

  const fleet = await db
    .select()
    .from(aircraft)
    .where(eq(aircraft.operatorId, id))
    .orderBy(asc(aircraft.category), asc(aircraft.tailNumber));

  const recentTrips = await db
    .select({
      id: trips.id,
      tripCode: trips.tripCode,
      status: trips.status,
      paxCount: trips.paxCount,
      revenueUsd: trips.revenueUsd,
      createdAt: trips.createdAt,
    })
    .from(trips)
    .where(eq(trips.operatorId, id))
    .orderBy(desc(trips.createdAt))
    .limit(10);

  const [aggregates] = await db
    .select({
      lifetimeTrips: sql<number>`coalesce(count(*)::int, 0)`,
      lifetimeRevenue: sql<number>`coalesce(sum(${trips.revenueUsd}), 0)::int`,
    })
    .from(trips)
    .where(eq(trips.operatorId, id));

  const renewals = [
    { label: "ARG/US", date: op.argusRenewsOn },
    { label: "Wyvern", date: op.wyvernRenewsOn },
    { label: "IS-BAO", date: op.isbaoRenewsOn },
    { label: "Insurance", date: op.insuranceRenewsOn },
    { label: "Next audit", date: op.nextAuditOn },
  ];

  return (
    <div className="container-jn py-8">
      {/* Top bar */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6 border-b border-ink-3 pb-6">
        <div>
          <nav className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
            <Link href="/admin/operators" className="transition-colors hover:text-clearance">
              Operators
            </Link>{" "}
            <span className="text-steel">/</span>{" "}
            <span className="text-bone">{op.certNumber ?? "—"}</span>
          </nav>
          <div className="mt-3 flex flex-wrap items-baseline gap-4">
            <span
              className="font-serif text-[36px] font-light leading-none tracking-tight text-bone"
              style={{ letterSpacing: "-0.02em" }}
            >
              {op.name}
            </span>
            <span
              className={[
                "rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]",
                STATUS_CLASS[op.status] ?? "border-ink-3 text-bone-2",
              ].join(" ")}
            >
              {op.status.replace(/_/g, " ")}
            </span>
            {op.isPreferred ? (
              <span className="rounded-[2px] bg-clearance px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink">
                Preferred
              </span>
            ) : null}
            <span
              className={[
                "rounded-[2px] border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]",
                ARGUS_CLASS[op.argusRating] ?? "border-steel text-steel",
              ].join(" ")}
            >
              ARG/US {op.argusRating}
            </span>
            {op.wyvernWingman ? (
              <span className="rounded-[2px] border border-clearance px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-clearance">
                Wyvern Wingman
              </span>
            ) : null}
          </div>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.08em] text-bone-2">
            {op.certNumber ?? "—"} · FAA Part {op.faaPart}
            {op.homeAirportIcao ? ` · Home ${op.homeAirportIcao}` : ""}
            {op.yearsPartner ? ` · ${op.yearsPartner}y partner` : ""}
          </p>
          {op.suspendedReason ? (
            <p className="mt-3 max-w-[64ch] rounded-[2px] border-l-2 border-[var(--error)] bg-[rgba(164,69,58,0.06)] px-4 py-2 font-mono text-[11px] tracking-[0.04em] text-[var(--error)]">
              — {op.suspendedReason}
            </p>
          ) : null}
        </div>
        <dl className="flex flex-wrap gap-x-10 gap-y-3 text-right">
          {[
            ["FLEET", String(fleet.length)],
            ["LIFETIME TRIPS", String(aggregates?.lifetimeTrips ?? 0)],
            [
              "LIFETIME REVENUE",
              aggregates?.lifetimeRevenue
                ? `$${(aggregates.lifetimeRevenue / 1000).toFixed(1)}k`
                : "$0",
            ],
            [
              "LIABILITY",
              op.liabilityLimitUsd
                ? `$${(Number(op.liabilityLimitUsd) / 1_000_000).toFixed(0)}M`
                : "—",
            ],
          ].map(([lbl, val]) => (
            <div key={lbl} className="flex flex-col items-end">
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">{lbl}</dt>
              <dd className="mt-1 font-serif text-[22px] font-light leading-none text-bone">{val}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_1fr]">
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-6">
          {/* Fleet */}
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <h2 className="caption mb-5">— Fleet · {fleet.length}</h2>
            {fleet.length === 0 ? (
              <p className="text-[13px] text-steel">— No aircraft on file.</p>
            ) : (
              <ul className="divide-y divide-ink-3">
                {fleet.map((ac) => (
                  <li
                    key={ac.id}
                    className="grid grid-cols-[110px_1fr_auto_auto_auto] items-baseline gap-3 py-3"
                  >
                    <span className="font-mono text-[11px] tracking-[0.04em] text-clearance">
                      {ac.tailNumber}
                    </span>
                    <div>
                      <div className="font-serif text-[15px] leading-tight text-bone">
                        {ac.makeModel}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-bone-2">
                        {ac.category} · {ac.yearManufactured ?? "—"}
                      </div>
                    </div>
                    <span className="font-mono text-[11px] tracking-[0.04em] text-bone-2">
                      {ac.seats} pax
                    </span>
                    <span className="font-mono text-[11px] tracking-[0.04em] text-bone-2">
                      {ac.rangeNm.toLocaleString()} NM
                    </span>
                    <span
                      className={[
                        "inline-block rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]",
                        AIRCRAFT_STATUS_CLASS[ac.status] ?? "border-ink-3 text-bone-2",
                      ].join(" ")}
                    >
                      {ac.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Recent trips */}
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <div className="mb-5 flex items-baseline justify-between">
              <h2 className="caption">— Recent trips · {recentTrips.length}</h2>
              <Link
                href="/admin/trip"
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-clearance"
              >
                All trips →
              </Link>
            </div>
            {recentTrips.length === 0 ? (
              <p className="text-[13px] text-steel">— No trips flown with this operator yet.</p>
            ) : (
              <ul className="divide-y divide-ink-3">
                {recentTrips.map((t) => (
                  <li
                    key={t.id}
                    className="grid grid-cols-[auto_1fr_auto_auto_auto] items-baseline gap-4 py-3"
                  >
                    <Link
                      href={`/admin/trip/${t.id}`}
                      className="font-mono text-[11px] tracking-[0.04em] text-clearance hover:underline"
                    >
                      {t.tripCode}
                    </Link>
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-bone-2">
                      {t.paxCount} pax · {t.createdAt.toISOString().slice(0, 10)}
                    </span>
                    <span
                      className={[
                        "inline-block rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]",
                        TRIP_STATUS_CLASS[t.status] ?? "border-ink-3 text-bone-2",
                      ].join(" ")}
                    >
                      {t.status.replace(/_/g, " ")}
                    </span>
                    <span className="font-mono text-[11px] tracking-[0.04em] text-bone">
                      {t.revenueUsd ? `$${(t.revenueUsd / 1000).toFixed(1)}k` : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Commercial terms */}
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <h2 className="caption mb-5">— Commercial terms</h2>
            <dl className="grid grid-cols-[160px_1fr] gap-x-4 gap-y-3 text-[12px]">
              <Row k="— Payment terms">
                <span className="font-mono tracking-[0.04em] text-bone">
                  {op.paymentTerms ?? "—"}
                </span>
              </Row>
              <Row k="— Volume discount">
                <span className="font-mono tracking-[0.04em] text-bone">
                  {op.volumeDiscountPct ? `${op.volumeDiscountPct}%` : "—"}
                </span>
              </Row>
              <Row k="— Rate lock">
                <span className="font-mono uppercase tracking-[0.12em] text-bone">
                  {op.rateLock ? (
                    <span className="text-[var(--success)]">✓ Locked</span>
                  ) : (
                    <span className="text-steel">— None</span>
                  )}
                </span>
              </Row>
              <Row k="— Liability limit">
                <span className="font-mono tracking-[0.04em] text-bone">
                  {op.liabilityLimitUsd
                    ? `$${Number(op.liabilityLimitUsd).toLocaleString()}`
                    : "—"}
                </span>
              </Row>
            </dl>
          </section>

          {/* Notes */}
          {op.notes ? (
            <section className="rounded-[4px] border-l-2 border-clearance bg-ink-2 p-6">
              <h2 className="caption mb-3">— Operator notes</h2>
              <p className="whitespace-pre-line italic text-[14px] leading-[1.65] text-bone">
                {op.notes}
              </p>
            </section>
          ) : null}
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-6">
          {/* Vetting + renewal calendar */}
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <h2 className="caption mb-5">— Vetting renewals</h2>
            <ul className="divide-y divide-ink-3">
              {renewals.map((r) => {
                const days = daysUntil(r.date);
                const tone = renewalTone(days);
                return (
                  <li
                    key={r.label}
                    className="grid grid-cols-[1fr_auto] items-baseline gap-3 py-3"
                  >
                    <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-bone-2">
                      — {r.label}
                    </span>
                    <span
                      className={[
                        "font-mono text-[11px] tracking-[0.04em]",
                        TONE[tone],
                      ].join(" ")}
                    >
                      {r.date ? (
                        <>
                          {String(r.date)}
                          {days !== null
                            ? days < 0
                              ? ` · ${Math.abs(days)}d past`
                              : ` · ${days}d`
                            : ""}
                        </>
                      ) : (
                        "—"
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            {op.isbaoStage ? (
              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-steel">
                — IS-BAO Stage {op.isbaoStage}
              </p>
            ) : null}
          </section>

          {/* Contacts */}
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <h2 className="caption mb-4">— Contacts · {contacts.length}</h2>
            {contacts.length === 0 ? (
              <p className="text-[13px] leading-[1.55] text-steel">
                — No contacts on file. Add via ops admin once contact-edit UI ships.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {contacts.map((c) => (
                  <li
                    key={c.id}
                    className={[
                      "rounded-[3px] border bg-ink p-3",
                      c.isEscalation
                        ? "border-clearance"
                        : "border-ink-3",
                    ].join(" ")}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-serif text-[15px] text-bone">{c.name}</span>
                      {c.isEscalation ? (
                        <span className="rounded-[2px] bg-clearance px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-ink">
                          Escalation
                        </span>
                      ) : null}
                    </div>
                    {c.role ? (
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-bone-2">
                        {c.role}
                      </div>
                    ) : null}
                    <dl className="mt-2 flex flex-col gap-1 text-[11px]">
                      {c.email ? (
                        <a
                          href={`mailto:${c.email}`}
                          className="font-mono tracking-[0.04em] text-clearance hover:underline"
                        >
                          {c.email}
                        </a>
                      ) : null}
                      {c.phoneE164 ? (
                        <a
                          href={`tel:${c.phoneE164}`}
                          className="font-mono tracking-[0.04em] text-clearance hover:underline"
                        >
                          {c.phoneE164}
                        </a>
                      ) : null}
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* History */}
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <h2 className="caption mb-4">— History</h2>
            <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-3 text-[12px]">
              <Row k="— Onboarded">
                <span className="font-mono tracking-[0.04em] text-bone-2">
                  {op.createdAt.toISOString().slice(0, 10)}
                </span>
              </Row>
              <Row k="— Updated">
                <span className="font-mono tracking-[0.04em] text-bone-2">
                  {op.updatedAt.toISOString().slice(0, 10)}
                </span>
              </Row>
              <Row k="— Years partner">
                <span className="font-mono tracking-[0.04em] text-bone">
                  {op.yearsPartner ?? "—"}
                </span>
              </Row>
              <Row k="— FAA Part">
                <span className="font-mono tracking-[0.04em] text-bone">{op.faaPart}</span>
              </Row>
            </dl>
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
