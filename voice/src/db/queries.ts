import { db } from "./client.js";

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
  depart_date_iso: string | null;
  return_date: string | null;
  pax: number | null;
  status: string;
  created_at: string;
};

export async function createCall(input: { callSid: string; from: string; to: string }) {
  const { data, error } = await db
    .from("voice_calls")
    .upsert(
      { call_sid: input.callSid, from_number: input.from, to_number: input.to },
      { onConflict: "call_sid" },
    )
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Returning-caller match: most recent lead for this number plus its open trips. */
export async function lookupCaller(phone: string): Promise<{ lead: LeadRow | null; trips: TripRow[] }> {
  const { data: lead } = await db
    .from("voice_leads")
    .select("id, phone, name, email")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!lead) return { lead: null, trips: [] };
  const { data: trips } = await db
    .from("voice_trip_requests")
    .select("id, origin, destination, depart_date, depart_date_iso, return_date, pax, status, created_at")
    .eq("lead_id", lead.id)
    .order("created_at", { ascending: false })
    .limit(5);
  return { lead: lead as LeadRow, trips: (trips ?? []) as TripRow[] };
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
  if (input.leadId) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.name) patch.name = input.name;
    if (input.email) patch.email = input.email;
    if (input.phone) patch.phone = input.phone;
    const { error } = await db.from("voice_leads").update(patch).eq("id", input.leadId);
    if (error) throw error;
    return input.leadId;
  }
  const { data, error } = await db
    .from("voice_leads")
    .insert({ phone: input.phone, name: input.name ?? null, email: input.email ?? null })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function upsertTripRequest(input: {
  tripId?: string | null;
  leadId: string;
  callId: string;
  fields: Partial<{
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
}): Promise<string> {
  const clean = Object.fromEntries(
    Object.entries(input.fields).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );
  if (input.tripId) {
    const { error } = await db
      .from("voice_trip_requests")
      .update({ ...clean, updated_at: new Date().toISOString() })
      .eq("id", input.tripId);
    if (error) throw error;
    return input.tripId;
  }
  const { data, error } = await db
    .from("voice_trip_requests")
    .insert({ lead_id: input.leadId, call_id: input.callId, ...clean })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function saveMessage(input: {
  callId: string;
  name?: string | null;
  company?: string | null;
  reason: string;
  callback?: string | null;
}) {
  const { error } = await db.from("voice_messages").insert({
    call_id: input.callId,
    name: input.name ?? null,
    company: input.company ?? null,
    reason: input.reason,
    callback: input.callback ?? null,
  });
  if (error) throw error;
}

export async function updateCall(callId: string, patch: Record<string, unknown>) {
  const { error } = await db
    .from("voice_calls")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", callId);
  if (error) throw error;
}

export async function finalizeCall(input: {
  callId: string;
  outcome: CallOutcome;
  transcript: TranscriptTurn[];
  leadId?: string | null;
  summary?: string | null;
  escalationReason?: string | null;
  startedAt: Date;
}) {
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

export async function setRecording(callSid: string, recordingSid: string, recordingUrl: string) {
  const { error } = await db
    .from("voice_calls")
    .update({ recording_sid: recordingSid, recording_url: recordingUrl, updated_at: new Date().toISOString() })
    .eq("call_sid", callSid);
  if (error) throw error;
}

export async function getCallBySid(callSid: string) {
  const { data } = await db
    .from("voice_calls")
    .select("id, lead_id, from_number, summary, transcript, outcome")
    .eq("call_sid", callSid)
    .maybeSingle();
  return data;
}
