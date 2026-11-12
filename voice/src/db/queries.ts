import { withDb } from "./client.js";

export type TranscriptTurn = {
  role: "user" | "assistant" | "system";
  text: string;
  at: string;
  /** Set on assistant turns the caller cut off; text is what was actually heard. */
  interrupted?: boolean;
};

export type CallOutcome = "lead" | "message" | "escalated" | "abandoned" | "other";

export type LeadRow = { id: string; phone: string; name: string | null; email: string | null };
export type TripRow = {
  id: string;
  origin: string | null;
  destination: string | null;
  depart_date: string | null;
  /** YYYY-MM-DD */
  depart_date_iso: string | null;
  return_date: string | null;
  pax: number | null;
  status: string;
  /** ISO 8601 */
  created_at: string;
};

export type CallRow = {
  id: string;
  lead_id: string | null;
  from_number: string | null;
  summary: string | null;
  transcript: TranscriptTurn[];
  outcome: CallOutcome | null;
};

export async function createCall(input: { callSid: string; from: string; to: string }): Promise<string> {
  return withDb(async (sql) => {
    const [row] = await sql<{ id: string }[]>`
      insert into voice_calls (call_sid, from_number, to_number)
      values (${input.callSid}, ${input.from}, ${input.to})
      on conflict (call_sid) do update
        set from_number = excluded.from_number, to_number = excluded.to_number
      returning id`;
    return row.id;
  });
}

/** Returning-caller match: most recent lead for this number plus its open trips. */
export async function lookupCaller(phone: string): Promise<{ lead: LeadRow | null; trips: TripRow[] }> {
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
}

/** A trip counts as active when it is not closed and has not departed. */
export function activeTrips(trips: TripRow[]): TripRow[] {
  const today = new Date().toISOString().slice(0, 10);
  return trips.filter(
    (t) =>
      !["closed", "cancelled", "flown", "lost"].includes(t.status) &&
      (!t.depart_date_iso || t.depart_date_iso >= today),
  );
}

export async function upsertLead(input: {
  leadId?: string | null;
  phone: string;
  name?: string | null;
  email?: string | null;
}): Promise<string> {
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
}

export type TripFields = Partial<{
  origin: string;
  destination: string;
  depart_date: string;
  depart_date_iso: string | null;
  return_date: string;
  return_date_iso: string | null;
  trip_type: string;
  pax: number;
  urgency: string;
  notes: string;
}>;

const TRIP_COLUMNS = [
  "origin",
  "destination",
  "depart_date",
  "depart_date_iso",
  "return_date",
  "return_date_iso",
  "trip_type",
  "pax",
  "urgency",
  "notes",
] as const;

export async function upsertTripRequest(input: {
  tripId?: string | null;
  leadId: string;
  callId: string;
  fields: TripFields;
}): Promise<string> {
  // Only columns the model actually filled in, and only known ones.
  const clean: Record<string, string | number> = {};
  for (const col of TRIP_COLUMNS) {
    const v = input.fields[col];
    if (v !== undefined && v !== null && v !== "") clean[col] = v;
  }
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
}

export async function saveMessage(input: {
  callId: string;
  name?: string | null;
  company?: string | null;
  reason: string;
  callback?: string | null;
}): Promise<void> {
  await withDb(
    (sql) => sql`
      insert into voice_messages (call_id, name, company, reason, callback)
      values (${input.callId}, ${input.name ?? null}, ${input.company ?? null}, ${input.reason}, ${input.callback ?? null})`,
  );
}

/** Columns a call row may be patched with after it was created. */
export type CallPatch = Partial<{
  ended_at: string;
  duration_seconds: number;
  outcome: CallOutcome;
  transcript: TranscriptTurn[];
  lead_id: string | null;
  summary: string | null;
  escalation_reason: string | null;
  returning_caller: boolean;
}>;

export async function updateCall(callId: string, patch: CallPatch): Promise<void> {
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
}

export async function finalizeCall(input: {
  callId: string;
  outcome: CallOutcome;
  transcript: TranscriptTurn[];
  leadId?: string | null;
  summary?: string | null;
  escalationReason?: string | null;
  startedAt: Date;
}): Promise<void> {
  const endedAt = new Date();
  await updateCall(input.callId, {
    ended_at: endedAt.toISOString(),
    duration_seconds: Math.round((endedAt.getTime() - input.startedAt.getTime()) / 1000),
    outcome: input.outcome,
    transcript: input.transcript,
    lead_id: input.leadId ?? null,
    summary: input.summary ?? null,
    escalation_reason: input.escalationReason ?? null,
  });
}

export async function setRecording(callSid: string, recordingSid: string, recordingUrl: string): Promise<void> {
  await withDb(
    (sql) => sql`
      update voice_calls
      set recording_sid = ${recordingSid}, recording_url = ${recordingUrl}, updated_at = now()
      where call_sid = ${callSid}`,
  );
}

export async function getCallBySid(callSid: string): Promise<CallRow | null> {
  return withDb(async (sql) => {
    const [row] = await sql<CallRow[]>`
      select id, lead_id, from_number, summary, transcript, outcome
      from voice_calls where call_sid = ${callSid} limit 1`;
    return row ?? null;
  });
}
