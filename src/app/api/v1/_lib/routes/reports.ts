import { z } from "zod";
import { reportSummary } from "@/domain/reports/queries";
import { err, ok } from "@/domain/result";
import type { RouteDef } from "../handler";

/** Owners see money; a team key with "read" does not. */
function isOwner(role: string): boolean {
  return role === "admin" || role === "superadmin";
}

const reportSummaryRoute: RouteDef = {
  method: "GET",
  path: "/reports/summary",
  operationId: "reportSummary",
  summary: "How the desk did",
  description:
    "Requests received and where they ended up, money invoiced and still owed, and the kept margin for the last 30 days, last 90 days or this year. Owners only: the key must act as an owner.",
  tag: "Reports",
  scope: "read",
  query: z.object({
    period: z.enum(["30", "90", "ytd"]).optional().describe("30 (default), 90 or ytd."),
  }),
  run: async ({ actor, query }) => {
    if (!isOwner(actor.role)) return err("forbidden", "Owners only.");
    const period = (query.period as "30" | "90" | "ytd" | undefined) ?? "30";
    return ok({ data: await reportSummary(period) });
  },
};

export const REPORT_ROUTES = {
  reportSummary: reportSummaryRoute,
} satisfies Record<string, RouteDef>;
