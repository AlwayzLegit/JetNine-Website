import test from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { freshD1WithBatch } from "@/db/d1/test-batch-client";
import { aircraft } from "@/db/d1/schema/aircraft";
import { auditLog, messages } from "@/db/d1/schema/audit";
import { members } from "@/db/d1/schema/members";
import { operators } from "@/db/d1/schema/operators";
import { quoteLegs, quotes } from "@/db/d1/schema/quotes";
import { aircraftScheduleBlocks } from "@/db/d1/schema/schedule-blocks";
import { sourcedOptions } from "@/db/d1/schema/sourced-option";
import { staff } from "@/db/d1/schema/staff";
import { trips } from "@/db/d1/schema/trips";
import { users } from "@/db/d1/schema/users";
import { invoices } from "@/db/d1/schema/invoices";
import { memberships, reserveTransactions } from "@/db/d1/schema/memberships";
import { invoiceCodeSequence } from "@/db/d1/schema/invoices";
import { tripCodeSequence, tripLegs } from "@/db/d1/schema/trips";
import { isUniqueViolation } from "@/db/unique";
import { likePattern } from "@/domain/common";
import { HoldTaken } from "./store";
import { d1RequestStore } from "./store-d1";
import type { ConvertPlan } from "./store";

// OPS-154: contract tests for the D1 request store (the desk's request list and request page,
// the SLA watch, the smoke prune and the reports export), on a real SQLite with the repo's own
// D1 migrations applied, foreign keys on and a batch that is one transaction, as D1 has them.
// Each case is the call the Postgres adapter answers. OPS-155 adds the desk's commands (status,
// messages, send options, assign, link a client, holds, options) at the end of the file.

