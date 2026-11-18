import test from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { freshD1WithBatch } from "@/db/d1/test-batch-client";
import { aircraft } from "@/db/d1/schema/aircraft";
import { invoices } from "@/db/d1/schema/invoices";
import { memberPreferences } from "@/db/d1/schema/member-prefs";
import { members } from "@/db/d1/schema/members";
import { operators } from "@/db/d1/schema/operators";
import { quotes } from "@/db/d1/schema/quotes";
import { aircraftScheduleBlocks } from "@/db/d1/schema/schedule-blocks";
import { sourcedOptions } from "@/db/d1/schema/sourced-option";
import { staff } from "@/db/d1/schema/staff";
import { tripLegs, trips } from "@/db/d1/schema/trips";
import { users } from "@/db/d1/schema/users";
import { likePattern } from "@/domain/common";
import { d1TripStore } from "./store-d1";

// OPS-156: contract tests for the D1 trip store (the desk's trip list and trip sheet, the trip
// lookups and the status write with its aircraft calendar block, the manual schedule blocks,
// the client's trip pages and the aircraft page's reads), on a real SQLite with the repo's own
// D1 migrations applied and foreign keys on, as D1 has them. Each case is the call the
// Postgres adapter answers.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = new Date("2026-11-17T20:00:00.000Z");
const at = (ms: number) => new Date(NOW.getTime() + ms);

function fresh() {
  const { sqlite, client } = freshD1WithBatch();
  return { sqlite, client, store: d1TripStore(client) };
}
type Fresh = ReturnType<typeof fresh>;

let seq = 0;
const n = () => ++seq;

async function user(c: Fresh["client"], over: Partial<typeof users.$inferInsert> = {}) {
  const [u] = await c
    .insert(users)
    .values({ email: `u${n()}@example.com`, ...over } as never)
    .returning({ id: users.id });
  return u.id;
}

async function member(
  c: Fresh["client"],
  userOver: Partial<typeof users.$inferInsert> = {},
  over: Partial<typeof members.$inferInsert> = {},
) {
  const userId = await user(c, userOver);
  const [m] = await c
    .insert(members)
    .values({ userId, memberCode: `M-2026-${String(n()).padStart(4, "0")}`, ...over })
    .returning({ id: members.id });
  return { id: m.id, userId };
}

async function operator(c: Fresh["client"], name: string) {
  const [o] = await c.insert(operators).values({ name } as never).returning({ id: operators.id });
  return o.id;
}

async function plane(c: Fresh["client"], operatorId: string, tail: string) {
  const [a] = await c
    .insert(aircraft)
    .values({ tailNumber: tail, operatorId, category: "midsize", makeModel: "Citation XLS", seats: 8, rangeNm: 1800, speedKt: 440 } as never)
    .returning({ id: aircraft.id });
  return a.id;
}

async function trip(c: Fresh["client"], memberId: string, over: Partial<typeof trips.$inferInsert> = {}) {
  const k = n();
  const [t] = await c
    .insert(trips)
    .values({
      tripCode: `JN-2026-${String(k).padStart(4, "0")}`,
      memberId,
      missionType: "one_way",
      paxCount: 2,
      status: "confirmed",
      createdAt: at(-k * 1000),
      ...over,
    } as never)
    .returning({ id: trips.id });
  return t.id;
}

async function leg(c: Fresh["client"], tripId: string, legNumber: number, over: Partial<typeof tripLegs.$inferInsert> = {}) {
  await c.insert(tripLegs).values({ tripId, legNumber, ...over } as never);
}

const ALL = { pattern: null as string | null, limit: 100 };

