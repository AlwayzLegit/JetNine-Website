// D1 (SQLite) tables for the phone line's call log (OPS-129): voice_leads, voice_calls,
// voice_trip_requests and voice_messages. They have NO Drizzle twin on Postgres: there the four
// tables are created only by raw SQL (migration 0038_voice_agent.sql) and written by the voice
// Worker in voice/. Here they are Drizzle tables so the copy tool (scripts/d1-copy) carries them
// to staging D1 and the site's call notes store reads them with typed statements. Same SQL table,
// column, index and foreign key names as 0038. Mapping: see DEPLOY.md "D1 tables (OPS-100)".
//
// The voice Worker keeps writing Postgres until its own row (OPS-93, "Rows still to file"); on
// staging these tables hold the last copy only. None of the four holds credential material.
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { enumCheck, newId, nowDate } from "../helpers";

/** The values of the Postgres enum voice_call_outcome (0038). One list, since there is no pgEnum. */
export const VOICE_CALL_OUTCOMES = ["lead", "message", "escalated", "abandoned", "other"] as const;

// ─── voice_leads ─────────────────────────────────────────────────────────

export const voiceLeads = sqliteTable(
  "voice_leads",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    phone: text("phone").notNull(),
    name: text("name"),
    email: text("email"),
    source: text("source").notNull().default("voice"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(nowDate),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(nowDate).$onUpdate(nowDate),
  },
  (t) => [index("voice_leads_phone_idx").on(t.phone)],
);

// ─── voice_calls ─────────────────────────────────────────────────────────

export const voiceCalls = sqliteTable(
  "voice_calls",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    callSid: text("call_sid").notNull(),
    fromNumber: text("from_number"),
    toNumber: text("to_number"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull().$defaultFn(nowDate),
    endedAt: integer("ended_at", { mode: "timestamp_ms" }),
    durationSeconds: integer("duration_seconds"),
    outcome: text("outcome", { enum: VOICE_CALL_OUTCOMES }),
    escalationReason: text("escalation_reason"),
    recordingSid: text("recording_sid"),
    recordingUrl: text("recording_url"),
    // [{ role: 'user'|'assistant'|'system', text, at }]
    transcript: text("transcript", { mode: "json" }).$type<unknown[]>().notNull().default([]),
    summary: text("summary"),
    leadId: text("lead_id").references(() => voiceLeads.id, { onDelete: "set null" }),
    returningCaller: integer("returning_caller", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(nowDate),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(nowDate).$onUpdate(nowDate),
  },
  (t) => [
    uniqueIndex("voice_calls_call_sid_idx").on(t.callSid),
    index("voice_calls_started_idx").on(sql`${t.startedAt} desc`),
    enumCheck("voice_calls_outcome_enum", t.outcome, VOICE_CALL_OUTCOMES),
  ],
);

// ─── voice_trip_requests ─────────────────────────────────────────────────

export const voiceTripRequests = sqliteTable(
  "voice_trip_requests",
  {
    id: text("id").primaryKey().$defaultFn(newId),
    leadId: text("lead_id")
      .notNull()
      .references(() => voiceLeads.id, { onDelete: "cascade" }),
    callId: text("call_id").references(() => voiceCalls.id, { onDelete: "set null" }),
    origin: text("origin"),
    destination: text("destination"),
    // Kept as spoken ("next Friday morning") plus a best-effort ISO date ("YYYY-MM-DD").
    departDate: text("depart_date"),
    departDateIso: text("depart_date_iso"),
    returnDate: text("return_date"),
    returnDateIso: text("return_date_iso"),
    tripType: text("trip_type"), // 'one_way' | 'round_trip'
    pax: integer("pax"),
    urgency: text("urgency"), // 'within_48h' | 'this_week' | 'flexible' | free text
    notes: text("notes"),
    status: text("status").notNull().default("new"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(nowDate),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(nowDate).$onUpdate(nowDate),
  },
  (t) => [
    index("voice_trip_requests_lead_idx").on(t.leadId),
    index("voice_trip_requests_status_idx").on(t.status, sql`${t.createdAt} desc`),
  ],
);

// ─── voice_messages ──────────────────────────────────────────────────────

export const voiceMessages = sqliteTable("voice_messages", {
  id: text("id").primaryKey().$defaultFn(newId),
  callId: text("call_id").references(() => voiceCalls.id, { onDelete: "set null" }),
  name: text("name"),
  company: text("company"),
  reason: text("reason"),
  callback: text("callback"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(nowDate),
});
