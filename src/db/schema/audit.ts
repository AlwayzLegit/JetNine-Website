import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

// ─── audit_log ───────────────────────────────────────────────────────────
// Append-only event log. Every state-changing Server Action drops a row.
// Used for Part 295 compliance + operational debugging + member dispute
// arbitration ("you said you cancelled at 14:32, here's the row").
//
// subject is polymorphic — the union of every entity type we audit.
// subject_code caches a human ref (JN-2026-NNNN etc.) so the admin audit
// view doesn't need a join to reconstruct readable history.

export const auditSubjectTypeEnum = pgEnum("audit_subject_type", [
  "quote",
  "trip",
  "invoice",
  "member",
  "membership",
  "reserve_transaction",
  "operator",
  "aircraft",
  "empty_leg",
  "empty_leg_watchlist",
  "contact_inquiry",
  "preferences",
  "user_role",
  "system",
]);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorRole: text("actor_role"),

    action: text("action").notNull(),
    subjectType: auditSubjectTypeEnum("subject_type").notNull(),
    subjectId: uuid("subject_id"),
    subjectCode: text("subject_code"),

    diff: jsonb("diff").$type<Record<string, unknown> | null>(),
    metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),

    ip: text("ip"),
    userAgent: text("user_agent"),

    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("audit_log_subject_idx").on(t.subjectType, t.subjectId, t.occurredAt),
    index("audit_log_actor_idx").on(t.actorUserId, t.occurredAt),
    index("audit_log_occurred_idx").on(t.occurredAt),
  ],
);

// ─── messages ────────────────────────────────────────────────────────────
// Polymorphic CRM thread. Every quote / trip / member can carry a thread;
// the dispatcher's inbox + member-facing comms both read from here.

export const messageChannelEnum = pgEnum("message_channel", [
  "sms",
  "email",
  "call",
  "voicemail",
  "inapp",
  "system",
  "whatsapp",
]);

export const messageDirectionEnum = pgEnum("message_direction", ["in", "out"]);

export const messageDeliveryStatusEnum = pgEnum("message_delivery_status", [
  "queued",
  "sent",
  "failed",
  "skipped",
]);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    subjectType: auditSubjectTypeEnum("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),

    channel: messageChannelEnum("channel").notNull(),
    direction: messageDirectionEnum("direction").notNull(),

    fromAddress: text("from_address"),
    toAddress: text("to_address"),
    fromUserId: uuid("from_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    toUserId: uuid("to_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    preview: text("preview"),
    body: text("body"),

    isRead: boolean("is_read").notNull().default(false),

    // Delivery tracking — populated by the action that posts the message
    // after the email / SMS provider call returns. See migration 0028
    // for status semantics.
    deliveryStatus: messageDeliveryStatusEnum("delivery_status").notNull().default("skipped"),
    deliveryProvider: text("delivery_provider"),
    deliveryMessageId: text("delivery_message_id"),
    deliveryError: text("delivery_error"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),

    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("messages_subject_idx").on(t.subjectType, t.subjectId, t.occurredAt),
    index("messages_unread_idx").on(t.isRead, t.toUserId),
    index("messages_delivery_status_idx").on(t.deliveryStatus, t.occurredAt),
  ],
);

export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