const DAY = 86_400_000;
const NOW = new Date("2026-11-17T20:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

function fresh() {
  const { sqlite, client } = freshD1WithBatch();
  return { sqlite, client, store: d1RequestStore(client) };
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

async function dispatcher(c: Fresh["client"], name: string) {
  const userId = await user(c, { role: "dispatcher" });
  const [s] = await c.insert(staff).values({ userId, displayName: name } as never).returning({ id: staff.id });
  return s.id;
}

async function member(c: Fresh["client"], over: Partial<typeof members.$inferInsert> = {}) {
  const userId = await user(c);
  const [m] = await c
    .insert(members)
    .values({ userId, memberCode: `M-2026-${String(n()).padStart(4, "0")}`, ...over })
    .returning({ id: members.id });
  return m.id;
}

type QuoteOver = Partial<typeof quotes.$inferInsert>;

async function quote(c: Fresh["client"], status: string, over: QuoteOver = {}) {
  const [q] = await c
    .insert(quotes)
    .values({
      quoteCode: `JN-2026-${String(n()).padStart(5, "0")}`,
      tripType: "one_way",
      paxCount: 2,
      status: status as never,
      receivedAt: ago(60 * 60_000),
      slaDeadlineAt: new Date(NOW.getTime() + 60 * 60_000),
      createdAt: ago(60 * 60_000),
      updatedAt: ago(60 * 60_000),
      contactSnapshot: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
      ...over,
    } as never)
    .returning({ id: quotes.id });
  return q.id;
}

async function leg(c: Fresh["client"], quoteId: string, legNumber: number, over: Partial<typeof quoteLegs.$inferInsert> = {}) {
  await c.insert(quoteLegs).values({ quoteId, legNumber, ...over } as never);
}

async function option(c: Fresh["client"], quoteId: string, optionNumber: number, over: Partial<typeof sourcedOptions.$inferInsert> = {}) {
  await c.insert(sourcedOptions).values({ quoteId, optionNumber, ...over } as never);
}

async function operator(c: Fresh["client"], name: string, over: Partial<typeof operators.$inferInsert> = {}) {
  const [o] = await c.insert(operators).values({ name, ...over } as never).returning({ id: operators.id });
  return o.id;
}

async function plane(c: Fresh["client"], operatorId: string, tail: string, over: Partial<typeof aircraft.$inferInsert> = {}) {
  const [a] = await c
    .insert(aircraft)
    .values({ tailNumber: tail, operatorId, category: "midsize", makeModel: "Citation XLS", seats: 8, rangeNm: 1800, speedKt: 440, ...over } as never)
    .returning({ id: aircraft.id });
  return a.id;
}

const OPTS = { bookedSince: ago(14 * DAY), closedSince: ago(30 * DAY), pattern: null as string | null, limit: 200 };

test("the list keeps open requests, bookings of the last 14 days and closed ones of the last 30, and hides smoke quotes", async () => {
  const { client, store } = fresh();
  const open = await quote(client, "submitted");
  const sourcing = await quote(client, "sourcing");
  const freshBooking = await quote(client, "accepted", { acceptedAt: ago(3 * DAY), updatedAt: ago(1 * DAY) });
  const oldBooking = await quote(client, "accepted", { acceptedAt: ago(20 * DAY), updatedAt: ago(20 * DAY) });
  // No accepted_at: coalesce falls back to updated_at.
  const bookedNoStamp = await quote(client, "converted", { acceptedAt: null, updatedAt: ago(2 * DAY) });
  const closedRecent = await quote(client, "declined", { updatedAt: ago(10 * DAY) });
  const closedOld = await quote(client, "expired", { updatedAt: ago(40 * DAY) });
  const smokeName = await quote(client, "submitted", { contactSnapshot: { firstName: "[SMOKE]", lastName: "Test", email: "x@example.com" } });
  const smokeMail = await quote(client, "submitted", { contactSnapshot: { firstName: "Real", lastName: "Name", email: "smoke+42@jetnine.com" } });
  // A phone request before the caller's name is taken: no snapshot fields at all.
  const anonymous = await quote(client, "submitted", { contactSnapshot: null });

  const rows = await store.listRows(OPTS);
  const ids = new Set(rows.map((r) => r.id));
  for (const id of [open, sourcing, freshBooking, bookedNoStamp, closedRecent, anonymous]) assert.ok(ids.has(id), id);
  for (const id of [oldBooking, closedOld, smokeName, smokeMail]) assert.ok(!ids.has(id), id);
  assert.ok(rows[0].receivedAt instanceof Date);
});

test("the list is newest first, honours the limit and carries the client's tier and the dispatcher's name", async () => {
  const { client, store } = fresh();
  const d = await dispatcher(client, "Dana Dispatch");
  const m = await member(client, { tier: "card_250" } as never);
  const a = await quote(client, "submitted", { receivedAt: ago(3 * 3_600_000) });
  const b = await quote(client, "submitted", { receivedAt: ago(1 * 3_600_000), assignedDispatcherId: d, memberId: m });
  const c = await quote(client, "submitted", { receivedAt: ago(2 * 3_600_000) });
  const rows = await store.listRows(OPTS);
  assert.deepEqual(rows.map((r) => r.id), [b, c, a]);
  assert.equal(rows[0].dispatcherName, "Dana Dispatch");
  assert.equal(rows[0].memberTier, "card_250");
  assert.equal(rows[1].dispatcherName, null);
  const two = await store.listRows({ ...OPTS, limit: 2 });
  assert.deepEqual(two.map((r) => r.id), [b, c]);
});

test("search finds a first name, 'first last', an email and a leg's city, any case, and a % or _ matches literally", async () => {
  const { client, store } = fresh();
  const ada = await quote(client, "submitted", { contactSnapshot: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" } });
  const bob = await quote(client, "submitted", { contactSnapshot: { firstName: "Bob", lastName: "Stone", email: "bob.stone@corp.example" } });
  const pct = await quote(client, "submitted", { contactSnapshot: { firstName: "100%", lastName: "Sure", email: "p@example.com" } });
  const under = await quote(client, "submitted", { contactSnapshot: { firstName: "a_b", lastName: "Under", email: "u@example.com" } });
  const plain = await quote(client, "submitted", { contactSnapshot: { firstName: "axb", lastName: "Plain", email: "x@example.com" } });
  await leg(client, bob, 1, { fromCity: "Teterboro", toCity: "Van Nuys", toIata: "VNY" } as never);

  const find = async (term: string) => (await store.listRows({ ...OPTS, pattern: likePattern(term) })).map((r) => r.id).sort();
  assert.deepEqual(await find("ADA"), [ada]);
  assert.deepEqual(await find("ada lovelace"), [ada]);
  assert.deepEqual(await find("bob.stone@corp"), [bob]);
  assert.deepEqual(await find("teterb"), [bob]);
  assert.deepEqual(await find("vny"), [bob]);
  assert.deepEqual(await find("100%"), [pct]);
  assert.deepEqual(await find("a_b"), [under]);
  assert.ok(!(await find("a_b")).includes(plain));
  assert.deepEqual(await find("nobody"), []);
});

test("legs and option counts are right for 120 quotes (more than two chunks of 50)", async () => {
  const { client, store } = fresh();
  const ids: string[] = [];
  for (let i = 0; i < 120; i++) {
    const id = await quote(client, "sourcing");
    ids.push(id);
    await leg(client, id, 2, { fromIata: "TEB", toIata: "VNY" } as never);
    await leg(client, id, 1, { fromIata: "VNY", toIata: "TEB", fromCity: `City${i}` } as never);
    if (i % 3 === 0) {
      await option(client, id, 1, { status: "sent_to_client" });
      await option(client, id, 2, { status: "sourced" });
      await option(client, id, 3, { status: "accepted" });
    }
  }
  const legs = await store.legsFor(ids);
  assert.equal(legs.length, 240);
  const byQuote = new Map<string, number[]>();
  for (const l of legs) byQuote.set(l.quoteId, [...(byQuote.get(l.quoteId) ?? []), l.legNumber]);
  assert.equal(byQuote.size, 120);
  for (const nums of byQuote.values()) assert.deepEqual(nums, [1, 2]);

  const counts = await store.optionCountsFor(ids);
  assert.equal(counts.length, 40);
  for (const c of counts) {
    assert.equal(c.total, 3);
    assert.equal(c.sent, 2);
    assert.equal(typeof c.total, "number");
  }
  assert.deepEqual(await store.legsFor([]), []);
  assert.deepEqual(await store.optionCountsFor([]), []);
});

test("getQuote returns the row or nothing", async () => {
  const { client, store } = fresh();
  const id = await quote(client, "submitted");
  const row = await store.getQuote(id);
  assert.equal(row?.id, id);
  assert.ok(row?.receivedAt instanceof Date);
  assert.equal(await store.getQuote("00000000-0000-4000-8000-000000000000"), undefined);
});

test("requestParts: legs, roster, dispatchers, assignee, trips flown without draft and cancelled, holds in force, options", async () => {
  const { client, store } = fresh();
  const d1 = await dispatcher(client, "Dana");
  await dispatcher(client, "Eli");
  await user(client, { role: "member" });
  const m = await member(client, {} as never);
  const q = await quote(client, "sourcing", { memberId: m, assignedDispatcherId: d1 });
  const other = await quote(client, "sourcing", { quoteCode: "JN-2026-99999" });
  await leg(client, q, 2, { toIata: "VNY" } as never);
  await leg(client, q, 1, { fromIata: "TEB" } as never);
  await option(client, q, 2, { status: "sourced", isChosen: false });
  await option(client, q, 1, { status: "sent_to_client", isChosen: true, clientPriceUsd: 41_000 });

  for (const status of ["confirmed", "completed", "draft", "cancelled_wx"]) {
    await client.insert(trips).values({ memberId: m, tripCode: `JN-T-${n()}`, missionType: "one_way", paxCount: 2, status } as never);
  }

  const op = await operator(client, "Alpha Air");
  const ac1 = await plane(client, op, "N100A");
  const ac2 = await plane(client, op, "N200B");
  const block = (aircraftId: string, quoteId: string, startAt: Date, endAt: Date) =>
    client.insert(aircraftScheduleBlocks).values({ aircraftId, kind: "hold", relatedQuoteId: quoteId, startAt, endAt } as never);
  await block(ac1, q, new Date(NOW.getTime() + 2 * 3_600_000), new Date(NOW.getTime() + 4 * 3_600_000));
  await block(ac2, other, new Date(NOW.getTime() + 2 * 3_600_000), new Date(NOW.getTime() + 4 * 3_600_000)); // in force
  await block(ac1, other, ago(5 * DAY), ago(4 * DAY)); // expired: not a conflict

  const quoteRow = await store.getQuote(q);
  assert.ok(quoteRow);
  const parts = await store.requestParts(quoteRow, NOW);

  assert.deepEqual(parts.legs.map((l) => l.legNumber), [1, 2]);
  assert.equal(parts.memberRows.length, 1);
  assert.equal(parts.memberRows[0].id, m);
  assert.deepEqual(parts.dispatchers.map((s) => s.displayName).sort(), ["Dana", "Eli"]);
  assert.deepEqual(parts.assignee, { id: d1, displayName: "Dana" });
  assert.equal(parts.timesFlown, 2);
  assert.equal(parts.holds.length, 1);
  assert.equal(parts.holds[0].tailNumber, "N100A");
  assert.ok(parts.holds[0].startAt instanceof Date);
  assert.equal(parts.conflicts.length, 2);
  assert.deepEqual(parts.conflicts.map((c) => c.quoteCode).sort(), [quoteRow.quoteCode, "JN-2026-99999"].sort());
  assert.deepEqual(parts.sourcedOptions.map((o) => o.optionNumber), [1, 2]);
  assert.equal(parts.sourcedOptions[0].isChosen, true);
  assert.equal(parts.sourcedOptions[1].isChosen, false);
  assert.equal(parts.sourcedOptions[0].clientPriceUsd, 41_000);

  // No client linked and nobody assigned: no flown count, no assignee.
  const bare = await store.getQuote(await quote(client, "submitted"));
  assert.ok(bare);
  const bareParts = await store.requestParts(bare, NOW);
  assert.equal(bareParts.timesFlown, null);
  assert.equal(bareParts.assignee, null);
  assert.deepEqual(bareParts.holds, []);
});

test("candidates are ordered preferred, then platinum to silver, then Wyvern, then tail, and capped at 8", async () => {
  const { client, store } = fresh();
  const pref = await operator(client, "Preferred", { isPreferred: true, argusRating: "silver" } as never);
  const plat = await operator(client, "Platinum", { argusRating: "platinum" } as never);
  const gold = await operator(client, "Gold", { argusRating: "gold" } as never);
  const goldWyvern = await operator(client, "GoldWyvern", { argusRating: "gold", wyvernWingman: true } as never);
  const none = await operator(client, "Plain");
  const suspended = await operator(client, "Suspended", { status: "suspended" } as never);
  await plane(client, none, "N500E");
  await plane(client, gold, "N400D");
  await plane(client, goldWyvern, "N300C");
  await plane(client, plat, "N200B");
  await plane(client, pref, "N100A");
  await plane(client, suspended, "N999Z");
  await plane(client, plat, "N201B", { seats: 4 }); // too few seats
  await plane(client, plat, "N202B", { rangeNm: 900 }); // not enough range
  await plane(client, plat, "N203B", { category: "light" }); // wrong category
  await plane(client, plat, "N204B", { status: "maint" } as never);

  const rows = await store.candidates({ category: "midsize", pax: 6, longestLegNm: 1500 });
  assert.deepEqual(rows.map((r) => r.tailNumber), ["N100A", "N200B", "N300C", "N400D", "N500E"]);
  assert.equal(rows[0].operatorName, "Preferred");
  assert.equal(rows[0].isPreferred, true);

  for (let i = 0; i < 6; i++) await plane(client, plat, `N6${i}0P`);
  assert.equal((await store.candidates({ category: "midsize", pax: 6, longestLegNm: 1500 })).length, 8);
});

test("claimSlaOverdue marks a quote once, honours the limit, and skips a deadline older than 24 hours", async () => {
  const { client, store } = fresh();
  const overdue = (minutes: number, over: QuoteOver = {}) =>
    quote(client, "submitted", { slaDeadlineAt: ago(minutes * 60_000), ...over });
  const a = await overdue(50);
  const b = await overdue(40);
  const c = await overdue(30);
  const ancient = await overdue(25 * 60);
  const notYet = await quote(client, "submitted", { slaDeadlineAt: new Date(NOW.getTime() + 60_000) });
  const alerted = await overdue(20, { slaAlertedAt: ago(10 * 60_000) });
  const wrongStatus = await overdue(20, { status: "options_sent" as never });

  const first = await store.claimSlaOverdue(NOW, 2);
  assert.deepEqual(first.map((r) => r.id).sort(), [a, b].sort(), "the two oldest deadlines");
  assert.ok(first[0].slaDeadlineAt instanceof Date);
  assert.ok(first[0].receivedAt instanceof Date);

  const second = await store.claimSlaOverdue(NOW, 10);
  assert.deepEqual(second.map((r) => r.id), [c], "a claimed quote is never claimed again");
  assert.deepEqual(await store.claimSlaOverdue(NOW, 10), []);

  const stamped = async (id: string) => (await client.select({ t: quotes.slaAlertedAt }).from(quotes).where(eq(quotes.id, id)))[0].t;
  assert.deepEqual((await stamped(a))?.getTime(), NOW.getTime());
  assert.equal(await stamped(ancient), null);
  assert.equal(await stamped(notYet), null);
  assert.equal(await stamped(wrongStatus), null);
  assert.equal((await stamped(alerted))?.getTime(), ago(10 * 60_000).getTime());
});

test("dueSoon lists quotes whose deadline is in the next window and skips one that has the audit row", async () => {
  const { client, store } = fresh();
  const soon = new Date(NOW.getTime() + 10 * 60_000);
  const inWindow = await quote(client, "triaged", { slaDeadlineAt: new Date(NOW.getTime() + 5 * 60_000) });
  const atEdge = await quote(client, "sourcing", { slaDeadlineAt: soon });
  const pastDeadline = await quote(client, "submitted", { slaDeadlineAt: ago(60_000) });
  const later = await quote(client, "submitted", { slaDeadlineAt: new Date(NOW.getTime() + 30 * 60_000) });
  const done = await quote(client, "options_sent", { slaDeadlineAt: new Date(NOW.getTime() + 5 * 60_000) });
  const announced = await quote(client, "submitted", { slaDeadlineAt: new Date(NOW.getTime() + 6 * 60_000) });
  await client.insert(auditLog).values({ action: "quote.reply_due_soon.notify", subjectType: "quote", subjectId: announced } as never);
  // An audit row with another action does not count.
  const otherAction = await quote(client, "submitted", { slaDeadlineAt: new Date(NOW.getTime() + 7 * 60_000) });
  await client.insert(auditLog).values({ action: "quote.status", subjectType: "quote", subjectId: otherAction } as never);

  const rows = await store.dueSoon(NOW, soon, "quote.reply_due_soon.notify", 10);
  assert.deepEqual(rows.map((r) => r.id), [inWindow, otherAction, atEdge], "soonest deadline first");
  for (const id of [pastDeadline, later, done, announced]) assert.ok(!rows.some((r) => r.id === id), id);
  assert.equal(rows[0].contactSnapshot?.firstName, "Ada");
  assert.ok(rows[0].slaDeadlineAt instanceof Date);
  assert.equal((await store.dueSoon(NOW, soon, "quote.reply_due_soon.notify", 1)).length, 1);
});

const SMOKE = { firstName: "[SMOKE]", lastName: "Run", email: "smoke+1@jetnine.com" };

test("pruneSmoke removes an old smoke quote with its legs, options and messages, and keeps the rest", async () => {
  const { client, store } = fresh();
  const op = await operator(client, "Alpha Air");
  const ac = await plane(client, op, "N100A");
  const old = await quote(client, "cancelled", { contactSnapshot: SMOKE, createdAt: ago(8 * DAY) });
  await leg(client, old, 1, { fromIata: "VNY" } as never);
  await option(client, old, 1);
  await client.insert(aircraftScheduleBlocks).values({ aircraftId: ac, kind: "hold", relatedQuoteId: old, startAt: ago(8 * DAY), endAt: ago(7 * DAY) } as never);
  const msg = (subjectType: string, subjectId: string) =>
    client.insert(messages).values({ subjectType, subjectId, channel: "email", direction: "in" } as never);
  await msg("quote", old);

  await quote(client, "cancelled", { contactSnapshot: { firstName: "Real", email: "smoke+7@jetnine.com" }, createdAt: ago(9 * DAY) });
  const young = await quote(client, "cancelled", { contactSnapshot: SMOKE, createdAt: ago(6 * DAY) });
  const real = await quote(client, "cancelled", { createdAt: ago(30 * DAY) });
  const owner = await member(client, {} as never);
  const withTrip = await quote(client, "converted", { contactSnapshot: SMOKE, createdAt: ago(20 * DAY) });
  await client.insert(trips).values({ memberId: owner, quoteId: withTrip, tripCode: "JN-T-1", missionType: "one_way", paxCount: 2 } as never);
  await msg("quote", young);
  await msg("quote", withTrip);
  await msg("quote", real);
  // Same id in another thread kind is not touched.
  await msg("trip", old);

  assert.equal(await store.pruneSmoke(NOW, 200), 2);

  const left = (await client.select({ id: quotes.id }).from(quotes)).map((r) => r.id).sort();
  assert.deepEqual(left, [young, real, withTrip].sort());
  assert.equal((await client.select().from(quoteLegs)).length, 0, "legs cascade");
  assert.equal((await client.select().from(sourcedOptions)).length, 0, "options cascade");
  assert.equal((await client.select().from(aircraftScheduleBlocks)).length, 0, "blocks cascade");
  const kept = await client.select({ type: messages.subjectType, id: messages.subjectId }).from(messages);
  assert.equal(kept.length, 4, "the old quote's thread went, the others stayed");
  assert.ok(!kept.some((m) => m.type === "quote" && m.id === old));
  assert.ok(kept.some((m) => m.type === "trip" && m.id === old));

  assert.equal(await store.pruneSmoke(NOW, 200), 0, "nothing left to prune");
});

test("pruneSmoke works in batches and across chunks of 50", async () => {
  const { client, store } = fresh();
  for (let i = 0; i < 120; i++) await quote(client, "cancelled", { contactSnapshot: SMOKE, createdAt: ago(9 * DAY) });
  assert.equal(await store.pruneSmoke(NOW, 70), 70);
  assert.equal((await client.select().from(quotes)).length, 50);
  assert.equal(await store.pruneSmoke(NOW, 200), 50);
  assert.equal((await client.select().from(quotes)).length, 0);
});

test("pruneSmoke keeps a quote that got a trip after it was picked (the guard is in every statement)", async () => {
  const { client, sqlite, store } = fresh();
  const owner = await member(client, {} as never);
  const id = await quote(client, "cancelled", { contactSnapshot: SMOKE, createdAt: ago(9 * DAY) });
  await client.insert(messages).values({ subjectType: "quote", subjectId: id, channel: "email", direction: "in" } as never);
  // A trip appears between the read and the batch: simulate by a trigger that adds it when the
  // first statement of the batch runs, which is the first delete on messages.
  sqlite.exec(`create trigger sneak before delete on messages begin
    insert into trips (id, member_id, quote_id, trip_code, mission_type, pax_count, status, created_at, updated_at)
    values ('t-sneak', '${owner}', '${id}', 'JN-T-SNEAK', 'one_way', 2, 'draft', 0, 0);
  end`);
  assert.equal(await store.pruneSmoke(NOW, 200), 0);
  assert.equal((await client.select().from(quotes)).length, 1);
});

test("exportRows: first and last leg, leg count, the chosen option's price once booked, no smoke rows, newest first, and the limit", async () => {
  const { client, store } = fresh();
  const start = ago(30 * DAY);
  const booked = await quote(client, "accepted", { receivedAt: ago(1 * DAY), finalPriceUsd: null, paxCount: 4 });
  await leg(client, booked, 1, { fromCity: "Van Nuys", fromIata: "VNY", toCity: "Teterboro", toIata: "TEB" } as never);
  await leg(client, booked, 2, { fromCity: "Teterboro", fromIata: "TEB", toCity: "Aspen", toName: "Aspen Pitkin", toIata: "ASE" } as never);
  await option(client, booked, 1, { isChosen: false, clientPriceUsd: 1 });
  await option(client, booked, 2, { isChosen: true, clientPriceUsd: 52_000 });

  const finalPrice = await quote(client, "converted", { receivedAt: ago(2 * DAY), finalPriceUsd: 61_500 });
  await leg(client, finalPrice, 1, { fromIata: "LAX", toIata: "LAS" } as never);
  const openOne = await quote(client, "submitted", { receivedAt: ago(3 * DAY), contactSnapshot: { firstName: "  Cy ", lastName: "", email: "cy@example.com" } });
  await option(client, openOne, 1, { isChosen: true, clientPriceUsd: 9 });
  await quote(client, "submitted", { receivedAt: ago(40 * DAY) }); // before the window
  await quote(client, "submitted", { receivedAt: ago(1 * DAY), contactSnapshot: SMOKE });
  await quote(client, "submitted", { receivedAt: ago(4 * DAY), contactSnapshot: null });

  const rows = await store.exportRows(start, 5000);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((r) => r.status), ["accepted", "converted", "submitted", "submitted"], "newest first");

  const [r1, r2, r3, r4] = rows;
  assert.equal(r1.client_name, "Ada Lovelace");
  assert.equal(r1.email, "ada@example.com");
  assert.equal(r1.from_city, "Van Nuys");
  assert.equal(r1.from_iata, "VNY");
  assert.equal(r1.to_city, "Aspen");
  assert.equal(r1.to_name, "Aspen Pitkin");
  assert.equal(r1.to_iata, "ASE");
  assert.equal(r1.legs, 2);
  assert.equal(r1.pax_count, 4);
  assert.equal(r1.booked_usd, 52_000, "the chosen option's client price");
  assert.ok(new Date(r1.received_at).getTime() === ago(1 * DAY).getTime());
  assert.equal(r2.booked_usd, 61_500, "the final price wins when set");
  assert.equal(r2.legs, 1);
  assert.equal(r3.booked_usd, null, "an open request has no booked value even if an option is chosen");
  assert.equal(r3.client_name, "Cy");
  assert.equal(r3.legs, 0);
  assert.equal(r3.from_city, null);
  assert.equal(r4.client_name, null, "a request with no snapshot is kept, with empty name and email");
  assert.equal(r4.email, null);

  assert.equal((await store.exportRows(start, 2)).length, 2);
});

// ─── The desk's commands (OPS-155) ─────────────────────────────────────────────────────────

const stamp = (d: Date | null | undefined) => (d ? new Date(d).getTime() : null);

test("setStatus writes the status, and responded_at only when one is given", async () => {
  const { client, store } = fresh();
  const id = await quote(client, "submitted");
  await store.setStatus(id, "triaged", undefined);
  let [row] = await client.select().from(quotes).where(eq(quotes.id, id));
  assert.equal(row.status, "triaged");
  assert.equal(row.respondedAt, null, "an undefined respondedAt leaves the column alone");

  await store.setStatus(id, "held", NOW);
  [row] = await client.select().from(quotes).where(eq(quotes.id, id));
  assert.equal(row.status, "held");
  assert.equal(stamp(row.respondedAt), NOW.getTime());

  const head = await store.quoteForStatus(id);
  assert.equal(head?.status, "held");
  assert.match(head?.code ?? "", /^JN-2026-/);
  assert.equal(head?.contactSnapshot?.firstName, "Ada");
  assert.equal(await store.quoteForStatus("00000000-0000-4000-8000-000000000000"), undefined);
  assert.equal((await store.quoteHead(id))?.id, id);
});

test("memberContact joins the account's email; memberUserId reads the user id alone", async () => {
  const { client, store } = fresh();
  const userId = await user(client, { email: "client@example.com" } as never);
  const [m] = await client.insert(members).values({ userId, memberCode: "M-2026-0900" }).returning({ id: members.id });
  assert.deepEqual(await store.memberContact(m.id), { userId, email: "client@example.com" });
  assert.deepEqual(await store.memberUserId(m.id), { userId });
  assert.equal(await store.memberContact("nobody"), undefined);
  assert.equal(await store.memberUserId("nobody"), undefined);
  assert.equal((await store.memberById(m.id))?.memberCode, "M-2026-0900");
  assert.equal(await store.memberById("nobody"), undefined);
});

test("quoteForMessage and quoteForSendOptions return the fields the commands read", async () => {
  const { client, store } = fresh();
  const id = await quote(client, "sourcing", { paxCount: 5, statusToken: "tok-1" } as never);
  const msg = await store.quoteForMessage(id);
  assert.equal(msg?.id, id);
  assert.equal(msg?.contactSnapshot?.email, "ada@example.com");
  const send = await store.quoteForSendOptions(id);
  assert.equal(send?.paxCount, 5);
  assert.equal(send?.status, "sourcing");
  assert.equal(send?.statusToken, "tok-1");
  assert.equal(await store.quoteForSendOptions("nope"), undefined);
});

test("vettedOptions keeps only the options that passed the safety floor, in option order; legRoute is in leg order", async () => {
  const { client, store } = fresh();
  const id = await quote(client, "sourcing");
  await option(client, id, 3, { safetyFloorPassed: true, clientPriceUsd: 3 });
  await option(client, id, 1, { safetyFloorPassed: true, clientPriceUsd: 1 });
  await option(client, id, 2, { safetyFloorPassed: false, clientPriceUsd: 2 });
  const vetted = await store.vettedOptions(id);
  assert.deepEqual(vetted.map((o) => o.optionNumber), [1, 3]);
  assert.equal(vetted[0].safetyFloorPassed, true, "booleans come back as booleans");

  await leg(client, id, 2, { fromIata: "TEB", toIata: "VNY" } as never);
  await leg(client, id, 1, { fromIata: "VNY", toIata: "TEB" } as never);
  assert.deepEqual(await store.legRoute(id), [
    { fromIata: "VNY", toIata: "TEB" },
    { fromIata: "TEB", toIata: "VNY" },
  ]);
});

test("markOptionsSent flips only the given options (more than one chunk) and moves an early request to options_sent", async () => {
  const { client, store } = fresh();
  const id = await quote(client, "sourcing");
  const other = await quote(client, "sourcing");
  for (let i = 1; i <= 60; i++) await option(client, id, i, { clientPriceUsd: i });
  await option(client, id, 61, { clientPriceUsd: 61 }); // not in the list
  await option(client, other, 1, { clientPriceUsd: 1 }); // another request
  const all = await client.select().from(sourcedOptions).where(eq(sourcedOptions.quoteId, id));
  const ids = all.filter((o) => o.optionNumber <= 60).map((o) => o.id);

  await store.markOptionsSent(id, ids, NOW);

  const after = await client.select().from(sourcedOptions).where(eq(sourcedOptions.quoteId, id));
  assert.equal(after.filter((o) => o.status === "sent_to_client").length, 60);
  assert.equal(after.find((o) => o.optionNumber === 61)?.status, "sourced");
  const [o2] = await client.select().from(sourcedOptions).where(eq(sourcedOptions.quoteId, other));
  assert.equal(o2.status, "sourced");
  const [q] = await client.select().from(quotes).where(eq(quotes.id, id));
  assert.equal(q.status, "options_sent");
  assert.equal(stamp(q.respondedAt), NOW.getTime());
});

test("markOptionsSent leaves a request that moved on (accepted) alone", async () => {
  const { client, store } = fresh();
  const id = await quote(client, "accepted", { respondedAt: ago(DAY) });
  await option(client, id, 1, { clientPriceUsd: 5 });
  const [o] = await client.select().from(sourcedOptions).where(eq(sourcedOptions.quoteId, id));
  await store.markOptionsSent(id, [o.id], NOW);
  const [q] = await client.select().from(quotes).where(eq(quotes.id, id));
  assert.equal(q.status, "accepted", "never pulled back");
  assert.equal(stamp(q.respondedAt), ago(DAY).getTime());
  const [o2] = await client.select().from(sourcedOptions).where(eq(sourcedOptions.id, o.id));
  assert.equal(o2.status, "sent_to_client", "the options still flip");
});

test("assign and linkMember write the dispatcher and the client; null clears them", async () => {
  const { client, store } = fresh();
  const id = await quote(client, "submitted");
  const staffId = await dispatcher(client, "Dee Dispatch");
  const memberId = await member(client);

  assert.deepEqual(await store.staffById(staffId), { id: staffId, displayName: "Dee Dispatch" });
  assert.equal(await store.staffById("nobody"), undefined);

  await store.assign(id, staffId);
  await store.linkMember(id, memberId, NOW);
  let head = await store.quoteForAssign(id);
  assert.equal(head?.assignedDispatcherId, staffId);
  let link = await store.quoteForLink(id);
  assert.equal(link?.memberId, memberId);
  assert.equal(link?.convertedTripId, null);
  const [row] = await client.select().from(quotes).where(eq(quotes.id, id));
  assert.equal(stamp(row.updatedAt), NOW.getTime());

  await store.assign(id, null);
  await store.linkMember(id, null, NOW);
  head = await store.quoteForAssign(id);
  link = await store.quoteForLink(id);
  assert.equal(head?.assignedDispatcherId, null);
  assert.equal(link?.memberId, null);
});

test("soft holds: place one, find it, a second for the same request and aircraft throws HoldTaken, release removes it", async () => {
  const { client, store } = fresh();
  const id = await quote(client, "sourcing");
  const other = await quote(client, "sourcing");
  const op = await operator(client, "Acme Jets");
  const tail = await plane(client, op, "N100AB");
  const userId = await user(client);

  assert.deepEqual(await store.aircraftById(tail), { id: tail, tailNumber: "N100AB", status: "available" });
  assert.equal(await store.aircraftById("nobody"), undefined);
  assert.equal((await store.quoteForHold(id))?.status, "sourcing");
  assert.equal(await store.holdFor(id, tail), undefined);

  const values = { aircraftId: tail, kind: "hold" as const, startAt: NOW, endAt: new Date(NOW.getTime() + 4 * 3_600_000), relatedQuoteId: id, notes: "JN", createdByUserId: userId };
  const { id: blockId } = await store.insertHold(values as never);
  assert.ok(blockId);
  assert.deepEqual(await store.holdFor(id, tail), { id: blockId });

  await assert.rejects(() => store.insertHold(values as never), (e) => e instanceof HoldTaken);
  // Another request may hold the same aircraft; a non-hold block is no duplicate.
  await store.insertHold({ ...values, relatedQuoteId: other } as never);

  const block = await store.holdById(blockId);
  assert.deepEqual(block, { id: blockId, kind: "hold", relatedQuoteId: id, aircraftId: tail, tailNumber: "N100AB" });
  assert.equal(await store.holdById("nobody"), undefined);

  await store.deleteHold(blockId);
  assert.equal(await store.holdById(blockId), undefined);
  assert.equal(await store.holdFor(id, tail), undefined);
  // Released, it can be placed again.
  await store.insertHold(values as never);
});

test("holdLegs sorts by date then time with undated legs last, as Postgres does", async () => {
  const { client, store } = fresh();
  const id = await quote(client, "sourcing");
  await leg(client, id, 1, { departDate: null, departTime: null } as never);
  await leg(client, id, 2, { departDate: "2026-12-02", departTime: "09:00" } as never);
  await leg(client, id, 3, { departDate: "2026-12-01", departTime: null } as never);
  await leg(client, id, 4, { departDate: "2026-12-01", departTime: "08:30" } as never);
  const legs = await store.holdLegs(id);
  assert.deepEqual(legs, [
    { departDate: "2026-12-01", departTime: "08:30" },
    { departDate: "2026-12-01", departTime: null },
    { departDate: "2026-12-02", departTime: "09:00" },
    { departDate: null, departTime: null },
  ]);
});

test("operatorLike matches a name by a %text% pattern, any case", async () => {
  const { client, store } = fresh();
  await operator(client, "Acme Jets", { argusRating: "gold", wyvernWingman: true } as never);
  await operator(client, "Zenith Air");
  const a = await store.operatorLike("%acme%");
  assert.equal(a?.name, "Acme Jets");
  assert.equal(a?.argusRating, "gold");
  assert.equal(a?.wyvernWingman, true);
  assert.equal((await store.operatorLike("%ACME%"))?.name, "Acme Jets");
  assert.equal((await store.operatorLike("%zen%"))?.name, "Zenith Air");
  assert.equal(await store.operatorLike("%nothing%"), undefined);
  // The wildcard is the caller's, as on Postgres: a lone underscore matches one character.
  assert.equal((await store.operatorLike("%Zenith _ir%"))?.name, "Zenith Air");
});

test("options: the next number is 1, then the highest plus one; a second option with the same number fails on the unique index", async () => {
  const { client, store } = fresh();
  const id = await quote(client, "sourcing");
  assert.equal(await store.nextOptionNumber(id), 1);
  const first = await store.insertOption({ quoteId: id, optionNumber: 1, aircraftType: "Citation XLS", markupType: "percent", markupValue: "12", operatorCostUsd: 10_000, clientPriceUsd: 11_200 });
  assert.ok(first.id);
  await store.insertOption({ quoteId: id, optionNumber: 5 });
  assert.equal(await store.nextOptionNumber(id), 6);
  await assert.rejects(
    () => store.insertOption({ quoteId: id, optionNumber: 5 }),
    (e) => isUniqueViolation(e),
  );

  const row = await store.optionOf(id, first.id);
  assert.equal(row?.aircraftType, "Citation XLS");
  assert.equal(row?.markupValue, "12");
  assert.equal(row?.isChosen, false);
  assert.equal(row?.safetyFloorPassed, false);
  assert.equal(await store.quoteIdForOption(first.id), id);
  assert.equal(await store.quoteIdForOption("nobody"), undefined);
  // An option of another request is none.
  const other = await quote(client, "sourcing");
  assert.equal(await store.optionOf(other, first.id), undefined);
});

test("updateOption changes the given fields and bumps updated_at; deleteOption removes the row", async () => {
  const { client, store } = fresh();
  const id = await quote(client, "sourcing");
  const { id: optionId } = await store.insertOption({ quoteId: id, optionNumber: 1, aircraftType: "Phenom 300" });
  await store.updateOption(optionId, { aircraftType: "Challenger 350", operatorMatched: true, safetyFloorPassed: true, clientPriceUsd: 42_000, isFloatingFleet: true }, NOW);
  const row = await store.optionOf(id, optionId);
  assert.equal(row?.aircraftType, "Challenger 350");
  assert.equal(row?.operatorMatched, true);
  assert.equal(row?.safetyFloorPassed, true);
  assert.equal(row?.isFloatingFleet, true);
  assert.equal(row?.clientPriceUsd, 42_000);
  assert.equal(stamp(row?.updatedAt), NOW.getTime());

  await store.deleteOption(optionId);
  assert.equal(await store.optionOf(id, optionId), undefined);
});

test("chooseOption leaves exactly one chosen, shortlisted option on the request and touches no other request", async () => {
  const { client, store } = fresh();
  const id = await quote(client, "sourcing");
  const other = await quote(client, "sourcing");
  const a = await store.insertOption({ quoteId: id, optionNumber: 1 });
  const b = await store.insertOption({ quoteId: id, optionNumber: 2 });
  const o = await store.insertOption({ quoteId: other, optionNumber: 1 });
  await client.update(sourcedOptions).set({ isChosen: true }).where(eq(sourcedOptions.id, o.id));

  await store.chooseOption(id, a.id, NOW);
  await store.chooseOption(id, b.id, NOW);

  const rows = await client.select().from(sourcedOptions).where(eq(sourcedOptions.quoteId, id));
  assert.deepEqual(rows.filter((r) => r.isChosen).map((r) => r.id), [b.id]);
  assert.equal(rows.find((r) => r.id === b.id)?.status, "shortlisted");
  const [untouched] = await client.select().from(sourcedOptions).where(eq(sourcedOptions.id, o.id));
  assert.equal(untouched.isChosen, true, "another request's chosen option stays chosen");
});


// ─── OPS-157: convert a request to a trip as one batch ───────────────────

async function clientMember(c: Fresh["client"]) {
  const userId = await user(c);
  const [m] = await c
    .insert(members)
    .values({ userId, memberCode: `M-2026-${String(n()).padStart(4, "0")}` })
    .returning({ id: members.id });
  return m.id;
}

async function membership(c: Fresh["client"], memberId: string, status: "active" | "paused" = "active", activatedOn = "2026-01-01") {
  const [row] = await c
    .insert(memberships)
    .values({ memberId, program: "card_250", depositUsd: 250_000, calloutHours: 24, status, activatedOn } as never)
    .returning({ id: memberships.id });
  return row.id;
}

async function topUp(c: Fresh["client"], memberId: string, membershipId: string | null, amountUsd: number) {
  await c.insert(reserveTransactions).values({ memberId, membershipId, kind: "top_up", amountUsd } as never);
}

function convertPlan(quoteId: string, memberId: string, over: { total?: number | null; aircraftId?: string | null; legs?: ConvertPlan["legs"] } = {}): ConvertPlan {
  const total = over.total === undefined ? 8_000 : over.total;
  return {
    quoteId,
    memberId,
    trip: {
      memberId,
      quoteId,
      assignedDispatcherId: null,
      missionType: "one_way",
      paxCount: 2,
      crewCount: 2,
      isInternational: false,
      status: "confirmed",
      revenueUsd: 7_000,
      operatorCostUsd: null,
      marginPct: null,
      aircraftId: over.aircraftId ?? null,
      operatorId: null,
    },
    legs: over.legs ?? [
      { legNumber: 1, fromCity: "Van Nuys", toCity: "Aspen", fromIata: "VNY", toIata: "ASE", departDate: "2026-12-01" },
      { legNumber: 2, fromCity: "Aspen", toCity: "Van Nuys", fromIata: "ASE", toIata: "VNY", departDate: "2026-12-05" },
    ],
    invoice: { memberId, kind: "charter", subtotalUsd: 7_000, fetUsd: 525, segmentFeeUsd: 100, totalUsd: total },
    totalUsd: total,
    tryDraw: total !== null && total > 0,
  };
}

const balanceOf = async (c: Fresh["client"], memberId: string) => {
  const rows = await c.select({ a: reserveTransactions.amountUsd }).from(reserveTransactions).where(eq(reserveTransactions.memberId, memberId));
  return rows.reduce((sum, r) => sum + r.a, 0);
};

test("convert with no membership writes one trip with its code and legs, one draft invoice with its code, releases the holds and marks the request converted", async () => {
  const { client, store } = fresh();
  const m = await clientMember(client);
  const op = await operator(client, "Acme Air");
  const ac = await plane(client, op, "N123AB");
  const q = await quote(client, "accepted", { memberId: m });
  await client.insert(aircraftScheduleBlocks).values({ aircraftId: ac, kind: "hold", startAt: ago(-DAY), endAt: ago(-2 * DAY), relatedQuoteId: q } as never);
  const otherQuote = await quote(client, "accepted", { memberId: m });
  await client.insert(aircraftScheduleBlocks).values({ aircraftId: ac, kind: "hold", startAt: ago(-3 * DAY), endAt: ago(-4 * DAY), relatedQuoteId: otherQuote } as never);

  const res = await store.convertToTrip(convertPlan(q, m));
  const year = new Date().getUTCFullYear();
  assert.equal(res.trip.tripCode, `JN-${year}-0001`);
  assert.equal(res.drawdown?.drew, false);
  assert.deepEqual(res.drawdown, { drew: false, reason: "NO_ACTIVE_MEMBERSHIP" });

  const [trip] = await client.select().from(trips).where(eq(trips.id, res.trip.id));
  assert.equal(trip.quoteId, q);
  assert.equal(trip.memberId, m);
  assert.equal(trip.status, "confirmed");
  const legs = await client.select().from(tripLegs).where(eq(tripLegs.tripId, res.trip.id)).orderBy(tripLegs.legNumber);
  assert.deepEqual(legs.map((l) => l.fromCity), ["Van Nuys", "Aspen"]);

  const [inv] = await client.select().from(invoices).where(eq(invoices.id, res.invoice.id));
  assert.equal(inv.invoiceCode, `INV-${year}-0001`);
  assert.equal(inv.status, "draft");
  assert.equal(inv.tripId, res.trip.id);
  assert.equal(inv.totalUsd, 8_000);

  const [quoteRow] = await client.select().from(quotes).where(eq(quotes.id, q));
  assert.equal(quoteRow.status, "converted");
  assert.equal(quoteRow.convertedTripId, res.trip.id);
  assert.ok(quoteRow.acceptedAt instanceof Date);
  const holds = await client.select().from(aircraftScheduleBlocks);
  assert.deepEqual(holds.map((h) => h.relatedQuoteId), [otherQuote]);

  assert.deepEqual(await store.convertedTripOf(q), { convertedTripId: res.trip.id, quoteCode: quoteRow.quoteCode });
});

test("a second convert of the same request is a unique violation and leaves no second trip or invoice and the counters where they were", async () => {
  const { client, store } = fresh();
  const m = await clientMember(client);
  const q = await quote(client, "accepted", { memberId: m });
  const first = await store.convertToTrip(convertPlan(q, m));

  await assert.rejects(store.convertToTrip(convertPlan(q, m)), (e) => isUniqueViolation(e));
  assert.equal((await client.select().from(trips)).length, 1);
  assert.equal((await client.select().from(invoices)).length, 1);
  assert.equal((await client.select().from(tripLegs)).length, 2);
  const [tc] = await client.select().from(tripCodeSequence);
  const [ic] = await client.select().from(invoiceCodeSequence);
  assert.equal(tc.lastValue, 1);
  assert.equal(ic.lastValue, 1);
  assert.equal((await client.select().from(quotes).where(eq(quotes.id, q)))[0].convertedTripId, first.trip.id);
});

test("an active membership with a balance that covers the total draws once, turns the invoice paid with the date and a note, and returns the balance left", async () => {
  const { client, store } = fresh();
  const m = await clientMember(client);
  const ms = await membership(client, m);
  await topUp(client, m, ms, 10_000);
  const q = await quote(client, "accepted", { memberId: m });

  const res = await store.convertToTrip(convertPlan(q, m, { total: 8_000 }));
  assert.equal(res.drawdown?.drew, true);
  if (res.drawdown?.drew) {
    assert.equal(res.drawdown.amountUsd, 8_000);
    assert.equal(res.drawdown.remainingBalanceUsd, 2_000);
  }
  const draws = await client.select().from(reserveTransactions).where(eq(reserveTransactions.kind, "charter_draw"));
  assert.equal(draws.length, 1);
  assert.equal(draws[0].amountUsd, -8_000);
  assert.equal(draws[0].membershipId, ms);
  assert.equal(draws[0].tripId, res.trip.id);
  assert.equal(draws[0].invoiceId, res.invoice.id);
  assert.equal(draws[0].description, `Charter draw — invoice ${res.invoice.id}`);
  assert.equal(res.drawdown && "reserveTxId" in res.drawdown ? res.drawdown.reserveTxId : null, draws[0].id);

  const [inv] = await client.select().from(invoices).where(eq(invoices.id, res.invoice.id));
  assert.equal(inv.status, "paid");
  assert.equal(inv.paidOn, new Date().toISOString().slice(0, 10));
  assert.ok(inv.paidAt instanceof Date);
  assert.equal(inv.notes, `Auto-drawn from reserve membership ${ms} — $8,000`);
  assert.equal(await balanceOf(client, m), 2_000);
});

test("a balance below the total makes no draw and the invoice stays a draft", async () => {
  const { client, store } = fresh();
  const m = await clientMember(client);
  const ms = await membership(client, m);
  await topUp(client, m, ms, 5_000);
  const q = await quote(client, "accepted", { memberId: m });

  const res = await store.convertToTrip(convertPlan(q, m, { total: 8_000 }));
  assert.deepEqual(res.drawdown, { drew: false, reason: "INSUFFICIENT_BALANCE" });
  assert.equal((await client.select().from(reserveTransactions).where(eq(reserveTransactions.kind, "charter_draw"))).length, 0);
  const [inv] = await client.select().from(invoices).where(eq(invoices.id, res.invoice.id));
  assert.equal(inv.status, "draft");
  assert.equal(inv.paidOn, null);
  assert.equal(await balanceOf(client, m), 5_000);
});

test("a paused membership gives NO_ACTIVE_MEMBERSHIP even with a balance", async () => {
  const { client, store } = fresh();
  const m = await clientMember(client);
  const ms = await membership(client, m, "paused");
  await topUp(client, m, ms, 50_000);
  const q = await quote(client, "accepted", { memberId: m });
  const res = await store.convertToTrip(convertPlan(q, m));
  assert.deepEqual(res.drawdown, { drew: false, reason: "NO_ACTIVE_MEMBERSHIP" });
  assert.equal(await balanceOf(client, m), 50_000);
});

test("two converts of two requests of one member with a balance for one give exactly one draw and a balance of 2,000", async () => {
  const { client, store } = fresh();
  const m = await clientMember(client);
  const ms = await membership(client, m);
  await topUp(client, m, ms, 10_000);
  const q1 = await quote(client, "accepted", { memberId: m });
  const q2 = await quote(client, "accepted", { memberId: m });

  const [r1, r2] = await Promise.all([store.convertToTrip(convertPlan(q1, m)), store.convertToTrip(convertPlan(q2, m))]);
  const drew = [r1, r2].filter((r) => r.drawdown?.drew);
  const short = [r1, r2].filter((r) => r.drawdown && !r.drawdown.drew);
  assert.equal(drew.length, 1);
  assert.equal(short.length, 1);
  assert.deepEqual(short[0].drawdown, { drew: false, reason: "INSUFFICIENT_BALANCE" });
  assert.equal((await client.select().from(reserveTransactions).where(eq(reserveTransactions.kind, "charter_draw"))).length, 1);
  assert.equal(await balanceOf(client, m), 2_000);
  const statuses = (await client.select().from(invoices)).map((i) => i.status).sort();
  assert.deepEqual(statuses, ["draft", "paid"]);
});

test("the draw names the active membership, not a newer paused one", async () => {
  const { client, store } = fresh();
  const m = await clientMember(client);
  // The schema allows one active row per member (a partial unique index), so the newer one is paused.
  const old = await membership(client, m, "active", "2025-01-01");
  const q = await quote(client, "accepted", { memberId: m });
  await membership(client, m, "paused", "2026-06-01");
  await topUp(client, m, old, 9_000);
  const res = await store.convertToTrip(convertPlan(q, m, { total: 8_000 }));
  assert.equal(res.drawdown?.drew, true);
  const [draw] = await client.select().from(reserveTransactions).where(eq(reserveTransactions.kind, "charter_draw"));
  assert.equal(draw.membershipId, old);
});

test("a total of zero or none opens a draft invoice and tries no draw", async () => {
  const { client, store } = fresh();
  const m = await clientMember(client);
  const ms = await membership(client, m);
  await topUp(client, m, ms, 10_000);
  const q = await quote(client, "accepted", { memberId: m });
  const res = await store.convertToTrip(convertPlan(q, m, { total: null }));
  assert.equal(res.drawdown, null);
  const [inv] = await client.select().from(invoices).where(eq(invoices.id, res.invoice.id));
  assert.equal(inv.status, "draft");
  assert.equal(await balanceOf(client, m), 10_000);
});

test("a convert with a chosen tail and legs a day apart writes the trip's calendar block, with the trip code in its notes", async () => {
  const { client, store } = fresh();
  const m = await clientMember(client);
  const op = await operator(client, "Acme Air");
  const ac = await plane(client, op, "N123AB");
  const q = await quote(client, "accepted", { memberId: m });
  const res = await store.convertToTrip(convertPlan(q, m, { aircraftId: ac }));
  const blocks = await client.select().from(aircraftScheduleBlocks).where(eq(aircraftScheduleBlocks.relatedTripId, res.trip.id));
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].kind, "trip");
  assert.equal(blocks[0].aircraftId, ac);
  assert.equal(blocks[0].notes, res.trip.tripCode);
  assert.equal(blocks[0].startAt.toISOString(), "2026-12-01T00:00:00.000Z");
  assert.equal(blocks[0].endAt.toISOString(), "2026-12-05T00:00:00.000Z");

  // No tail, or legs all on one day: no block.
  const q2 = await quote(client, "accepted", { memberId: m });
  const noTail = await store.convertToTrip(convertPlan(q2, m));
  assert.equal((await client.select().from(aircraftScheduleBlocks).where(eq(aircraftScheduleBlocks.relatedTripId, noTail.trip.id))).length, 0);
  const q3 = await quote(client, "accepted", { memberId: m });
  const sameDay = await store.convertToTrip(
    convertPlan(q3, m, { aircraftId: ac, legs: [{ legNumber: 1, fromCity: "A", toCity: "B", departDate: "2026-12-01" }] }),
  );
  assert.equal((await client.select().from(aircraftScheduleBlocks).where(eq(aircraftScheduleBlocks.relatedTripId, sameDay.trip.id))).length, 0);

  // Codes count up across converts.
  assert.deepEqual([res.trip.tripCode.slice(-4), noTail.trip.tripCode.slice(-4), sameDay.trip.tripCode.slice(-4)], ["0001", "0002", "0003"]);
});

test("the convert's reads: whole legs in order, the chosen option, the aircraft by tail, the client's name", async () => {
  const { client, store } = fresh();
  const u = await user(client, { firstName: "Ada", lastName: "Lovelace" } as never);
  const [m] = await client.insert(members).values({ userId: u, memberCode: "M-2026-9999" }).returning({ id: members.id });
  const op = await operator(client, "Acme Air");
  await plane(client, op, "N123AB");
  const q = await quote(client, "accepted", { memberId: m.id });
  await leg(client, q, 2, { fromCity: "B", toCity: "A" });
  await leg(client, q, 1, { fromCity: "A", toCity: "B" });
  await option(client, q, 1, { aircraftType: "first" });
  await option(client, q, 2, { aircraftType: "chosen", isChosen: true });

  assert.deepEqual((await store.quoteLegsInOrder(q)).map((l) => l.legNumber), [1, 2]);
  assert.equal((await store.chosenOption(q))?.aircraftType, "chosen");
  assert.equal(await store.chosenOption(await quote(client, "accepted")), undefined);
  assert.ok(await store.aircraftIdByTail("N123AB"));
  assert.equal(await store.aircraftIdByTail("N000XX"), undefined);
  const who = await store.clientName(m.id);
  assert.equal(who?.firstName, "Ada");
  assert.equal(who?.lastName, "Lovelace");
  assert.equal(await store.convertedTripOf("nope"), undefined);
});
