// D1 only (OPS-373): one row per lead the site has told the Crew's Leads board about
// (OPS-370). It holds no name, phone, email or message text: a subject type, the id of
// the stored quote or inquiry, the source word, the times and whether the pointer was
// sent. There is no Postgres twin (production reads D1 since the cutover, OPS-206); the
// parity test names it as D1-only.
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { enumCheck, newId, nowDate } from "../helpers";

/** voice is for OPS-374; chat, text and email for OPS-414. */
export const leadDeskSubjectTypes = ["quote", "contact", "voice", "chat", "text", "email"] as const;
export const leadDeskPointerStates = ["sent", "failed", "not_stored"] as const;

export const leadDesk = sqliteTable(
  "lead_desk",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    subjectType: text("subject_type", { enum: leadDeskSubjectTypes }).notNull(),
    /** The quote or inquiry id; "ns-<uuid>" for a lead that was not stored. */
    subjectId: text("subject_id").notNull(),
    /** The board's Source word: Quote, Contact, Form. */
    source: text("source").notNull(),
    receivedAt: integer("received_at", { mode: "timestamp_ms" }).notNull(),
    replyDueAt: integer("reply_due_at", { mode: "timestamp_ms" }),
    slaAlertedAt: integer("sla_alerted_at", { mode: "timestamp_ms" }),
    pointer: text("pointer", { enum: leadDeskPointerStates }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(nowDate),
  },
  (t) => [
    index("lead_desk_subject_due_idx").on(t.subjectType, t.replyDueAt),
    index("lead_desk_created_idx").on(t.createdAt),
    enumCheck("lead_desk_subject_type_enum", t.subjectType, leadDeskSubjectTypes),
    enumCheck("lead_desk_pointer_enum", t.pointer, leadDeskPointerStates),
  ],
);
