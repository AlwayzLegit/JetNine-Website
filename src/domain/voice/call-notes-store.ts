import { d1Db, dbTarget } from "@/db";
import { d1CallNotesStore } from "./call-notes-store-d1";
import { pgCallNotesStore } from "./call-notes-store-pg";

// The call notes domain's one door to the phone line's log (OPS-129): the admin Messages
// Calls tab and GET /api/v1/messages/calls read the newest calls with their latest message
// through a CallNotesStore. There is one adapter per database, chosen per request by
// dbTarget(): Postgres until the move, D1 where DB_TARGET is "d1" (staging first; the code
// refuses "d1" in production, see src/db/target.mjs).
//
// The four tables (voice_leads, voice_calls, voice_trip_requests, voice_messages) are written by
// the voice Worker in voice/, which keeps writing Postgres until its own row. So on staging the
// Calls tab shows only what the last D1 copy carried.

/** One call on the Calls tab. Field names are the SQL column names, as the v1 route returns them. */
export type VoiceCallRow = {
  id: string;
  from_number: string | null;
  started_at: Date;
  duration_seconds: number | null;
  outcome: string | null;
  summary: string | null;
  escalation_reason: string | null;
  recording_url: string | null;
  returning_caller: boolean;
  message_reason: string | null;
  message_callback: string | null;
};

export interface CallNotesStore {
  /** The newest `limit` calls (by start time), each with the reason and callback of its latest message. */
  recentCalls(limit: number): Promise<VoiceCallRow[]>;
}

/** The store for this request. One call per request; nothing is cached across requests. */
export function callNotesStore(): CallNotesStore {
  if (dbTarget() === "d1") {
    const client = d1Db();
    if (!client) throw new Error("DB_TARGET is d1 but the DB binding is missing");
    return d1CallNotesStore(client);
  }
  return pgCallNotesStore();
}