test("the list is newest first, honours the limit and carries the client, aircraft, operator and ground option", async () => {
  const { client, store } = fresh();
  const m = await member(client, { firstName: "Ada", lastName: "Lovelace", phoneE164: "+13105550100" }, { preferredName: "Ada L" });
  const op = await operator(client, "Acme Air");
  const ac = await plane(client, op, "N123AB");
  const [q] = await client
    .insert(quotes)
    .values({
      quoteCode: `JN-2026-${String(n()).padStart(5, "0")}`,
      tripType: "one_way",
      paxCount: 2,
      status: "converted",
      receivedAt: NOW,
      slaDeadlineAt: NOW,
      groundOption: "suv_sprinter",
    } as never)
    .returning({ id: quotes.id });
  const old = await trip(client, m.id, { createdAt: at(-3 * HOUR) });
  const mid = await trip(client, m.id, { createdAt: at(-2 * HOUR), aircraftId: ac, operatorId: op, quoteId: q.id });
  const newest = await trip(client, m.id, { createdAt: at(-1 * HOUR) });

  const rows = await store.listRows(ALL);
  assert.deepEqual(rows.map((r) => r.id), [newest, mid, old]);
  const row = rows[1];
  assert.equal(row.memberFirstName, "Ada");
  assert.equal(row.memberLastName, "Lovelace");
  assert.equal(row.memberPhone, "+13105550100");
  assert.equal(row.preferredName, "Ada L");
  assert.equal(row.tailNumber, "N123AB");
  assert.equal(row.makeModel, "Citation XLS");
  assert.equal(row.operatorName, "Acme Air");
  assert.equal(row.groundOption, "suv_sprinter");
  assert.ok(row.createdAt instanceof Date);
  assert.equal(rows[0].tailNumber, null);

  const two = await store.listRows({ ...ALL, limit: 2 });
  assert.deepEqual(two.map((r) => r.id), [newest, mid]);
});

test("search finds a last name, an email and a leg's city in any case, not an unrelated word, and % and _ match literally", async () => {
  const { client, store } = fresh();
  const ada = await member(client, { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" }, { legalName: "Ada Byron" });
  const bob = await member(client, { firstName: "Bob", lastName: "Stone", email: "bob.stone@corp.example" });
  const tAda = await trip(client, ada.id);
  const tBob = await trip(client, bob.id);
  await leg(client, tAda, 1, { fromCity: "Van Nuys", toCity: "Aspen" });
  await leg(client, tBob, 1, { fromCity: "Teterboro", toCity: "Palm Beach" });

  const ids = async (q: string) => (await store.listRows({ ...ALL, pattern: likePattern(q) })).map((r) => r.id).sort();
  assert.deepEqual(await ids("LOVELACE"), [tAda]);
  assert.deepEqual(await ids("byron"), [tAda]);
  assert.deepEqual(await ids("corp.example"), [tBob]);
  assert.deepEqual(await ids("aspen"), [tAda]);
  assert.deepEqual(await ids("PALM"), [tBob]);
  assert.deepEqual(await ids("zebra"), []);
  // A bare % or _ is a literal character, not a wildcard.
  assert.deepEqual(await ids("%"), []);
  assert.deepEqual(await ids("_"), []);
});

test("120 trips: the list and the legs, invoices and options read across chunks of 50 and come back in SQL order", async () => {
  const { client, store } = fresh();
  const m = await member(client, { firstName: "Many", lastName: "Trips" });
  const tripIds: string[] = [];
  const quoteIds: string[] = [];
  for (let i = 0; i < 120; i++) {
    const [q] = await client
      .insert(quotes)
      .values({
        quoteCode: `JN-2026-${String(n()).padStart(5, "0")}`,
        tripType: "one_way",
        paxCount: 2,
        status: "converted",
        receivedAt: NOW,
        slaDeadlineAt: NOW,
      } as never)
      .returning({ id: quotes.id });
    quoteIds.push(q.id);
    const id = await trip(client, m.id, { quoteId: q.id, createdAt: at(-i * 1000) });
    tripIds.push(id);
    // Leg 2 is written before leg 1 on purpose.
    await leg(client, id, 2, { fromCity: "B", toCity: "A" });
    await leg(client, id, 1, { fromCity: "A", toCity: "B" });
    await client.insert(sourcedOptions).values({ quoteId: q.id, optionNumber: 2, aircraftType: "second" } as never);
    await client.insert(sourcedOptions).values({ quoteId: q.id, optionNumber: 1, aircraftType: "first" } as never);
    await client.insert(sourcedOptions).values({ quoteId: q.id, optionNumber: 3, aircraftType: "chosen", isChosen: true } as never);
  }

  const all = await store.listRows({ ...ALL, limit: 120 });
  assert.equal(all.length, 120);
  assert.equal(all[0].id, tripIds[0]);

  const legs = await store.legsForTrips(tripIds);
  assert.equal(legs.length, 240);
  // Sorted by leg number overall, so each trip's legs come out as 1 then 2.
  for (const id of [tripIds[0], tripIds[60], tripIds[119]]) {
    assert.deepEqual(legs.filter((l) => l.tripId === id).map((l) => l.legNumber), [1, 2]);
  }
  assert.deepEqual(legs.map((l) => l.legNumber), [...legs.map((l) => l.legNumber)].sort((a, b) => a - b));

  const options = await store.optionsForQuotes(quoteIds);
  assert.equal(options.length, 360);
  for (const q of [quoteIds[0], quoteIds[55], quoteIds[119]]) {
    assert.deepEqual(options.filter((o) => o.quoteId === q).map((o) => o.aircraftType), ["chosen", "first", "second"]);
  }

  // Nothing to read is no read.
  assert.deepEqual(await store.legsForTrips([]), []);
  assert.deepEqual(await store.invoicesForTrips([]), []);
  assert.deepEqual(await store.optionsForQuotes([]), []);
});

test("invoicesForTrips returns the invoices of the trips, oldest first", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const t1 = await trip(client, m.id);
  const t2 = await trip(client, m.id);
  const other = await trip(client, m.id);
  await client.insert(invoices).values({ memberId: m.id, tripId: t1, invoiceCode: "INV-1", kind: "credit", status: "credit", totalUsd: 10, createdAt: at(-1000) } as never);
  await client.insert(invoices).values({ memberId: m.id, tripId: t1, invoiceCode: "INV-2", kind: "charter", status: "paid", totalUsd: 500, paidOn: "2026-11-10", createdAt: at(-3000) } as never);
  await client.insert(invoices).values({ memberId: m.id, tripId: t2, invoiceCode: "INV-3", kind: "charter", status: "due", totalUsd: 900, dueOn: "2026-12-01", createdAt: at(-2000) } as never);

  const rows = await store.invoicesForTrips([t1, t2]);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.status), ["paid", "due", "credit"]);
  assert.equal(rows[0].tripId, t1);
  assert.equal(rows[0].totalUsd, 500);
  assert.equal(rows[0].paidOn, "2026-11-10");
  assert.ok(!rows.some((r) => r.tripId === other));
  assert.ok(!("createdAt" in rows[0]));
});

