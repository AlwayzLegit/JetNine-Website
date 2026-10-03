import { deskSnapshot } from "@/domain/desk/queries";
import { ok } from "@/domain/result";
import type { RouteDef } from "../handler";

/** Desk-wide read-only routes. */
export const DESK_ROUTES = {
  deskSnapshot: {
    method: "GET",
    path: "/desk/snapshot",
    operationId: "deskSnapshot",
    summary: "How the desk is doing right now",
    description:
      "One set of counts: requests needing a reply (and how many are overdue), requests being worked, options out with clients, bookings in the last 14 days, unread messages, new contact inquiries, failed deliveries in the last 7 days, upcoming trips in the next 30 days, trips flying today, overdue invoices, live empty legs and the reply-time promise in minutes. Smoke-test requests are left out.",
    tag: "Desk",
    scope: "read",
    run: async () => ok({ data: await deskSnapshot() }),
  },
} satisfies Record<string, RouteDef>;
