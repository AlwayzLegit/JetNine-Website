import test from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { freshD1 } from "@/db/d1/test-client";
import { users } from "@/db/d1/schema/users";
import { staff } from "@/db/d1/schema/staff";
import { authTokens, userCredentials, userSessions } from "@/db/d1/schema/sessions";
import { RoleChangeRefused } from "@/lib/role-lock";
import { d1IdentityStore } from "./store-d1";

// OPS-174: contract tests for the D1 identity store (sign-in sessions, passwords, emailed links, the
// user and staff writes, the health probe), on a real SQLite with the repo's own D1 migrations applied
// and foreign keys on, as D1 has them. The clock is passed in.

const T0 = new Date("2026-11-18T12:00:00Z");
const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

function fresh(requirePassword = false) {
  const { sqlite, client } = freshD1();
  const clock = { now: T0 };
  const store = d1IdentityStore(client, () => clock.now, requirePassword);
  return { sqlite, client, store, clock };
}
type Fresh = ReturnType<typeof fresh>;

let n = 0;
async function user(f: Fresh, over: Record<string, unknown> = {}) {
  n += 1;
  const [u] = await f.client
    .insert(users)
    .values({ email: `u${n}@example.com`, role: "member", createdAt: new Date(T0.getTime() + n), ...over } as never)
    .returning({ id: users.id });
  return u.id;
}

const hashOf = (c: string) => `hash-${c}`;

// ── sessions ─────────────────────────────────────────────────────────────
test("a session is found by its token hash with its user, touched, swept and deleted", async () => {
  const f = fresh();
  const id = await user(f, { firstName: "Ann", lastName: "Lee", role: "dispatcher" });
  await f.store.insertSession({ userId: id, tokenHash: hashOf("a"), now: T0, expiresAt: new Date(T0.getTime() + DAY) });
  await f.store.insertSession({ userId: id, tokenHash: hashOf("old"), now: new Date(T0.getTime() - 2 * DAY), expiresAt: new Date(T0.getTime() - DAY) });

  const row = await f.store.sessionByTokenHash(hashOf("a"));
  assert.ok(row);
  assert.equal(row.id, id);
  assert.equal(row.role, "dispatcher");
  assert.equal(row.firstName, "Ann");
  assert.ok(row.expiresAt instanceof Date);
  assert.equal(await f.store.sessionByTokenHash(hashOf("nope")), undefined);

  const later = new Date(T0.getTime() + 10 * MIN);
  await f.store.touchSession(row.sessionId, later);
  assert.equal((await f.store.sessionByTokenHash(hashOf("a")))?.lastSeenAt.getTime(), later.getTime());

  await f.store.sweepSessions(id, T0);
  assert.equal(await f.store.sessionByTokenHash(hashOf("old")), undefined);
  assert.ok(await f.store.sessionByTokenHash(hashOf("a")));

  await f.store.deleteSessionByTokenHash(hashOf("a"));
  assert.equal(await f.store.sessionByTokenHash(hashOf("a")), undefined);
});

test("deleting a user's sessions leaves other users' sessions", async () => {
  const f = fresh();
  const a = await user(f);
  const b = await user(f);
  for (const [u, t] of [[a, "a1"], [a, "a2"], [b, "b1"]] as const) {
    await f.store.insertSession({ userId: u, tokenHash: hashOf(t), now: T0, expiresAt: new Date(T0.getTime() + DAY) });
  }
  await f.store.deleteSessionsOfUser(a);
  assert.equal(await f.store.sessionByTokenHash(hashOf("a1")), undefined);
  assert.equal(await f.store.sessionByTokenHash(hashOf("a2")), undefined);
  assert.ok(await f.store.sessionByTokenHash(hashOf("b1")));
});

test("a session for a user that does not exist is refused by the foreign key", async () => {
  const f = fresh();
  await assert.rejects(f.store.insertSession({ userId: "ghost", tokenHash: hashOf("g"), now: T0, expiresAt: new Date(T0.getTime() + DAY) }));
});

