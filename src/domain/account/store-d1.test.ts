import test from "node:test";
import assert from "node:assert/strict";
import { freshD1WithBatch } from "@/db/d1/test-batch-client";
import { aircraft } from "@/db/d1/schema/aircraft";
import { invoices } from "@/db/d1/schema/invoices";
import { members } from "@/db/d1/schema/members";
import { operators } from "@/db/d1/schema/operators";
import { quoteLegs, quotes } from "@/db/d1/schema/quotes";
import { tripLegs, trips } from "@/db/d1/schema/trips";
import { users } from "@/db/d1/schema/users";
import { d1AccountStore } from "./store-d1";

// OPS-164: contract tests for the D1 account store (the signed-in client's home and Quotes
// list), on a real SQLite with the repo's own D1 migrations applied and foreign keys on, as D1
// has them. Each case is the call the Postgres adapter answers.

const HOUR = 3_600_000;
const NOW = new Date("2026-11-18T14:00:00.000Z");
const at = (ms: number) => new Date(NOW.getTime() + ms);

function fresh() {
  const { sqlite, client } = freshD1WithBatch();
  return { sqlite, client, store: d1AccountStore(client) };
}
type Fresh = ReturnType<typeof fresh>;

let seq = 0;
const n = () => ++seq;

async function user(c: Fresh["client"]) {
  const [u] = await c.insert(users).values({ email: `u${n()}@example.com` } as never).returning({ id: users.id });
  return u.id;
}

async function member(c: Fresh["client"]) {
  const userId = await user(c);
  const [m] = await c
    .insert(members)
    .values({ userId, memberCode: `M-2026-${String(n()).padStart(4, "0")}` })
    .returning({ id: members.id });
  return { id: m.id, userId };
}

async function quote(c: Fresh["client"], over: Record<string, unknown> = {}) {
  const [q] = await c
    .insert(quotes)
    .values({
      quoteCode: `JN-2026-${String(n()).padStart(5, "0")}`,
      tripType: "one_way",
      paxCount: 2,
      status: "submitted",
      receivedAt: at(-HOUR),
      slaDeadlineAt: at(HOUR),
      ...over,
    } as never)
    .returning({ id: quotes.id });
  return q.id;
}

async function trip(c: Fresh["client"], memberId: string, over: Record<string, unknown> = {}) {
  const [t] = await c
    .insert(trips)
    .values({
      tripCode: `JN-2026-${String(n()).padStart(4, "0")}`,
      memberId,
      missionType: "one_way",
      paxCount: 2,
      status: "confirmed",
      ...over,
    } as never)
    .returning({ id: trips.id });
  return t.id;
}

test("openQuotes: made by the user with no member, owned by the member, a stranger's left out; only in-progress statuses; newest first; the limit", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const stranger = await user(client);
  const mine = await quote(client, { createdByUserId: m.userId, receivedAt: at(-3 * HOUR) });
  const viaMember = await quote(client, { memberId: m.id, createdByUserId: stranger, receivedAt: at(-1 * HOUR) });
  await quote(client, { createdByUserId: m.userId, status: "declined" }); // closed: not in progress
  await quote(client, { createdByUserId: stranger, receivedAt: at(-30 * 60_000) });
  const IN_PROGRESS = ["submitted", "triaged", "sourcing", "options_sent", "held"] as never;

  const both = await store.openQuotes({ owner: { userId: m.userId, memberId: m.id }, statuses: IN_PROGRESS, limit: 50 });
  assert.deepEqual(both.map((q) => q.id), [viaMember, mine]);
  assert.ok(both[0].slaDeadlineAt instanceof Date);
  assert.equal(both[0].paxCount, 2);
  assert.equal(both[0].status, "submitted");
  assert.equal(both[0].assignedDispatcherId, null);
  assert.ok(both[0].statusToken.length > 0);

  // No member: ownership by the user who made the quote only.
  const onlyMine = await store.openQuotes({ owner: { userId: m.userId, memberId: null }, statuses: IN_PROGRESS, limit: 50 });
  assert.deepEqual(onlyMine.map((q) => q.id), [mine]);

  assert.deepEqual(
    (await store.openQuotes({ owner: { userId: m.userId, memberId: m.id }, statuses: IN_PROGRESS, limit: 1 })).map((q) => q.id),
    [viaMember],
  );
});

