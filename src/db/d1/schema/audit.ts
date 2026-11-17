// D1 (SQLite) twin of src/db/schema/audit.ts (OPS-100). Same export names, same SQL table
// and column names. Mapping: see DEPLOY.md "D1 tables (OPS-100)".
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { enumCheck, newId, nowDate } from "../helpers";
import { auditSubjectTypeEnum, messageChannelEnum, messageDirectionEnum, messageDeliveryStatusEnum } from "../../schema/audit";
import { users } from "./users";

// ─── audit_log ───────────────────────────────────────────────────────────
// Append-only event log. Every state-changing Server Action drops a row.
// Used for Part 295 compliance + operational debugging + member dispute
// arbitration ("you said you cancelled at 14:32, here's the row").
//
// subject is polymorphic — the union of every entity type we audit.
// subject_code caches a human ref (JN-2026-NNNN etc.) so the admin audit
// view doesn't need a join to reconstruct readable history.


export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey().$defaultFn(newId),

    actorUserId: text("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorRole: text("actor_role"),

    action: text("action").notNull(),
    subjectType: text("subject_type", { enum: auditSubjectTypeEnum.enumValues }).notNull(),
    subjectId: text("subject_id"),
    subjectCode: text("subject_code"),

    diff: text("diff", { mode: "json" }).$type<Record<string, unknown> | null>(),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown> | null>(),

    ip: text("ip"),
    userAgent: text("user_agent"),

    occurredAt: integer("occurred_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
  },
  (t) => [
    index("audit_log_subject_idx").on(t.subjectType, t.subjectId, t.occurredAt),
    index("audit_log_actor_idx").on(t.actorUserId, t.occurredAt),
    index("audit_log_occurred_idx").on(t.occurredAt),
    enumCheck("audit_log_subject_type_enum", t.subjectType, auditSubjectTypeEnum.enumValues),
  ]);

// ─── messages ────────────────────────────────────────────────────────────
// Polymorphic CRM thread. Every quote / trip / member can carry a thread;
// the dispatcher's inbox + member-facing comms both read from here.

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey().$defaultFn(newId),

    subjectType: text("subject_type", { enum: auditSubjectTypeEnum.enumValues }).notNull(),
    subjectId: text("subject_id").notNull(),

    channel: text("channel", { enum: messageChannelEnum.enumValues }).notNull(),
    direction: text("direction", { enum: messageDirectionEnum.enumValues }).notNull(),

    fromAddress: text("from_address"),
    toAddress: text("to_address"),
    fromUserId: text("from_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    toUserId: text("to_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    preview: text("preview"),
    body: text("body"),

    isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),

    // Delivery tracking — populated by the action that posts the message
    // after the email / SMS provider call returns. See migration 0028
    // for status semantics.
    deliveryStatus: text("delivery_status", { enum: messageDeliveryStatusEnum.enumValues }).notNull().default("skipped"),
    deliveryProvider: text("delivery_provider"),
    deliveryMessageId: text("delivery_message_id"),
    deliveryError: text("delivery_error"),
    deliveredAt: integer("delivered_at", { mode: "timestamp_ms" }),

    occurredAt: integer("occurred_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(nowDate),
  },
  (t) => [
    index("messages_subject_idx").on(t.subjectType, t.subjectId, t.occurredAt),
    index("messages_unread_idx").on(t.isRead, t.toUserId),
    index("messages_delivery_status_idx").on(t.deliveryStatus, t.occurredAt),
    // Inbound idempotency (OPS-127), the twin of Postgres migration 0029: a
    // webhook retried by the provider must not land twice. Partial, because the
    // column also holds outbound provider ids, where uniqueness is not wanted.
    uniqueIndex("messages_inbound_provider_id_uq")
      .on(t.deliveryMessageId)
      .where(sql`${t.direction} = 'in' and ${t.deliveryMessageId} is not null`),
    enumCheck("messages_subject_type_enum", t.subjectType, auditSubjectTypeEnum.enumValues),
    enumCheck("messages_channel_enum", t.channel, messageChannelEnum.enumValues),
    enumCheck("messages_direction_enum", t.direction, messageDirectionEnum.enumValues),
    enumCheck("messages_delivery_status_enum", t.deliveryStatus, messageDeliveryStatusEnum.enumValues),
  ]);

