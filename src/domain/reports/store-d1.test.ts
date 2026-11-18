import test from "node:test";
import assert from "node:assert/strict";
import { freshD1WithBatch } from "@/db/d1/test-batch-client";
import { aircraft } from "@/db/d1/schema/aircraft";
import { airports } from "@/db/d1/schema/airports";
import { emptyLegs } from "@/db/d1/schema/empty-legs";
import { invoices } from "@/db/d1/schema/invoices";
import { members } from "@/db/d1/schema/members";
import { operators } from "@/db/d1/schema/operators";
import { quoteLegs, quotes } from "@/db/d1/schema/quotes";
import { tripLegs, trips } from "@/db/d1/schema/trips";
import { users } from "@/db/d1/schema/users";
import { d1ReportStore } from "./store-d1";

// OPS-163: contract tests for the D1 report store (the desk's sidebar count and snapshot, the
// Reports page and the 7 AM morning summary), on a real SQLite with the repo's own D1
// migrations applied and foreign keys on, as D1 has them. Each case is the call the Postgres
// adapter answers.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = new Date("2026-11-18T14:00:00.000Z");
const at = (ms: number) => new Date(NOW.getTime() + ms);
const ago = (ms: number) => at(-ms);
const TODAY = "2026-11-18";

function fresh() {
  const { sqlite, client } = freshD1WithBatch();
  return { sqlite, client, store: d1ReportStore(client) };
}
type Fresh = ReturnType<typeof fresh>;

let seq = 0;
const n = () => ++seq;

async function member(c: Fresh["client"], userOver: Partial<typeof users.$inferInsert> = {}, over: Partial<typeof members.$inferInsert> = {}) {
  const [u] = await c
    .insert(users)
    .values({ email: `u${n()}@example.com`, ...userOver } as never)
    .returning({ id: users.id });
  const [m] = await c
    .insert(members)
    .values({ userId: u.id, memberCode: `M-2026-${String(n()).padStart(4, "0")}`, ...over })
    .returning({ id: members.id });
  return m.id;
}

async function quote(c: Fresh["client"], status: string, over: Record<string, unknown> = {}) {
  const [q] = await c
    .insert(quotes)
    .values({
      quoteCode: `JN-2026-${String(n()).padStart(5, "0")}`,
      tripType: "one_way",
      paxCount: 2,
      status: status as never,
      receivedAt: ago(2 * HOUR),
      slaDeadlineAt: at(HOUR),
      createdAt: ago(2 * HOUR),
      updatedAt: ago(2 * HOUR),
      contactSnapshot: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
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
      paxCount: 3,
      status: "confirmed",
      ...over,
    } as never)
    .returning({ id: trips.id });
  return t.id;
}

async function invoice(c: Fresh["client"], memberId: string, over: Record<string, unknown> = {}) {
  const [i] = await c
    .insert(invoices)
    .values({ memberId, invoiceCode: `INV-2026-${String(n()).padStart(4, "0")}`, status: "paid", issuedOn: TODAY, totalUsd: 1000, fetUsd: 0, segmentFeeUsd: 0, ...over } as never)
    .returning({ id: invoices.id });
  return i.id;
}

test("the sidebar count is submitted quotes only and leaves smoke quotes out, a quote with no name or email kept", async () => {
  const { client, store } = fresh();
  await quote(client, "submitted");
  await quote(client, "submitted");
  await quote(client, "triaged");
  await quote(client, "submitted", { contactSnapshot: { firstName: "[SMOKE] Ada", email: "ada@example.com" } });
  await quote(client, "submitted", { contactSnapshot: { firstName: "Bo", email: "smoke+deploy@jetnine.com" } });
  await quote(client, "submitted", { contactSnapshot: {} });
  assert.equal(await store.submittedCount(), 3);
});

test("the five snapshot counts: one quote per status, a smoke quote out, booked inside and outside 14 days, an overdue reply", async () => {
  const { client, store } = fresh();
  await quote(client, "submitted"); // needs a reply, deadline ahead
  await quote(client, "submitted", { slaDeadlineAt: ago(HOUR) }); // overdue reply
  await quote(client, "triaged");
  await quote(client, "sourcing");
  await quote(client, "options_sent");
  await quote(client, "held");
  await quote(client, "accepted", { acceptedAt: ago(3 * DAY) }); // booked, inside
  await quote(client, "converted", { acceptedAt: null, updatedAt: ago(5 * DAY) }); // booked by updated_at, inside
  await quote(client, "accepted", { acceptedAt: ago(20 * DAY) }); // booked, outside
  await quote(client, "declined"); // counts nowhere
  await quote(client, "submitted", { slaDeadlineAt: ago(HOUR), contactSnapshot: { firstName: "[SMOKE]", email: "x@example.com" } });
  const counts = await store.quoteStageCounts(ago(14 * DAY), NOW);
  assert.deepEqual(counts, { needsReply: 2, working: 2, optionsOut: 2, bookedLast14Days: 2, overdueReplies: 1 });
});

