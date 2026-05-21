import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { members } from "@/db/schema/members";
import { users } from "@/db/schema/users";
import { staff } from "@/db/schema/staff";
import { memberPreferences } from "@/db/schema/member-prefs";
import { memberLanes, companions } from "@/db/schema/member-prefs";
import { memberships, reserveTransactions } from "@/db/schema/memberships";
import { trips } from "@/db/schema/trips";
import { invoices } from "@/db/schema/invoices";
import { quotes } from "@/db/schema/quotes";
import { formatUSD } from "@/lib/quote-pricing";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

const TIER_LABEL: Record<string, string> = {
  on_demand: "On-demand",
  card_100: "Card · 100",
  card_250: "Card · 250",
  card_500: "Card · 500",
  reserve_50: "Reserve · 50",
  reserve_100: "Reserve · 100",
  reserve_250: "Reserve · 250",
  reserve_500_apply: "Reserve · 500 (apply)",
};

const MEMBER_STATUS_CLASS: Record<string, string> = {
  active: "border-[var(--success)] text-[var(--success)]",
  paused: "border-[var(--warn)] text-[var(--warn)]",
  closed: "border-steel text-steel",
};

const TRIP_STATUS_CLASS: Record<string, string> = {
  confirmed: "border-clearance text-clearance",
  airborne: "border-[var(--warn)] text-[var(--warn)]",
  completed: "border-[var(--success)] text-[var(--success)]",
  cancelled_wx: "border-[var(--error)] text-[var(--error)]",
  cancelled_other: "border-[var(--error)] text-[var(--error)]",
};

const INVOICE_STATUS_CLASS: Record<string, string> = {
  draft: "border-bone-2 text-bone-2",
  due: "border-[var(--warn)] text-[var(--warn)]",
  overdue: "border-[var(--error)] text-[var(--error)]",
  paid: "border-[var(--success)] text-[var(--success)]",
  credit: "border-clearance text-clearance",
  void: "border-steel text-steel",
};

const QUOTE_STATUS_CLASS: Record<string, string> = {
  submitted: "border-clearance text-clearance",
  triaged: "border-bone-2 text-bone",
  sourcing: "border-[var(--warn)] text-[var(--warn)]",
  options_sent: "border-bone text-bone",
  held: "border-ink-4 text-steel",
  accepted: "border-[var(--success)] text-[var(--success)]",
  declined: "border-[var(--error)] text-[var(--error)]",
  expired: "border-steel text-steel",
  cancelled: "border-steel text-steel",
  converted: "border-[var(--success)] text-[var(--success)]",
};

