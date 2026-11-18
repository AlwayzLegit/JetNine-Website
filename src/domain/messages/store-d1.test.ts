import test from "node:test";
import assert from "node:assert/strict";
import { freshD1 } from "@/db/d1/test-client";
import { members } from "@/db/d1/schema/members";
import { quoteLegs, quotes } from "@/db/d1/schema/quotes";
import { tripLegs, trips } from "@/db/d1/schema/trips";
import { users } from "@/db/d1/schema/users";
import { d1MessageStore } from "./store-d1";
import { isDuplicateMessage } from "./store";
import { laDayBounds } from "./day";

// OPS-127: contract tests for the D1 message store (the admin inbox, one thread,
// failed deliveries, mark read, the desk counts, emails sent today, a member's
// trip timeline and the three webhooks' writes), on a real SQLite with the
// repo's own D1 migrations applied and foreign keys on, as D1 has them.

function fresh() {
  const { sqlite, client } = freshD1();
  return { sqlite, client, store: d1MessageStore(client) };
}

type Fresh = ReturnType<typeof fresh>;

const out = (over: Record<string, unknown> = {}) => ({
  subjectType: "quote" as const,
  subjectId: "q1",
  channel: "email" as const,
  direction: "out" as const,
  body: "Hello",
  preview: "Hello",
  ...over,
});

const inb = (over: Record<string, unknown> = {}) => out({ direction: "in", ...over });

async function user(client: Fresh["client"], email = "desk@example.com", firstName: string | null = "Dee") {
  const [u] = await client
    .insert(users)
    .values({ email, firstName, role: "dispatcher" } as never)
    .returning({ id: users.id });
  return u.id;
}

const at = (iso: string) => new Date(iso);

test("insert an outbound message and read it back through thread with the author's name and email", async () => {
  const { client, store } = fresh();
  const author = await user(client);
  const { id } = await store.insertMessage(out({ fromUserId: author }) as never);
  assert.ok(id.length > 0);
  const rows = await store.thread("quote", "q1", 500);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, id);
  assert.equal(rows[0].fromUserFirstName, "Dee");
  assert.equal(rows[0].fromUserEmail, "desk@example.com");
  assert.equal(rows[0].direction, "out");
  assert.equal(rows[0].deliveryStatus, "skipped");
  assert.ok(rows[0].occurredAt instanceof Date);
});

test("channel, direction and delivery status outside the enum each fail on the CHECK", async () => {
  const { store } = fresh();
  await assert.rejects(() => store.insertMessage(out({ channel: "pigeon" }) as never));
  await assert.rejects(() => store.insertMessage(out({ direction: "sideways" }) as never));
  await assert.rejects(() => store.insertMessage(out({ deliveryStatus: "lost" }) as never));
});

test("an unknown from_user_id fails on the foreign key", async () => {
  const { store } = fresh();
  await assert.rejects(() => store.insertMessage(out({ fromUserId: "no-such-user" }) as never));
});

test("setDelivery sets sent, provider, id and deliveredAt, and a partial patch leaves the rest alone", async () => {
  const { store } = fresh();
  const { id } = await store.insertMessage(out({ deliveryStatus: "queued" }) as never);
  const when = at("2026-11-17T20:00:00Z");
  await store.setDelivery(id, {
    deliveryStatus: "sent",
    deliveryProvider: "resend",
    deliveryMessageId: "re_1",
    deliveryError: null,
    deliveredAt: when,
  });
  let [row] = await store.thread("quote", "q1", 10);
  assert.equal(row.deliveryStatus, "sent");
  assert.equal(row.deliveryProvider, "resend");
  await store.setDelivery(id, { deliveryError: "late warning" });
  [row] = await store.thread("quote", "q1", 10);
  assert.equal(row.deliveryStatus, "sent", "status untouched by a patch that leaves it out");
  assert.equal(row.deliveryError, "late warning");
});

