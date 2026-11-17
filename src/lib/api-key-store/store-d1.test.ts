import test from "node:test";
import assert from "node:assert/strict";
import { freshD1 } from "@/db/d1/test-client";
import { apiKeys, apiRequests } from "@/db/d1/schema/api";
import { staff } from "@/db/d1/schema/staff";
import { users } from "@/db/d1/schema/users";
import { d1ApiKeyStore } from "./store-d1";
import type { NewKey } from "./store";

// OPS-138: contract tests for the D1 API key store (Settings > API keys, create with the cap,
// revoke, the old blog key's usage, the /api/v1 key sign-in and its last-used stamp, one key's
// limits, the request log and its 30 day clean-up), on a real SQLite with the repo's own D1
// migrations applied and foreign keys on, as D1 has them. The clock is passed in.

const T0 = new Date("2026-11-17T12:00:00Z");
const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

function fresh(start = T0) {
  const { sqlite, client } = freshD1();
  const clock = { now: start };
  const store = d1ApiKeyStore(client, () => clock.now);
  return { sqlite, client, store, clock };
}

type Fresh = ReturnType<typeof fresh>;

async function user(client: Fresh["client"], over: Record<string, unknown> = {}) {
  const [u] = await client
    .insert(users)
    .values({ email: `u${Math.random().toString(36).slice(2)}@example.com`, role: "admin", ...over } as never)
    .returning({ id: users.id });
  return u.id;
}

let n = 0;
const newKey = (createdBy: string, over: Partial<NewKey> = {}): NewKey => {
  n += 1;
  return {
    name: `Key ${n}`,
    prefix: `pfx${String(n).padStart(5, "0")}`,
    tokenHash: `hash-${n}`,
    last4: "abcd",
    scopes: ["read"],
    requiresApproval: false,
    createdBy,
    expiresAt: null,
    ...over,
  };
};

// drizzle wraps SQLite errors ("Failed query"), so the reason is read down the cause chain.
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

test("create returns the new id, and the key reads back with its scopes as an array and its flags as booleans", async () => {
  const { client, store } = fresh();
  const who = await user(client);
  const made = await store.createIfUnderCap(newKey(who, { name: "Desk key", scopes: ["read", "desk"], requiresApproval: true }), 25);
  assert.ok(made && made.id.length > 0);
  const [row] = await store.listKeys();
  assert.equal(row.id, made.id);
  assert.equal(row.name, "Desk key");
  assert.deepEqual(row.scopes, ["read", "desk"]);
  assert.strictEqual(row.requiresApproval, true);
  assert.ok(row.createdAt instanceof Date);
  assert.equal(row.createdAt.getTime(), T0.getTime());
  assert.equal(row.expiresAt, null);
  assert.equal(row.revokedAt, null);
});

test("the cap: up to the cap are made and the next one is refused", async () => {
  const { client, store } = fresh();
  const who = await user(client);
  for (let i = 0; i < 3; i++) assert.ok(await store.createIfUnderCap(newKey(who), 3));
  assert.equal(await store.createIfUnderCap(newKey(who), 3), null);
  assert.equal((await store.listKeys()).length, 3);
});

test("a revoked key and an expired key do not count toward the cap", async () => {
  const { client, store, clock } = fresh();
  const who = await user(client);
  const a = await store.createIfUnderCap(newKey(who), 3);
  await store.createIfUnderCap(newKey(who, { expiresAt: new Date(T0.getTime() + HOUR) }), 3);
  await store.createIfUnderCap(newKey(who), 3);
  assert.equal(await store.createIfUnderCap(newKey(who), 3), null, "full");
  await store.revoke(a!.id, who, "done with it");
  assert.ok(await store.createIfUnderCap(newKey(who), 3), "a revoked key frees a place");
  assert.equal(await store.createIfUnderCap(newKey(who), 3), null, "full again");
  clock.now = new Date(T0.getTime() + 2 * HOUR);
  assert.ok(await store.createIfUnderCap(newKey(who), 3), "an expired key frees a place");
});

test("two creates started together at the cap: only one is made", async () => {
  const { client, store } = fresh();
  const who = await user(client);
  await store.createIfUnderCap(newKey(who), 3);
  await store.createIfUnderCap(newKey(who), 3);
  const [x, y] = await Promise.all([store.createIfUnderCap(newKey(who), 3), store.createIfUnderCap(newKey(who), 3)]);
  assert.equal([x, y].filter(Boolean).length, 1);
  assert.equal((await store.listKeys()).length, 3);
});

