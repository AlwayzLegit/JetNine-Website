import { env } from "cloudflare:workers";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { vars } from "../src/env.js";

// The voice store on a real D1 (miniflare) with the site's D1 migrations
// (test/setup-d1.ts). Target d1 outside production, as on the staging Worker.
vars.DEPLOY_ENV = "staging";
vars.DB_TARGET = "d1";
// config.ts reads these once, when it loads (the imports below load it).
vars.PUBLIC_HOST = "voice.example.com";
vars.ANTHROPIC_API_KEY = "sk-ant-test";

const db = (env as unknown as { DB: D1Database }).DB;
const { store, dbTarget, dbHealth } = await import("../src/db/store.js");
const q = await import("../src/db/queries.js");
const { liveAgent, agentById } = await import("../src/agent-store.js");
const { resolveRouting, resetRoutingCache } = await import("../src/llm/providers.js");

const TABLES = ["voice_messages", "voice_trip_requests", "voice_calls", "voice_leads", "voice_agents", "ai_routes", "ai_providers"];

beforeEach(async () => {
  for (const t of TABLES) await db.prepare(`delete from ${t}`).run();
  resetRoutingCache();
});

afterAll(() => {
  vars.DB_TARGET = undefined;
  vars.DEPLOY_ENV = "production";
});

const count = async (table: string) => (await db.prepare(`select count(*) as n from ${table}`).first<{ n: number }>())!.n;

describe("target", () => {
  it("is d1 on staging with DB_TARGET=d1", () => {
    expect(dbTarget()).toBe("d1");
  });

  it("answers one select 1 and says which side", async () => {
    expect(await dbHealth()).toEqual({ target: "d1", ok: true });
  });
});

describe("calls", () => {
  it("createCall twice with one CallSid gives one row and the same id", async () => {
    const a = await q.createCall({ callSid: "CA1", from: "+15550001111", to: "+15550002222" });
    const b = await q.createCall({ callSid: "CA1", from: "+15550003333", to: "+15550002222" });
    expect(b).toBe(a);
    expect(await count("voice_calls")).toBe(1);
    const row = await db.prepare("select from_number, to_number, transcript, returning_caller from voice_calls").first<Record<string, unknown>>();
    expect(row).toMatchObject({ from_number: "+15550003333", to_number: "+15550002222", transcript: "[]", returning_caller: 0 });
  });

  it("updateCall writes the transcript as JSON and getCallBySid reads it back as an array", async () => {
    const id = await q.createCall({ callSid: "CA2", from: "+15550001111", to: "+15550002222" });
    const transcript = [
      { role: "user" as const, text: "Hi, I need a jet", at: "2026-11-17T22:00:00.000Z" },
      { role: "assistant" as const, text: "Of course.", at: "2026-11-17T22:00:02.000Z", interrupted: true },
    ];
    const startedAt = new Date(Date.now() - 65_000);
    await q.finalizeCall({ callId: id, outcome: "lead", transcript, summary: "Wants a jet", startedAt });
    const raw = await db.prepare("select transcript, outcome, duration_seconds, ended_at, summary from voice_calls where id = ?").bind(id).first<Record<string, unknown>>();
    expect(typeof raw!.transcript).toBe("string");
    expect(JSON.parse(raw!.transcript as string)).toEqual(transcript);
    expect(raw).toMatchObject({ outcome: "lead", summary: "Wants a jet" });
    expect(raw!.duration_seconds).toBeGreaterThanOrEqual(64);
    expect(typeof raw!.ended_at).toBe("number");

    const call = await q.getCallBySid("CA2");
    expect(call).toMatchObject({ id, outcome: "lead", summary: "Wants a jet", from_number: "+15550001111", lead_id: null });
    expect(Array.isArray(call!.transcript)).toBe(true);
    expect(call!.transcript).toEqual(transcript);
    expect(await q.getCallBySid("CA-missing")).toBeNull();
  });

  it("updateCall stores returning_caller as 0/1 and refuses an outcome outside the enum", async () => {
    const id = await q.createCall({ callSid: "CA3", from: "+1", to: "+2" });
    await q.updateCall(id, { returning_caller: true });
    expect((await db.prepare("select returning_caller from voice_calls where id = ?").bind(id).first<{ returning_caller: number }>())!.returning_caller).toBe(1);
    await expect(q.updateCall(id, { outcome: "bogus" as never })).rejects.toThrow();
  });

  it("updateCall with an empty patch only touches updated_at, and ignores keys outside its list", async () => {
    const id = await q.createCall({ callSid: "CA4", from: "+1", to: "+2" });
    await q.updateCall(id, {});
    await q.updateCall(id, { call_sid: "CA-hijack", summary: "kept" } as never);
    const row = await db.prepare("select call_sid, summary from voice_calls where id = ?").bind(id).first<Record<string, unknown>>();
    expect(row).toEqual({ call_sid: "CA4", summary: "kept" });
  });

  it("setRecording sets both columns by CallSid", async () => {
    await q.createCall({ callSid: "CA5", from: "+1", to: "+2" });
    await q.setRecording("CA5", "RE1", "https://api.twilio.com/rec/RE1");
    expect(await db.prepare("select recording_sid, recording_url from voice_calls").first()).toEqual({
      recording_sid: "RE1",
      recording_url: "https://api.twilio.com/rec/RE1",
    });
  });

  it("saveMessage links the message to its call", async () => {
    const id = await q.createCall({ callSid: "CA6", from: "+1", to: "+2" });
    await q.saveMessage({ callId: id, name: "Dana", reason: "Call me back", callback: "+15550009999" });
    expect(await db.prepare("select call_id, name, company, reason, callback from voice_messages").first()).toEqual({
      call_id: id,
      name: "Dana",
      company: null,
      reason: "Call me back",
      callback: "+15550009999",
    });
  });
});