test("tripParts gives the trip, its legs in order, the client, the first invoice and the chosen option only when no aircraft is set", async () => {
  const { client, store } = fresh();
  const m = await member(client, { firstName: "Ada", lastName: "Lovelace" }, { tier: "card_250" } as never);
  const op = await operator(client, "Acme Air");
  const ac = await plane(client, op, "N123AB");
  const [q] = await client
    .insert(quotes)
    .values({
      quoteCode: "JN-2026-00099",
      tripType: "one_way",
      paxCount: 2,
      status: "converted",
      receivedAt: NOW,
      slaDeadlineAt: NOW,
      groundOption: "suv_sprinter",
    } as never)
    .returning({ id: quotes.id });
  await client.insert(sourcedOptions).values({ quoteId: q.id, optionNumber: 1, aircraftType: "Phenom 300" } as never);
  await client.insert(sourcedOptions).values({ quoteId: q.id, optionNumber: 2, aircraftType: "Challenger 350", tailNumber: "N350XX", operatorNameRaw: "Raw Air", totalFlightTimeMin: 190, isChosen: true } as never);

  const noAircraft = await trip(client, m.id, { quoteId: q.id });
  await leg(client, noAircraft, 2, { fromCity: "B", toCity: "A" });
  await leg(client, noAircraft, 1, { fromCity: "A", toCity: "B" });
  await client.insert(invoices).values({ memberId: m.id, tripId: noAircraft, invoiceCode: "INV-9", status: "due", totalUsd: 1200 } as never);

  const parts = await store.tripParts(noAircraft);
  assert.ok(parts);
  assert.equal(parts.trip.id, noAircraft);
  assert.deepEqual(parts.legs.map((l) => l.legNumber), [1, 2]);
  assert.equal(parts.member?.firstName, "Ada");
  assert.equal(parts.member?.tier, "card_250");
  assert.equal(parts.invoice?.totalUsd, 1200);
  assert.equal(parts.quote?.quoteCode, "JN-2026-00099");
  assert.equal(parts.quote?.groundOption, "suv_sprinter");
  assert.equal(parts.aircraft, null);
  assert.equal(parts.operator, null);
  assert.equal(parts.chosenOption?.aircraftType, "Challenger 350");
  assert.equal(parts.chosenOption?.totalFlightTimeMin, 190);

  const withAircraft = await trip(client, m.id, { aircraftId: ac, operatorId: op });
  const second = await store.tripParts(withAircraft);
  assert.equal(second?.aircraft?.tailNumber, "N123AB");
  assert.equal(second?.operator?.name, "Acme Air");
  assert.equal(second?.chosenOption, null);
  assert.equal(second?.invoice, null);

  assert.equal(await store.tripParts("00000000-0000-4000-8000-000000000000"), null);
});