test("markFailedByProviderId marks the matching message failed and returns its subject; unknown id returns nothing", async () => {
  const { store } = fresh();
  const { id } = await store.insertMessage(
    out({ deliveryStatus: "sent", deliveryMessageId: "re_9", toAddress: "a@example.com", preview: "Hi" }) as never,
  );
  assert.deepEqual(await store.markFailedByProviderId("re_unknown", "x"), []);
  const hit = await store.markFailedByProviderId("re_9", "email.bounced: hard bounce");
  assert.equal(hit.length, 1);
  assert.equal(hit[0].id, id);
  assert.equal(hit[0].subjectType, "quote");
  assert.equal(hit[0].subjectId, "q1");
  assert.equal(hit[0].toAddress, "a@example.com");
  const [row] = await store.thread("quote", "q1", 10);
  assert.equal(row.deliveryStatus, "failed");
  assert.equal(row.deliveryError, "email.bounced: hard bounce");
});

test("a second inbound with the same provider message id is refused as a duplicate; outbound ids may repeat", async () => {
  const { store } = fresh();
  await store.insertMessage(inb({ deliveryMessageId: "pm_1" }) as never);
  let caught: unknown;
  try {
    await store.insertMessage(inb({ subjectId: "q2", deliveryMessageId: "pm_1" }) as never);
  } catch (e) {
    caught = e;
  }
  assert.ok(caught, "the duplicate inbound insert throws");
  assert.equal(isDuplicateMessage(caught), true);
  // Inbound without a provider id, and outbound with a repeated id, are fine.
  await store.insertMessage(inb({ subjectId: "q3" }) as never);
  await store.insertMessage(inb({ subjectId: "q4" }) as never);
  await store.insertMessage(out({ deliveryMessageId: "pm_1" }) as never);
  await store.insertMessage(out({ subjectId: "q5", deliveryMessageId: "pm_1" }) as never);
});

test("isDuplicateMessage reads Postgres 23505, a D1 message and a wrapped cause, and nothing else", () => {
  assert.equal(isDuplicateMessage({ code: "23505" }), true);
  assert.equal(isDuplicateMessage(new Error("D1_ERROR: UNIQUE constraint failed: messages.delivery_message_id: SQLITE_CONSTRAINT")), true);
  assert.equal(isDuplicateMessage(new Error("Failed query", { cause: { code: "23505" } })), true);
  assert.equal(isDuplicateMessage(new Error("connection reset")), false);
  assert.equal(isDuplicateMessage({ code: "23503" }), false);
  assert.equal(isDuplicateMessage(null), false);
  assert.equal(isDuplicateMessage("UNIQUE constraint failed"), false);
});

test("markThreadRead clears unread inbound on that thread only and counts the rows", async () => {
  const { store } = fresh();
  await store.insertMessage(inb({ subjectId: "q1" }) as never);
  await store.insertMessage(inb({ subjectId: "q1" }) as never);
  await store.insertMessage(out({ subjectId: "q1" }) as never);
  await store.insertMessage(inb({ subjectId: "q2" }) as never);
  assert.equal(await store.unreadInThread("quote", "q1"), 2);
  assert.equal(await store.markThreadRead("quote", "q1"), 2);
  assert.equal(await store.unreadInThread("quote", "q1"), 0);
  assert.equal(await store.unreadInThread("quote", "q2"), 1);
  assert.equal(await store.markThreadRead("quote", "q1"), 0, "nothing left to change is a no-op");
});

test("threadSummaries gives threads newest first with lastAt a Date and the right unread and spoken counts", async () => {
  const { store } = fresh();
  await store.insertMessage(inb({ subjectId: "old", occurredAt: at("2026-11-01T10:00:00Z") }) as never);
  await store.insertMessage(inb({ subjectId: "mid", occurredAt: at("2026-11-05T10:00:00Z") }) as never);
  await store.insertMessage(out({ subjectId: "mid", occurredAt: at("2026-11-06T10:00:00Z") }) as never);
  await store.insertMessage(inb({ subjectType: "trip", subjectId: "new", channel: "voicemail", occurredAt: at("2026-11-10T10:00:00Z") }) as never);
  await store.insertMessage(inb({ subjectType: "invoice", subjectId: "inv", occurredAt: at("2026-11-12T10:00:00Z") }) as never);
  const rows = await store.threadSummaries(["quote", "trip", "member"], 100);
  assert.deepEqual(rows.map((r) => r.subjectId), ["new", "mid", "old"], "the invoice thread is left out");
  assert.ok(rows[0].lastAt instanceof Date);
  assert.equal(rows[0].lastAt.toISOString(), "2026-11-10T10:00:00.000Z");
  assert.equal(rows[0].spoken, 0, "a voicemail only thread has no spoken messages");
  assert.equal(rows[0].unread, 1);
  assert.equal(rows[1].unread, 1);
  assert.equal(rows[1].spoken, 2);
  assert.equal((await store.threadSummaries(["quote", "trip", "member"], 2)).length, 2, "the limit applies");
});

