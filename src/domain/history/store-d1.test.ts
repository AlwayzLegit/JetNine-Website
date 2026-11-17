import test from "node:test";
import assert from "node:assert/strict";
import { freshD1 } from "@/db/d1/test-client";
import { auditLog } from "@/db/d1/schema/audit";
import { members } from "@/db/d1/schema/members";
import { users } from "@/db/d1/schema/users";
import { likePattern } from "@/domain/common";
import { d1HistoryStore } from "./store-d1";

// OPS-123: contract tests for the D1 history store (Settings > History and
// GET /api/v1/history), on a real SQLite with the repo's own D1 migrations
// applied and foreign keys on, as D1 has them.

function fresh() {
  const { sqlite, client } = freshD1();
  return { sqlite, client, store: d1HistoryStore(client) };
}

type Fresh = ReturnType<typeof fresh>;

let n = 0;
async function audit(
  f: Fresh,
  over: Partial<typeof auditLog.$inferInsert> & { action: string; subjectType: (typeof auditLog.$inferInsert)["subjectType"] },
) {
  n += 1;
  await f.client.insert(auditLog).values({ occurredAt: new Date(Date.UTC(2026, 10, 1, 0, n)), ...over });
}

test("newest first, with the limit respected and the total counted without it", async () => {
  const f = fresh();
  await audit(f, { action: "a.one", subjectType: "quote" });
  await audit(f, { action: "a.two", subjectType: "trip" });
  await audit(f, { action: "a.three", subjectType: "invoice" });
  const rows = await f.store.historyRows({}, 100);
  assert.deepEqual(rows.map((r) => r.action), ["a.three", "a.two", "a.one"]);
  assert.ok(rows[0].occurredAt instanceof Date);
  const limited = await f.store.historyRows({}, 2);
  assert.deepEqual(limited.map((r) => r.action), ["a.three", "a.two"]);
  assert.equal(await f.store.historyTotal({}), 3);
});

test("a tab's types keep only those subject types, and the other tab leaves the named types out", async () => {
  const f = fresh();
  await audit(f, { action: "q.sent", subjectType: "quote" });
  await audit(f, { action: "t.moved", subjectType: "trip" });
  await audit(f, { action: "i.paid", subjectType: "invoice" });
  await audit(f, { action: "c.submit", subjectType: "contact_inquiry" });
  const requests = await f.store.historyRows({ types: ["quote"] }, 100);
  assert.deepEqual(requests.map((r) => r.action), ["q.sent"]);
  assert.equal(await f.store.historyTotal({ types: ["quote", "trip"] }), 2);
  const other = await f.store.historyRows({ excludeTypes: ["quote", "trip", "invoice"] }, 100);
  assert.deepEqual(other.map((r) => r.action), ["c.submit"]);
  assert.equal(await f.store.historyTotal({ excludeTypes: ["quote", "trip", "invoice"] }), 1);
});

test("the search is case-insensitive and treats % and _ as plain characters", async () => {
  const f = fresh();
  await audit(f, { action: "Quote.Sent", subjectType: "quote" });
  await audit(f, { action: "quote_sent", subjectType: "quote" });
  await audit(f, { action: "quoteXsent", subjectType: "quote" });
  await audit(f, { action: "invoice.100%.paid", subjectType: "invoice" });
  assert.deepEqual((await f.store.historyRows({ q: "QUOTE.sent" }, 100)).map((r) => r.action), ["Quote.Sent"]);
  // A bare underscore must not match any one character.
  assert.deepEqual((await f.store.historyRows({ q: "quote_sent" }, 100)).map((r) => r.action), ["quote_sent"]);
  assert.equal(await f.store.historyTotal({ q: "quote_sent" }), 1);
  // A bare percent must not match everything.
  assert.deepEqual((await f.store.historyRows({ q: "100%" }, 100)).map((r) => r.action), ["invoice.100%.paid"]);
  assert.equal(likePattern("100%"), "%100\\%%");
});

