import { sql } from "@/db";
import type { CallNotesStore, VoiceCallRow } from "./call-notes-store";

// The Postgres side of the call notes store (OPS-129): the query that lived in
// listCallNotes(), moved as it was. The voice tables are raw SQL (migration 0038), in no
// Drizzle schema.

export function pgCallNotesStore(): CallNotesStore {
  return {
    async recentCalls(limit) {
      const rows = await sql<(Omit<VoiceCallRow, "started_at"> & { started_at: string | Date })[]>`
        select c.id, c.from_number, c.started_at, c.duration_seconds, c.outcome,
               c.summary, c.escalation_reason, c.recording_url, c.returning_caller,
               m.reason as message_reason, m.callback as message_callback
        from public.voice_calls c
        left join lateral (
          select reason, callback from public.voice_messages
          where call_id = c.id
          order by created_at desc limit 1
        ) m on true
        order by c.started_at desc
        limit ${limit}
      `;
      return rows.map((r) => ({ ...r, started_at: new Date(r.started_at) }));
    },
  };
}
