import test from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { freshD1 } from "@/db/d1/test-client";
import { agentRuns } from "@/db/d1/schema/agent";
import { apiKeys } from "@/db/d1/schema/api";
import { approvals } from "@/db/d1/schema/approvals";
import { staff } from "@/db/d1/schema/staff";
import { users } from "@/db/d1/schema/users";
import { isUniqueViolation } from "@/db/unique";
import { d1ApprovalStore } from "./store-d1";
import type { NewApprovalValues } from "./store";

// OPS-150: contract tests for the D1 approval store (queue, claim, finish, expire, the lists and
// counts), on a real SQLite with the repo's own D1 migrations applied and foreign keys on, as D1
// has them.

function fresh() {
  const { sqlite, client } = freshD1();
  return { sqlite, client, store: d1ApprovalStore(client) };
}
type Fresh = ReturnType<typeof fresh>;

let seq = 0;
const proposal = (over: Partial<NewApprovalValues> = {}): NewApprovalValues => ({
  op: "messages.send",
  payload: { body: "Hello", n: 2, nested: { a: [1, 2] } },
  summary: "Send a note",
  preview: null,
  reason: null,
  risk: "client",
  subjectType: "request",
  subjectId: "11111111-1111-4111-8111-111111111111",
  subjectCode: "REQ-1",
  dedupeKey: `k-${++seq}`,
  requestedByKey: null,
  requestedByUser: null,
  runId: null,
  ...over,
});

async function makeKey(client: Fresh["client"], name = "Daily assistant") {
  const n = ++seq;
  const [k] = await client
    .insert(apiKeys)
    .values({ name, prefix: `jn_${n}`, tokenHash: `hash${n}`, last4: "abcd", scopes: ["read"] } as never)
    .returning({ id: apiKeys.id });
  return k.id;
}
async function makeUser(client: Fresh["client"], email = `desk${++seq}@example.com`) {
  const [u] = await client.insert(users).values({ email, role: "dispatcher" } as never).returning({ id: users.id });
  return u.id;
}
async function makeRun(client: Fresh["client"]) {
  const [r] = await client.insert(agentRuns).values({ runDate: "2026-11-17" } as never).returning({ id: agentRuns.id });
  return r.id;
}

test("insert round-trips payload as an object and gives a pending row with a seven day expiry", async () => {
  const { store } = fresh();
  const row = await store.insert(proposal({ payload: { body: "Hi", nested: { a: [1, 2] } } }));
  assert.equal(row.status, "pending");
  assert.deepEqual(row.payload, { body: "Hi", nested: { a: [1, 2] } });
  assert.ok(row.createdAt instanceof Date);
  assert.ok(row.expiresAt instanceof Date);
  const days = (row.expiresAt.getTime() - row.createdAt.getTime()) / 86_400_000;
  assert.ok(days > 6.99 && days < 7.01);
  const back = await store.getById(row.id);
  assert.deepEqual(back?.payload, row.payload);
  assert.equal(await store.getById("00000000-0000-4000-8000-000000000000"), undefined);
});

test("a second pending insert with the same dedupe key is refused as a unique violation, and the first is handed back", async () => {
  const { store } = fresh();
  const first = await store.insert(proposal({ dedupeKey: "same" }));
  let caught: unknown;
  try {
    await store.insert(proposal({ dedupeKey: "same" }));
  } catch (e) {
    caught = e;
  }
  assert.equal(isUniqueViolation(caught), true);
  const dupe = await store.pendingByDedupe("same");
  assert.equal(dupe?.id, first.id);
});

test("a decided proposal does not block a new one with the same dedupe key", async () => {
  const { store } = fresh();
  const first = await store.insert(proposal({ dedupeKey: "again" }));
  await store.claim(first.id, null, "rejected", "no", new Date());
  const second = await store.insert(proposal({ dedupeKey: "again" }));
  assert.notEqual(second.id, first.id);
  assert.equal((await store.pendingByDedupe("again"))?.id, second.id);
});

test("claim on a pending row returns it once; a second claim returns nothing", async () => {
  const { store, client } = fresh();
  const who = await makeUser(client);
  const row = await store.insert(proposal());
  const now = new Date();
  const claimed = await store.claim(row.id, who, "executing", "go ahead", now);
  assert.equal(claimed?.status, "executing");
  assert.equal(claimed?.decidedBy, who);
  assert.equal(claimed?.decisionNote, "go ahead");
  assert.equal(claimed?.decidedAt?.getTime(), now.getTime());
  assert.equal(await store.claim(row.id, who, "executing", null, new Date()), undefined);
  assert.equal(await store.claim(row.id, who, "rejected", null, new Date()), undefined);
  assert.equal((await store.getById(row.id))?.status, "executing");
});

