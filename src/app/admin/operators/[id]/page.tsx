import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { operators, operatorContacts } from "@/db/schema/operators";
import { aircraft } from "@/db/schema/aircraft";
import { trips } from "@/db/schema/trips";
import { OperatorContactsEditor } from "@/components/admin/operator-contacts-editor";
import { OperatorEditForm } from "@/components/admin/operator-edit-form";
import { DeskCard, DeskHeader, DeskPage, DotSentence, NumberCard, StatusPill } from "@/components/admin/desk-ui";
import { passengersWords, tripState } from "@/lib/desk-status";
import { formatUSD } from "@/lib/quote-pricing";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

type Tone = "gold" | "steel" | "success" | "danger";

const STATUS_WORDS: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "success" },
  audit_due: { label: "Audit due", tone: "gold" },
  hold: { label: "On hold", tone: "steel" },
  suspended: { label: "Suspended", tone: "danger" },
  banned: { label: "Banned", tone: "danger" },
};

const ARGUS_WORDS: Record<string, string> = {
  platinum: "Platinum",
  gold: "Gold",
  silver: "Silver",
  none: "Not rated",
};

const AIRCRAFT_STATUS_WORDS: Record<string, { label: string; tone: Tone }> = {
  available: { label: "Available", tone: "success" },
  aog: { label: "Grounded (AOG)", tone: "danger" },
  maint: { label: "In maintenance", tone: "gold" },
  sold: { label: "Sold / retired", tone: "steel" },
};

const CATEGORY_WORDS: Record<string, string> = {
  turboprop: "Turboprop",
  light: "Light",
  midsize: "Midsize",
  supermid: "Super-mid",
  heavy: "Heavy",
  ulr: "Ultra long range",
};

function daysUntil(date: Date | string | null, now: Date): number | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  return Math.round((d.getTime() - now.getTime()) / 86_400_000);
}

function renewalTone(days: number | null): string {
  if (days === null) return "text-steel";
  if (days < 0) return "text-danger";
  if (days < 60) return "text-gold";
  return "text-bone";
}

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(`${date}T12:00:00Z`) : date;
  return Number.isNaN(d.getTime()) ? String(date) : DATE_FMT.format(d);
}