test("latestPerThread returns the newest message of each thread and only one per thread", async () => {
  const { store } = fresh();
  await store.insertMessage(inb({ subjectId: "a", body: "first", preview: "first", occurredAt: at("2026-11-01T10:00:00Z") }) as never);
  await store.insertMessage(out({ subjectId: "a", body: "second", preview: "second", occurredAt: at("2026-11-02T10:00:00Z") }) as never);
  await store.insertMessage(out({ subjectId: "b", body: "only", preview: "only", occurredAt: at("2026-11-03T10:00:00Z") }) as never);
  await store.insertMessage(out({ subjectId: "c", body: "not asked for", occurredAt: at("2026-11-04T10:00:00Z") }) as never);
  const rows = await store.latestPerThread(["quote", "trip", "member"], ["a", "b"]);
  assert.equal(rows.length, 2);
  const byId = new Map(rows.map((r) => [r.subjectId, r]));
  assert.equal(byId.get("a")?.preview, "second");
  assert.equal(byId.get("a")?.direction, "out");
  assert.equal(byId.get("b")?.body, "only");
  assert.deepEqual(await store.latestPerThread(["quote"], []), []);
});

test("latestPerThread stays inside D1's 100 parameter limit for a full thread list", async () => {
  const { sqlite, client, store } = fresh();
  const ids = Array.from({ length: 120 }, (_, i) => `thread-${i}`);
  await client.insert((await import("@/db/d1/schema/audit")).messages).values(
    ids.flatMap((subjectId, i) => [
      { subjectType: "quote", subjectId, channel: "email", direction: "in", body: "old", occurredAt: at("2026-11-01T10:00:00Z") },
      { subjectType: "quote", subjectId, channel: "email", direction: "out", body: `last-${i}`, occurredAt: at("2026-11-02T10:00:00Z") },
    ]) as never,
  );
  // From here on, refuse a query with more than 100 bound parameters, as D1 does.
  const prepare = sqlite.prepare.bind(sqlite);
  sqlite.prepare = ((query: string) => {
    const stmt = prepare(query);
    const all = stmt.all.bind(stmt);
    stmt.all = ((...params: unknown[]) => {
      if (params.length > 100) throw new Error(`too many SQL variables: ${params.length}`);
      return all(...(params as never[]));
    }) as typeof stmt.all;
    return stmt;
  }) as typeof sqlite.prepare;
  const rows = await store.latestPerThread(["quote", "trip", "member"], ids);
  assert.equal(rows.length, 120);
  assert.equal(new Set(rows.map((r) => r.subjectId)).size, 120);
  assert.ok(rows.every((r) => r.body === `last-${r.subjectId.slice(7)}`));
});

test("unreadThreadCount counts threads, not messages, and only inbound unread on the given kinds", async () => {
  const { store } = fresh();
  await store.insertMessage(inb({ subjectId: "a" }) as never);
  await store.insertMessage(inb({ subjectId: "a" }) as never);
  await store.insertMessage(inb({ subjectType: "trip", subjectId: "a" }) as never);
  await store.insertMessage(inb({ subjectId: "b", isRead: true }) as never);
  await store.insertMessage(out({ subjectId: "c" }) as never);
  await store.insertMessage(inb({ subjectType: "invoice", subjectId: "i" }) as never);
  assert.equal(await store.unreadThreadCount(["quote", "trip", "member"]), 2, "quote a and trip a are two threads");
  assert.equal(await store.unreadInbound(), 4, "the desk count is messages, any subject");
});

test("thread keeps the newest limit messages, newest first", async () => {
  const { store } = fresh();
  for (let i = 1; i <= 5; i++) {
    await store.insertMessage(out({ body: `m${i}`, occurredAt: at(`2026-11-0${i}T10:00:00Z`) }) as never);
  }
  const rows = await store.thread("quote", "q1", 3);
  assert.deepEqual(rows.map((r) => r.body), ["m5", "m4", "m3"]);
});

