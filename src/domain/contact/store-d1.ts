import { count, desc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { contactInquiries } from "@/db/d1/schema/contact";
import { users } from "@/db/d1/schema/users";
import type { InquiryStore } from "./store";

// The D1 (SQLite) side of the inquiry store (OPS-122). Same methods and the
// same results as store-pg.ts, on the D1 twin table (src/db/d1/schema, OPS-100).
// The client is passed in so a test can hand it a real SQLite.
//
// Differences from Postgres: ids are text made by newId() on insert, the
// timestamps are integer milliseconds that drizzle maps to Date, reason and
// status are text with CHECK constraints, count(*) needs no ::int cast and the
// table needs no `public.` prefix. created_at is integer ms, so ordering by it
// is chronological.

type D1Client = DrizzleD1Database;

export function d1InquiryStore(db: D1Client): InquiryStore {
  return {
    async insertInquiry(values) {
      const [row] = await db.insert(contactInquiries).values(values).returning({ id: contactInquiries.id });
      return row;
    },

    async newCount() {
      const [row] = await db.select({ n: count() }).from(contactInquiries).where(eq(contactInquiries.status, "new"));
      return row?.n ?? 0;
    },

    async listInquiries(showHandled, limit) {
      return db
        .select({
          id: contactInquiries.id,
          reason: contactInquiries.reason,
          firstName: contactInquiries.firstName,
          lastName: contactInquiries.lastName,
          email: contactInquiries.email,
          phone: contactInquiries.phone,
          fromText: contactInquiries.fromText,
          toText: contactInquiries.toText,
          dateText: contactInquiries.dateText,
          paxText: contactInquiries.paxText,
          notes: contactInquiries.notes,
          memberId: contactInquiries.memberId,
          status: contactInquiries.status,
          handledAt: contactInquiries.handledAt,
          createdAt: contactInquiries.createdAt,
          handledByEmail: users.email,
        })
        .from(contactInquiries)
        .leftJoin(users, eq(users.id, contactInquiries.handledByUserId))
        .where(showHandled ? undefined : eq(contactInquiries.status, "new"))
        .orderBy(desc(contactInquiries.createdAt))
        .limit(limit);
    },

    async statusOf(id) {
      const [row] = await db
        .select({ id: contactInquiries.id, status: contactInquiries.status })
        .from(contactInquiries)
        .where(eq(contactInquiries.id, id));
      return row;
    },

    async setStatus(id, patch) {
      const [row] = await db
        .update(contactInquiries)
        .set(patch)
        .where(eq(contactInquiries.id, id))
        .returning({ id: contactInquiries.id });
      return row;
    },
  };
}