test("tripForMessage and tripForStatus find the trip, the client's user and contact points; unknown ids find nothing", async () => {
  const { client, store } = fresh();
  const m = await member(client, { email: "ada@example.com", phoneE164: "+13105550100" });
  const t = await trip(client, m.id, { status: "boarding" });
  const msg = await store.tripForMessage(t);
  assert.equal(msg?.memberUserId, m.userId);
  assert.equal(msg?.memberId, m.id);
  assert.equal(msg?.memberEmail, "ada@example.com");
  assert.equal(msg?.memberPhone, "+13105550100");
  const st = await store.tripForStatus(t);
  assert.equal(st?.status, "boarding");
  assert.equal(await store.tripForMessage("nope"), undefined);
  assert.equal(await store.tripForStatus("nope"), undefined);
});

test("setStatus to airborne stamps wheels-up and a block appears for a trip with an aircraft and times; a cancellation removes it", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const op = await operator(client, "Acme Air");
  const ac = await plane(client, op, "N123AB");
  const t = await trip(client, m.id, { aircraftId: ac, tripCode: "JN-2026-7001" });
  await leg(client, t, 1, { scheduledDepAt: at(1 * HOUR), scheduledArrAt: at(4 * HOUR) });

  await store.setStatus(t, { status: "airborne", wheelsUpAt: at(2 * HOUR) });
  const [row] = await client.select().from(trips).where(eq(trips.id, t));
  assert.equal(row.status, "airborne");
  assert.equal(row.wheelsUpAt?.getTime(), at(2 * HOUR).getTime());
  let blocks = await client.select().from(aircraftScheduleBlocks).where(eq(aircraftScheduleBlocks.relatedTripId, t));
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].kind, "trip");
  assert.equal(blocks[0].aircraftId, ac);
  assert.equal(blocks[0].startAt.getTime(), at(2 * HOUR).getTime());
  assert.equal(blocks[0].endAt.getTime(), at(4 * HOUR).getTime());
  assert.equal(blocks[0].notes, "JN-2026-7001");

  // A second write updates the one block, it does not add another.
  await store.setStatus(t, { status: "wheels_down", wheelsDownAt: at(5 * HOUR) });
  blocks = await client.select().from(aircraftScheduleBlocks).where(eq(aircraftScheduleBlocks.relatedTripId, t));
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].endAt.getTime(), at(5 * HOUR).getTime());

  await store.setStatus(t, { status: "cancelled_other" });
  blocks = await client.select().from(aircraftScheduleBlocks).where(eq(aircraftScheduleBlocks.relatedTripId, t));
  assert.equal(blocks.length, 0);
});

test("setStatus on a trip with no aircraft writes the status and makes no block", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const t = await trip(client, m.id);
  await leg(client, t, 1, { scheduledDepAt: at(HOUR), scheduledArrAt: at(3 * HOUR) });
  await store.setStatus(t, { status: "confirmed" });
  assert.equal((await client.select().from(aircraftScheduleBlocks)).length, 0);
});

test("a manual block is inserted, read back with the links that tell who owns it, and deleted", async () => {
  const { client, store } = fresh();
  const op = await operator(client, "Acme Air");
  const ac = await plane(client, op, "N123AB");
  assert.deepEqual(await store.aircraftForBlock(ac), { id: ac, tailNumber: "N123AB" });
  assert.equal(await store.aircraftForBlock("nope"), undefined);

  const { id } = await store.insertBlock({ aircraftId: ac, kind: "maintenance", startAt: at(DAY), endAt: at(2 * DAY), notes: "A check" } as never);
  assert.ok(id);
  const block = await store.blockById(id);
  assert.deepEqual(block, { id, aircraftId: ac, kind: "maintenance", relatedTripId: null, relatedQuoteId: null });

  await store.deleteBlock(id);
  assert.equal(await store.blockById(id), undefined);
});

