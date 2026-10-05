import Link from "next/link";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { aircraft } from "@/db/schema/aircraft";
import { invoices } from "@/db/schema/invoices";
import { memberships, reserveTransactions } from "@/db/schema/memberships";
import { quotes, quoteLegs } from "@/db/schema/quotes";
import { staff } from "@/db/schema/staff";
import { trips, tripLegs } from "@/db/schema/trips";
import { getCurrentUser } from "@/lib/auth";
import { getReplyPromiseMinutes } from "@/lib/desk-settings";
import { replyPromiseWords } from "@/lib/desk-status";
import { getMemberByUserId } from "@/lib/member";
import { statusPath } from "@/lib/request-status";
import { USD, formatDay } from "@/lib/request-page";
import {
  DispatcherCard,
  InvoicesCard,
  MembershipCard,
  type Dispatcher,
  type InvoiceSummary,
  type MembershipSummary,
} from "@/components/account/overview-aside";
import { NoUpcomingTrip, UpcomingTripCard, type UpcomingTrip } from "@/components/account/overview-upcoming-trip";
import { BTN_LINE, BTN_PRIMARY, EmptyPanel, Eyebrow, PANEL, PageHead, SectionTitle, UnderLink } from "@/components/account/panel";
import { QUOTE_IN_PROGRESS, countWords, dotClass, quoteStatusWords, todayISO } from "@/components/account/quotes-status";
import { isUpcoming, nextLeg, routeWords } from "@/components/account/trips-status";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ denied?: string }>;
};

