import type { PeriodKey } from "@/app/admin/settings/reports/period";
import { reportStore } from "./store";

/**
 * Settings › Reports: how the desk did over a period. Shared by the admin
 * page and GET /api/v1/reports/summary. Money figures are owner-only; the
 * caller enforces that. The reads go through the report store (OPS-163): Postgres until the
 * move, D1 where DB_TARGET is "d1".
 */

export type ReportRequests = {
  received: number;
  receivedPrev: number;
  booked: number;
  waiting: number;
  lost: number;
  open: number;
};

export type ReportMoney = {
  invoiced: number;
  invoicedPrev: number;
  outstanding: number;
  outstandingCount: number;
  trueMargin: number;
  coveredInvoiced: number;
  marginCovered: number;
  marginTotal: number;
};

export type MostOverdue = { name: string | null; preferredName: string | null; daysLate: number };

export type ReportSummary = {
  period: PeriodKey;
  requests: ReportRequests;
  money: ReportMoney;
  mostOverdue: MostOverdue | null;
};

export async function getRequests(period: PeriodKey, now: Date = new Date()): Promise<ReportRequests> {
  return reportStore().requestCounts(period, now);
}

export async function getMoney(period: PeriodKey, now: Date = new Date()): Promise<ReportMoney> {
  return reportStore().moneySummary(period, now);
}

export async function getMostOverdue(now: Date = new Date()): Promise<MostOverdue | null> {
  return reportStore().mostOverdue(now.toISOString().slice(0, 10));
}

export async function reportSummary(period: PeriodKey, now: Date = new Date()): Promise<ReportSummary> {
  const [requests, money, mostOverdue] = await Promise.all([
    getRequests(period, now),
    getMoney(period, now),
    getMostOverdue(now),
  ]);
  return { period, requests, money, mostOverdue };
}
