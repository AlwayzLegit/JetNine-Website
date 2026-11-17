import test from "node:test";
import assert from "node:assert/strict";
import { freshD1 } from "@/db/d1/test-client";
import { members } from "@/db/d1/schema/members";
import { users } from "@/db/d1/schema/users";
import { d1InquiryStore } from "./store-d1";

// OPS-122: contract tests for the D1 inquiry store (the contact form, the guide
// download, the desk count, the admin Website form tab and its handle and reopen
// action), on a real SQLite with the repo's own D1 migration applied and foreign
// keys on, as D1 has them.

function fresh() {
  const { sqlite, client } = freshD1();
  return { sqlite, client, store: d1InquiryStore(client) };
}

const inquiry = (over: Record<string, unknown> = {}) => ({
  reason: "quote" as const,
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  ...over,
});

async function staff(client: ReturnType<typeof fresh>["client"], email = "desk@example.com") {
  const [u] = await client.insert(users).values({ email, role: "dispatcher" } as never).returning({ id: users.id });
  return u.id;
}

test("insert an anonymous inquiry and read it back through listInquiries as new, nulls kept, createdAt a Date", async () => {
  const { store } = fresh();
  const { id } = await store.insertInquiry(inquiry({ notes: "Thinking out loud" }));
  assert.ok(id.length > 0);
  const rows = await store.listInquiries(false, 100);
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.id, id);
  assert.equal(row.status, "new");
  assert.equal(row.reason, "quote");
  assert.equal(row.firstName, "Ada");
  assert.equal(row.notes, "Thinking out loud");
  assert.equal(row.phone, null);
  assert.equal(row.fromText, null);
  assert.equal(row.memberId, null);
  assert.equal(row.handledAt, null);
  assert.equal(row.handledByEmail, null);
  assert.ok(row.createdAt instanceof Date);
});

test("the guide download shape (reason other, notes, no phone) inserts", async () => {
  const { store } = fresh();
  const { id } = await store.insertInquiry({
    reason: "other",
    firstName: "Grace",
    lastName: "—",
    email: "grace@example.com",
    notes: "Pricing guide download · flies privately: monthly",
    status: "new",
  });
  const [row] = await store.listInquiries(false, 100);
  assert.equal(row.id, id);
  assert.equal(row.reason, "other");
  assert.equal(row.lastName, "—");
});

test("a smoke inquiry inserted as handled stays out of the open list and the new count", async () => {
  const { store } = fresh();
  await store.insertInquiry(inquiry({ status: "handled" }));
  assert.equal(await store.newCount(), 0);
  assert.equal((await store.listInquiries(false, 100)).length, 0);
  assert.equal((await store.listInquiries(true, 100)).length, 1);
});

test("a reason or a status outside the enum fails on the CHECK", async () => {
  const { store } = fresh();
  await assert.rejects(() => store.insertInquiry(inquiry({ reason: "spam" })));
  await assert.rejects(() => store.insertInquiry(inquiry({ status: "closed" })));
  assert.equal((await store.listInquiries(true, 100)).length, 0);
});

test("a memberId of an unknown member fails on the foreign key", async () => {
  const { store } = fresh();
  await assert.rejects(() => store.insertInquiry(inquiry({ memberId: "no-such-member" })));
});

test("a signed-in member's inquiry keeps the member id", async () => {
  const { client, store } = fresh();
  const [u] = await client.insert(users).values({ email: "m@example.com" } as never).returning({ id: users.id });
  const [m] = await client
    .insert(members)
    .values({ userId: u.id, memberCode: "JN-0001" } as never)
    .returning({ id: members.id });
  await store.insertInquiry(inquiry({ memberId: m.id }));
  const [row] = await store.listInquiries(false, 100);
  assert.equal(row.memberId, m.id);
});