test("the snapshot counts are zeros on an empty database", async () => {
  const { store } = fresh();
  assert.deepEqual(await store.quoteStageCounts(ago(14 * DAY), NOW), {
    needsReply: 0,
    working: 0,
    optionsOut: 0,
    bookedLast14Days: 0,
    overdueReplies: 0,
  });
  assert.equal(await store.submittedCount(), 0);
  assert.equal(await store.overdueInvoiceCount(), 0);
  assert.equal(await store.liveEmptyLegCount(), 0);
});

test("overdue invoices and live empty legs are counted by status", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  await invoice(client, m, { status: "overdue", dueOn: "2026-11-01" });
  await invoice(client, m, { status: "overdue", dueOn: "2026-10-01" });
  await invoice(client, m, { status: "due", dueOn: "2026-12-01" });
  await invoice(client, m, { status: "paid" });
  assert.equal(await store.overdueInvoiceCount(), 2);

  const [op] = await client.insert(operators).values({ name: "bravo air" }).returning({ id: operators.id });
  await client.insert(airports).values([
    { icao: "KVNY", name: "Van Nuys", city: "Van Nuys", countryIso2: "US", region: "CA", lat: "34.2", lon: "-118.5" },
    { icao: "KTEB", name: "Teterboro", city: "Teterboro", countryIso2: "US", region: "NJ", lat: "40.8", lon: "-74.0" },
  ]);
  const leg = (code: string, status: string) =>
    ({
      code,
      operatorId: op.id,
      category: "midsize",
      fromIcao: "KVNY",
      toIcao: "KTEB",
      wheelsUpAt: at(2 * DAY),
      seatsAvailable: 6,
      fullCharterRefUsd: 30000,
      listedPriceUsd: 15000,
      status,
    }) as never;
  await client.insert(emptyLegs).values([leg("EL-2026-0001", "live"), leg("EL-2026-0002", "live"), leg("EL-2026-0003", "draft")]);
  assert.equal(await store.liveEmptyLegCount(), 2);
});

test("requestCounts for 30 days: this window, the previous window and neither", async () => {
  const { client, store } = fresh();
  // 30 days back from 2026-11-18 is 2026-10-19 (UTC midnight); the previous window starts 2026-09-19.
  await quote(client, "submitted", { receivedAt: ago(1 * DAY) });
  await quote(client, "accepted", { receivedAt: ago(10 * DAY) });
  await quote(client, "converted", { receivedAt: ago(10 * DAY) });
  await quote(client, "options_sent", { receivedAt: ago(5 * DAY) });
  await quote(client, "held", { receivedAt: ago(5 * DAY) });
  await quote(client, "declined", { receivedAt: ago(5 * DAY) });
  await quote(client, "expired", { receivedAt: ago(5 * DAY) });
  await quote(client, "cancelled", { receivedAt: ago(5 * DAY) });
  await quote(client, "triaged", { receivedAt: ago(2 * DAY) });
  await quote(client, "sourcing", { receivedAt: ago(2 * DAY) });
  await quote(client, "accepted", { receivedAt: ago(45 * DAY) }); // previous window
  await quote(client, "submitted", { receivedAt: ago(45 * DAY) }); // previous window
  await quote(client, "submitted", { receivedAt: ago(70 * DAY) }); // neither
  await quote(client, "submitted", { receivedAt: ago(1 * DAY), contactSnapshot: { firstName: "[SMOKE]", email: "a@example.com" } }); // smoke
  const c = await store.requestCounts("30", NOW);
  assert.deepEqual(c, { received: 10, receivedPrev: 2, booked: 2, waiting: 2, lost: 3, open: 3 });
});

test("requestCounts for the year starts on 1 January UTC and its previous window is last year", async () => {
  const { client, store } = fresh();
  await quote(client, "submitted", { receivedAt: new Date("2026-01-01T00:00:00.000Z") }); // first instant of the year
  await quote(client, "submitted", { receivedAt: new Date("2025-12-31T23:59:59.000Z") }); // last second of last year
  await quote(client, "submitted", { receivedAt: new Date("2025-01-01T00:00:00.000Z") }); // first instant of last year
  await quote(client, "submitted", { receivedAt: new Date("2024-12-31T23:59:59.000Z") }); // before both
  const c = await store.requestCounts("ytd", NOW);
  assert.equal(c.received, 1);
  assert.equal(c.receivedPrev, 2);
});