test("messageForRetry returns one message or nothing", async () => {
  const { store } = fresh();
  const { id } = await store.insertMessage(out({ deliveryStatus: "failed", toAddress: "a@example.com" }) as never);
  const m = await store.messageForRetry(id);
  assert.equal(m?.id, id);
  assert.equal(m?.deliveryStatus, "failed");
  assert.equal(m?.toAddress, "a@example.com");
  assert.equal(await store.messageForRetry("nope"), undefined);
});

test("failedSince leaves out sent, inbound and older messages, and joins the request and the trip", async () => {
  const { client, store } = fresh();
  const [q] = await client
    .insert(quotes)
    .values({
      quoteCode: "JN-2026-0001",
      tripType: "one_way",
      paxCount: 2,
      contactSnapshot: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
    } as never)
    .returning({ id: quotes.id });
  const memberUser = await user(client, "member@example.com", "Grace");
  const [mem] = await client
    .insert(members)
    .values({ userId: memberUser, memberCode: "M-1" } as never)
    .returning({ id: members.id });
  const [t] = await client
    .insert(trips)
    .values({ tripCode: "JN-2026-0100", memberId: mem.id, missionType: "one_way", paxCount: 3 } as never)
    .returning({ id: trips.id });
  const day = (d: number) => at(`2026-11-${String(d).padStart(2, "0")}T12:00:00Z`);
  await store.insertMessage(out({ subjectId: q.id, deliveryStatus: "failed", deliveryError: "bounce", occurredAt: day(16) }) as never);
  await store.insertMessage(out({ subjectType: "trip", subjectId: t.id, deliveryStatus: "failed", occurredAt: day(15) }) as never);
  await store.insertMessage(out({ subjectId: q.id, deliveryStatus: "sent", occurredAt: day(16) }) as never);
  await store.insertMessage(inb({ subjectId: q.id, deliveryStatus: "failed", occurredAt: day(16) }) as never);
  await store.insertMessage(out({ subjectId: q.id, deliveryStatus: "failed", occurredAt: day(1) }) as never);
  const rows = await store.failedSince(day(10));
  assert.equal(rows.length, 2);
  assert.equal(rows[0].subjectType, "quote", "newest first");
  assert.equal(rows[0].quoteCode, "JN-2026-0001");
  assert.equal(rows[0].quoteContact?.firstName, "Ada");
  assert.equal(rows[0].error, "bounce");
  assert.equal(rows[1].subjectType, "trip");
  assert.equal(rows[1].tripCode, "JN-2026-0100");
  assert.equal(rows[1].tripFirstName, "Grace");
  assert.ok(rows[1].occurredAt instanceof Date);
});

test("snapshotCounts gives unread inbound and the failed outbound inside the window", async () => {
  const { store } = fresh();
  const since = at("2026-11-10T00:00:00Z");
  await store.insertMessage(inb({ subjectId: "a" }) as never);
  await store.insertMessage(inb({ subjectId: "b", isRead: true }) as never);
  await store.insertMessage(out({ subjectId: "c", deliveryStatus: "failed", occurredAt: at("2026-11-12T00:00:00Z") }) as never);
  await store.insertMessage(out({ subjectId: "d", deliveryStatus: "failed", occurredAt: at("2026-11-01T00:00:00Z") }) as never);
  await store.insertMessage(out({ subjectId: "e", deliveryStatus: "sent", occurredAt: at("2026-11-12T00:00:00Z") }) as never);
  assert.deepEqual(await store.snapshotCounts(since), { unread: 1, failed: 1 });
  assert.deepEqual(await fresh().store.snapshotCounts(since), { unread: 0, failed: 0 });
});