// ── passwords ────────────────────────────────────────────────────────────
test("hashForEmail: case-insensitive, hash from user_credentials, null when none", async () => {
  const f = fresh();
  const id = await user(f, { email: "Mixed.Case@Example.com" });
  assert.deepEqual(await f.store.hashForEmail("mixed.case@example.com"), { id, hash: null });
  await f.store.upsertCredential(id, "bcrypt-1", T0);
  assert.deepEqual(await f.store.hashForEmail("mixed.case@example.com"), { id, hash: "bcrypt-1" });
  assert.equal(await f.store.hashForEmail("nobody@example.com"), undefined);
});

test("upsertCredential replaces the hash and stamps the time", async () => {
  const f = fresh();
  const id = await user(f);
  await f.store.upsertCredential(id, "one", T0);
  const later = new Date(T0.getTime() + HOUR);
  await f.store.upsertCredential(id, "two", later);
  const rows = await f.client.select().from(userCredentials).where(eq(userCredentials.userId, id));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].passwordHash, "two");
  assert.equal(rows[0].updatedAt.getTime(), later.getTime());
  assert.equal(await f.store.hashForUser(id), "two");
  assert.equal(await f.store.hashForUser("ghost"), null);
});

test("a banned user gets no hash; a ban that has ended does not count", async () => {
  const f = fresh();
  const banned = await user(f, { email: "b@example.com", bannedUntil: new Date(T0.getTime() + DAY) });
  const over = await user(f, { email: "o@example.com", bannedUntil: new Date(T0.getTime() - DAY) });
  await f.store.upsertCredential(banned, "x", T0);
  await f.store.upsertCredential(over, "y", T0);
  assert.equal(await f.store.hashForEmail("b@example.com"), undefined);
  assert.deepEqual(await f.store.hashForEmail("o@example.com"), { id: over, hash: "y" });
  // the ban moves with the clock
  f.clock.now = new Date(T0.getTime() + 2 * DAY);
  assert.deepEqual(await f.store.hashForEmail("b@example.com"), { id: banned, hash: "x" });
});

test("hasPassword is true only with a user_credentials row", async () => {
  const f = fresh();
  const id = await user(f);
  assert.equal(await f.store.hasPassword(id), false);
  await f.store.upsertCredential(id, "x", T0);
  assert.equal(await f.store.hasPassword(id), true);
  assert.equal(await f.store.hasPassword("ghost"), false);
});

// ── emailed links ────────────────────────────────────────────────────────
test("userForMail picks the oldest row and refuses a banned user", async () => {
  const f = fresh();
  const first = await user(f, { email: "dup@example.com", createdAt: new Date(T0.getTime() - HOUR) });
  await user(f, { email: "DUP@example.com", createdAt: new Date(T0.getTime() - MIN) });
  assert.deepEqual(await f.store.userForMail("dup@example.com"), { id: first });
  assert.equal(await f.store.userForMail("none@example.com"), null);
  await user(f, { email: "ban@example.com", bannedUntil: new Date(T0.getTime() + HOUR) });
  assert.equal(await f.store.userForMail("ban@example.com"), null);
});

function link(userId: string, tokenHash: string, over: Partial<Parameters<Fresh["store"]["replaceToken"]>[0]> = {}) {
  return { userId, purpose: "reset" as const, tokenHash, createdAt: T0, expiresAt: new Date(T0.getTime() + HOUR), ...over };
}

test("replaceToken keeps only the newest unused token of a purpose", async () => {
  const f = fresh();
  const id = await user(f);
  await f.store.replaceToken(link(id, "t1"));
  await f.store.replaceToken(link(id, "t2"));
  await f.store.replaceToken(link(id, "i1", { purpose: "invite" }));
  assert.equal(await f.store.peekToken("t1", "reset", T0), false);
  assert.equal(await f.store.peekToken("t2", "reset", T0), true);
  assert.equal(await f.store.peekToken("i1", "invite", T0), true);
});

