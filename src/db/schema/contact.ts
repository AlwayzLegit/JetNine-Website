import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { members } from "./members";
import { users } from "./users";

// Mirrors the reason chips on the public contact form. "quote" inquiries
// are quote-shaped but arrive without legs/consents, so they stay out of
// the quotes table — dispatch triages them into the wizard if they firm up.
export const contactReasonEnum = pgEnum("contact_reason", [
  "quote",
  "card",
  "trip",
  "other",
]);

export const contactInquiryStatusEnum = pgEnum("contact_inquiry_status", [
  "new",
  "handled",
]);

// ─── contact_inquiries ───────────────────────────────────────────────────
// Public contact-form submissions. Anonymous insert (RLS allows member_id
// null), staff-only read/update. Route/date/pax are free-text exactly as
// typed — the form deliberately doesn't force structure on "thinking out
// loud" inquiries the way the quote wizard does.

export const contactInquiries = pgTable(
  "contact_inquiries",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    reason: contactReasonEnum("reason").notNull().default("quote"),

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
    memberId: uuid("member_id").references(() => members.id, { onDelete: "set null" }),

    status: contactInquiryStatusEnum("status").notNull().default("new"),
    handledByUserId: uuid("handled_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    handledAt: timestamp("handled_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("contact_inquiries_status_idx").on(t.status, t.createdAt),
    index("contact_inquiries_email_idx").on(t.email),
  ],
);

export type ContactInquiry = typeof contactInquiries.$inferSelect;
export type NewContactInquiry = typeof contactInquiries.$inferInsert;
