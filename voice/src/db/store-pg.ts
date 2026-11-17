import { withDb } from "./client.js";
import type { VoiceStore } from "./store.js";
import type { AgentRow, CallPatch, CallRow, LeadRow, ProviderRow, RouteRow, TripRow } from "./types.js";

// The Postgres side of the voice store: the SQL the Worker has always run,
// moved here unchanged (OPS-137). Production uses this side.

export const pgStore: VoiceStore = {
  async createCall(input) {
    return withDb(async (sql) => {
      const [row] = await sql<{ id: string }[]>`
        insert into voice_calls (call_sid, from_number, to_number)
        values (${input.callSid}, ${input.from}, ${input.to})
        on conflict (call_sid) do update
          set from_number = excluded.from_number, to_number = excluded.to_number
        returning id`;
      return row.id;
    });
  },

  async lookupCaller(phone) {
    return withDb(async (sql) => {
      const [lead] = await sql<LeadRow[]>`
        select id, phone, name, email from voice_leads
        where phone = ${phone}
        order by created_at desc limit 1`;
      if (!lead) return { lead: null, trips: [] };
      // Dates come back as text so callers can compare them as before.
      const trips = await sql<TripRow[]>`
        select id, origin, destination, depart_date, depart_date_iso::text, return_date, pax, status,
               to_json(created_at) #>> '{}' as created_at
        from voice_trip_requests
        where lead_id = ${lead.id}
        order by created_at desc limit 5`;
      return { lead, trips };
    });
  },

  async upsertLead(input) {
    return withDb(async (sql) => {
      if (input.leadId) {
        await sql`
          update voice_leads set
            name = coalesce(${input.name || null}, name),
            email = coalesce(${input.email || null}, email),
            phone = coalesce(${input.phone || null}, phone),
            updated_at = now()
          where id = ${input.leadId}`;
        return input.leadId;
      }
      const [row] = await sql<{ id: string }[]>`
        insert into voice_leads (phone, name, email)
        values (${input.phone}, ${input.name ?? null}, ${input.email ?? null})
        returning id`;
      return row.id;
    });
  },

  async upsertTripRequest(input) {
    // `fields` was cleaned by queries.ts: allow-listed columns, no empty values.
    const clean = input.fields as Record<string, string | number>;
    const cols = Object.keys(clean);
    return withDb(async (sql) => {
      if (input.tripId) {
        if (cols.length > 0) {
          await sql`update voice_trip_requests set ${sql(clean, ...cols)}, updated_at = now() where id = ${input.tripId}`;
        } else {
          await sql`update voice_trip_requests set updated_at = now() where id = ${input.tripId}`;
        }
        return input.tripId;
      }
      const row: Record<string, string | number> = { lead_id: input.leadId, call_id: input.callId, ...clean };
      const [inserted] = await sql<{ id: string }[]>`
        insert into voice_trip_requests ${sql(row, ...Object.keys(row))} returning id`;
      return inserted.id;
    });
  },

  async saveMessage(input) {
    await withDb(
      (sql) => sql`
        insert into voice_messages (call_id, name, company, reason, callback)
        values (${input.callId}, ${input.name ?? null}, ${input.company ?? null}, ${input.reason}, ${input.callback ?? null})`,
    );
  },

  async updateCall(callId, patch: CallPatch) {
    const set: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      // A JS array would be sent as a Postgres array; the transcript is jsonb.
      set[k] = k === "transcript" ? JSON.stringify(v) : v;
    }
    const cols = Object.keys(set);
    await withDb((sql) =>
      cols.length > 0
        ? sql`update voice_calls set ${sql(set, ...cols)}, updated_at = now() where id = ${callId}`
        : sql`update voice_calls set updated_at = now() where id = ${callId}`,
    );
  },

  async setRecording(callSid, recordingSid, recordingUrl) {
    await withDb(
      (sql) => sql`
        update voice_calls
        set recording_sid = ${recordingSid}, recording_url = ${recordingUrl}, updated_at = now()
        where call_sid = ${callSid}`,
    );
  },

  async getCallBySid(callSid) {
    return withDb(async (sql) => {
      const [row] = await sql<CallRow[]>`
        select id, lead_id, from_number, summary, transcript, outcome
        from voice_calls where call_sid = ${callSid} limit 1`;
      return row ?? null;
    });
  },

  async liveAgentRow() {
    const [row] = await withDb(
      (sql) => sql<AgentRow[]>`
        select id, name, version, config from voice_agents
        where is_live and archived_at is null limit 1`,
    );
    return row ?? null;
  },

  async agentRowById(id) {
    const [row] = await withDb((sql) => sql<AgentRow[]>`select id, name, version, config from voice_agents where id = ${id} limit 1`);
    return row ?? null;
  },

  async voiceRoute() {
    return withDb(async (sql) => {
      const [route] = await sql<RouteRow[]>`
        select primary_provider_id, fallback_provider_id from ai_routes where purpose = 'voice_agent' limit 1`;
      const ids = [route?.primary_provider_id, route?.fallback_provider_id].filter(
        (v): v is string => typeof v === "string" && v.length > 0,
      );
      const rows =
        ids.length === 0
          ? []
          : await sql<ProviderRow[]>`
              select id, provider, label, api_key_enc, default_model, enabled
              from ai_providers where id in ${sql(ids)}`;
      return { route, rows };
    });
  },

  async ping() {
    await withDb((sql) => sql`select 1`);
  },
};