test("a tab and a search combine", async () => {
  const f = fresh();
  await audit(f, { action: "x.sent", subjectType: "quote" });
  await audit(f, { action: "x.sent", subjectType: "trip" });
  assert.equal(await f.store.historyTotal({ types: ["trip"], q: "sent" }), 1);
  assert.equal(await f.store.historyTotal({ types: ["invoice"], q: "sent" }), 0);
});

test("the actor's email and name come from users, and a row with no actor reads null", async () => {
  const f = fresh();
  const [u] = await f.client
    .insert(users)
    .values({ email: "desk@example.com", firstName: "Dana", lastName: "Desk", role: "dispatcher" } as never)
    .returning({ id: users.id });
  await audit(f, { action: "by.staff", subjectType: "trip", actorUserId: u.id, actorRole: "dispatcher" });
  await audit(f, { action: "by.nobody", subjectType: "trip" });
  const [nobody, staff] = await f.store.historyRows({}, 100);
  assert.equal(staff.actorEmail, "desk@example.com");
  assert.equal(staff.actorFirstName, "Dana");
  assert.equal(staff.actorLastName, "Desk");
  assert.equal(staff.actorRole, "dispatcher");
  assert.equal(nobody.actorEmail, null);
  assert.equal(nobody.actorFirstName, null);
});

test("diff and metadata come back as JSON objects", async () => {
  const f = fresh();
  await audit(f, { action: "j", subjectType: "quote", diff: { status: ["a", "b"] }, metadata: { reason: "x" } });
  const [row] = await f.store.historyRows({}, 1);
  assert.deepEqual(row.diff, { status: ["a", "b"] });
  assert.deepEqual(row.metadata, { reason: "x" });
});

test("the subject name reads a quote's first and last name from its contact snapshot", async () => {
  const f = fresh();
  const now = Date.UTC(2026, 10, 1);
  const snap = (first: string | null, last: string | null) => JSON.stringify({ firstName: first, lastName: last });
  const q = f.sqlite.prepare(
    "insert into quotes (id, quote_code, trip_type, pax_count, status_token, received_at, sla_deadline_at, created_at, updated_at, contact_snapshot) values (?, ?, 'one_way', 2, ?, ?, ?, ?, ?, ?)",
  );
  q.run("q-full", "JN-1", "tok1", now, now, now, now, snap("Tom", "Okafor"));
  q.run("q-first", "JN-2", "tok2", now, now, now, now, snap("Tom", null));
  q.run("q-none", "JN-3", "tok3", now, now, now, now, snap(null, null));
  await audit(f, { action: "quote.sent", subjectType: "quote", subjectId: "q-full" });
  await audit(f, { action: "quote.sent", subjectType: "quote", subjectId: "q-first" });
  await audit(f, { action: "quote.sent", subjectType: "quote", subjectId: "q-none" });
  await audit(f, { action: "quote.sent", subjectType: "quote", subjectId: "q-missing" });
  await audit(f, { action: "x", subjectType: "contact_inquiry", subjectId: "c-1" });
  const names = new Map((await f.store.historyRows({}, 100)).map((r) => [r.subjectId, r.subjectName]));
  assert.equal(names.get("q-full"), "Tom Okafor");
  assert.equal(names.get("q-first"), "Tom");
  assert.equal(names.get("q-none"), null);
  assert.equal(names.get("q-missing"), null);
  assert.equal(names.get("c-1"), null);
});

test("the subject name reads a member's name from users, for a member row and for a membership row", async () => {
  const f = fresh();
  const [u] = await f.client
    .insert(users)
    .values({ email: "ada@example.com", firstName: "Ada", lastName: "Lovelace" } as never)
    .returning({ id: users.id });
  const [m] = await f.client.insert(members).values({ userId: u.id, memberCode: "JN-0001" } as never).returning({ id: members.id });
  await audit(f, { action: "member.update", subjectType: "member", subjectId: m.id });
  await audit(f, { action: "membership.renew", subjectType: "membership", subjectId: m.id });
  const rows = await f.store.historyRows({}, 100);
  assert.deepEqual(rows.map((r) => r.subjectName), ["Ada Lovelace", "Ada Lovelace"]);
});