test("two claims started together: exactly one wins", async () => {
  const { store } = fresh();
  const row = await store.insert(proposal());
  const [a, b] = await Promise.all([
    store.claim(row.id, null, "executing", null, new Date()),
    store.claim(row.id, null, "executing", null, new Date()),
  ]);
  assert.equal([a, b].filter(Boolean).length, 1);
});

test("finish writes executed with a result and failed with an error, editedPayload kept as an object", async () => {
  const { store } = fresh();
  const a = await store.insert(proposal());
  await store.claim(a.id, null, "executing", null, new Date());
  const done = await store.finish(a.id, { status: "executed", result: { sent: true, id: "m1" }, editedPayload: { body: "Edited" } });
  assert.equal(done?.status, "executed");
  assert.deepEqual(done?.result, { sent: true, id: "m1" });
  assert.deepEqual(done?.editedPayload, { body: "Edited" });

  const b = await store.insert(proposal());
  await store.claim(b.id, null, "executing", null, new Date());
  const failed = await store.finish(b.id, { status: "failed", error: "Nope", editedPayload: null });
  assert.equal(failed?.status, "failed");
  assert.equal(failed?.error, "Nope");
  assert.equal(failed?.editedPayload, null);
});

test("expireStaleTwin expires only a pending row past its expiry, then a fresh one can be queued", async () => {
  const { store, client } = fresh();
  const old = await store.insert(proposal({ dedupeKey: "twin" }));
  const now = new Date();
  await store.expireStaleTwin("twin", now);
  assert.equal((await store.getById(old.id))?.status, "pending");

  await client.update(approvals).set({ expiresAt: new Date(now.getTime() - 1000) });
  await store.expireStaleTwin("twin", now);
  const expired = await store.getById(old.id);
  assert.equal(expired?.status, "expired");
  assert.equal(expired?.decidedAt?.getTime(), now.getTime());
  const fresher = await store.insert(proposal({ dedupeKey: "twin" }));
  assert.equal((await store.pendingByDedupe("twin"))?.id, fresher.id);
});

test("countForRun counts one run's proposals; countForKeySince sees only the window", async () => {
  const { store, client } = fresh();
  const run = await makeRun(client);
  const otherRun = await makeRun(client);
  const key = await makeKey(client);
  for (let i = 0; i < 3; i++) await store.insert(proposal({ runId: run, requestedByKey: key }));
  await store.insert(proposal({ runId: otherRun }));
  assert.equal(await store.countForRun(run), 3);
  assert.equal(await store.countForRun(otherRun), 1);

  const now = Date.now();
  const rows = await client.select({ id: approvals.id }).from(approvals);
  assert.equal(rows.length, 4);
  // Two of the key's three proposals are older than 24 hours.
  const mine = await client.select({ id: approvals.id }).from(approvals);
  const keyed = (await Promise.all(mine.map((r) => store.getById(r.id)))).filter((r) => r?.requestedByKey === key);
  assert.equal(keyed.length, 3);
  await client.update(approvals).set({ createdAt: new Date(now - 25 * 3_600_000) }).where(eq(approvals.id, keyed[0]!.id));
  await client.update(approvals).set({ createdAt: new Date(now - 30 * 3_600_000) }).where(eq(approvals.id, keyed[1]!.id));
  assert.equal(await store.countForKeySince(key, new Date(now - 24 * 3_600_000)), 1);
  assert.equal(await store.countForKeySince(key, new Date(now - 48 * 3_600_000)), 3);
});

test("expirePending: a pending row past expiry becomes expired, an executing row older than an hour becomes failed, the rest are left", async () => {
  const { store, client } = fresh();
  const now = new Date();
  const pastDue = await store.insert(proposal());
  const stillOpen = await store.insert(proposal());
  const stuck = await store.insert(proposal());
  const running = await store.insert(proposal());
  await client.update(approvals).set({ expiresAt: new Date(now.getTime() - 1000) }).where(eq(approvals.id, pastDue.id));
  await store.claim(stuck.id, null, "executing", null, new Date(now.getTime() - 2 * 3_600_000));
  await store.claim(running.id, null, "executing", null, new Date(now.getTime() - 5 * 60_000));

  assert.equal(await store.expirePending(now), 2);
  assert.equal((await store.getById(pastDue.id))?.status, "expired");
  assert.equal((await store.getById(stillOpen.id))?.status, "pending");
  const failed = await store.getById(stuck.id);
  assert.equal(failed?.status, "failed");
  assert.match(failed?.error ?? "", /lost track/);
  assert.equal((await store.getById(running.id))?.status, "executing");
  assert.equal(await store.expirePending(now), 0);
});

