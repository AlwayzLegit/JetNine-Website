import { count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { contactInquiries } from "@/db/schema/contact";
import { users } from "@/db/schema/users";
import type { InquiryStore } from "./store";

// The Postgres side of the inquiry store (OPS-122): the queries that lived in
// the contact and guide actions, the desk counts and the messages domain,
// moved as they were.

export function pgInquiryStore(): InquiryStore {
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
