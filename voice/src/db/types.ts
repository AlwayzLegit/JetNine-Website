// Row and input shapes of the voice tables, shared by the store's two sides
// (store-pg.ts, store-d1.ts) and the callers. queries.ts re-exports them, so
// every existing import keeps working.

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

/** The only trip columns a call may fill in. A column list is built from this and nothing else. */
export const TRIP_COLUMNS = [
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

/** The only call columns updateCall may write. Same rule: never built from input keys. */
export const CALL_PATCH_COLUMNS = [
  "ended_at",
  "duration_seconds",
  "outcome",
  "transcript",
  "lead_id",
  "summary",
  "escalation_reason",
  "returning_caller",
] as const;

/** A voice_agents row, config as stored (parsed by agent-config.ts). */
export type AgentRow = { id: string; name: string; version: number; config: unknown };

export type ProviderRow = {
  id: string;
  provider: "anthropic" | "openai";
  label: string;
  api_key_enc: string;
  default_model: string;
  enabled: boolean;
};

export type RouteRow = { primary_provider_id: string | null; fallback_provider_id: string | null };

/** The ai_routes row for the voice agent plus the providers it names (none when unrouted). */
export type VoiceRouteData = { route: RouteRow | undefined; rows: ProviderRow[] };