test("clientQuotes: every status, newest first, the limit, with the indicative range and the category", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const old = await quote(client, { createdByUserId: m.userId, status: "declined", receivedAt: at(-5 * HOUR) });
  const mid = await quote(client, { memberId: m.id, status: "accepted", receivedAt: at(-3 * HOUR), indicativeLowUsd: 9000, indicativeHighUsd: 12000, requestedCategory: "midsize" });
  const fresh1 = await quote(client, { createdByUserId: m.userId, receivedAt: at(-1 * HOUR) });
  await quote(client, { createdByUserId: await user(client) });
  const rows = await store.clientQuotes({ owner: { userId: m.userId, memberId: m.id }, limit: 50 });
  assert.deepEqual(rows.map((r) => r.id), [fresh1, mid, old]);
  assert.equal(rows[1].indicativeLowUsd, 9000);
  assert.equal(rows[1].indicativeHighUsd, 12000);
  assert.equal(rows[1].requestedCategory, "midsize");
  assert.equal(rows[0].indicativeLowUsd, null);
  assert.ok(rows[0].quoteCode.startsWith("JN-2026-"));
  assert.ok(rows[0].receivedAt instanceof Date);
  assert.equal((await store.clientQuotes({ owner: { userId: m.userId, memberId: m.id }, limit: 2 })).length, 2);
  assert.deepEqual(await store.clientQuotes({ owner: { userId: await user(client), memberId: null }, limit: 50 }), []);
});

test("quoteLegsOf over 60 quotes crosses a chunk and keeps each quote's legs in leg order", async () => {
  const { client, store } = fresh();
  const ids: string[] = [];
  for (let i = 0; i < 60; i++) {
    const id = await quote(client);
    ids.push(id);
    // Insert the second leg first: the read must sort by leg number.
    await client.insert(quoteLegs).values({ quoteId: id, legNumber: 2, fromIata: "TEB", toIata: "VNY", fromCity: "Teterboro", toCity: "Van Nuys", departDate: "2026-12-05" } as never);
    await client.insert(quoteLegs).values({ quoteId: id, legNumber: 1, fromIata: "VNY", toIata: "TEB", fromCity: "Van Nuys", toCity: "Teterboro", departDate: "2026-12-01" } as never);
  }
  const rows = await store.quoteLegsOf(ids);
  assert.equal(rows.length, 120);
  for (const id of ids) {
    const mine = rows.filter((r) => r.quoteId === id);
    assert.deepEqual(mine.map((r) => r.legNumber), [1, 2]);
    assert.equal(mine[0].fromIata, "VNY");
    assert.equal(mine[1].departDate, "2026-12-05");
  }
  assert.deepEqual(await store.quoteLegsOf([]), []);
});

test("homeTrips: newest first, the limit, another member's trip left out", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const other = await member(client);
  const [op] = await client.insert(operators).values({ name: "Acme Air" } as never).returning({ id: operators.id });
  const [ac] = await client
    .insert(aircraft)
    .values({ tailNumber: "N123AB", operatorId: op.id, category: "midsize", makeModel: "Citation XLS", seats: 8, rangeNm: 1800, speedKt: 440 } as never)
    .returning({ id: aircraft.id });
  const old = await trip(client, m.id, { createdAt: at(-3 * HOUR) });
  const newest = await trip(client, m.id, { createdAt: at(-1 * HOUR), aircraftId: ac.id, revenueUsd: 8000 });
  await trip(client, other.id, { createdAt: at(-30 * 60_000) });
  const rows = await store.homeTrips(m.id, 100);
  assert.deepEqual(rows.map((r) => r.id), [newest, old]);
  assert.equal(rows[0].aircraftId, ac.id);
  assert.equal(rows[0].revenueUsd, 8000);
  assert.equal(rows[0].status, "confirmed");
  assert.ok(rows[0].code.startsWith("JN-2026-"));
  assert.equal(rows[1].aircraftId, null);
  assert.deepEqual((await store.homeTrips(m.id, 1)).map((r) => r.id), [newest]);
});