test("emailsSentBetween counts only sent outbound email inside the two bounds, the end excluded", async () => {
  const { store } = fresh();
  const start = at("2026-11-17T08:00:00Z");
  const end = at("2026-11-18T08:00:00Z");
  await store.insertMessage(out({ deliveryStatus: "sent", occurredAt: at("2026-11-17T08:00:00Z") }) as never);
  await store.insertMessage(out({ deliveryStatus: "sent", occurredAt: at("2026-11-18T07:59:59Z") }) as never);
  await store.insertMessage(out({ deliveryStatus: "sent", occurredAt: end }) as never);
  await store.insertMessage(out({ deliveryStatus: "sent", occurredAt: at("2026-11-17T07:59:59Z") }) as never);
  await store.insertMessage(out({ deliveryStatus: "queued", occurredAt: at("2026-11-17T12:00:00Z") }) as never);
  await store.insertMessage(out({ deliveryStatus: "sent", channel: "sms", occurredAt: at("2026-11-17T12:00:00Z") }) as never);
  await store.insertMessage(inb({ deliveryStatus: "sent", occurredAt: at("2026-11-17T12:00:00Z") }) as never);
  assert.equal(await store.emailsSentBetween(start, end), 2);
});

test("memberTripTimeline returns only outbound messages of that trip, oldest first", async () => {
  const { store } = fresh();
  await store.insertMessage(out({ subjectType: "trip", subjectId: "t1", body: "second", occurredAt: at("2026-11-02T10:00:00Z") }) as never);
  await store.insertMessage(out({ subjectType: "trip", subjectId: "t1", body: "first", occurredAt: at("2026-11-01T10:00:00Z") }) as never);
  await store.insertMessage(inb({ subjectType: "trip", subjectId: "t1", body: "from the client" }) as never);
  await store.insertMessage(out({ subjectType: "trip", subjectId: "t2", body: "other trip" }) as never);
  const rows = await store.memberTripTimeline("t1");
  assert.deepEqual(rows.map((r) => r.body), ["first", "second"]);
  assert.ok(rows[0].occurredAt instanceof Date);
});

test("laDayBounds: an ordinary day, a time near midnight UTC, and the two daylight saving change days", () => {
  const iso = (d: Date) => d.toISOString();
  // Noon on 2026-11-17 in Los Angeles (PST, UTC-8): the day runs 08:00Z to 08:00Z.
  let b = laDayBounds(at("2026-11-17T20:00:00Z"));
  assert.equal(iso(b.start), "2026-11-17T08:00:00.000Z");
  assert.equal(iso(b.end), "2026-11-18T08:00:00.000Z");
  // 2026-11-18T05:00Z is still 21:00 on the 17th in Los Angeles.
  b = laDayBounds(at("2026-11-18T05:00:00Z"));
  assert.equal(iso(b.start), "2026-11-17T08:00:00.000Z");
  // 2026-11-18T08:00Z is exactly the next day's start.
  b = laDayBounds(at("2026-11-18T08:00:00Z"));
  assert.equal(iso(b.start), "2026-11-18T08:00:00.000Z");
  // Daylight saving ends on 2026-11-01: the day is 25 hours long.
  b = laDayBounds(at("2026-11-01T18:00:00Z"));
  assert.equal(iso(b.start), "2026-11-01T07:00:00.000Z");
  assert.equal(iso(b.end), "2026-11-02T08:00:00.000Z");
  // Daylight saving starts on 2026-03-08: the day is 23 hours long.
  b = laDayBounds(at("2026-03-08T20:00:00Z"));
  assert.equal(iso(b.start), "2026-03-08T08:00:00.000Z");
  assert.equal(iso(b.end), "2026-03-09T07:00:00.000Z");
});