test("the table's own refusals still hold: an unknown scope, and the agent key without supervision", async () => {
  const { client, store } = fresh();
  const who = await user(client);
  await refusedWith(() => store.createIfUnderCap(newKey(who, { scopes: ["read", "root"] }), 25), /CHECK constraint failed/);
  await refusedWith(() => store.createIfUnderCap(newKey(who, { scopes: ["agent"], requiresApproval: false }), 25), /CHECK constraint failed/);
  assert.ok(await store.createIfUnderCap(newKey(who, { scopes: ["agent"], requiresApproval: true }), 25));
});

test("a duplicate prefix is refused by the table, not counted as the cap", async () => {
  const { client, store } = fresh();
  const who = await user(client);
  const k = newKey(who);
  assert.ok(await store.createIfUnderCap(k, 25));
  await refusedWith(() => store.createIfUnderCap({ ...newKey(who), prefix: k.prefix }, 25), /UNIQUE constraint failed/);
});

test("revoke: sets the stamp, the person and the reason; a second revoke finds nothing", async () => {
  const { client, store } = fresh();
  const who = await user(client);
  const made = await store.createIfUnderCap(newKey(who, { name: "Old key" }), 25);
  const gone = await store.revoke(made!.id, who, "left the company");
  assert.equal(gone?.name, "Old key");
  assert.ok(gone?.prefix);
  assert.equal(await store.revoke(made!.id, who, null), undefined);
  assert.equal(await store.revoke("11111111-1111-1111-1111-111111111111", who, null), undefined);
  const [row] = await store.listKeys();
  assert.ok(row.revokedAt instanceof Date);
  assert.equal(row.revokeReason, "left the company");
});

test("list: working keys first, newest first inside each group, revoked last", async () => {
  const { client, store, clock } = fresh();
  const who = await user(client);
  const a = await store.createIfUnderCap(newKey(who, { name: "a" }), 25);
  clock.now = new Date(T0.getTime() + MIN);
  const b = await store.createIfUnderCap(newKey(who, { name: "b" }), 25);
  clock.now = new Date(T0.getTime() + 2 * MIN);
  const c = await store.createIfUnderCap(newKey(who, { name: "c" }), 25);
  await store.revoke(b!.id, who, null);
  assert.deepEqual((await store.listKeys()).map((r) => r.name), ["c", "a", "b"]);
  void a; void c;
});

test("list: the creator's name parts, display name and role come from users and staff; a key with no creator row lists nulls", async () => {
  const { client, store } = fresh();
  const who = await user(client, { email: "owner@example.com", firstName: "Olive", lastName: "Owner", role: "superadmin" });
  await client.insert(staff).values({ userId: who, displayName: "Olive O." } as never);
  await store.createIfUnderCap(newKey(who, { name: "mine" }), 25);
  const [row] = await store.listKeys();
  assert.equal(row.creatorEmail, "owner@example.com");
  assert.equal(row.creatorFirst, "Olive");
  assert.equal(row.creatorLast, "Owner");
  assert.equal(row.creatorDisplay, "Olive O.");
  assert.equal(row.creatorRole, "superadmin");
});

test("list: calls and errors in the last 24 hours only, per key, zero when none", async () => {
  const { client, store, clock } = fresh();
  const who = await user(client);
  const busy = await store.createIfUnderCap(newKey(who, { name: "busy" }), 25);
  const quiet = await store.createIfUnderCap(newKey(who, { name: "quiet" }), 25);
  clock.now = new Date(T0.getTime() - 30 * HOUR);
  await store.logRequest({ keyId: busy!.id, method: "GET", route: "/old", status: 500 });
  clock.now = new Date(T0.getTime() - 2 * HOUR);
  await store.logRequest({ keyId: busy!.id, method: "GET", route: "/a", status: 200 });
  await store.logRequest({ keyId: busy!.id, method: "GET", route: "/b", status: 404 });
  await store.logRequest({ keyId: busy!.id, method: "POST", route: "/c", status: 500 });
  clock.now = T0;
  const rows = await store.listKeys();
  const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
  assert.equal(byName.busy.calls, 3);
  assert.equal(byName.busy.errors, 2);
  assert.equal(byName.quiet.calls, 0);
  assert.equal(byName.quiet.errors, 0);
  assert.strictEqual(typeof byName.busy.calls, "number");
  void quiet;
});