export default async function AdminOperatorDetailPage({ params }: Props) {
  const { id } = await params;
  const now = new Date();

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

  const status = STATUS_WORDS[op.status] ?? { label: op.status.replace(/_/g, " "), tone: "steel" as Tone };

  const leadParts = [
    op.certNumber ? `Certificate ${op.certNumber}` : null,
    `FAA Part ${op.faaPart}`,
    op.homeAirportIcao ? `Home base ${op.homeAirportIcao}` : null,
    op.yearsPartner ? `${op.yearsPartner} year${op.yearsPartner === 1 ? "" : "s"} as a partner` : null,
  ].filter(Boolean);

  return (
    <DeskPage>
      <DeskHeader
        back={{ href: "/admin/operators", label: "Operators" }}
        title={op.name}
        lead={`${leadParts.join(" · ")}.`}
        actions={
          <>
            <StatusPill tone={status.tone}>{status.label}</StatusPill>
            {op.isPreferred ? <span className="pill pill-clearance h-9 text-[14px]">Preferred</span> : null}
            <span className="pill pill-outline h-9 text-[14px]">
              ARG/US {ARGUS_WORDS[op.argusRating] ?? op.argusRating}
            </span>
            {op.wyvernWingman ? <span className="pill pill-outline h-9 text-[14px]">Wyvern Wingman</span> : null}
          </>
        }
      />

      {op.suspendedReason ? (
        <p className="mt-5 max-w-[64ch] rounded-control border border-line-2 bg-surface px-4 py-3 text-[15px] text-danger">
          {op.suspendedReason}
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <NumberCard label="Aircraft" value={fleet.length} />
        <NumberCard label="Trips flown" value={aggregates?.lifetimeTrips ?? 0} />
        <NumberCard
          label="Lifetime revenue"
          value={aggregates?.lifetimeRevenue ? formatUSD(aggregates.lifetimeRevenue) : "$0"}
        />
        <NumberCard
          label="Liability limit"
          value={op.liabilityLimitUsd ? `$${(Number(op.liabilityLimitUsd) / 1_000_000).toFixed(0)}M` : "—"}
        />
      </div>

      <div className="mt-6">
        <OperatorEditForm initial={op} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-6">
          {/* Fleet */}
          <DeskCard title={`Aircraft · ${fleet.length}`}>
            {fleet.length === 0 ? (
              <p className="mt-4 text-[15px] text-steel">No aircraft on file.</p>
            ) : (
              <ul className="mt-4 divide-y divide-line-faint">
                {fleet.map((ac) => {
                  const s = AIRCRAFT_STATUS_WORDS[ac.status] ?? { label: ac.status, tone: "steel" as Tone };
                  return (
                    <li
                      key={ac.id}
                      className="grid grid-cols-1 items-center gap-2 py-3 md:grid-cols-[110px_1fr_auto_auto_auto] md:gap-4"
                    >
                      <Link href={`/admin/aircraft/${ac.id}`} className="text-[15px] font-medium text-bone hover:underline">
                        {ac.tailNumber}
                      </Link>
                      <div>
                        <div className="text-[15px] text-bone">{ac.makeModel}</div>
                        <div className="mt-0.5 text-[13px] text-steel">
                          {CATEGORY_WORDS[ac.category] ?? ac.category} · {ac.yearManufactured ?? "—"}
                        </div>
                      </div>
                      <span className="text-[14px] text-bone-2">
                        {ac.seats} seat{ac.seats === 1 ? "" : "s"}
                      </span>
                      <span className="text-[14px] text-bone-2">{ac.rangeNm.toLocaleString()} nm</span>
                      <span className="pill pill-outline">
                        <DotSentence tone={s.tone}>{s.label}</DotSentence>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </DeskCard>

          {/* Recent trips */}
          <DeskCard
            title={`Recent trips · ${recentTrips.length}`}
            actions={
              <Link href="/admin/trips" className="text-[14px] text-steel transition-colors hover:text-bone">
                All trips →
              </Link>
            }
          >
            {recentTrips.length === 0 ? (
              <p className="mt-4 text-[15px] text-steel">No trips flown with this operator yet.</p>
            ) : (
              <ul className="mt-4 divide-y divide-line-faint">
                {recentTrips.map((t) => {
                  const s = tripState(t.status);
                  return (
                    <li
                      key={t.id}
                      className="grid grid-cols-1 items-center gap-2 py-3 md:grid-cols-[auto_1fr_auto_auto] md:gap-4"
                    >
                      <Link href={`/admin/trips/${t.id}`} className="text-[15px] font-medium text-bone hover:underline">
                        {t.tripCode}
                      </Link>
                      <span className="text-[14px] text-bone-2">
                        {passengersWords(t.paxCount)} · {formatDate(t.createdAt)}
                      </span>
                      <span className="pill pill-outline">
                        <DotSentence tone={s.dot}>{s.label}</DotSentence>
                      </span>
                      <span className="text-[15px] text-bone">{t.revenueUsd ? formatUSD(t.revenueUsd) : "—"}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </DeskCard>

          {/* Commercial terms */}
          <DeskCard title="Commercial terms">
            <dl className="dl-jn mt-4">
              <dt>Payment terms</dt>
              <dd>{op.paymentTerms ?? "—"}</dd>
              <dt>Volume discount</dt>
              <dd>{op.volumeDiscountPct ? `${op.volumeDiscountPct}%` : "—"}</dd>
              <dt>Rate lock</dt>
              <dd>
                {op.rateLock ? (
                  <DotSentence tone="success">Locked</DotSentence>
                ) : (
                  <span className="text-steel">None</span>
                )}
              </dd>
              <dt>Liability limit</dt>
              <dd>{op.liabilityLimitUsd ? `$${Number(op.liabilityLimitUsd).toLocaleString()}` : "—"}</dd>
            </dl>
          </DeskCard>

          {/* Notes */}
          {op.notes ? (
            <DeskCard title="Operator notes">
              <p className="mt-4 whitespace-pre-line text-[15px] leading-[1.6] text-bone">{op.notes}</p>
            </DeskCard>
          ) : null}
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-6">
          {/* Vetting + renewal calendar */}
          <DeskCard title="Vetting renewals">
            <ul className="mt-4 divide-y divide-line-faint">
              {renewals.map((r) => {
                const days = daysUntil(r.date, now);
                return (
                  <li key={r.label} className="grid grid-cols-[1fr_auto] items-baseline gap-3 py-3">
                    <span className="text-[15px] text-steel">{r.label}</span>
                    <span className={`text-[15px] ${renewalTone(days)}`}>
                      {r.date ? (
                        <>
                          {formatDate(r.date)}
                          {days !== null
                            ? days < 0
                              ? ` · ${Math.abs(days)} days past`
                              : ` · in ${days} days`
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
            {op.isbaoStage ? <p className="mt-4 text-[14px] text-steel">IS-BAO Stage {op.isbaoStage}</p> : null}
          </DeskCard>

          {/* Contacts */}
          <DeskCard title={`Contacts · ${contacts.length}`}>
            <div className="mt-4">
              <OperatorContactsEditor operatorId={op.id} initial={contacts} />
            </div>
          </DeskCard>

          {/* History */}
          <DeskCard title="History">
            <dl className="dl-jn mt-4">
              <dt>Onboarded</dt>
              <dd className="text-bone-2">{formatDate(op.createdAt)}</dd>
              <dt>Updated</dt>
              <dd className="text-bone-2">{formatDate(op.updatedAt)}</dd>
              <dt>Years as a partner</dt>
              <dd>{op.yearsPartner ?? "—"}</dd>
              <dt>FAA Part</dt>
              <dd>{op.faaPart}</dd>
            </dl>
          </DeskCard>
        </div>
      </div>
    </DeskPage>
  );
}