test("sweepTokens removes this user's expired tokens only", async () => {
  const f = fresh();
  const a = await user(f);
  const b = await user(f);
  await f.store.replaceToken(link(a, "old", { purpose: "signin", expiresAt: new Date(T0.getTime() - MIN) }));
  await f.store.replaceToken(link(b, "oldb", { expiresAt: new Date(T0.getTime() - MIN) }));
  await f.store.sweepTokens(a, T0);
  const left = (await f.client.select({ h: authTokens.tokenHash }).from(authTokens)).map((r) => r.h);
  assert.deepEqual(left, ["oldb"]);
});

test("consumeToken spends a token once and peekToken writes nothing", async () => {
  const f = fresh();
  const id = await user(f);
  await f.store.replaceToken(link(id, "t"));
  assert.equal(await f.store.peekToken("t", "reset", T0), true);
  assert.equal(await f.store.peekToken("t", "reset", T0), true); // still there
  assert.equal(await f.store.consumeToken("t", "reset", T0), id);
  assert.equal(await f.store.consumeToken("t", "reset", T0), null);
  assert.equal(await f.store.peekToken("t", "reset", T0), false);
});

test("two spends at once: exactly one wins", async () => {
  const f = fresh();
  const id = await user(f);
  await f.store.replaceToken(link(id, "t"));
  const got = await Promise.all([f.store.consumeToken("t", "reset", T0), f.store.consumeToken("t", "reset", T0)]);
  assert.deepEqual(got.filter((x) => x === id).length, 1);
  assert.deepEqual(got.filter((x) => x === null).length, 1);
});

test("a token is refused for the wrong purpose, when expired, and for a banned user", async () => {
  const f = fresh();
  const id = await user(f);
  await f.store.replaceToken(link(id, "t"));
  assert.equal(await f.store.consumeToken("t", "invite", T0), null);
  assert.equal(await f.store.consumeToken("t", "reset", new Date(T0.getTime() + 2 * HOUR)), null);
  assert.equal(await f.store.peekToken("t", "reset", new Date(T0.getTime() + 2 * HOUR)), false);
  await f.client.update(users).set({ bannedUntil: new Date(T0.getTime() + DAY) }).where(eq(users.id, id));
  assert.equal(await f.store.peekToken("t", "reset", T0), false);
  assert.equal(await f.store.consumeToken("t", "reset", T0), null);
  // the ban ends: the same token works again (it was never spent)
  await f.client.update(users).set({ bannedUntil: new Date(T0.getTime() - MIN) }).where(eq(users.id, id));
  assert.equal(await f.store.consumeToken("t", "reset", T0), id);
});

// ── users ────────────────────────────────────────────────────────────────
test("insertUser makes a plain member; oldestUserByEmail reads it back; deleteUser removes it", async () => {
  const f = fresh();
  const made = await f.store.insertUser({ email: "new@example.com", firstName: "N", lastName: null });
  const row = await f.store.oldestUserByEmail("new@example.com");
  assert.deepEqual(row, { id: made.id, role: "member", firstName: "N", lastName: null, phoneE164: null });
  await f.store.deleteUser(made.id);
  assert.equal(await f.store.oldestUserByEmail("new@example.com"), null);
});

test("deleting a user takes their sessions, credentials and tokens with it", async () => {
  const f = fresh();
  const id = await user(f);
  await f.store.insertSession({ userId: id, tokenHash: hashOf("s"), now: T0, expiresAt: new Date(T0.getTime() + DAY) });
  await f.store.upsertCredential(id, "x", T0);
  await f.store.replaceToken(link(id, "t"));
  await f.store.deleteUser(id);
  assert.equal((await f.client.select().from(userSessions)).length, 0);
  assert.equal((await f.client.select().from(userCredentials)).length, 0);
  assert.equal((await f.client.select().from(authTokens)).length, 0);
});