export default async function AdminMemberDetailPage({ params }: Props) {
  const { id } = await params;

  const [memberRow] = await db
    .select({
      id: members.id,
      memberCode: members.memberCode,
      legalName: members.legalName,
      preferredName: members.preferredName,
      tier: members.tier,
      tierSince: members.tierSince,
      memberSince: members.memberSince,
      status: members.status,
      mobileE164: members.mobileE164,
      companyName: members.companyName,
      roleTitle: members.roleTitle,
      twoFactorEnabled: members.twoFactorEnabled,
      marketingOptIn: members.marketingOptIn,
      lifetimeTripsCache: members.lifetimeTripsCache,
      lifetimeHoursCache: members.lifetimeHoursCache,
      primaryDispatcherId: members.primaryDispatcherId,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phoneE164: users.phoneE164,
      role: users.role,
    })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(eq(members.id, id));
  if (!memberRow) notFound();

  const [dispatcherRow] = memberRow.primaryDispatcherId
    ? await db
        .select({ displayName: staff.displayName, status: staff.status })
        .from(staff)
        .where(eq(staff.id, memberRow.primaryDispatcherId))
    : [];

  const [prefs] = await db
    .select()
    .from(memberPreferences)
    .where(eq(memberPreferences.memberId, id));

  const lanesList = await db
    .select()
    .from(memberLanes)
    .where(eq(memberLanes.memberId, id))
    .orderBy(desc(memberLanes.frequencyPerYear));

  const companionsList = await db
    .select()
    .from(companions)
    .where(eq(companions.memberId, id))
    .orderBy(asc(companions.legalName));

  const programs = await db
    .select()
    .from(memberships)
    .where(eq(memberships.memberId, id))
    .orderBy(desc(memberships.activatedOn));
  const activeProgram = programs.find((p) => p.status === "active") ?? null;

  const [balanceRow] = await db
    .select({
      balance: sql<number>`coalesce(sum(${reserveTransactions.amountUsd}), 0)::int`,
    })
    .from(reserveTransactions)
    .where(eq(reserveTransactions.memberId, id));
  const balance = balanceRow?.balance ?? 0;

  const tripsList = await db
    .select({
      id: trips.id,
      tripCode: trips.tripCode,
      status: trips.status,
      missionType: trips.missionType,
      paxCount: trips.paxCount,
      revenueUsd: trips.revenueUsd,
      createdAt: trips.createdAt,
    })
    .from(trips)
    .where(eq(trips.memberId, id))
    .orderBy(desc(trips.createdAt))
    .limit(10);

  const invoicesList = await db
    .select({
      id: invoices.id,
      invoiceCode: invoices.invoiceCode,
      status: invoices.status,
      issuedOn: invoices.issuedOn,
      totalUsd: invoices.totalUsd,
      tripCode: trips.tripCode,
    })
    .from(invoices)
    .leftJoin(trips, eq(trips.id, invoices.tripId))
    .where(eq(invoices.memberId, id))
    .orderBy(desc(invoices.issuedOn))
    .limit(10);

  const quotesList = await db
    .select({
      id: quotes.id,
      quoteCode: quotes.quoteCode,
      status: quotes.status,
      paxCount: quotes.paxCount,
      receivedAt: quotes.receivedAt,
      convertedTripId: quotes.convertedTripId,
    })
    .from(quotes)
    .where(eq(quotes.memberId, id))
    .orderBy(desc(quotes.receivedAt))
    .limit(10);

  const [lifetimeInvoicedRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${invoices.totalUsd}), 0)::int`,
    })
    .from(invoices)
    .where(
      sql`${invoices.memberId} = ${id} and ${invoices.status} in ('paid','due','overdue')`,
    );
  const lifetimeInvoiced = lifetimeInvoicedRow?.total ?? 0;

  const displayName =
    [memberRow.firstName, memberRow.lastName].filter(Boolean).join(" ") ||
    memberRow.email;
  const recentLedger = await db
    .select({
      id: reserveTransactions.id,
      kind: reserveTransactions.kind,
      amountUsd: reserveTransactions.amountUsd,
      description: reserveTransactions.description,
      occurredAt: reserveTransactions.occurredAt,
    })
    .from(reserveTransactions)
    .where(eq(reserveTransactions.memberId, id))
    .orderBy(desc(reserveTransactions.occurredAt))
    .limit(8);

  return (
    <div className="container-jn py-8">
      {/* Top bar */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6 border-b border-ink-3 pb-6">
        <div>
          <nav className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2">
            <Link href="/admin/member" className="transition-colors hover:text-clearance">
              Members
            </Link>{" "}
            <span className="text-steel">/</span>{" "}
            <span className="text-bone">{memberRow.memberCode}</span>
          </nav>
          <div className="mt-3 flex flex-wrap items-baseline gap-4">
            <span
              className="font-serif text-[40px] font-light leading-none tracking-tight text-bone"
              style={{ letterSpacing: "-0.02em" }}
            >
              {displayName}
            </span>
            <span
              className={[
                "rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]",
                MEMBER_STATUS_CLASS[memberRow.status] ?? "border-ink-3 text-bone-2",
              ].join(" ")}
            >
              {memberRow.status}
            </span>
            <span className="rounded-[2px] border border-ink-3 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-clearance">
              {TIER_LABEL[memberRow.tier] ?? memberRow.tier}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
              {memberRow.memberCode}
            </span>
          </div>
          {memberRow.companyName ? (
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.08em] text-bone-2">
              {memberRow.companyName}
              {memberRow.roleTitle ? ` · ${memberRow.roleTitle}` : ""}
            </p>
          ) : null}
        </div>
        <dl className="flex flex-wrap gap-x-10 gap-y-3 text-right">
          {[
            ["LIFETIME TRIPS", String(memberRow.lifetimeTripsCache ?? 0)],
            ["LIFETIME HOURS", String(memberRow.lifetimeHoursCache ?? 0)],
            ["LIFETIME INVOICED", formatUSD(lifetimeInvoiced)],
            ["RESERVE BALANCE", formatUSD(balance)],
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
          {/* Contact + ID */}
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <h2 className="caption mb-5">— Contact &amp; ID</h2>
            <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-3 text-[12px]">
              <Row k="— Email">
                <a
                  href={`mailto:${memberRow.email}`}
                  className="font-mono tracking-[0.04em] text-clearance hover:underline"
                >
                  {memberRow.email}
                </a>
              </Row>
              <Row k="— Mobile">
                {memberRow.mobileE164 || memberRow.phoneE164 ? (
                  <a
                    href={`tel:${memberRow.mobileE164 ?? memberRow.phoneE164}`}
                    className="font-mono tracking-[0.04em] text-clearance hover:underline"
                  >
                    {memberRow.mobileE164 ?? memberRow.phoneE164}
                  </a>
                ) : (
                  <span className="text-steel">—</span>
                )}
              </Row>
              <Row k="— Legal name">
                <span className="text-bone">{memberRow.legalName ?? "—"}</span>
              </Row>
              <Row k="— Preferred">
                <span className="text-bone">{memberRow.preferredName ?? "—"}</span>
              </Row>
              <Row k="— Member since">
                <span className="font-mono text-[11px] tracking-[0.04em] text-bone-2">
                  {memberRow.memberSince ?? "—"}
                </span>
              </Row>
              <Row k="— Tier since">
                <span className="font-mono text-[11px] tracking-[0.04em] text-bone-2">
                  {memberRow.tierSince ?? "—"}
                </span>
              </Row>
              <Row k="— 2FA">
                <span className="font-mono text-[11px] uppercase tracking-[0.12em]">
                  <span
                    className={
                      memberRow.twoFactorEnabled ? "text-[var(--success)]" : "text-bone-2"
                    }
                  >
                    {memberRow.twoFactorEnabled ? "Enabled" : "Disabled"}
                  </span>
                </span>
              </Row>
              <Row k="— Marketing">
                <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-bone-2">
                  {memberRow.marketingOptIn ? "Opted-in" : "Opted-out"}
                </span>
              </Row>
              <Row k="— Dispatcher">
                {dispatcherRow ? (
                  <span className="text-bone">{dispatcherRow.displayName}</span>
                ) : (
                  <span className="text-steel">— Unassigned</span>
                )}
              </Row>
            </dl>
          </section>

          {/* Preferences */}
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <div className="mb-5 flex items-baseline justify-between">
              <h2 className="caption">— Preferences</h2>
              {prefs ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
                  Updated {prefs.updatedAt.toISOString().slice(0, 10)}
                </span>
              ) : null}
            </div>
            {prefs ? (
              <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
                <PrefBlock label="Cabin defaults">
                  <ChipList
                    items={[
                      prefs.cabinWifi ? "Wi-Fi" : null,
                      prefs.cabinStandup ? "Stand-up" : null,
                      prefs.cabinLavatoryEnclosed ? "Enclosed lav" : null,
                      prefs.cabinLieflat
                        ? `Lie-flat ≥ ${prefs.lieflatMinHours}h`
                        : null,
                      prefs.cabinFlightAttendant ? "Flight attendant" : null,
                      prefs.cabinPetFriendly ? "Pet" : null,
                    ].filter(Boolean) as string[]}
                  />
                </PrefBlock>
                <PrefBlock label="Catering">
                  <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-bone">
                    {prefs.cateringTier}
                  </span>
                  {prefs.dietary ? (
                    <p className="mt-1 text-[12px] text-bone-2">{prefs.dietary}</p>
                  ) : null}
                  {prefs.barPreferences ? (
                    <p className="mt-1 text-[12px] text-bone-2">Bar: {prefs.barPreferences}</p>
                  ) : null}
                </PrefBlock>
                <PrefBlock label="Ground">
                  <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-bone">
                    {prefs.groundType.replace(/_/g, " ")}
                  </span>
                  {prefs.groundVendor ? (
                    <p className="mt-1 text-[12px] text-bone-2">{prefs.groundVendor}</p>
                  ) : null}
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
                    Arrival window {prefs.arrivalWindowMinutes} min
                  </p>
                </PrefBlock>
                <PrefBlock label="Comms">
                  <ChipList
                    items={[
                      prefs.commsVoice ? "Voice" : null,
                      prefs.commsEmail ? "Email" : null,
                      prefs.commsSmsUpdates ? "SMS updates" : null,
                      prefs.commsSmsEmptyLeg ? "SMS empty-leg" : null,
                    ].filter(Boolean) as string[]}
                  />
                  {prefs.quietHoursStart && prefs.quietHoursEnd ? (
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-bone-2">
                      Quiet {prefs.quietHoursStart}–{prefs.quietHoursEnd}{" "}
                      {prefs.quietHoursTz ?? ""}
                    </p>
                  ) : null}
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
                    Empty-leg threshold {prefs.emptyLegAlertThresholdPct}%+
                  </p>
                </PrefBlock>
                <PrefBlock label="Privacy">
                  <ChipList
                    items={[
                      prefs.anonymizeManifest ? "Anonymize manifest" : null,
                      prefs.blockFlightTracking ? "Block flight tracking" : null,
                    ].filter(Boolean) as string[]}
                  />
                  {!prefs.anonymizeManifest && !prefs.blockFlightTracking ? (
                    <span className="text-[11px] text-steel">— No privacy holds</span>
                  ) : null}
                </PrefBlock>
                {prefs.standingCateringNotes ? (
                  <PrefBlock label="Standing catering notes">
                    <p className="text-[12px] leading-[1.55] text-bone">
                      {prefs.standingCateringNotes}
                    </p>
                  </PrefBlock>
                ) : null}
              </div>
            ) : (
              <p className="text-[13px] leading-[1.55] text-steel">
                — No preferences set. Member hasn&rsquo;t customized defaults yet.
              </p>
            )}
          </section>

          {/* Trips */}
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <div className="mb-5 flex items-baseline justify-between">
              <h2 className="caption">— Recent trips · {tripsList.length}</h2>
              <Link
                href="/admin/trip"
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-clearance"
              >
                All trips →
              </Link>
            </div>
            {tripsList.length === 0 ? (
              <p className="text-[13px] text-steel">— No trips on file.</p>
            ) : (
              <ul className="divide-y divide-ink-3">
                {tripsList.map((t) => (
                  <li
                    key={t.id}
                    className="grid grid-cols-[auto_1fr_auto_auto] items-baseline gap-4 py-3"
                  >
                    <Link
                      href={`/admin/trip/${t.id}`}
                      className="font-mono text-[11px] tracking-[0.04em] text-clearance hover:underline"
                    >
                      {t.tripCode}
                    </Link>
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-bone">
                      {t.missionType.replace(/_/g, " ")} · {t.paxCount} pax
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
                      {t.revenueUsd ? formatUSD(t.revenueUsd) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Recent quotes */}
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <div className="mb-5 flex items-baseline justify-between">
              <h2 className="caption">— Recent quotes · {quotesList.length}</h2>
              <Link
                href="/admin/dispatch"
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-2 transition-colors hover:text-clearance"
              >
                Inbox →
              </Link>
            </div>
            {quotesList.length === 0 ? (
              <p className="text-[13px] text-steel">— No quotes on file.</p>
            ) : (
              <ul className="divide-y divide-ink-3">
                {quotesList.map((q) => (
                  <li
                    key={q.id}
                    className="grid grid-cols-[auto_1fr_auto_auto] items-baseline gap-4 py-3"
                  >
                    <Link
                      href={`/admin/quote/${q.id}`}
                      className="font-mono text-[11px] tracking-[0.04em] text-clearance hover:underline"
                    >
                      {q.quoteCode}
                    </Link>
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-bone-2">
                      {q.paxCount} pax · {q.receivedAt?.toISOString().slice(0, 10) ?? "—"}
                    </span>
                    <span
                      className={[
                        "inline-block rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]",
                        QUOTE_STATUS_CLASS[q.status] ?? "border-ink-3 text-bone-2",
                      ].join(" ")}
                    >
                      {q.status.replace(/_/g, " ")}
                    </span>
                    {q.convertedTripId ? (
                      <Link
                        href={`/admin/trip/${q.convertedTripId}`}
                        className="font-mono text-[10px] uppercase tracking-[0.14em] text-clearance hover:underline"
                      >
                        → trip
                      </Link>
                    ) : (
                      <span />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-6">
          {/* Active program + balance */}
          {activeProgram ? (
            <section className="rounded-[4px] border border-clearance bg-[rgba(232,226,210,0.04)] p-6">
              <p className="caption mb-3">— Active program</p>
              <div className="font-serif text-[24px] font-normal leading-tight text-bone">
                {TIER_LABEL[activeProgram.program] ?? activeProgram.program}
              </div>
              <div
                className="mt-3 font-serif text-[44px] font-light leading-none tracking-tight text-bone"
                style={{ letterSpacing: "-0.02em" }}
              >
                {formatUSD(balance)}
              </div>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-steel">
                Current reserve balance
              </p>
              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-ink-3 pt-4 text-[11px]">
                <Row k="Callout">
                  <span className="font-mono text-bone">{activeProgram.calloutHours}h</span>
                </Row>
                <Row k="Rate lock">
                  <span className="font-mono text-bone">{activeProgram.rateLockMonths}mo</span>
                </Row>
                <Row k="Cashback">
                  <span className="font-mono text-clearance">{activeProgram.cashbackPct}%</span>
                </Row>
                <Row k="Cards">
                  <span className="font-mono text-bone">
                    {activeProgram.namedCardholdersLimit === 99
                      ? "Unlimited"
                      : activeProgram.namedCardholdersLimit}
                  </span>
                </Row>
              </dl>
            </section>
          ) : (
            <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
              <p className="caption mb-3">— No active program</p>
              <p className="text-[13px] leading-[1.55] text-bone-2">
                Member is on-demand. Use this row to enroll in a Card / Reserve program.
              </p>
            </section>
          )}

          {/* Recent ledger */}
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <h2 className="caption mb-4">— Reserve ledger · last 8</h2>
            {recentLedger.length === 0 ? (
              <p className="text-[13px] text-steel">— No ledger activity.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-[12px]">
                {recentLedger.map((tx) => (
                  <li
                    key={tx.id}
                    className="grid grid-cols-[68px_1fr_auto] items-baseline gap-3"
                  >
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-steel">
                      {tx.occurredAt.toISOString().slice(0, 10)}
                    </span>
                    <span className="text-bone">
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-clearance">
                        {tx.kind.replace(/_/g, " ")}
                      </span>
                      {tx.description ? (
                        <span className="ml-2 text-bone-2">{tx.description}</span>
                      ) : null}
                    </span>
                    <span
                      className={[
                        "font-mono tracking-[0.04em]",
                        tx.amountUsd >= 0 ? "text-[var(--success)]" : "text-bone",
                      ].join(" ")}
                    >
                      {tx.amountUsd >= 0 ? "+" : ""}
                      {formatUSD(tx.amountUsd)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Companions */}
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <h2 className="caption mb-4">— Companions · {companionsList.length}</h2>
            {companionsList.length === 0 ? (
              <p className="text-[13px] text-steel">— None on file.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {companionsList.map((c) => (
                  <li key={c.id} className="rounded-[3px] border border-ink-3 bg-ink p-3">
                    <div className="flex items-baseline justify-between">
                      <span className="font-serif text-[15px] text-bone">{c.legalName}</span>
                      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-clearance">
                        {c.relation}
                      </span>
                    </div>
                    {c.relation === "pet" && c.speciesBreed ? (
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-bone-2">
                        {c.speciesBreed}
                        {c.weightLb ? ` · ${c.weightLb} lb` : ""}
                      </div>
                    ) : null}
                    {c.apisComplete ? (
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--success)]">
                        APIS complete
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Lanes */}
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <h2 className="caption mb-4">— Frequent lanes · {lanesList.length}</h2>
            {lanesList.length === 0 ? (
              <p className="text-[13px] text-steel">— None recorded yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {lanesList.map((l) => (
                  <li
                    key={l.id}
                    className="grid grid-cols-[1fr_auto] items-baseline gap-3"
                  >
                    <span className="font-mono text-[11px] tracking-[0.06em] text-clearance">
                      {l.fromIcao} → {l.toIcao}
                    </span>
                    <span className="font-mono text-[10px] tracking-[0.04em] text-bone-2">
                      {l.frequencyPerYear ? `${l.frequencyPerYear}× / yr` : "—"}
                      {l.seasonal ? " · seasonal" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Invoices */}
          <section className="rounded-[4px] border border-ink-3 bg-ink-2 p-6">
            <h2 className="caption mb-4">— Recent invoices · {invoicesList.length}</h2>
            {invoicesList.length === 0 ? (
              <p className="text-[13px] text-steel">— None yet.</p>
            ) : (
              <ul className="divide-y divide-ink-3">
                {invoicesList.map((i) => (
                  <li
                    key={i.id}
                    className="grid grid-cols-[auto_1fr_auto_auto] items-baseline gap-3 py-2 text-[11px]"
                  >
                    <span className="font-mono tracking-[0.04em] text-clearance">
                      {i.invoiceCode}
                    </span>
                    <span className="font-mono text-bone-2">
                      {i.tripCode ?? "—"} · {String(i.issuedOn)}
                    </span>
                    <span
                      className={[
                        "inline-block rounded-full border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em]",
                        INVOICE_STATUS_CLASS[i.status] ?? "border-ink-3 text-bone-2",
                      ].join(" ")}
                    >
                      {i.status}
                    </span>
                    <span className="font-mono tracking-[0.04em] text-bone">
                      {i.totalUsd ? formatUSD(i.totalUsd) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
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

function PrefBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-steel">
        — {label}
      </span>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function ChipList({ items }: { items: string[] }) {
  if (items.length === 0)
    return <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-steel">— None</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => (
        <span
          key={it}
          className="rounded-full border border-ink-3 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-bone"
        >
          {it}
        </span>
      ))}
    </div>
  );
}
