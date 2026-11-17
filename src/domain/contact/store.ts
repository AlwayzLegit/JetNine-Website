import { d1Db, dbTarget } from "@/db";
import type { NewContactInquiry } from "@/db/schema/contact";
import { d1InquiryStore } from "./store-d1";
import { pgInquiryStore } from "./store-pg";

// The contact domain's one door to the database (OPS-122): the contact form
// and the pricing guide download both write contact_inquiries, the desk counts
// the new ones, the admin Website form tab lists them and a staff member marks
// one handled or reopens it. Every query on that table goes through an
// InquiryStore. There is one adapter per database, chosen per request by
// dbTarget(): Postgres until the move, D1 where DB_TARGET is "d1" (staging
// first; the code refuses "d1" in production, see src/db/target.mjs). Audit
// log and rate limits stay on Postgres (their own row, OPS-123).

export type InquiryRow = {
  id: string;
  reason: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  fromText: string | null;
  toText: string | null;
  dateText: string | null;
  paxText: string | null;
  notes: string | null;
  memberId: string | null;
  status: string;
  handledAt: Date | null;
  createdAt: Date;
  handledByEmail: string | null;
};

export type InquiryStatus = "new" | "handled";

/** What a status change writes: who handled it and when, or both cleared on reopen. */
export type InquiryStatusPatch =
  | { status: "handled"; handledByUserId: string | null; handledAt: Date }
  | { status: "new"; handledByUserId: null; handledAt: null };

export interface InquiryStore {
  /** A new inquiry. Throws when the insert fails: a lead must never be lost silently. */
  insertInquiry(values: NewContactInquiry): Promise<{ id: string }>;
  /** Inquiries still waiting (status new). */
  newCount(): Promise<number>;
  /** Newest first; open ones only unless `showHandled`. The handler's email comes from users. */
  listInquiries(showHandled: boolean, limit: number): Promise<InquiryRow[]>;
  statusOf(id: string): Promise<{ id: string; status: InquiryStatus } | undefined>;
  /** Undefined when no inquiry has this id. */
  setStatus(id: string, patch: InquiryStatusPatch): Promise<{ id: string } | undefined>;
}

/** The store for this request. One call per request; nothing is cached across requests. */
export function inquiryStore(): InquiryStore {
  if (dbTarget() === "d1") {
    const client = d1Db();
    if (!client) throw new Error("DB_TARGET is d1 but the DB binding is missing");
    return d1InquiryStore(client);
  }
  return pgInquiryStore();
}
