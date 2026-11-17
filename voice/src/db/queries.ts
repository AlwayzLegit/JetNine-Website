import { store } from "./store.js";
import { TRIP_COLUMNS, type CallOutcome, type CallPatch, type CallRow, type LeadRow, type TranscriptTurn, type TripFields, type TripRow } from "./types.js";

// The voice Worker's database operations. The SQL lives in the store (store-pg.ts,
// store-d1.ts), chosen by DB_TARGET (OPS-137); the names and types below are what
// the rest of the Worker imports, and they did not change.
export type { CallOutcome, CallPatch, CallRow, LeadRow, TranscriptTurn, TripFields, TripRow };

export async function createCall(input: { callSid: string; from: string; to: string }): Promise<string> {
  return store().createCall(input);
}

/** Returning-caller match: most recent lead for this number plus its open trips. */
export async function lookupCaller(phone: string): Promise<{ lead: LeadRow | null; trips: TripRow[] }> {
  return store().lookupCaller(phone);
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
  return store().upsertLead(input);
}

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
  return store().upsertTripRequest({ ...input, fields: clean as TripFields });
}

export async function saveMessage(input: {
  callId: string;
  name?: string | null;
  company?: string | null;
  reason: string;
  callback?: string | null;
}): Promise<void> {
  await store().saveMessage(input);
}

export async function updateCall(callId: string, patch: CallPatch): Promise<void> {
  await store().updateCall(callId, patch);
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
  await store().setRecording(callSid, recordingSid, recordingUrl);
}

export async function getCallBySid(callSid: string): Promise<CallRow | null> {
  return store().getCallBySid(callSid);
}