/** Run one query; a failing table degrades to its section's empty state. */
async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[account] ${label} failed`, err);
    return fallback;
  }
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default async function AccountPage({ searchParams }: Props) {
  const { denied } = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;

  const firstName = user.firstName || user.email.split("@")[0];
  const today = todayISO();
  // Reply-time promise from the desk setting (Settings › Notifications).
  const replyMinutes = await getReplyPromiseMinutes();
  const member = await safe("member", () => getMemberByUserId(user.id), null);

  // ── Quotes in progress ──────────────────────────────────────────────
  const ownership = member
    ? or(eq(quotes.createdByUserId, user.id), eq(quotes.memberId, member.id))
    : eq(quotes.createdByUserId, user.id);
  const openQuotes = await safe(
    "quotes",
    () =>
      db
        .select({
          id: quotes.id,
          status: quotes.status,
          paxCount: quotes.paxCount,
          statusToken: quotes.statusToken,
          slaDeadlineAt: quotes.slaDeadlineAt,
          assignedDispatcherId: quotes.assignedDispatcherId,
        })
        .from(quotes)
        .where(and(ownership, inArray(quotes.status, [...QUOTE_IN_PROGRESS])))
        .orderBy(desc(quotes.receivedAt))
        .limit(50),
    [],
  );
  const quoteLegRows = openQuotes.length
    ? await safe(
        "quote legs",
        () =>
          db
            .select({
              quoteId: quoteLegs.quoteId,
              fromIata: quoteLegs.fromIata,
              toIata: quoteLegs.toIata,
              fromCity: quoteLegs.fromCity,
              toCity: quoteLegs.toCity,
              departDate: quoteLegs.departDate,
            })
            .from(quoteLegs)
            .where(inArray(quoteLegs.quoteId, openQuotes.slice(0, 3).map((q) => q.id)))
            .orderBy(asc(quoteLegs.legNumber)),
        [],
      )
    : [];
  const quoteLegsById = new Map<string, typeof quoteLegRows>();
  for (const l of quoteLegRows) {
    quoteLegsById.set(l.quoteId, [...(quoteLegsById.get(l.quoteId) ?? []), l]);
  }

  // ── Trips ───────────────────────────────────────────────────────────
  const tripRows = member
    ? await safe(
        "trips",
        () =>
          db
            .select({
              id: trips.id,
              code: trips.tripCode,
              status: trips.status,
              paxCount: trips.paxCount,
              aircraftId: trips.aircraftId,
              revenueUsd: trips.revenueUsd,
              assignedDispatcherId: trips.assignedDispatcherId,
            })
            .from(trips)
            .where(eq(trips.memberId, member.id))
            .orderBy(desc(trips.createdAt))
            .limit(100),
        [],
      )
    : [];
  const tripLegRows = tripRows.length
    ? await safe(
        "trip legs",
        () =>
          db
            .select({
              tripId: tripLegs.tripId,
              fromIata: tripLegs.fromIata,
              toIata: tripLegs.toIata,
              fromCity: tripLegs.fromCity,
              toCity: tripLegs.toCity,
              fromName: tripLegs.fromName,
              departDate: tripLegs.departDate,
              departTime: tripLegs.departTime,
              scheduledDepAt: tripLegs.scheduledDepAt,
              scheduledArrAt: tripLegs.scheduledArrAt,
            })
            .from(tripLegs)
            .where(inArray(tripLegs.tripId, tripRows.map((t) => t.id)))
            .orderBy(asc(tripLegs.legNumber)),
        [],
      )
    : [];
  const tripLegsById = new Map<string, typeof tripLegRows>();
  for (const l of tripLegRows) {
    tripLegsById.set(l.tripId, [...(tripLegsById.get(l.tripId) ?? []), l]);
  }
  const legsOf = (id: string) => tripLegsById.get(id) ?? [];

  const upcoming = tripRows
    .filter((t) => isUpcoming(t.status, legsOf(t.id), today))
    .sort((a, b) => {
      const da = nextLeg(legsOf(a.id), today)?.departDate ?? "9999";
      const dbb = nextLeg(legsOf(b.id), today)?.departDate ?? "9999";
      return da.localeCompare(dbb);
    });
  const next = upcoming[0] ?? null;
  const past = tripRows
    .filter((t) => t.status === "completed")
    .sort((a, b) => (legsOf(b.id)[0]?.departDate ?? "").localeCompare(legsOf(a.id)[0]?.departDate ?? ""))
    .slice(0, 3);

  const aircraftIds = [next, ...past].flatMap((t) => (t?.aircraftId ? [t.aircraftId] : []));
  const aircraftRows = aircraftIds.length
    ? await safe(
        "aircraft",
        () =>
          db
            .select({ id: aircraft.id, makeModel: aircraft.makeModel, category: aircraft.category, seats: aircraft.seats })
            .from(aircraft)
            .where(inArray(aircraft.id, aircraftIds)),
        [],
      )
    : [];
  const aircraftById = new Map(aircraftRows.map((a) => [a.id, a]));

  const nextTrip: UpcomingTrip | null = next
    ? {
        id: next.id,
        code: next.code,
        status: next.status,
        paxCount: next.paxCount,
        route: routeWords(legsOf(next.id)),
        leg: nextLeg(legsOf(next.id), today) ?? legsOf(next.id)[0] ?? null,
        aircraft: next.aircraftId ? (aircraftById.get(next.aircraftId) ?? null) : null,
      }
    : null;

  // ── Invoices ────────────────────────────────────────────────────────
  const invoiceSummary: InvoiceSummary | null = member
    ? await safe(
        "invoices",
        async () => {
          const rows = await db
            .select({ status: invoices.status, totalUsd: invoices.totalUsd, paidOn: invoices.paidOn })
            .from(invoices)
            .where(eq(invoices.memberId, member.id));
          const due = rows.filter((r) => r.status === "due" || r.status === "overdue");
          const paid = rows
            .filter((r) => r.status === "paid" && r.paidOn)
            .sort((a, b) => String(b.paidOn).localeCompare(String(a.paidOn)));
          return {
            dueCount: due.length,
            dueTotalUsd: due.reduce((sum, r) => sum + (r.totalUsd ?? 0), 0),
            lastPaid: paid[0] ? { totalUsd: paid[0].totalUsd, paidOn: paid[0].paidOn } : null,
          };
        },
        null,
      )
    : null;

  // ── Membership (same derivation as /account/members) ────────────────
  const membership: MembershipSummary | null = member
    ? await safe(
        "membership",
        async () => {
          const [active] = await db
            .select({
              program: memberships.program,
              depositUsd: memberships.depositUsd,
              nextRenewalDate: memberships.nextRenewalDate,
              expiresOn: memberships.expiresOn,
              autoRenew: memberships.autoRenew,
            })
            .from(memberships)
            .where(and(eq(memberships.memberId, member.id), eq(memberships.status, "active")))
            .orderBy(desc(memberships.activatedOn))
            .limit(1);
          if (!active) return null;
          const [balanceRow] = await db
            .select({ balance: sql<number>`coalesce(sum(${reserveTransactions.amountUsd}), 0)::int` })
            .from(reserveTransactions)
            .where(eq(reserveTransactions.memberId, member.id));
          return { ...active, balanceUsd: balanceRow?.balance ?? 0 };
        },
        null,
      )
    : null;

  // ── Dispatcher: the one on the next trip, else on the latest quote,
  //    else the member's primary, else the desk. ───────────────────────
  const dispatcherId =
    next?.assignedDispatcherId ??
    openQuotes.find((q) => q.assignedDispatcherId)?.assignedDispatcherId ??
    member?.primaryDispatcherId ??
    null;
  const dispatcher: Dispatcher = dispatcherId
    ? await safe(
        "dispatcher",
        async () => {
          const [row] = await db
            .select({ displayName: staff.displayName, directLineE164: staff.directLineE164 })
            .from(staff)
            .where(eq(staff.id, dispatcherId))
            .limit(1);
          return row ?? null;
        },
        null,
      )
    : null;

  // ── One-sentence summary ────────────────────────────────────────────
  const clauses: string[] = [];
  if (upcoming.length) clauses.push(`${countWords(upcoming.length)} trip${upcoming.length === 1 ? "" : "s"} coming up`);
  if (openQuotes.length) clauses.push(`${countWords(openQuotes.length)} quote${openQuotes.length === 1 ? "" : "s"} in progress`);
  const dueCount = invoiceSummary?.dueCount ?? 0;
  if (dueCount) clauses.push(`${countWords(dueCount)} invoice${dueCount === 1 ? "" : "s"} to pay`);
  else if (clauses.length) clauses.push("nothing outstanding to pay");
  const summary = clauses.length ? `${capitalise(clauses.join(", "))}.` : "Nothing coming up yet.";

  return (
    <>
      {denied === "admin" ? (
        <div className={`${PANEL} mb-6 border-danger px-6 py-5`} role="alert">
          <Eyebrow className="!text-danger">Dispatch desk · access denied</Eyebrow>
          <p className="mt-2 text-[15px] leading-[1.5] text-bone-2">
            Your account doesn&rsquo;t have a dispatcher or admin role. Contact your account owner or
            email{" "}
            <a href="mailto:dispatch@jetnine.com" className="text-link">
              dispatch@jetnine.com
            </a>{" "}
            if this is unexpected.
          </p>
        </div>
      ) : null}

      <PageHead
        title={<>Welcome back, {firstName}.</>}
        sub={summary}
        action={
          <Link href="/quote/mission" className={BTN_PRIMARY}>
            Request a quote <span aria-hidden="true">→</span>
          </Link>
        }
      />

      {nextTrip ? <UpcomingTripCard trip={nextTrip} /> : <NoUpcomingTrip />}

      <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] items-start gap-4">
        <section className={`${PANEL} px-5 py-[18px]`}>
          <div className="flex items-baseline justify-between gap-3">
            <Eyebrow>{openQuotes.length > 1 ? "Quotes in progress" : "Quote in progress"}</Eyebrow>
            <UnderLink href="/account/quotes">All quotes</UnderLink>
          </div>
          {openQuotes.length === 0 ? (
            <>
              <div className="mt-2 font-serif text-[21px] leading-[1.15] text-bone">No open requests.</div>
              <p className="mt-1 text-[14px] text-steel">Dispatch answers a new one {replyPromiseWords(replyMinutes)}.</p>
              <Link href="/quote/mission" className={`${BTN_LINE} mt-3`}>
                Request a quote <span aria-hidden="true">&nbsp;→</span>
              </Link>
            </>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {openQuotes.slice(0, 3).map((q) => {
                const legs = quoteLegsById.get(q.id) ?? [];
                const meta = [formatDay(legs[0]?.departDate)?.replace(/^\w+, /, ""), `${q.paxCount} passenger${q.paxCount === 1 ? "" : "s"}`]
                  .filter(Boolean)
                  .join(" · ");
                const status = quoteStatusWords(q.status, q.slaDeadlineAt, undefined, replyMinutes);
                const href = q.statusToken ? statusPath(q.statusToken) : null;
                return (
                  <li key={q.id} className="py-3 first:pt-2 last:pb-0">
                    <div className="font-serif text-[21px] leading-[1.15] text-bone">
                      {href ? (
                        <Link href={href} className="transition-colors hover:text-gold">
                          {routeWords(legs)}
                        </Link>
                      ) : (
                        routeWords(legs)
                      )}
                    </div>
                    {meta ? <div className="text-[14px] text-steel">{meta}</div> : null}
                    <div className="mt-2.5 flex items-center gap-2.5 bg-surface-2 px-3 py-2.5 text-[13px] text-bone">
                      <span className={dotClass(status.tone)} aria-hidden="true" />
                      <span>{status.text}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <MembershipCard membership={membership} />
        <InvoicesCard summary={invoiceSummary} />
        {dispatcher ? (
          <DispatcherCard dispatcher={dispatcher} subject={nextTrip ? `${nextTrip.code} — question` : undefined} />
        ) : null}
      </div>

      <section className="mt-5">
        <SectionTitle href="/account/trips" linkText="All trips">
          Past flights
        </SectionTitle>
        {past.length === 0 ? (
          <EmptyPanel className="mt-2.5">
            {member ? "No completed trips yet." : "Your trips appear here once dispatch books your first flight."}
          </EmptyPanel>
        ) : (
          <ul className={`${PANEL} mt-2.5`}>
            {past.map((t) => {
              const legs = legsOf(t.id);
              const ac = t.aircraftId ? aircraftById.get(t.aircraftId) : null;
              const meta = [formatDay(legs[0]?.departDate)?.replace(/^\w+, /, ""), ac?.makeModel].filter(Boolean).join(" · ");
              return (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-line px-[18px] py-3 text-[14px] first:border-t-0"
                >
                  <div className="min-w-0 flex-[999_1_240px]">
                    <Link href={`/account/trips/${t.id}`} className="font-serif text-[17px] text-bone transition-colors hover:text-gold">
                      {routeWords(legs)}
                    </Link>
                    {meta ? <span className="text-steel"> · {meta}</span> : null}
                  </div>
                  <span className="flex-none text-bone">{t.revenueUsd != null ? USD.format(t.revenueUsd) : ""}</span>
                  <UnderLink href="/account/invoices" className="flex-none">
                    Invoice
                  </UnderLink>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