test("a trip's block carries the trip link, so the desk refuses to delete it by hand", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const op = await operator(client, "Acme Air");
  const ac = await plane(client, op, "N123AB");
  const t = await trip(client, m.id, { aircraftId: ac });
  await leg(client, t, 1, { scheduledDepAt: at(HOUR), scheduledArrAt: at(3 * HOUR) });
  await store.setStatus(t, { status: "confirmed" });
  const [b] = await client.select().from(aircraftScheduleBlocks).where(eq(aircraftScheduleBlocks.relatedTripId, t));
  assert.equal((await store.blockById(b.id))?.relatedTripId, t);
});

test("the client's trip pages: their trips with the aircraft, their legs, and no row for another client's trip", async () => {
  const { client, store } = fresh();
  const mine = await member(client);
  const theirs = await member(client);
  const op = await operator(client, "Acme Air");
  const ac = await plane(client, op, "N123AB");
  const a = await trip(client, mine.id, { aircraftId: ac, operatorId: op, createdAt: at(-1 * HOUR), revenueUsd: 4200 });
  const b = await trip(client, mine.id, { createdAt: at(-2 * HOUR) });
  const other = await trip(client, theirs.id);
  await leg(client, a, 2, { fromIata: "ASE", toIata: "VNY", fromCity: "Aspen", toCity: "Van Nuys", departDate: "2026-12-05" });
  await leg(client, a, 1, { fromIata: "VNY", toIata: "ASE", fromCity: "Van Nuys", toCity: "Aspen", departDate: "2026-12-01" });
  await client.insert(invoices).values({ memberId: mine.id, tripId: a, invoiceCode: "INV-5", status: "paid", totalUsd: 4200 } as never);
  const [sdx] = await client.insert(staff).values({ userId: await user(client, { role: "dispatcher" }), displayName: "Dana Dispatch", directLineE164: "+13105550111" } as never).returning({ id: staff.id });

  const list = await store.memberTrips(mine.id, 50);
  assert.deepEqual(list.map((r) => r.id), [a, b]);
  assert.equal(list[0].aircraft, "Citation XLS");
  assert.equal(list[0].revenueUsd, 4200);
  assert.equal(list[1].aircraft, null);
  assert.equal((await store.memberTrips(mine.id, 1)).length, 1);

  const legs = await store.accountLegs(list.map((r) => r.id));
  assert.deepEqual(legs.filter((l) => l.tripId === a).map((l) => l.departDate), ["2026-12-01", "2026-12-05"]);
  assert.deepEqual(await store.accountLegs([]), []);

  const parts = await store.memberTripParts(a, mine.id);
  assert.ok(parts);
  assert.deepEqual(parts.legs.map((l) => l.legNumber), [1, 2]);
  assert.equal(parts.invoice?.status, "paid");
  assert.equal(parts.aircraft?.makeModel, "Citation XLS");
  assert.equal(parts.aircraft?.seats, 8);
  assert.equal(parts.operator?.name, "Acme Air");

  assert.equal(await store.memberTripParts(other, mine.id), null);
  assert.equal(await store.memberTripParts(a, theirs.id), null);

  assert.deepEqual(await store.staffContact(sdx.id), { displayName: "Dana Dispatch", directLineE164: "+13105550111" });
  assert.equal(await store.staffContact("nope"), undefined);
});

