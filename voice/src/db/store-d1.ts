import type { VoiceStore } from "./store.js";
import {
  CALL_PATCH_COLUMNS,
  TRIP_COLUMNS,
  type AgentRow,
  type CallPatch,
  type CallRow,
  type LeadRow,
  type ProviderRow,
  type RouteRow,
  type TranscriptTurn,
  type TripRow,
} from "./types.js";

// The D1 side of the voice store (OPS-137): the same operations over the
// Worker's DB binding (staging D1 today, the site's D1 after the cutover).
// Mapping, the same as the site's D1 twins (DEPLOY.md "D1 tables (OPS-100)"):
// ids are made here (crypto.randomUUID), times are integer milliseconds made
// here, the transcript is JSON text, booleans are 0/1. Values always go in as
// bound parameters; column names come only from the fixed lists in types.ts.

const newId = () => crypto.randomUUID();
const now = () => Date.now();

/** Read a JSON text column back; anything unreadable is the fallback. */
function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return (value as T) ?? fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

type TripDbRow = Omit<TripRow, "created_at"> & { created_at: number };
type CallDbRow = Omit<CallRow, "transcript"> & { transcript: string | null };
type AgentDbRow = Omit<AgentRow, "config"> & { config: unknown };
type ProviderDbRow = Omit<ProviderRow, "enabled"> & { enabled: number };