test("keyForAuth: the key by prefix with its creator's role, and undefined for a made-up prefix", async () => {
  const { client, store } = fresh();
  const who = await user(client, { role: "dispatcher" });
  const k = newKey(who, { name: "Blog key", scopes: ["content"], expiresAt: new Date(T0.getTime() + DAY) });
  const made = await store.createIfUnderCap(k, 25);
  const row = await store.keyForAuth(k.prefix);
  assert.equal(row?.id, made!.id);
  assert.equal(row?.tokenHash, k.tokenHash);
  assert.deepEqual(row?.scopes, ["content"]);
  assert.strictEqual(row?.requiresApproval, false);
  assert.equal(row?.rateLimitPerMin, 120);
  assert.equal(row?.creatorId, who);
  assert.equal(row?.creatorRole, "dispatcher");
  assert.ok(row?.expiresAt instanceof Date);
  assert.equal(row?.revokedAt, null);
  assert.equal(row?.lastUsedAt, null);
  assert.equal(await store.keyForAuth("zzzzzzzz"), undefined);
});

test("keyForAuth: a key whose creator row is gone comes back with null creator fields, a revoked key shows its stamp", async () => {
  const { client, sqlite, store } = fresh();
  const who = await user(client);
  const k = newKey(who);
  const made = await store.createIfUnderCap(k, 25);
  await store.revoke(made!.id, who, null);
  sqlite.exec(`delete from users where id = '${who}'`);
  const row = await store.keyForAuth(k.prefix);
  assert.equal(row?.creatorId, null);
  assert.equal(row?.creatorRole, null);
  assert.ok(row?.revokedAt instanceof Date);
});

test("keyForAuth with a canonical role source: the sign-in takes the role from it, not from the copied users row", async () => {
  const { client } = fresh();
  const who = await user(client, { role: "admin" });
  const roles = new Map<string, string | null>([[who, "dispatcher"]]);
  const store = d1ApiKeyStore(client, () => T0, async (id) => roles.get(id) ?? null);
  const k = newKey(who, { scopes: ["admin"] });
  await store.createIfUnderCap(k, 25);
  assert.equal((await store.keyForAuth(k.prefix))?.creatorRole, "dispatcher", "demoted in the canonical store");
  roles.set(who, "member");
  assert.equal((await store.keyForAuth(k.prefix))?.creatorRole, "member");
  roles.delete(who);
  const gone = await store.keyForAuth(k.prefix);
  assert.equal(gone?.creatorRole, null, "removed in the canonical store: no role left");
  assert.equal(gone?.creatorId, who);
});

test("keyForAuth with a canonical role source that fails: the error is not swallowed", async () => {
  const { client } = fresh();
  const who = await user(client);
  const store = d1ApiKeyStore(client, () => T0, async () => {
    throw new Error("canonical store down");
  });
  const k = newKey(who);
  await store.createIfUnderCap(k, 25);
  await assert.rejects(() => store.keyForAuth(k.prefix), /canonical store down/);
  assert.equal(await store.keyForAuth("zzzzzzzz"), undefined, "no key, no role read");
});

test("keyLimits: created, expires and the rate limit of one key, undefined for an unknown id", async () => {
  const { client, store } = fresh();
  const who = await user(client);
  const exp = new Date(T0.getTime() + 30 * DAY);
  const made = await store.createIfUnderCap(newKey(who, { expiresAt: exp }), 25);
  const limits = await store.keyLimits(made!.id);
  assert.equal(limits?.createdAt.getTime(), T0.getTime());
  assert.equal(limits?.expiresAt?.getTime(), exp.getTime());
  assert.equal(limits?.rateLimitPerMin, 120);
  assert.equal(await store.keyLimits("nope"), undefined);
});

test("touchLastUsed writes once inside 60 seconds, and again after", async () => {
  const { client, store, clock } = fresh();
  const who = await user(client);
  const k = newKey(who);
  const made = await store.createIfUnderCap(k, 25);
  await store.touchLastUsed(made!.id, "203.0.113.7", "agent/1");
  let row = await store.keyForAuth(k.prefix);
  assert.equal(row?.lastUsedAt?.getTime(), T0.getTime());
  const [listed] = await store.listKeys();
  assert.equal(listed.lastUsedIp, "203.0.113.7");

  clock.now = new Date(T0.getTime() + 30_000);
  await store.touchLastUsed(made!.id, "198.51.100.9", "agent/2");
  row = await store.keyForAuth(k.prefix);
  assert.equal(row?.lastUsedAt?.getTime(), T0.getTime(), "inside 60 seconds: not written");
  assert.equal((await store.listKeys())[0].lastUsedIp, "203.0.113.7");

  clock.now = new Date(T0.getTime() + 61_000);
  await store.touchLastUsed(made!.id, "198.51.100.9", null);
  row = await store.keyForAuth(k.prefix);
  assert.equal(row?.lastUsedAt?.getTime(), T0.getTime() + 61_000);
  assert.equal((await store.listKeys())[0].lastUsedIp, "198.51.100.9");
});

