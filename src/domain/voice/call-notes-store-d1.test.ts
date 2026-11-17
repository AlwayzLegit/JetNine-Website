import test from "node:test";
import assert from "node:assert/strict";
import { freshD1 } from "@/db/d1/test-client";
import { voiceCalls, voiceLeads, voiceMessages, voiceTripRequests } from "@/db/d1/schema/voice-calls";
import { d1CallNotesStore } from "./call-notes-store-d1";

// OPS-129: contract tests for the D1 call notes store (the admin Calls tab and
// GET /api/v1/messages/calls), on a real SQLite with the repo's own D1 migrations applied and
// foreign keys on, as D1 has them.

function fresh() {
  const { sqlite, client } = freshD1();
  return { sqlite, client, store: d1CallNotesStore(client) };
}

type Fresh = ReturnType<typeof fresh>;

const at = (iso: string) => new Date(iso);

// drizzle wraps the SQLite error ("Failed query"), so the reason is read down the cause chain.
async function refusedWith(run: () => Promise<unknown>, reason: RegExp) {
  try {
    await run();
  } catch (err) {
    let e: unknown = err;
    for (let depth = 0; depth < 4 && e && typeof e === "object"; depth++) {
      const { message, cause } = e as { message?: unknown; cause?: unknown };
      if (typeof message === "string" && reason.test(message)) return;
      e = cause;
    }
    assert.fail(`refused for another reason: ${String(err)}`);
  }
  assert.fail("the statement was not refused");
}

let n = 0;
async function call(client: Fresh["client"], over: Record<string, unknown> = {}) {
  n += 1;
  const [row] = await client
    .insert(voiceCalls)
    .values({ callSid: `CA${n}`, startedAt: at("2026-11-01T10:00:00Z"), ...over } as never)
    .returning({ id: voiceCalls.id });
  return row.id;
}

test("calls come back newest first and at most the limit", async () => {
  const { client, store } = fresh();
  for (let i = 0; i < 55; i++) {
    await call(client, { startedAt: new Date(Date.UTC(2026, 10, 1, 0, i)) });
  }
  const rows = await store.recentCalls(50);
  assert.equal(rows.length, 50);
  assert.equal(rows[0].started_at.getTime(), Date.UTC(2026, 10, 1, 0, 54));
  assert.equal(rows[49].started_at.getTime(), Date.UTC(2026, 10, 1, 0, 5));
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].started_at >= rows[i].started_at);
  assert.equal((await store.recentCalls(3)).length, 3);
});

test("a call with two messages shows the newer one's reason and callback", async () => {
  const { client, store } = fresh();
  const id = await call(client);
  await client.insert(voiceMessages).values({ callId: id, reason: "old reason", callback: "555-0100", createdAt: at("2026-11-01T10:05:00Z") });
  await client.insert(voiceMessages).values({ callId: id, reason: "new reason", callback: "555-0199", createdAt: at("2026-11-01T10:09:00Z") });
  const [row] = await store.recentCalls(50);
  assert.equal(row.message_reason, "new reason");
  assert.equal(row.message_callback, "555-0199");
});

test("two messages with the same time give both columns to one message", async () => {
  const { client, store } = fresh();
  const id = await call(client);
  const same = at("2026-11-01T10:05:00Z");
  await client.insert(voiceMessages).values({ callId: id, reason: "first", callback: "111", createdAt: same });
  await client.insert(voiceMessages).values({ callId: id, reason: "second", callback: "222", createdAt: same });
  const [row] = await store.recentCalls(50);
  const pair = `${row.message_reason}/${row.message_callback}`;
  assert.ok(pair === "first/111" || pair === "second/222", pair);
});

test("a call with no message shows nulls, and a message of another call is not mixed in", async () => {
  const { client, store } = fresh();
  const a = await call(client, { startedAt: at("2026-11-01T11:00:00Z") });
  const b = await call(client, { startedAt: at("2026-11-01T10:00:00Z") });
  await client.insert(voiceMessages).values({ callId: b, reason: "for b", callback: "555-0111" });
  const rows = await store.recentCalls(50);
  assert.equal(rows[0].id, a);
  assert.equal(rows[0].message_reason, null);
  assert.equal(rows[0].message_callback, null);
  assert.equal(rows[1].id, b);
  assert.equal(rows[1].message_reason, "for b");
});

