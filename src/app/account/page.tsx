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
import { SectionHead } from "@/components/account/overview-section";
import { NoUpcomingTrip, UpcomingTripCard, type UpcomingTrip } from "@/components/account/overview-upcoming-trip";
import { QuoteRow } from "@/components/account/quotes-row";
import { QUOTE_IN_PROGRESS, countWords, quoteStatusWords, todayISO } from "@/components/account/quotes-status";
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
        <div className="card mb-8 p-6" role="alert">
          <div className="label-jn text-[13px] text-danger">Dispatch desk · access denied</div>
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

      <h1 className="title-app">Welcome back, {firstName}.</h1>
      <p className="mt-2.5 text-[17px] text-bone-2">{summary}</p>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <SectionHead label="Upcoming trip" />
          {nextTrip ? <UpcomingTripCard trip={nextTrip} /> : <NoUpcomingTrip />}

          <SectionHead label="Quotes · submitted & in progress" href="/account/quotes" linkText="All quotes →" className="mt-7" />
          {openQuotes.length === 0 ? (
            <div className="card mt-2.5 flex flex-wrap items-center justify-between gap-4 px-6 py-[18px] max-md:px-4">
              <p className="text-[15px] text-bone-2">No open requests. Dispatch answers a new one {replyPromiseWords(replyMinutes)}.</p>
              <Link href="/quote/mission" className="btn btn-secondary btn-sm">
                Request a quote <span aria-hidden="true">→</span>
              </Link>
            </div>
          ) : (
            <div className="mt-2.5 flex flex-col gap-2">
              {openQuotes.slice(0, 3).map((q) => {
                const legs = quoteLegsById.get(q.id) ?? [];
                const title = [routeWords(legs), formatDay(legs[0]?.departDate)?.replace(/^\w+, /, ""), `${q.paxCount} passenger${q.paxCount === 1 ? "" : "s"}`]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <QuoteRow
                    key={q.id}
                    href={q.statusToken ? statusPath(q.statusToken) : null}
                    title={title}
                    status={quoteStatusWords(q.status, q.slaDeadlineAt, undefined, replyMinutes)}
                  />
                );
              })}
            </div>
          )}

          <SectionHead label="Trips · past" href="/account/trips" linkText="All trips →" className="mt-7" />
          {past.length === 0 ? (
            <div className="card mt-2.5 px-6 py-[18px] max-md:px-4">
              <p className="text-[15px] text-bone-2">
                {member ? "No completed trips yet." : "Your trips appear here once dispatch books your first flight."}
              </p>
            </div>
          ) : (
            <ul className="card mt-2.5 overflow-hidden">
              {past.map((t) => {
                const legs = legsOf(t.id);
                const ac = t.aircraftId ? aircraftById.get(t.aircraftId) : null;
                const meta = [formatDay(legs[0]?.departDate)?.replace(/^\w+, /, ""), ac?.makeModel].filter(Boolean).join(" · ");
                return (
                  <li
                    key={t.id}
                    className="grid items-center gap-x-6 gap-y-1 border-b border-line-faint px-6 py-4 text-[15px] last:border-b-0 max-md:px-4 md:grid-cols-[minmax(0,1fr)_auto_auto]"
                  >
                    <div className="min-w-0">
                      <Link href={`/account/trips/${t.id}`} className="font-medium text-bone transition-colors hover:text-bone-2">
                        {routeWords(legs)}
                      </Link>
                      {meta ? <span className="text-steel"> · {meta}</span> : null}
                    </div>
                    <span className="text-bone">{t.revenueUsd != null ? USD.format(t.revenueUsd) : ""}</span>
                    <Link href="/account/invoices" className="text-link">
                      Invoice
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <MembershipCard membership={membership} />
          <InvoicesCard summary={invoiceSummary} />
          <DispatcherCard dispatcher={dispatcher} subject={nextTrip ? `${nextTrip.code} — question` : undefined} />
        </aside>
      </div>
    </>
  );
}