test("threadSubjects: quotes with legs in leg order, trips with their client, members, and 60 quotes across a chunk", async () => {
  const { client, store } = fresh();
  assert.deepEqual(await store.threadSubjects({ quoteIds: [], tripIds: [], memberIds: [] }), {
    quotes: [],
    quoteLegs: [],
    trips: [],
    tripLegs: [],
    members: [],
  });

  // A quote whose two legs are inserted out of order.
  const [q] = await client
    .insert(quotes)
    .values({
      quoteCode: "JN-2026-0500",
      tripType: "round",
      paxCount: 2,
      status: "submitted",
      contactSnapshot: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
    } as never)
    .returning({ id: quotes.id });
  await client.insert(quoteLegs).values({ quoteId: q.id, legNumber: 2, fromCity: "Teterboro", toCity: "Van Nuys", departDate: "2026-12-05" } as never);
  await client.insert(quoteLegs).values({ quoteId: q.id, legNumber: 1, fromCity: "Van Nuys", fromIata: "VNY", toCity: "Teterboro", toIata: "TEB", departDate: "2026-12-01" } as never);

  const memberUser = await user(client, "grace@example.com", "Grace");
  const [mem] = await client
    .insert(members)
    .values({ userId: memberUser, memberCode: "M-7", mobileE164: "+13105550123" } as never)
    .returning({ id: members.id });
  const [t] = await client
    .insert(trips)
    .values({ tripCode: "JN-2026-0600", memberId: mem.id, missionType: "one_way", paxCount: 3, status: "confirmed" } as never)
    .returning({ id: trips.id });
  await client.insert(tripLegs).values({ tripId: t.id, legNumber: 2, fromCity: "B", toCity: "C", departDate: "2026-12-09" } as never);
  await client.insert(tripLegs).values({ tripId: t.id, legNumber: 1, fromCity: "A", toCity: "B", departDate: "2026-12-08" } as never);

  // Sixty more quotes, so the id list crosses the chunk size.
  const manyIds: string[] = [];
  for (let i = 0; i < 60; i++) {
    const [r] = await client
      .insert(quotes)
      .values({
        quoteCode: `JN-2026-${String(700 + i).padStart(4, "0")}`,
        tripType: "one_way",
        paxCount: 1,
        contactSnapshot: { firstName: "N", lastName: String(i), email: `n${i}@example.com` },
      } as never)
      .returning({ id: quotes.id });
    manyIds.push(r.id);
  }

  const got = await store.threadSubjects({ quoteIds: [q.id, ...manyIds, "no-such-quote"], tripIds: [t.id, "no-such-trip"], memberIds: [mem.id] });
  assert.equal(got.quotes.length, 61);
  const quote = got.quotes.find((r) => r.id === q.id);
  assert.equal(quote?.status, "submitted");
  assert.equal(quote?.contactSnapshot?.firstName, "Ada");
  const legsOfQuote = got.quoteLegs.filter((l) => l.quoteId === q.id);
  assert.deepEqual(legsOfQuote.map((l) => l.fromCity), ["Van Nuys", "Teterboro"], "leg_number order");
  assert.equal(legsOfQuote[0].departDate, "2026-12-01");
  assert.equal(legsOfQuote[0].fromIata, "VNY");

  assert.equal(got.trips.length, 1);
  assert.equal(got.trips[0].id, t.id);
  assert.equal(got.trips[0].status, "confirmed");
  assert.equal(got.trips[0].memberId, mem.id);
  assert.equal(got.trips[0].email, "grace@example.com");
  assert.equal(got.trips[0].firstName, "Grace");
  assert.deepEqual(got.tripLegs.map((l) => l.fromCity), ["A", "B"]);
  assert.ok(got.tripLegs.every((l) => l.tripId === t.id));

  assert.equal(got.members.length, 1);
  assert.equal(got.members[0].id, mem.id);
  assert.equal(got.members[0].mobile, "+13105550123");
  assert.equal(got.members[0].email, "grace@example.com");
  assert.ok(typeof got.members[0].tier === "string");
});

test("subjectCode returns a quote's or a trip's code, and null for an unknown id", async () => {
  const { client, store } = fresh();
  const [q] = await client
    .insert(quotes)
    .values({ quoteCode: "JN-2026-0800", tripType: "one_way", paxCount: 1, contactSnapshot: { firstName: "A", lastName: "B", email: "a@example.com" } } as never)
    .returning({ id: quotes.id });
  const memberUser = await user(client, "m2@example.com", "Mo");
  const [mem] = await client.insert(members).values({ userId: memberUser, memberCode: "M-8" } as never).returning({ id: members.id });
  const [t] = await client
    .insert(trips)
    .values({ tripCode: "JN-2026-0801", memberId: mem.id, missionType: "one_way", paxCount: 1 } as never)
    .returning({ id: trips.id });
  assert.equal(await store.subjectCode("quote", q.id), "JN-2026-0800");
  assert.equal(await store.subjectCode("trip", t.id), "JN-2026-0801");
  assert.equal(await store.subjectCode("quote", "no-such-quote"), null);
  assert.equal(await store.subjectCode("trip", t.id + "x"), null);
  // A trip id asked as a quote is not found.
  assert.equal(await store.subjectCode("quote", t.id), null);
});
