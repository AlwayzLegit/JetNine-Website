import { desc, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { voiceCalls } from "@/db/d1/schema/voice-calls";
import type { CallNotesStore, VoiceCallRow } from "./call-notes-store";

// The D1 (SQLite) side of the call notes store (OPS-129). Same method and the same result as
// call-notes-store-pg.ts, on the D1 twin tables (src/db/d1/schema/voice-calls.ts). The client is
// passed in so a test can hand it a real SQLite.
//
// SQLite has no LATERAL join, so the latest message of each call is read with two correlated
// subqueries, ordered by created_at and then by rowid so a tie gives one message to both
// columns. started_at comes back as a Date and returning_caller as a boolean (drizzle maps them).

type D1Client = DrizzleD1Database;

const latestMessage = (column: "reason" | "callback") =>
  sql<string | null>`(
    select ${sql.raw(column)} from voice_messages
    where voice_messages.call_id = voice_calls.id
    order by voice_messages.created_at desc, voice_messages.rowid desc
    limit 1
  )`;

export function d1CallNotesStore(db: D1Client): CallNotesStore {
  return {
    async recentCalls(limit) {
      const rows: VoiceCallRow[] = await db
        .select({
          id: voiceCalls.id,
          from_number: voiceCalls.fromNumber,
          started_at: voiceCalls.startedAt,
          duration_seconds: voiceCalls.durationSeconds,
          outcome: voiceCalls.outcome,
          summary: voiceCalls.summary,
          escalation_reason: voiceCalls.escalationReason,
          recording_url: voiceCalls.recordingUrl,
          returning_caller: voiceCalls.returningCaller,
          message_reason: latestMessage("reason"),
          message_callback: latestMessage("callback"),
        })
        .from(voiceCalls)
        .orderBy(desc(voiceCalls.startedAt))
        .limit(limit);
      return rows;
    },
  };
}
