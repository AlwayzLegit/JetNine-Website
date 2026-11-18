import { d1Db, dbTarget } from "@/db";
import type { PeriodKey } from "@/app/admin/settings/reports/period";
import { d1ReportStore } from "./store-d1";
import { pgReportStore } from "./store-pg";

// The reports domain's one door to the database for the cross-domain reads (OPS-163): the
// desk's sidebar count and snapshot (src/domain/desk/queries.ts), the Settings, Reports page
// and GET /api/v1/reports/summary (queries.ts here) and the 7 AM morning summary
// (src/app/api/cron/morning-summary/route.ts). Nothing is written. There is one adapter per
// database, chosen per request by dbTarget(): Postgres until the move, D1 where DB_TARGET is
// "d1" (staging first; the code refuses "d1" in production, see src/db/target.mjs).
//
// Time windows are worked out once in the app and handed over as dates, the way the CSV
// export does (OPS-154). The Postgres adapter keeps today's SQL as it was (current_date and
// date_trunc included) and so ignores the dates it does not need.

/** The five quote counts the desk snapshot shows. Smoke quotes are left out of all of them. */
export type QuoteStageCounts = {
  needsReply: number;
  working: number;
  optionsOut: number;
  bookedLast14Days: number;
  overdueReplies: number;
};

export type RequestCounts = {
  received: number;
  receivedPrev: number;
  booked: number;
  waiting: number;
  lost: number;
  open: number;
};

export type MoneySummary = {
  invoiced: number;
  invoicedPrev: number;
  outstanding: number;
  outstandingCount: number;
  trueMargin: number;
  coveredInvoiced: number;
  marginCovered: number;
  marginTotal: number;
};

export type MostOverdueRow = { name: string | null; preferredName: string | null; daysLate: number };

/** One flight of the morning summary. Field names are the ones the summary has always read. */
export type FlightRow = {
  trip_id: string;
  status: string;
  from_city: string | null;
  from_name: string | null;
  from_iata: string | null;
  to_city: string | null;
  to_name: string | null;
  to_iata: string | null;
  depart_time: string | null;
  pax_count: number;
  client_name: string | null;
  aircraft: string | null;
};

/** One open request of the morning summary. */
export type SummaryRequestRow = {
  id: string;
  status: string;
  received_at: Date;
  sla_deadline_at: Date;
  pax_count: number;
  from_city: string | null;
  from_name: string | null;
  from_iata: string | null;
  to_city: string | null;
  to_name: string | null;
  to_iata: string | null;
  client_name: string | null;
};

export interface ReportStore {
  /** Quotes waiting on a first reply (status submitted), smoke quotes left out: the sidebar pill. */
  submittedCount(): Promise<number>;
  /** The snapshot's five quote counts. `since14` is 14 days before `now`. */
  quoteStageCounts(since14: Date, now: Date): Promise<QuoteStageCounts>;
  overdueInvoiceCount(): Promise<number>;
  liveEmptyLegCount(): Promise<number>;
  /** Request counts of the Reports page for a period. `now` fixes the windows on D1. */
  requestCounts(period: PeriodKey, now: Date): Promise<RequestCounts>;
  /** Invoiced, outstanding and true margin for a period. Owner-only; the caller enforces it. */
  moneySummary(period: PeriodKey, now: Date): Promise<MoneySummary>;
  /** The oldest unpaid invoice past its due date, or null. `today` is the UTC day, YYYY-MM-DD. */
  mostOverdue(today: string): Promise<MostOverdueRow | null>;
  /** Today's legs (not cancelled), in time order with an untimed leg last, at most 40. `day` is YYYY-MM-DD. */
  flightsOn(day: string): Promise<FlightRow[]>;
  /** Open requests by reply deadline, smoke quotes left out, at most 40. */
  openRequestsForSummary(): Promise<SummaryRequestRow[]>;
}

/** The store for this request. One call per request; nothing is cached across requests. */
export function reportStore(): ReportStore {
  if (dbTarget() === "d1") {
    const client = d1Db();
    if (!client) throw new Error("DB_TARGET is d1 but the DB binding is missing");
    return d1ReportStore(client);
  }
  return pgReportStore();
}