test("listJoined, getJoined and pendingForSubject carry the key's name and the decider's name, newest first", async () => {
  const { store, client } = fresh();
  const key = await makeKey(client, "Daily assistant");
  const person = await makeUser(client, "alex@example.com");
  await client.insert(staff).values({ userId: person, displayName: "Alex Desk" } as never);

  const a = await store.insert(proposal({ requestedByKey: key, subjectType: "trip", subjectId: "22222222-2222-4222-8222-222222222222" }));
  await new Promise((r) => setTimeout(r, 5));
  const b = await store.insert(proposal({ requestedByKey: key, subjectType: "trip", subjectId: "22222222-2222-4222-8222-222222222222" }));
  const c = await store.insert(proposal());
  await store.claim(c.id, person, "rejected", "not now", new Date());

  const pending = await store.listJoined(["pending"], undefined, 50);
  assert.deepEqual(pending.map((r) => r.approval.id), [b.id, a.id]);
  assert.equal(pending[0].keyName, "Daily assistant");
  assert.equal(pending[0].decEmail, null);

  const byKey = await store.listJoined(["pending", "rejected"], key, 50);
  assert.equal(byKey.length, 2);
  assert.equal((await store.listJoined(["pending"], undefined, 1)).length, 1);

  const decided = await store.getJoined(c.id);
  assert.equal(decided?.approval.status, "rejected");
  assert.equal(decided?.decEmail, "alex@example.com");
  assert.equal(decided?.decDisplay, "Alex Desk");
  assert.equal(decided?.keyName, null);
  assert.equal(await store.getJoined("00000000-0000-4000-8000-000000000000"), undefined);

  const forTrip = await store.pendingForSubject("trip", "22222222-2222-4222-8222-222222222222");
  assert.deepEqual(forTrip.map((r) => r.approval.id), [b.id, a.id]);
  assert.equal((await store.pendingForSubject("trip", "33333333-3333-4333-8333-333333333333")).length, 0);
});

test("countPending counts pending only", async () => {
  const { store } = fresh();
  assert.equal(await store.countPending(), 0);
  const a = await store.insert(proposal());
  await store.insert(proposal());
  assert.equal(await store.countPending(), 2);
  await store.claim(a.id, null, "executing", null, new Date());
  assert.equal(await store.countPending(), 1);
});

test("decidedSince lists executed, failed, rejected and expired since a date, newest first, and not pending or executing", async () => {
  const { store } = fresh();
  const t0 = new Date("2026-11-10T00:00:00Z");
  const mk = async (decidedAt: Date, status: "rejected" | "executing") => {
    const r = await store.insert(proposal());
    await store.claim(r.id, null, status, null, decidedAt);
    return r.id;
  };
  const old = await mk(new Date("2026-11-01T00:00:00Z"), "rejected");
  const mid = await mk(new Date("2026-11-12T00:00:00Z"), "rejected");
  const late = await mk(new Date("2026-11-14T00:00:00Z"), "rejected");
  await mk(new Date("2026-11-15T00:00:00Z"), "executing");
  await store.insert(proposal());
  const rows = await store.decidedSince(t0, 40);
  assert.deepEqual(rows.map((r) => r.id), [late, mid]);
  assert.ok(!rows.some((r) => r.id === old));
  assert.equal((await store.decidedSince(t0, 1)).length, 1);
});

test("the key and person behind a proposal may be deleted: the proposal stays, with the link cleared", async () => {
  const { store, client, sqlite } = fresh();
  const key = await makeKey(client);
  const row = await store.insert(proposal({ requestedByKey: key }));
  sqlite.exec(`delete from api_keys where id = '${key}'`);
  const after = await store.getById(row.id);
  assert.equal(after?.requestedByKey, null);
  assert.equal(await store.keyName(key), undefined);
});

test("keyName reads a key's name", async () => {
  const { store, client } = fresh();
  const key = await makeKey(client, "Voice agent");
  assert.deepEqual(await store.keyName(key), { id: key, name: "Voice agent" });
});

test("isUniqueViolation reads Postgres 23505, a D1 message and a wrapped cause, and nothing else", () => {
  assert.equal(isUniqueViolation({ code: "23505" }), true);
  assert.equal(isUniqueViolation(new Error("D1_ERROR: UNIQUE constraint failed: approvals.dedupe_key: SQLITE_CONSTRAINT")), true);
  assert.equal(isUniqueViolation(new Error("Failed query", { cause: { code: "23505" } })), true);
  assert.equal(isUniqueViolation(new Error("Failed query", { cause: new Error("UNIQUE constraint failed: x.y") })), true);
  assert.equal(isUniqueViolation(new Error("FOREIGN KEY constraint failed")), false);
  assert.equal(isUniqueViolation(null), false);
  assert.equal(isUniqueViolation("UNIQUE constraint failed"), false);
});