export function d1Store(db: D1Database): VoiceStore {
  return {
    async createCall(input) {
      const t = now();
      const row = await db
        .prepare(
          `insert into voice_calls (id, call_sid, from_number, to_number, started_at, created_at, updated_at)
           values (?, ?, ?, ?, ?, ?, ?)
           on conflict (call_sid) do update
             set from_number = excluded.from_number, to_number = excluded.to_number
           returning id`,
        )
        .bind(newId(), input.callSid, input.from, input.to, t, t, t)
        .first<{ id: string }>();
      if (!row) throw new Error("createCall: no row returned");
      return row.id;
    },

    async lookupCaller(phone) {
      // rowid breaks a tie between two rows made in the same millisecond: the later insert wins.
      const lead = await db
        .prepare(`select id, phone, name, email from voice_leads where phone = ? order by created_at desc, rowid desc limit 1`)
        .bind(phone)
        .first<LeadRow>();
      if (!lead) return { lead: null, trips: [] };
      const { results } = await db
        .prepare(
          `select id, origin, destination, depart_date, depart_date_iso, return_date, pax, status, created_at
           from voice_trip_requests where lead_id = ? order by created_at desc, rowid desc limit 5`,
        )
        .bind(lead.id)
        .all<TripDbRow>();
      // created_at is milliseconds here; callers get ISO text, as from Postgres.
      const trips: TripRow[] = results.map((r) => ({ ...r, created_at: new Date(r.created_at).toISOString() }));
      return { lead, trips };
    },

    async upsertLead(input) {
      const t = now();
      if (input.leadId) {
        await db
          .prepare(
            `update voice_leads set
               name = coalesce(?, name),
               email = coalesce(?, email),
               phone = coalesce(?, phone),
               updated_at = ?
             where id = ?`,
          )
          .bind(input.name || null, input.email || null, input.phone || null, t, input.leadId)
          .run();
        return input.leadId;
      }
      const id = newId();
      await db
        .prepare(`insert into voice_leads (id, phone, name, email, created_at, updated_at) values (?, ?, ?, ?, ?, ?)`)
        .bind(id, input.phone, input.name ?? null, input.email ?? null, t, t)
        .run();
      return id;
    },

    async upsertTripRequest(input) {
      // Only allow-listed columns that hold a value; the list is fixed, never taken from input keys.
      const fields = input.fields as Record<string, string | number | null | undefined>;
      const cols = TRIP_COLUMNS.filter((c) => fields[c] !== undefined && fields[c] !== null && fields[c] !== "");
      const values = cols.map((c) => fields[c] as string | number);
      const t = now();
      if (input.tripId) {
        const sets = [...cols.map((c) => `${c} = ?`), "updated_at = ?"].join(", ");
        await db
          .prepare(`update voice_trip_requests set ${sets} where id = ?`)
          .bind(...values, t, input.tripId)
          .run();
        return input.tripId;
      }
      const id = newId();
      const names = ["id", "lead_id", "call_id", ...cols, "created_at", "updated_at"];
      await db
        .prepare(`insert into voice_trip_requests (${names.join(", ")}) values (${names.map(() => "?").join(", ")})`)
        .bind(id, input.leadId, input.callId, ...values, t, t)
        .run();
      return id;
    },

    async saveMessage(input) {
      await db
        .prepare(`insert into voice_messages (id, call_id, name, company, reason, callback, created_at) values (?, ?, ?, ?, ?, ?, ?)`)
        .bind(newId(), input.callId, input.name ?? null, input.company ?? null, input.reason, input.callback ?? null, now())
        .run();
    },

    async updateCall(callId, patch: CallPatch) {
      const sets: string[] = [];
      const values: (string | number | null)[] = [];
      for (const col of CALL_PATCH_COLUMNS) {
        const v = patch[col];
        if (v === undefined) continue;
        sets.push(`${col} = ?`);
        if (col === "transcript") values.push(JSON.stringify(v));
        else if (col === "returning_caller") values.push(v ? 1 : 0);
        else if (col === "ended_at") {
          const ms = Date.parse(v as string);
          values.push(Number.isNaN(ms) ? now() : ms);
        } else values.push(v as string | number | null);
      }
      sets.push("updated_at = ?");
      await db
        .prepare(`update voice_calls set ${sets.join(", ")} where id = ?`)
        .bind(...values, now(), callId)
        .run();
    },

    async setRecording(callSid, recordingSid, recordingUrl) {
      await db
        .prepare(`update voice_calls set recording_sid = ?, recording_url = ?, updated_at = ? where call_sid = ?`)
        .bind(recordingSid, recordingUrl, now(), callSid)
        .run();
    },

    async getCallBySid(callSid) {
      const row = await db
        .prepare(`select id, lead_id, from_number, summary, transcript, outcome from voice_calls where call_sid = ? limit 1`)
        .bind(callSid)
        .first<CallDbRow>();
      if (!row) return null;
      return { ...row, transcript: parseJson<TranscriptTurn[]>(row.transcript, []) };
    },

    async liveAgentRow() {
      const row = await db
        .prepare(`select id, name, version, config from voice_agents where is_live = 1 and archived_at is null limit 1`)
        .first<AgentDbRow>();
      return row ? { ...row, config: parseJson<unknown>(row.config, null) } : null;
    },

    async agentRowById(id) {
      const row = await db
        .prepare(`select id, name, version, config from voice_agents where id = ? limit 1`)
        .bind(id)
        .first<AgentDbRow>();
      return row ? { ...row, config: parseJson<unknown>(row.config, null) } : null;
    },

    async voiceRoute() {
      const route =
        (await db
          .prepare(`select primary_provider_id, fallback_provider_id from ai_routes where purpose = 'voice_agent' limit 1`)
          .first<RouteRow>()) ?? undefined;
      const ids = [route?.primary_provider_id, route?.fallback_provider_id].filter(
        (v): v is string => typeof v === "string" && v.length > 0,
      );
      if (ids.length === 0) return { route, rows: [] };
      // At most two ids, so the placeholder list is two question marks at most.
      const { results } = await db
        .prepare(
          `select id, provider, label, api_key_enc, default_model, enabled
           from ai_providers where id in (${ids.map(() => "?").join(", ")})`,
        )
        .bind(...ids)
        .all<ProviderDbRow>();
      return { route, rows: results.map((r) => ({ ...r, enabled: r.enabled === 1 })) };
    },

    async ping() {
      await db.prepare("select 1 as ok").first();
    },
  };
}