describe("leads and trips", () => {
  it("a returning caller with two leads: the newest wins", async () => {
    const first = await q.upsertLead({ phone: "+15551234567", name: "Old" });
    const second = await q.upsertLead({ phone: "+15551234567", name: "New" });
    expect(second).not.toBe(first);
    const { lead } = await q.lookupCaller("+15551234567");
    expect(lead).toEqual({ id: second, phone: "+15551234567", name: "New", email: null });
    expect(await q.lookupCaller("+15559999999")).toEqual({ lead: null, trips: [] });
  });

  it("upsertLead on an existing lead keeps what the caller did not repeat", async () => {
    const id = await q.upsertLead({ phone: "+15551234567", name: "Sam", email: "sam@example.com" });
    expect(await q.upsertLead({ leadId: id, phone: "+15551234567", name: "Samuel" })).toBe(id);
    const { lead } = await q.lookupCaller("+15551234567");
    expect(lead).toMatchObject({ name: "Samuel", email: "sam@example.com" });
  });

  it("five trips come back newest first with an ISO created_at, from six", async () => {
    const leadId = await q.upsertLead({ phone: "+15551234567" });
    const callId = await q.createCall({ callSid: "CA7", from: "+1", to: "+2" });
    const t0 = Date.now() - 10_000;
    for (let i = 0; i < 6; i++) {
      await q.upsertTripRequest({ leadId, callId, fields: { origin: `O${i}`, destination: "KTEB" } });
      // Spread the rows apart so created_at orders them.
      await db.prepare("update voice_trip_requests set created_at = ? where origin = ?").bind(t0 + i * 1000, `O${i}`).run();
    }
    const { trips } = await q.lookupCaller("+15551234567");
    expect(trips.map((t) => t.origin)).toEqual(["O5", "O4", "O3", "O2", "O1"]);
    expect(trips[0].created_at).toBe(new Date(t0 + 5000).toISOString());
    expect(trips[0].status).toBe("new");
    expect(q.activeTrips(trips)).toHaveLength(5);
  });

  it("upsertTripRequest ignores a column outside the allow list and drops empty values", async () => {
    const leadId = await q.upsertLead({ phone: "+15551234567" });
    const callId = await q.createCall({ callSid: "CA8", from: "+1", to: "+2" });
    const id = await q.upsertTripRequest({
      leadId,
      callId,
      fields: { origin: "KVNY", destination: "", pax: 4, status: "closed", "id; drop table voice_leads; --": "x" } as never,
    });
    const row = await db.prepare("select origin, destination, pax, status, lead_id, call_id from voice_trip_requests where id = ?").bind(id).first();
    expect(row).toEqual({ origin: "KVNY", destination: null, pax: 4, status: "new", lead_id: leadId, call_id: callId });
    expect(await count("voice_leads")).toBe(1);

    // The same through the store, bypassing queries.ts's cleaning.
    const again = await store().upsertTripRequest({ leadId, callId, fields: { origin: "KSFO", status: "closed", notes: "" } as never });
    expect(await db.prepare("select origin, status from voice_trip_requests where id = ?").bind(again).first()).toEqual({ origin: "KSFO", status: "new" });
  });

  it("updating a trip changes only the given columns", async () => {
    const leadId = await q.upsertLead({ phone: "+15551234567" });
    const callId = await q.createCall({ callSid: "CA9", from: "+1", to: "+2" });
    const id = await q.upsertTripRequest({ leadId, callId, fields: { origin: "KVNY", destination: "KTEB", pax: 3 } });
    expect(await q.upsertTripRequest({ tripId: id, leadId, callId, fields: { destination: "KPBI", depart_date_iso: "2026-12-01" } })).toBe(id);
    expect(await q.upsertTripRequest({ tripId: id, leadId, callId, fields: {} })).toBe(id);
    expect(await db.prepare("select origin, destination, pax, depart_date_iso from voice_trip_requests where id = ?").bind(id).first()).toEqual({
      origin: "KVNY",
      destination: "KPBI",
      pax: 3,
      depart_date_iso: "2026-12-01",
    });
  });

  it("a trip of a departed date is not active", async () => {
    const leadId = await q.upsertLead({ phone: "+15551234567" });
    const callId = await q.createCall({ callSid: "CA10", from: "+1", to: "+2" });
    await q.upsertTripRequest({ leadId, callId, fields: { origin: "A", depart_date_iso: "2020-01-01" } });
    await q.upsertTripRequest({ leadId, callId, fields: { origin: "B", depart_date_iso: "2999-01-01" } });
    const { trips } = await q.lookupCaller("+15551234567");
    expect(trips.map((t) => t.depart_date_iso).sort()).toEqual(["2020-01-01", "2999-01-01"]);
    expect(q.activeTrips(trips).map((t) => t.origin)).toEqual(["B"]);
  });
});