test("newCount counts only new inquiries", async () => {
  const { store } = fresh();
  assert.equal(await store.newCount(), 0);
  await store.insertInquiry(inquiry({ email: "a@example.com" }));
  await store.insertInquiry(inquiry({ email: "b@example.com" }));
  const { id } = await store.insertInquiry(inquiry({ email: "c@example.com" }));
  assert.equal(await store.newCount(), 3);
  await store.setStatus(id, { status: "handled", handledByUserId: null, handledAt: new Date() });
  assert.equal(await store.newCount(), 2);
});

test("listInquiries leaves handled ones out, or includes them newest first, and respects the limit", async () => {
  const { store } = fresh();
  const first = await store.insertInquiry(inquiry({ email: "1@example.com", createdAt: new Date("2026-11-01T10:00:00Z") }));
  const second = await store.insertInquiry(inquiry({ email: "2@example.com", createdAt: new Date("2026-11-02T10:00:00Z") }));
  const third = await store.insertInquiry(inquiry({ email: "3@example.com", createdAt: new Date("2026-11-03T10:00:00Z") }));
  await store.setStatus(second.id, { status: "handled", handledByUserId: null, handledAt: new Date() });

  const open = await store.listInquiries(false, 100);
  assert.deepEqual(open.map((r) => r.id), [third.id, first.id]);

  const all = await store.listInquiries(true, 100);
  assert.deepEqual(all.map((r) => r.id), [third.id, second.id, first.id]);

  const limited = await store.listInquiries(true, 2);
  assert.deepEqual(limited.map((r) => r.id), [third.id, second.id]);
});

test("setStatus handled stamps the user and the time, and the list returns that user's email", async () => {
  const { client, store } = fresh();
  const userId = await staff(client);
  const { id } = await store.insertInquiry(inquiry());
  const at = new Date("2026-11-17T12:30:00Z");
  const set = await store.setStatus(id, { status: "handled", handledByUserId: userId, handledAt: at });
  assert.deepEqual(set, { id });
  const [row] = await store.listInquiries(true, 100);
  assert.equal(row.status, "handled");
  assert.equal(row.handledByEmail, "desk@example.com");
  assert.equal(row.handledAt?.getTime(), at.getTime());
});

test("setStatus new clears the handler and the time", async () => {
  const { client, store } = fresh();
  const userId = await staff(client);
  const { id } = await store.insertInquiry(inquiry());
  await store.setStatus(id, { status: "handled", handledByUserId: userId, handledAt: new Date() });
  await store.setStatus(id, { status: "new", handledByUserId: null, handledAt: null });
  const [row] = await store.listInquiries(false, 100);
  assert.equal(row.id, id);
  assert.equal(row.status, "new");
  assert.equal(row.handledByEmail, null);
  assert.equal(row.handledAt, null);
});

test("setStatus on an unknown id returns undefined", async () => {
  const { store } = fresh();
  assert.equal(await store.setStatus("no-such-inquiry", { status: "new", handledByUserId: null, handledAt: null }), undefined);
});

test("statusOf returns the id and status, and undefined for an unknown id", async () => {
  const { store } = fresh();
  const { id } = await store.insertInquiry(inquiry());
  assert.deepEqual(await store.statusOf(id), { id, status: "new" });
  await store.setStatus(id, { status: "handled", handledByUserId: null, handledAt: new Date() });
  assert.deepEqual(await store.statusOf(id), { id, status: "handled" });
  assert.equal(await store.statusOf("no-such-inquiry"), undefined);
});

test("deleting the handling user keeps the inquiry and clears the handler (on delete set null)", async () => {
  const { sqlite, client, store } = fresh();
  const userId = await staff(client);
  const { id } = await store.insertInquiry(inquiry());
  await store.setStatus(id, { status: "handled", handledByUserId: userId, handledAt: new Date() });
  sqlite.prepare("delete from users where id = ?").run(userId);
  const [row] = await store.listInquiries(true, 100);
  assert.equal(row.id, id);
  assert.equal(row.handledByEmail, null);
});