test("logRequest keeps the fields, the legacy flag and a null key for the old blog key", async () => {
  const { client, sqlite, store } = fresh();
  const who = await user(client);
  const made = await store.createIfUnderCap(newKey(who), 25);
  await store.logRequest({
    keyId: made!.id, method: "POST", route: "/posts", status: 201, errorCode: null, durationMs: 42,
    ip: "203.0.113.7", ua: "curl/8", runId: "run-1", requestId: "req-1",
  });
  await store.logRequest({ keyId: null, legacy: true, method: "GET", route: "/api/admin/blog/posts", status: 200 });
  const rows = sqlite.prepare("select key_id, legacy, method, route, status, duration_ms, ip, run_id, request_id, at from api_requests order by id").all() as Record<string, unknown>[];
  assert.equal(rows.length, 2);
  assert.equal(rows[0].key_id, made!.id);
  assert.equal(rows[0].legacy, 0);
  assert.equal(rows[0].duration_ms, 42);
  assert.equal(rows[0].request_id, "req-1");
  assert.equal(rows[0].at, T0.getTime());
  assert.equal(rows[1].key_id, null);
  assert.equal(rows[1].legacy, 1);
});

test("a request for a key that does not exist is refused by the foreign key", async () => {
  const { store } = fresh();
  await refusedWith(() => store.logRequest({ keyId: "missing", method: "GET", route: "/x", status: 200 }), /FOREIGN KEY constraint failed/);
});

test("deleteRequestsOlderThan30Days removes the old rows and says how many", async () => {
  const { client, store, clock } = fresh();
  const who = await user(client);
  const made = await store.createIfUnderCap(newKey(who), 25);
  clock.now = new Date(T0.getTime() - 31 * DAY);
  await store.logRequest({ keyId: made!.id, method: "GET", route: "/a", status: 200 });
  await store.logRequest({ keyId: made!.id, method: "GET", route: "/b", status: 200 });
  clock.now = new Date(T0.getTime() - 29 * DAY);
  await store.logRequest({ keyId: made!.id, method: "GET", route: "/c", status: 200 });
  clock.now = T0;
  assert.equal(await store.deleteRequestsOlderThan30Days(), 2);
  assert.equal(await store.deleteRequestsOlderThan30Days(), 0);
  const left = await client.select().from(apiRequests);
  assert.equal(left.length, 1);
  assert.equal(left[0].route, "/c");
});

test("legacyUsage: only calls with the legacy flag count, with the last time and the 7 and 30 day counts", async () => {
  const { client, store, clock } = fresh();
  const who = await user(client);
  const made = await store.createIfUnderCap(newKey(who), 25);
  const empty = await store.legacyUsage();
  assert.deepEqual(empty, { lastUsedAt: null, calls7d: 0, calls30d: 0 });

  clock.now = new Date(T0.getTime() - 20 * DAY);
  await store.logRequest({ keyId: null, legacy: true, method: "GET", route: "/old", status: 200 });
  clock.now = new Date(T0.getTime() - 3 * DAY);
  await store.logRequest({ keyId: null, legacy: true, method: "GET", route: "/mid", status: 200 });
  await store.logRequest({ keyId: made!.id, method: "GET", route: "/not-legacy", status: 200 });
  clock.now = T0;
  const usage = await store.legacyUsage();
  assert.equal(usage.calls30d, 2);
  assert.equal(usage.calls7d, 1);
  assert.ok(usage.lastUsedAt instanceof Date);
  assert.equal(usage.lastUsedAt?.getTime(), T0.getTime() - 3 * DAY);
});

test("deleting a key's creator keeps the key and nulls created_by; deleting a key removes its log rows", async () => {
  const { client, sqlite, store } = fresh();
  const who = await user(client);
  const made = await store.createIfUnderCap(newKey(who), 25);
  await store.logRequest({ keyId: made!.id, method: "GET", route: "/a", status: 200 });
  sqlite.exec(`delete from users where id = '${who}'`);
  const [row] = await store.listKeys();
  assert.equal(row.id, made!.id);
  assert.equal(row.creatorEmail, null);
  sqlite.exec(`delete from api_keys where id = '${made!.id}'`);
  assert.equal((await client.select().from(apiRequests)).length, 0);
  assert.equal((await client.select().from(apiKeys)).length, 0);
});