test("patchUserProfile changes the three fields only", async () => {
  const f = fresh();
  const id = await user(f, { email: "p@example.com", role: "dispatcher" });
  await f.store.patchUserProfile(id, { firstName: "A", lastName: "B", phoneE164: "+15555550100" });
  assert.deepEqual(await f.store.oldestUserByEmail("p@example.com"), {
    id,
    role: "dispatcher",
    firstName: "A",
    lastName: "B",
    phoneE164: "+15555550100",
  });
});

test("setRoleGuarded: an admin changes a role; anyone else is refused and nothing changes", async () => {
  const f = fresh();
  const id = await user(f, { email: "r@example.com" });
  for (const actor of ["member", "dispatcher", null, undefined]) {
    await assert.rejects(f.store.setRoleGuarded(actor, id, "dispatcher", {}), RoleChangeRefused);
  }
  assert.equal((await f.store.oldestUserByEmail("r@example.com"))?.role, "member");

  await f.store.setRoleGuarded("admin", id, "dispatcher", { firstName: "Rae" });
  assert.deepEqual(await f.store.oldestUserByEmail("r@example.com"), { id, role: "dispatcher", firstName: "Rae", lastName: null, phoneE164: null });
  await f.store.setRoleGuarded("superadmin", id, "member", {});
  assert.equal((await f.store.oldestUserByEmail("r@example.com"))?.role, "member");
});

test("setRoleGuarded: keeping the same role is allowed for anyone; a missing user changes nothing", async () => {
  const f = fresh();
  const id = await user(f, { email: "same@example.com", role: "dispatcher" });
  await f.store.setRoleGuarded("member", id, "dispatcher", { firstName: "Same" });
  assert.equal((await f.store.oldestUserByEmail("same@example.com"))?.firstName, "Same");
  await f.store.setRoleGuarded("admin", "ghost", "admin", {});
  assert.equal((await f.client.select().from(users)).length, 1);
});

// ── staff ────────────────────────────────────────────────────────────────
test("staff rows: insert, read the id, set the status by id and by user", async () => {
  const f = fresh();
  const id = await user(f);
  assert.equal(await f.store.staffIdOfUser(id), undefined);
  await f.store.insertStaff({ userId: id, displayName: "Ann", status: "on_call" });
  const row = await f.store.staffIdOfUser(id);
  assert.ok(row);
  const read = async () => (await f.client.select({ s: staff.status, d: staff.displayName }).from(staff))[0];
  assert.deepEqual(await read(), { s: "on_call", d: "Ann" });
  await f.store.setStaffStatusById(row.id, "off");
  assert.equal((await read()).s, "off");
  await f.store.setStaffStatusByUser(id, "on_call");
  assert.equal((await read()).s, "on_call");
});

// ── the health probe ─────────────────────────────────────────────────────
test("signinProbe: ok on staging with no passwords; 'passwords' in production until one exists", async () => {
  const staging = fresh(false);
  assert.equal(await staging.store.signinProbe(), null);

  const prod = fresh(true);
  assert.equal(await prod.store.signinProbe(), "passwords");
  const id = await user(prod);
  await prod.store.upsertCredential(id, "x", T0);
  assert.equal(await prod.store.signinProbe(), null);
});

test("signinProbe names the first table that cannot be read, and logs only name and code", async () => {
  const f = fresh();
  const logged: unknown[][] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => void logged.push(a);
  try {
    f.sqlite.exec("DROP TABLE auth_tokens");
    assert.equal(await f.store.signinProbe(), "links");
    f.sqlite.exec("DROP TABLE user_sessions");
    assert.equal(await f.store.signinProbe(), "sessions");
  } finally {
    console.error = orig;
  }
  assert.equal(logged.length, 2);
  for (const call of logged) {
    assert.equal(call[0], "[health] signin probe failed");
    assert.deepEqual(Object.keys(call[1] as object).sort(), ["code", "name"]);
  }
});