test("moneySummary: paid, due, overdue, void and draft invoices; a trip with operator cost and one without", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const withCost = await trip(client, m, { operatorCostUsd: 600 });
  const noCost = await trip(client, m);
  // In the 30 day window (from 2026-10-19):
  await invoice(client, m, { status: "paid", issuedOn: "2026-11-10", totalUsd: 1000, fetUsd: 75, segmentFeeUsd: 25, tripId: withCost }); // margin 1000-75-25-600 = 300
  await invoice(client, m, { status: "paid", issuedOn: "2026-11-11", totalUsd: 500, tripId: noCost }); // paid, cost unknown
  await invoice(client, m, { status: "due", issuedOn: "2026-11-12", totalUsd: 200, dueOn: "2026-12-12" });
  await invoice(client, m, { status: "overdue", issuedOn: "2026-10-20", totalUsd: 300, dueOn: "2026-11-05" });
  await invoice(client, m, { status: "void", issuedOn: "2026-11-12", totalUsd: 9999 });
  await invoice(client, m, { status: "draft", issuedOn: "2026-11-12", totalUsd: 8888 });
  // In the previous window (2026-09-19 to 2026-10-18):
  await invoice(client, m, { status: "paid", issuedOn: "2026-10-01", totalUsd: 700 });
  // Before both:
  await invoice(client, m, { status: "paid", issuedOn: "2026-06-01", totalUsd: 4000 });
  const s = await store.moneySummary("30", NOW);
  assert.deepEqual(s, {
    invoiced: 1000 + 500 + 200 + 300,
    invoicedPrev: 700,
    outstanding: 200 + 300,
    outstandingCount: 2,
    trueMargin: 300,
    coveredInvoiced: 1000,
    marginCovered: 1,
    marginTotal: 2,
  });
});

test("moneySummary on an empty database is zeros, not nulls", async () => {
  const { store } = fresh();
  assert.deepEqual(await store.moneySummary("30", NOW), {
    invoiced: 0,
    invoicedPrev: 0,
    outstanding: 0,
    outstandingCount: 0,
    trueMargin: 0,
    coveredInvoiced: 0,
    marginCovered: 0,
    marginTotal: 0,
  });
});

test("mostOverdue picks the oldest past-due invoice with the right days late and the client's name; null when none", async () => {
  const { client, store } = fresh();
  assert.equal(await store.mostOverdue(TODAY), null);
  const ada = await member(client, { firstName: "Ada", lastName: "Lovelace" }, { preferredName: "Ada L" });
  const bo = await member(client, { firstName: "Bo", lastName: null });
  const nameless = await member(client, { firstName: null, lastName: null });
  await invoice(client, bo, { status: "overdue", dueOn: "2026-11-10" });
  await invoice(client, ada, { status: "due", dueOn: "2026-11-03" }); // oldest
  await invoice(client, nameless, { status: "overdue", dueOn: "2026-11-05" });
  await invoice(client, ada, { status: "due", dueOn: "2026-11-18" }); // due today is not late
  await invoice(client, ada, { status: "paid", dueOn: "2026-10-01" }); // paid is out
  await invoice(client, ada, { status: "due", dueOn: null }); // no due date is out
  assert.deepEqual(await store.mostOverdue(TODAY), { name: "Ada Lovelace", preferredName: "Ada L", daysLate: 15 });

  // Only the nameless one left past due: the name is null, as on Postgres.
  const { client: c2, store: s2 } = fresh();
  const m2 = await member(c2, { firstName: null, lastName: null });
  await invoice(c2, m2, { status: "overdue", dueOn: "2026-11-17" });
  assert.deepEqual(await s2.mostOverdue(TODAY), { name: null, preferredName: null, daysLate: 1 });
});

