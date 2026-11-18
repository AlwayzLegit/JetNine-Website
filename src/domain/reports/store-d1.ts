import { and, asc, count, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { aircraft } from "@/db/d1/schema/aircraft";
import { emptyLegs } from "@/db/d1/schema/empty-legs";
import { invoices } from "@/db/d1/schema/invoices";
import { members } from "@/db/d1/schema/members";
import { quoteLegs, quotes } from "@/db/d1/schema/quotes";
import { tripLegs, trips } from "@/db/d1/schema/trips";
import { users } from "@/db/d1/schema/users";
import { NOT_SMOKE_D1 } from "@/domain/smoke-d1";
import { OPEN_REQUEST_STATUSES } from "@/lib/desk-status";
import { periodPrevStartDate, periodStartDate } from "@/app/admin/settings/reports/period";
import type { FlightRow, ReportStore, SummaryRequestRow } from "./store";

// The D1 (SQLite) side of the report store (OPS-163). Same methods and the same results as
// store-pg.ts, on the D1 twin tables (src/db/d1/schema, OPS-100). The client is passed in so a
// test can hand it a real SQLite.
//
// Differences from Postgres: SQLite has no `filter` clause on aggregates, so each filtered
// count is count(case when ... then 1 end) and each filtered sum is sum(case ...); quote times
// are integer milliseconds, so the windows arrive as milliseconds worked out in the app (UTC
// midnights, the same day `current_date - n` gives on a UTC Postgres); invoice dates and leg
// dates are text YYYY-MM-DD, compared with the same days as text; contact_snapshot is JSON
// text read with json_extract (the smoke filter is smoke-d1.ts); days late is a julianday
// difference with today passed in; NULL times sort last through an explicit `is null` key.

type D1Client = DrizzleD1Database;

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** SQLite hands back integers as numbers; Number() keeps a null sum from leaking as null. */
const num = (v: unknown) => Number(v ?? 0);

export function d1ReportStore(db: D1Client): ReportStore {
  return {
    async submittedCount() {
      const [row] = await db
        .select({ n: count() })
        .from(quotes)
        .where(and(eq(quotes.status, "submitted"), NOT_SMOKE_D1));
      return row?.n ?? 0;
    },

    async quoteStageCounts(since14, now) {
      const [q] = await db
        .select({
          needsReply: sql<number>`count(case when ${quotes.status} = 'submitted' then 1 end)`,
          working: sql<number>`count(case when ${quotes.status} in ('triaged', 'sourcing') then 1 end)`,
          optionsOut: sql<number>`count(case when ${quotes.status} in ('options_sent', 'held') then 1 end)`,
          bookedLast14Days: sql<number>`count(case
            when ${quotes.status} in ('accepted', 'converted')
              and coalesce(${quotes.acceptedAt}, ${quotes.updatedAt}) >= ${since14.getTime()}
            then 1 end)`,
          overdueReplies: sql<number>`count(case
            when ${quotes.status} = 'submitted' and ${quotes.slaDeadlineAt} < ${now.getTime()}
            then 1 end)`,
        })
        .from(quotes)
        .where(NOT_SMOKE_D1);
      return {
        needsReply: num(q?.needsReply),
        working: num(q?.working),
        optionsOut: num(q?.optionsOut),
        bookedLast14Days: num(q?.bookedLast14Days),
        overdueReplies: num(q?.overdueReplies),
      };
    },

    async overdueInvoiceCount() {
      const [row] = await db.select({ n: count() }).from(invoices).where(eq(invoices.status, "overdue"));
      return row?.n ?? 0;
    },

    async liveEmptyLegCount() {
      const [row] = await db.select({ n: count() }).from(emptyLegs).where(eq(emptyLegs.status, "live"));
      return row?.n ?? 0;
    },

    async requestCounts(period, now) {
      const start = periodStartDate(period, now).getTime();
      const prevStart = periodPrevStartDate(period, now).getTime();
      const [row] = await db
        .select({
          received: sql<number>`count(case when ${quotes.receivedAt} >= ${start} then 1 end)`,
          receivedPrev: sql<number>`count(case when ${quotes.receivedAt} >= ${prevStart} and ${quotes.receivedAt} < ${start} then 1 end)`,
          booked: sql<number>`count(case when ${quotes.receivedAt} >= ${start} and ${quotes.status} in ('accepted', 'converted') then 1 end)`,
          waiting: sql<number>`count(case when ${quotes.receivedAt} >= ${start} and ${quotes.status} in ('options_sent', 'held') then 1 end)`,
          lost: sql<number>`count(case when ${quotes.receivedAt} >= ${start} and ${quotes.status} in ('declined', 'expired', 'cancelled') then 1 end)`,
          open: sql<number>`count(case when ${quotes.receivedAt} >= ${start} and ${quotes.status} in ('submitted', 'triaged', 'sourcing') then 1 end)`,
        })
        .from(quotes)
        .where(NOT_SMOKE_D1);
      return {
        received: num(row?.received),
        receivedPrev: num(row?.receivedPrev),
        booked: num(row?.booked),
        waiting: num(row?.waiting),
        lost: num(row?.lost),
        open: num(row?.open),
      };
    },

    async moneySummary(period, now) {
      const start = ymd(periodStartDate(period, now));
      const prevStart = ymd(periodPrevStartDate(period, now));
      // Same rules as the Postgres adapter: true margin sums over the cost-known cohort only,
      // and margin_covered / margin_total report the coverage. No smoke filter (smoke quotes
      // never become trips or invoices).
      const [row] = await db
        .select({
          invoiced: sql<number>`coalesce(sum(case when ${invoices.issuedOn} >= ${start}
            and ${invoices.status} in ('paid', 'due', 'overdue') then ${invoices.totalUsd} else 0 end), 0)`,
          invoicedPrev: sql<number>`coalesce(sum(case when ${invoices.issuedOn} >= ${prevStart} and ${invoices.issuedOn} < ${start}
            and ${invoices.status} in ('paid', 'due', 'overdue') then ${invoices.totalUsd} else 0 end), 0)`,
          outstanding: sql<number>`coalesce(sum(case when ${invoices.status} in ('due', 'overdue') then ${invoices.totalUsd} else 0 end), 0)`,
          outstandingCount: sql<number>`count(case when ${invoices.status} in ('due', 'overdue') then 1 end)`,
          trueMargin: sql<number>`coalesce(sum(case when ${invoices.issuedOn} >= ${start}
            and ${invoices.status} = 'paid' and ${trips.operatorCostUsd} is not null
            then ${invoices.totalUsd} - coalesce(${invoices.fetUsd}, 0) - coalesce(${invoices.segmentFeeUsd}, 0) - ${trips.operatorCostUsd}
            else 0 end), 0)`,
          coveredInvoiced: sql<number>`coalesce(sum(case when ${invoices.issuedOn} >= ${start}
            and ${invoices.status} = 'paid' and ${trips.operatorCostUsd} is not null
            then ${invoices.totalUsd} else 0 end), 0)`,
          marginCovered: sql<number>`count(case when ${invoices.issuedOn} >= ${start}
            and ${invoices.status} = 'paid' and ${trips.operatorCostUsd} is not null then 1 end)`,
          marginTotal: sql<number>`count(case when ${invoices.issuedOn} >= ${start} and ${invoices.status} = 'paid' then 1 end)`,
        })
        .from(invoices)
        .leftJoin(trips, eq(trips.id, invoices.tripId));
      return {
        invoiced: num(row?.invoiced),
        invoicedPrev: num(row?.invoicedPrev),
        outstanding: num(row?.outstanding),
        outstandingCount: num(row?.outstandingCount),
        trueMargin: num(row?.trueMargin),
        coveredInvoiced: num(row?.coveredInvoiced),
        marginCovered: num(row?.marginCovered),
        marginTotal: num(row?.marginTotal),
      };
    },

    async mostOverdue(today) {
      const [row] = await db
        .select({
          name: sql<string | null>`nullif(trim(coalesce(${users.firstName}, '') || ' ' || coalesce(${users.lastName}, '')), '')`,
          preferredName: members.preferredName,
          daysLate: sql<number>`cast(julianday(${today}) - julianday(${invoices.dueOn}) as integer)`,
        })
        .from(invoices)
        .innerJoin(members, eq(members.id, invoices.memberId))
        .innerJoin(users, eq(users.id, members.userId))
        .where(and(inArray(invoices.status, ["due", "overdue"]), isNotNull(invoices.dueOn), lt(invoices.dueOn, today)))
        .orderBy(asc(invoices.dueOn))
        .limit(1);
      return row ? { name: row.name, preferredName: row.preferredName, daysLate: num(row.daysLate) } : null;
    },

    async flightsOn(day) {
      const rows = await db
        .select({
          trip_id: trips.id,
          status: trips.status,
          pax_count: trips.paxCount,
          from_city: tripLegs.fromCity,
          from_name: tripLegs.fromName,
          from_iata: tripLegs.fromIata,
          to_city: tripLegs.toCity,
          to_name: tripLegs.toName,
          to_iata: tripLegs.toIata,
          depart_time: tripLegs.departTime,
          client_name: sql<string | null>`nullif(trim(coalesce(${users.firstName}, '') || ' ' || coalesce(${users.lastName}, '')), '')`,
          aircraft: aircraft.makeModel,
        })
        .from(tripLegs)
        .innerJoin(trips, eq(trips.id, tripLegs.tripId))
        .innerJoin(members, eq(members.id, trips.memberId))
        .innerJoin(users, eq(users.id, members.userId))
        .leftJoin(aircraft, eq(aircraft.id, trips.aircraftId))
        .where(and(eq(tripLegs.departDate, day), sql`${trips.status} not in ('cancelled_wx', 'cancelled_other')`))
        .orderBy(sql`${tripLegs.departTime} is null`, asc(tripLegs.departTime), asc(tripLegs.legNumber))
        .limit(40);
      return rows as FlightRow[];
    },

    async openRequestsForSummary() {
      const rows = await db
        .select({
          id: quotes.id,
          status: quotes.status,
          received_at: quotes.receivedAt,
          sla_deadline_at: quotes.slaDeadlineAt,
          pax_count: quotes.paxCount,
          from_city: quoteLegs.fromCity,
          from_name: quoteLegs.fromName,
          from_iata: quoteLegs.fromIata,
          to_city: quoteLegs.toCity,
          to_name: quoteLegs.toName,
          to_iata: quoteLegs.toIata,
          client_name: sql<string | null>`nullif(trim(coalesce(json_extract(${quotes.contactSnapshot}, '$.firstName'), '') || ' ' || coalesce(json_extract(${quotes.contactSnapshot}, '$.lastName'), '')), '')`,
        })
        .from(quotes)
        .leftJoin(quoteLegs, and(eq(quoteLegs.quoteId, quotes.id), eq(quoteLegs.legNumber, 1)))
        .where(and(inArray(quotes.status, [...OPEN_REQUEST_STATUSES]), NOT_SMOKE_D1))
        .orderBy(asc(quotes.slaDeadlineAt))
        .limit(40);
      return rows as SummaryRequestRow[];
    },
  };
}
