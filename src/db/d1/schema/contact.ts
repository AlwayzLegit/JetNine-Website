// D1 (SQLite) twin of src/db/schema/contact.ts (OPS-100). Same export names, same SQL table
// and column names. Mapping: see DEPLOY.md "D1 tables (OPS-100)".
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { enumCheck, newId } from "../helpers";
import { contactReasonEnum, contactInquiryStatusEnum } from "../../schema/contact";
import { members } from "./members";
import { users } from "./users";

// Mirrors the reason chips on the public contact form. "quote" inquiries
// are quote-shaped but arrive without legs/consents, so they stay out of
// the quotes table — dispatch triages them into the wizard if they firm up.


// ─── contact_inquiries ───────────────────────────────────────────────────
// Public contact-form submissions. Anonymous insert (RLS allows member_id
// null), staff-only read/update. Route/date/pax are free-text exactly as
// typed — the form deliberately doesn't force structure on "thinking out
// loud" inquiries the way the quote wizard does.

export const contactInquiries = sqliteTable(
  "contact_inquiries",
  {
    id: text("id").primaryKey().$defaultFn(newId),

    reason: text("reason", { enum: contactReasonEnum.enumValues }).notNull().default("quote"),

    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),

    fromText: text("from_text"),
    toText: text("to_text"),
    dateText: text("date_text"),
    paxText: text("pax_text"),
    notes: text("notes"),

    // Linked when the visitor is signed in with a member profile, so the
    // desk sees account context without asking.
    memberId: text("member_id").references(() => members.id, { onDelete: "set null" }),

    status: text("status", { enum: contactInquiryStatusEnum.enumValues }).notNull().default("new"),
    handledByUserId: text("handled_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    handledAt: integer("handled_at", { mode: "timestamp_ms" }),

    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().defaultNow(),
  },
  (t) => [
    index("contact_inquiries_status_idx").on(t.status, t.createdAt),
    index("contact_inquiries_email_idx").on(t.email),
    enumCheck("contact_inquiries_reason_enum", t.reason, contactReasonEnum.enumValues),
    enumCheck("contact_inquiries_status_enum", t.status, contactInquiryStatusEnum.enumValues),
  ]);