test("fields have the types the Calls tab expects", async () => {
  const { client, store } = fresh();
  await call(client, {
    fromNumber: "+13105550100",
    durationSeconds: 95,
    outcome: "lead",
    summary: "Wants a quote",
    escalationReason: null,
    recordingUrl: "https://example.com/rec",
    returningCaller: true,
  });
  await call(client, { startedAt: at("2026-10-01T10:00:00Z") });
  const [first, second] = await store.recentCalls(50);
  assert.ok(first.started_at instanceof Date);
  assert.equal(first.started_at.toISOString(), "2026-11-01T10:00:00.000Z");
  assert.equal(first.from_number, "+13105550100");
  assert.equal(first.duration_seconds, 95);
  assert.equal(first.outcome, "lead");
  assert.equal(first.summary, "Wants a quote");
  assert.equal(first.recording_url, "https://example.com/rec");
  assert.strictEqual(first.returning_caller, true);
  assert.strictEqual(second.returning_caller, false);
  assert.equal(second.outcome, null);
});

test("every outcome value is accepted and a wrong one is refused", async () => {
  const { client } = fresh();
  for (const outcome of ["lead", "message", "escalated", "abandoned", "other"]) {
    await call(client, { outcome });
  }
  await refusedWith(() => call(client, { outcome: "bogus" }), /CHECK constraint failed/);
});

test("the call sid is unique", async () => {
  const { client } = fresh();
  await client.insert(voiceCalls).values({ callSid: "CAX" } as never);
  await refusedWith(() => client.insert(voiceCalls).values({ callSid: "CAX" } as never), /UNIQUE constraint failed/);
});

test("the foreign keys behave as on Postgres: lead delete nulls the call and removes its trip requests, call delete nulls its messages", async () => {
  const { client, sqlite, store } = fresh();
  const [lead] = await client.insert(voiceLeads).values({ phone: "+13105550100", name: "Caller" }).returning({ id: voiceLeads.id });
  const callId = await call(client, { leadId: lead.id });
  await client.insert(voiceTripRequests).values({ leadId: lead.id, callId, origin: "LAX", destination: "TEB", departDateIso: "2026-12-01", pax: 4 });
  await client.insert(voiceMessages).values({ callId, reason: "r", callback: "c" });

  sqlite.exec(`delete from voice_leads where id = '${lead.id}'`);
  const trips = sqlite.prepare("select count(*) as c from voice_trip_requests").get() as { c: number };
  assert.equal(trips.c, 0, "trip requests of a deleted lead go with it");
  const leadOnCall = sqlite.prepare("select lead_id from voice_calls where id = ?").get(callId) as { lead_id: string | null };
  assert.equal(leadOnCall.lead_id, null);
  assert.equal((await store.recentCalls(50)).length, 1, "the call stays");

  sqlite.exec(`delete from voice_calls where id = '${callId}'`);
  const msg = sqlite.prepare("select call_id from voice_messages").get() as { call_id: string | null };
  assert.equal(msg.call_id, null, "a message outlives its call");
});

test("a transcript is stored as JSON text and the date columns stay text", async () => {
  const { client, sqlite } = fresh();
  const transcript = [{ role: "user", text: "Hello", at: "2026-11-01T10:00:00Z" }];
  const callId = await call(client, { transcript });
  const [lead] = await client.insert(voiceLeads).values({ phone: "+13105550100" }).returning({ id: voiceLeads.id });
  await client.insert(voiceTripRequests).values({ leadId: lead.id, callId, departDate: "next Friday", departDateIso: "2026-12-04" });
  const row = sqlite.prepare("select transcript from voice_calls where id = ?").get(callId) as { transcript: string };
  assert.deepEqual(JSON.parse(row.transcript), transcript);
  const trip = sqlite.prepare("select depart_date, depart_date_iso, status from voice_trip_requests").get() as Record<string, string>;
  assert.equal(trip.depart_date, "next Friday");
  assert.equal(trip.depart_date_iso, "2026-12-04");
  assert.equal(trip.status, "new");
});