test("homeTripLegs over 60 trips keeps leg order and returns Dates for the scheduled times", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const ids: string[] = [];
  for (let i = 0; i < 60; i++) {
    const id = await trip(client, m.id);
    ids.push(id);
    await client.insert(tripLegs).values({ tripId: id, legNumber: 2, fromIata: "TEB", toIata: "VNY", departDate: "2026-12-05", departTime: "09:00" } as never);
    await client
      .insert(tripLegs)
      .values({ tripId: id, legNumber: 1, fromIata: "VNY", toIata: "TEB", fromCity: "Van Nuys", fromName: "Van Nuys Airport", departDate: "2026-12-01", departTime: "08:30", scheduledDepAt: at(HOUR), scheduledArrAt: at(6 * HOUR) } as never);
  }
  const rows = await store.homeTripLegs(ids);
  assert.equal(rows.length, 120);
  for (const id of ids) {
    const mine = rows.filter((r) => r.tripId === id);
    assert.deepEqual(mine.map((r) => r.departDate), ["2026-12-01", "2026-12-05"]);
    assert.ok(mine[0].scheduledDepAt instanceof Date);
    assert.equal(mine[0].scheduledDepAt?.getTime(), at(HOUR).getTime());
    assert.equal(mine[0].scheduledArrAt?.getTime(), at(6 * HOUR).getTime());
    assert.equal(mine[0].fromName, "Van Nuys Airport");
    assert.equal(mine[1].scheduledDepAt, null);
  }
  assert.deepEqual(await store.homeTripLegs([]), []);
});

test("aircraftCards returns model, category and seats of the asked aircraft only", async () => {
  const { client, store } = fresh();
  const [op] = await client.insert(operators).values({ name: "Acme Air" } as never).returning({ id: operators.id });
  const plane = async (tail: string, makeModel: string, category: string, seats: number) => {
    const [a] = await client
      .insert(aircraft)
      .values({ tailNumber: tail, operatorId: op.id, category, makeModel, seats, rangeNm: 1800, speedKt: 440 } as never)
      .returning({ id: aircraft.id });
    return a.id;
  };
  const a1 = await plane("N1", "Citation XLS", "midsize", 8);
  const a2 = await plane("N2", "Gulfstream G550", "heavy", 14);
  await plane("N3", "King Air", "turboprop", 6);
  const rows = await store.aircraftCards([a1, a2]);
  assert.deepEqual(
    rows.map((r) => [r.makeModel, r.category, r.seats]).sort(),
    [
      ["Citation XLS", "midsize", 8],
      ["Gulfstream G550", "heavy", 14],
    ],
  );
  assert.deepEqual(await store.aircraftCards([]), []);
});

test("invoiceFacts returns status, total and paid-on of every invoice of the member, due, overdue, paid and void", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const other = await member(client);
  const inv = (memberId: string, over: Record<string, unknown>) =>
    client.insert(invoices).values({ memberId, invoiceCode: `INV-2026-${String(n()).padStart(4, "0")}`, issuedOn: "2026-11-01", ...over } as never);
  await inv(m.id, { status: "due", totalUsd: 1200, dueOn: "2026-12-01" });
  await inv(m.id, { status: "overdue", totalUsd: 800, dueOn: "2026-11-05" });
  await inv(m.id, { status: "paid", totalUsd: 5000, paidOn: "2026-10-20" });
  await inv(m.id, { status: "void", totalUsd: 77 });
  await inv(other.id, { status: "due", totalUsd: 999 });
  const rows = await store.invoiceFacts(m.id);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((r) => r.status).sort(), ["due", "overdue", "paid", "void"]);
  const paid = rows.find((r) => r.status === "paid");
  assert.deepEqual(paid, { status: "paid", totalUsd: 5000, paidOn: "2026-10-20" });
  assert.equal(rows.find((r) => r.status === "due")?.paidOn, null);
  const nobody = await member(client);
  assert.deepEqual(await store.invoiceFacts(nobody.id), []);
});