describe("the live agent", () => {
  const config = { profile: { language: "en-US" } };
  const insertAgent = (id: string, name: string, live: number, archivedAt: number | null) =>
    db
      .prepare(
        `insert into voice_agents (id, name, config, version, is_live, archived_at, created_at, updated_at)
         values (?, ?, ?, 3, ?, ?, 1, 1)`,
      )
      .bind(id, name, JSON.stringify(config), live, archivedAt)
      .run();

  it("is the built-in agent with no row", async () => {
    expect(await store().liveAgentRow()).toBeNull();
  });

  it("reads the live agent with an archived one present, config as an object", async () => {
    await insertAgent("a-old", "Old", 0, 5);
    await insertAgent("a-live", "Live", 1, null);
    const row = await store().liveAgentRow();
    expect(row).toEqual({ id: "a-live", name: "Live", version: 3, config });
  });

  it("an archived agent is never the live one", async () => {
    await insertAgent("a-archived", "Archived", 1, 5);
    expect(await store().liveAgentRow()).toBeNull();
    expect(await store().agentRowById("a-archived")).toMatchObject({ id: "a-archived", config });
    expect(await store().agentRowById("nope")).toBeNull();
  });

  it("agent-store loads it through the store", async () => {
    await insertAgent("a-live2", "Second", 1, null);
    const agent = await agentById("a-live2");
    expect(agent).toMatchObject({ id: "a-live2", name: "Second", version: 3 });
    expect(typeof agent.config).toBe("object");
    expect((await liveAgent()).id).toBeDefined();
  });
});

describe("LLM routing", () => {
  const provider = (id: string, kind: string, enabled: number) =>
    db
      .prepare(
        `insert into ai_providers (id, provider, label, api_key_enc, api_key_last4, default_model, enabled, created_at, updated_at)
         values (?, ?, ?, 'sealed', '1234', 'm', ?, 1, 1)`,
      )
      .bind(id, kind, kind.toUpperCase(), enabled)
      .run();

  it("no route reads as an empty answer", async () => {
    expect(await store().voiceRoute()).toEqual({ route: undefined, rows: [] });
  });

  it("a route returns its providers with enabled as a boolean", async () => {
    await provider("p1", "anthropic", 1);
    await provider("p2", "openai", 0);
    await db.prepare(`insert into ai_routes (purpose, primary_provider_id, fallback_provider_id, updated_at) values ('voice_agent', 'p1', 'p2', 1)`).run();
    const { route, rows } = await store().voiceRoute();
    expect(route).toEqual({ primary_provider_id: "p1", fallback_provider_id: "p2" });
    expect(rows.sort((a, b) => a.id.localeCompare(b.id))).toEqual([
      { id: "p1", provider: "anthropic", label: "ANTHROPIC", api_key_enc: "sealed", default_model: "m", enabled: true },
      { id: "p2", provider: "openai", label: "OPENAI", api_key_enc: "sealed", default_model: "m", enabled: false },
    ]);
  });

  it("a route with only a fallback binds one id", async () => {
    await provider("p9", "openai", 1);
    await db.prepare(`insert into ai_routes (purpose, primary_provider_id, fallback_provider_id, updated_at) values ('voice_agent', NULL, 'p9', 1)`).run();
    expect((await store().voiceRoute()).rows.map((r) => r.id)).toEqual(["p9"]);
  });

  it("resolveRouting says no route and falls to the environment when nothing is routed", async () => {
    const r = await resolveRouting();
    expect(r.primary?.source).toBe("env");
    expect(r.note).toMatch(/no route in ai_routes/);
  });
});