test("flightsOn returns today's legs in time order with an untimed leg last, leaves out cancelled trips, carries client and aircraft", async () => {
  const { client, store } = fresh();
  const m = await member(client, { firstName: "Ada", lastName: "Lovelace" });
  const [op] = await client.insert(operators).values({ name: "Acme Air" } as never).returning({ id: operators.id });
  const [ac] = await client
    .insert(aircraft)
    .values({ tailNumber: "N123AB", operatorId: op.id, category: "midsize", makeModel: "Citation XLS", seats: 8, rangeNm: 1800, speedKt: 440 } as never)
    .returning({ id: aircraft.id });
  const late = await trip(client, m, { aircraftId: ac.id });
  const early = await trip(client, m);
  const untimed = await trip(client, m);
  const cancelled = await trip(client, m, { status: "cancelled_wx" });
  const cancelled2 = await trip(client, m, { status: "cancelled_other" });
  const tomorrow = await trip(client, m);
  const leg = (tripId: string, legNumber: number, departDate: string, departTime: string | null, over: Record<string, unknown> = {}) =>
    client.insert(tripLegs).values({ tripId, legNumber, departDate, departTime, fromCity: "Van Nuys", fromIata: "VNY", toCity: "Teterboro", toIata: "TEB", ...over } as never);
  await leg(late, 1, TODAY, "15:30");
  await leg(early, 1, TODAY, "07:15", { fromCity: null, fromName: "Burbank Airport", fromIata: null });
  await leg(untimed, 1, TODAY, null);
  await leg(cancelled, 1, TODAY, "09:00");
  await leg(cancelled2, 1, TODAY, "09:30");
  await leg(tomorrow, 1, "2026-11-19", "08:00");
  await leg(late, 2, "2026-11-19", "10:00"); // the return leg is another day

  const rows = await store.flightsOn(TODAY);
  assert.deepEqual(rows.map((r) => r.trip_id), [early, late, untimed]);
  assert.equal(rows[0].from_city, null);
  assert.equal(rows[0].from_name, "Burbank Airport");
  assert.equal(rows[1].client_name, "Ada Lovelace");
  assert.equal(rows[1].aircraft, "Citation XLS");
  assert.equal(rows[1].pax_count, 3);
  assert.equal(rows[1].status, "confirmed");
  assert.equal(rows[1].depart_time, "15:30");
  assert.equal(rows[0].aircraft, null);
  assert.equal(rows[2].depart_time, null);
});

test("flightsOn keeps two legs of one trip in leg order when the times tie, and stops at 40", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const t = await trip(client, m);
  await client.insert(tripLegs).values({ tripId: t, legNumber: 2, departDate: TODAY, departTime: "10:00", fromCity: "B" } as never);
  await client.insert(tripLegs).values({ tripId: t, legNumber: 1, departDate: TODAY, departTime: "10:00", fromCity: "A" } as never);
  assert.deepEqual((await store.flightsOn(TODAY)).map((r) => r.from_city), ["A", "B"]);
  for (let i = 0; i < 45; i++) {
    const t2 = await trip(client, m);
    await client.insert(tripLegs).values({ tripId: t2, legNumber: 1, departDate: TODAY, departTime: "11:00" } as never);
  }
  assert.equal((await store.flightsOn(TODAY)).length, 40);
});

test("openRequestsForSummary leaves out smoke and closed requests, orders by deadline, carries the first leg and the client name", async () => {
  const { client, store } = fresh();
  const first = await quote(client, "submitted", { slaDeadlineAt: at(3 * HOUR) });
  const soonest = await quote(client, "held", { slaDeadlineAt: at(HOUR), contactSnapshot: { firstName: "Grace", lastName: "Hopper", email: "g@example.com" } });
  const nameless = await quote(client, "sourcing", { slaDeadlineAt: at(2 * HOUR), contactSnapshot: { email: "who@example.com" } });
  await quote(client, "accepted");
  await quote(client, "declined");
  await quote(client, "submitted", { contactSnapshot: { firstName: "[SMOKE] Ada", email: "ada@example.com" } });
  await quote(client, "submitted", { contactSnapshot: { firstName: "Bo", email: "smoke+deploy@jetnine.com" } });
  const leg = (quoteId: string, legNumber: number, fromCity: string) =>
    client.insert(quoteLegs).values({ quoteId, legNumber, fromCity, toCity: "Teterboro", fromIata: "VNY", toIata: "TEB" } as never);
  await leg(soonest, 1, "Van Nuys");
  await leg(soonest, 2, "Teterboro"); // a second leg never doubles the row
  await leg(first, 1, "Burbank");

  const rows = await store.openRequestsForSummary();
  assert.deepEqual(rows.map((r) => r.id), [soonest, nameless, first]);
  assert.equal(rows[0].client_name, "Grace Hopper");
  assert.equal(rows[0].from_city, "Van Nuys");
  assert.equal(rows[0].to_city, "Teterboro");
  assert.equal(rows[0].pax_count, 2);
  assert.ok(rows[0].received_at instanceof Date);
  assert.ok(rows[0].sla_deadline_at instanceof Date);
  assert.equal(rows[0].sla_deadline_at.getTime(), at(HOUR).getTime());
  assert.equal(rows[1].client_name, null); // a quote with no name: the summary says "A client"
  assert.equal(rows[1].from_city, null); // no leg yet
});

test("openRequestsForSummary stops at 40", async () => {
  const { client, store } = fresh();
  for (let i = 0; i < 45; i++) await quote(client, "submitted", { slaDeadlineAt: at(i * 1000) });
  assert.equal((await store.openRequestsForSummary()).length, 40);
});
