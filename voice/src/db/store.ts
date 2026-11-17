import { env } from "cloudflare:workers";
import { vars } from "../env.js";
import { parseDbTarget, type DbTarget } from "./target.js";
import { pgConfigured } from "./client.js";
import { pgStore } from "./store-pg.js";
import { d1Store } from "./store-d1.js";
import type {
  AgentRow,
  CallPatch,
  CallRow,
  LeadRow,
  TripFields,
  TripRow,
  VoiceRouteData,
} from "./types.js";

// Every query the voice Worker makes goes through this one interface, so the
// Worker can run on Postgres (today's SQL, Hyperdrive) or on D1 (OPS-137, the
// D1 move OPS-93) from a single setting. The side is chosen per call from
// DB_TARGET and DEPLOY_ENV, by the site's rule (see target.ts): production
// stays on Postgres.

export interface VoiceStore {
  createCall(input: { callSid: string; from: string; to: string }): Promise<string>;
  /** Most recent lead for this number plus its five newest trips (created_at as ISO text). */
  lookupCaller(phone: string): Promise<{ lead: LeadRow | null; trips: TripRow[] }>;
  upsertLead(input: { leadId?: string | null; phone: string; name?: string | null; email?: string | null }): Promise<string>;
  /** `fields` holds only allow-listed, non-empty columns (queries.ts cleans them). */
  upsertTripRequest(input: { tripId?: string | null; leadId: string; callId: string; fields: TripFields }): Promise<string>;
  saveMessage(input: {
    callId: string;
    name?: string | null;
    company?: string | null;
    reason: string;
    callback?: string | null;
  }): Promise<void>;
  updateCall(callId: string, patch: CallPatch): Promise<void>;
  setRecording(callSid: string, recordingSid: string, recordingUrl: string): Promise<void>;
  getCallBySid(callSid: string): Promise<CallRow | null>;
  /** The live, unarchived voice agent, or null. */
  liveAgentRow(): Promise<AgentRow | null>;
  agentRowById(id: string): Promise<AgentRow | null>;
  /** ai_routes for purpose voice_agent and the ai_providers rows it names. */
  voiceRoute(): Promise<VoiceRouteData>;
  /** One `select 1`; throws when the database does not answer. */
  ping(): Promise<void>;
}

type Bindings = { DB?: D1Database };
const bindings = (): Bindings => env as unknown as Bindings;

/** The side this Worker uses right now. Read on every call so tests can switch it. */
export const dbTarget = (): DbTarget => parseDbTarget(vars.DB_TARGET, vars.DEPLOY_ENV);

/** True when the chosen side's binding exists (DB for D1, HYPERDRIVE for Postgres). */
export const dbConfigured = (): boolean => (dbTarget() === "d1" ? bindings().DB !== undefined : pgConfigured());

/** Name of the binding the chosen side needs, for the missing-config report on /health. */
export const dbBindingName = (): "DB" | "HYPERDRIVE" => (dbTarget() === "d1" ? "DB" : "HYPERDRIVE");

/**
 * The store for the chosen side. Target d1 with no DB binding throws here,
 * loudly, instead of quietly reading an empty database.
 */
export function store(): VoiceStore {
  if (dbTarget() === "d1") {
    const db = bindings().DB;
    if (!db) throw new Error("Database is not configured (DB binding, DB_TARGET=d1)");
    return d1Store(db);
  }
  return pgStore;
}

/** The /health field: which side, and whether one `select 1` answered within `limitMs`. */
export async function dbHealth(limitMs = 3000): Promise<{ target: DbTarget; ok: boolean }> {
  const target = dbTarget();
  if (!dbConfigured()) return { target, ok: false };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      store().ping(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("database ping timed out")), limitMs);
      }),
    ]);
    return { target, ok: true };
  } catch {
    return { target, ok: false };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