test("tailBlocks returns only blocks that overlap the window, earliest first, with the trip code of a trip block", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const op = await operator(client, "Acme Air");
  const ac = await plane(client, op, "N123AB");
  const otherAc = await plane(client, op, "N999ZZ");
  const t = await trip(client, m.id, { aircraftId: ac, tripCode: "JN-2026-8001" });
  await leg(client, t, 1, { scheduledDepAt: at(2 * DAY), scheduledArrAt: at(2 * DAY + 3 * HOUR) });
  await store.setStatus(t, { status: "confirmed" });

  const mk = async (aircraftId: string, startAt: Date, endAt: Date) =>
    (await store.insertBlock({ aircraftId, kind: "maintenance", startAt, endAt } as never)).id;
  const inside = await mk(ac, at(1 * DAY), at(1 * DAY + HOUR));
  const straddlesStart = await mk(ac, at(-2 * DAY), at(DAY / 2));
  const before = await mk(ac, at(-3 * DAY), at(-2 * DAY));
  const after = await mk(ac, at(20 * DAY), at(21 * DAY));
  const elsewhere = await mk(otherAc, at(1 * DAY), at(2 * DAY));

  const rows = await store.tailBlocks(ac, at(0), at(14 * DAY));
  const ids = rows.map((r) => r.id);
  assert.ok(ids.includes(inside) && ids.includes(straddlesStart));
  for (const x of [before, after, elsewhere]) assert.ok(!ids.includes(x), x);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.startAt.getTime()), [...rows.map((r) => r.startAt.getTime())].sort((a, b) => a - b));
  const tripBlock = rows.find((r) => r.relatedTripId === t);
  assert.equal(tripBlock?.tripCode, "JN-2026-8001");
  assert.equal(rows.find((r) => r.id === inside)?.tripCode, null);
  // A block that ends exactly at the window start does not overlap it.
  const touching = await mk(ac, at(-1 * DAY), at(0));
  assert.ok(!(await store.tailBlocks(ac, at(0), at(14 * DAY))).some((r) => r.id === touching));
});

test("a tail's recent trips are newest first and capped, and its totals add up trips, revenue and passengers", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const op = await operator(client, "Acme Air");
  const ac = await plane(client, op, "N123AB");
  const empty = await plane(client, op, "N000EM");
  const ids: string[] = [];
  for (let i = 0; i < 14; i++) {
    ids.push(await trip(client, m.id, { aircraftId: ac, paxCount: 3, revenueUsd: i === 0 ? null : 1000, createdAt: at(-i * HOUR) }));
  }
  const recent = await store.tailRecentTrips(ac, 12);
  assert.equal(recent.length, 12);
  assert.deepEqual(recent.map((r) => r.id), ids.slice(0, 12));
  assert.ok(recent[0].createdAt instanceof Date);

  assert.deepEqual(await store.tailTotals(ac), { lifetimeTrips: 14, lifetimeRevenue: 13_000, totalPax: 42 });
  assert.deepEqual(await store.tailTotals(empty), { lifetimeTrips: 0, lifetimeRevenue: 0, totalPax: 0 });
});

test("the status notice reads the client's contact points, text opt-in and quiet hours, and the legs in order", async () => {
  const { client, store } = fresh();
  const m = await member(client, { email: "ada@example.com", phoneE164: "+13105550100", firstName: "Ada" });
  const plain = await member(client, { email: "bob@example.com" });
  await client.insert(memberPreferences).values({
    memberId: m.id,
    commsSmsUpdates: true,
    quietHoursStart: "22:00:00",
    quietHoursEnd: "07:00:00",
    quietHoursTz: "America/Los_Angeles",
  } as never);
  const t = await trip(client, m.id, { paxCount: 4 });
  await leg(client, t, 2, { fromIcao: null, toIcao: null, departDate: "2026-12-05" });
  await leg(client, t, 1, { departDate: "2026-12-01" });
  const noPrefs = await trip(client, plain.id);

  const target = await store.noticeTarget(t);
  assert.equal(target?.memberUserId, m.userId);
  assert.equal(target?.memberEmail, "ada@example.com");
  assert.equal(target?.memberPhone, "+13105550100");
  assert.equal(target?.memberFirstName, "Ada");
  assert.equal(target?.paxCount, 4);
  assert.equal(target?.smsOptIn, true);
  assert.equal(target?.quietStart, "22:00:00");
  assert.equal(target?.quietTz, "America/Los_Angeles");
  assert.deepEqual((await store.noticeLegs(t)).map((l) => l.departDate), ["2026-12-01", "2026-12-05"]);

  // A client with no saved preferences still has a row: the text opt-in is simply unset.
  const bare = await store.noticeTarget(noPrefs);
  assert.equal(bare?.smsOptIn, null);
  assert.equal(await store.noticeTarget("nope"), undefined);
});
