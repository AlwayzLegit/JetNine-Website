import test from "node:test";
import assert from "node:assert/strict";
import { codeYear } from "@/db/codes";
import { freshD1WithBatch } from "@/db/d1/test-batch-client";
import { aircraft } from "@/db/d1/schema/aircraft";
import { airports } from "@/db/d1/schema/airports";
import { invoices } from "@/db/d1/schema/invoices";
import { memberLanes } from "@/db/d1/schema/member-prefs";
import { members } from "@/db/d1/schema/members";
import { operators } from "@/db/d1/schema/operators";
import { quoteLegs, quotes } from "@/db/d1/schema/quotes";
import { aircraftScheduleBlocks } from "@/db/d1/schema/schedule-blocks";
import { staff } from "@/db/d1/schema/staff";
import { tripLegs, trips } from "@/db/d1/schema/trips";
import { users } from "@/db/d1/schema/users";
import { likePattern } from "@/domain/common";
import { d1MemberStore } from "./store-d1";

// OPS-149: contract tests for the D1 member store (the desk's client list and
// detail, the reserve ledger, the invite with its M code, memberships and the
// tier sync, preferences, companions and lanes), on a real SQLite with the
// repo's own D1 migrations applied and foreign keys on, as D1 has them. Each
// case is the same call the Postgres adapter answers.

function fresh() {
  const { sqlite, client } = freshD1WithBatch();
  return { sqlite, client, store: d1MemberStore(client) };
}
type Fresh = ReturnType<typeof fresh>;

// drizzle wraps the driver's error ("Failed query: ..."); the SQLite message is on its cause.
const isUnique = (e: unknown) => /UNIQUE constraint failed/i.test(String((e as { cause?: { message?: string } })?.cause?.message ?? (e as Error)?.message));

let seq = 0;
const n = () => ++seq;

async function user(c: Fresh["client"], over: Partial<typeof users.$inferInsert> = {}) {
  const [u] = await c
    .insert(users)
    .values({ email: `u${n()}@example.com`, ...over } as never)
    .returning({ id: users.id });
  return u.id;
}

async function member(c: Fresh["client"], over: Partial<typeof members.$inferInsert> = {}, userOver: Partial<typeof users.$inferInsert> = {}) {
  const userId = await user(c, userOver);
  const [m] = await c
    .insert(members)
    .values({ userId, memberCode: `M-2026-${String(n()).padStart(4, "0")}`, ...over })
    .returning({ id: members.id, memberCode: members.memberCode });
  return { id: m.id, userId, memberCode: m.memberCode };
}

async function airport(c: Fresh["client"], icao: string, city = icao) {
  await c.insert(airports).values({ icao, name: `${city} Airport`, city, countryIso2: "US", lat: "0", lon: "0" } as never);
}

async function trip(c: Fresh["client"], memberId: string, over: Partial<typeof trips.$inferInsert> = {}) {
  const [t] = await c
    .insert(trips)
    .values({ memberId, tripCode: `JN-2026-${String(n()).padStart(4, "0")}`, missionType: "one_way", paxCount: 3, ...over })
    .returning({ id: trips.id });
  return t.id;
}

async function leg(c: Fresh["client"], tripId: string, legNumber: number, departDate: string | null, over: Partial<typeof tripLegs.$inferInsert> = {}) {
  await c.insert(tripLegs).values({ tripId, legNumber, departDate, ...over } as never);
}

async function quote(c: Fresh["client"], memberId: string | null, status: string, over: Partial<typeof quotes.$inferInsert> = {}) {
  const [q] = await c
    .insert(quotes)
    .values({
      memberId,
      quoteCode: `JN-2026-${String(n()).padStart(5, "0")}`,
      tripType: "one_way",
      paxCount: 2,
      status: status as never,
      ...over,
    } as never)
    .returning({ id: quotes.id });
  return q.id;
}

async function invoice(c: Fresh["client"], memberId: string, status: string, totalUsd: number | null, over: Partial<typeof invoices.$inferInsert> = {}) {
  const [i] = await c
    .insert(invoices)
    .values({ memberId, invoiceCode: `INV-2026-${String(n()).padStart(4, "0")}`, status: status as never, totalUsd, ...over } as never)
    .returning({ id: invoices.id });
  return i.id;
}

const membershipValues = (memberId: string, over: Record<string, unknown> = {}) => ({
  memberId,
  program: "card_100" as const,
  depositUsd: 100_000,
  calloutHours: 12,
  ...over,
});

// ─── identity ───────────────────────────────────────────────────────────────

test("memberByUserId and memberRefByUserId find the profile, or null for a user with none", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const lonely = await user(client);
  const row = await store.memberByUserId(m.userId);
  assert.equal(row?.id, m.id);
  assert.equal(row?.tier, "on_demand");
  assert.ok(row?.createdAt instanceof Date);
  assert.deepEqual(await store.memberRefByUserId(m.userId), { id: m.id, memberCode: m.memberCode });
  assert.equal(await store.memberByUserId(lonely), null);
  assert.equal(await store.memberRefByUserId(lonely), null);
});

// ─── the client list ────────────────────────────────────────────────────────

test("listClientRows: search is case-insensitive over the six columns, escapes wildcards, and orders by last then first name", async () => {
  const { client, store } = fresh();
  const ada = await member(client, { legalName: "Augusta Ada King", companyName: "Analytical Engines" }, { firstName: "Ada", lastName: "Lovelace", email: "ada@babbage.test" });
  const grace = await member(client, { preferredName: "Amazing Grace" }, { firstName: "Grace", lastName: "Hopper", email: "grace@navy.test" });
  await member(client, {}, { firstName: "Per", lastName: "100%_sure", email: "per@x.test" });

  const all = await store.listClientRows(null, "2026-11-17");
  assert.deepEqual(all.map((r) => r.lastName), ["100%_sure", "Hopper", "Lovelace"]);

  const hit = async (term: string) => (await store.listClientRows(likePattern(term), "2026-11-17")).map((r) => r.id);
  assert.deepEqual(await hit("ADA"), [ada.id]); // first name, upper case
  assert.deepEqual(await hit("hopper"), [grace.id]); // last name
  assert.deepEqual(await hit("BABBAGE.TEST"), [ada.id]); // email
  assert.deepEqual(await hit("augusta"), [ada.id]); // legal name
  assert.deepEqual(await hit("amazing"), [grace.id]); // preferred name
  assert.deepEqual(await hit("engines"), [ada.id]); // company
  assert.equal((await hit("100%_")).length, 1); // wildcards are literal
  assert.equal((await hit("1_0")).length, 0);
  assert.deepEqual(await hit("nobody"), []);
});

test("listClientRows: trip count, lifetime sum, last flown, next trip, open requests and reserve sum", async () => {
  const { client, store } = fresh();
  const today = "2026-11-17";
  const m = await member(client, {}, { firstName: "Ada", lastName: "Lovelace" });
  const other = await member(client, {}, { firstName: "Zed", lastName: "Zero" });

  // Trips: one flown (leg before today), one cancelled (ignored for last flown), one next (leg after today), one draft.
  const flown = await trip(client, m.id, { status: "completed" });
  await leg(client, flown, 1, "2026-10-01");
  await leg(client, flown, 2, "2026-10-03");
  const cancelled = await trip(client, m.id, { status: "cancelled_wx" });
  await leg(client, cancelled, 1, "2026-11-10");
  const soon = await trip(client, m.id, { status: "confirmed" });
  await leg(client, soon, 1, "2026-12-20");
  const sooner = await trip(client, m.id, { status: "confirmed" });
  await leg(client, sooner, 1, "2026-11-30");
  const draft = await trip(client, m.id, { status: "draft" });
  await leg(client, draft, 1, "2026-11-12");
  // Someone else's trip does not count.
  await trip(client, other.id);

  await invoice(client, m.id, "paid", 1000);
  await invoice(client, m.id, "due", 250);
  await invoice(client, m.id, "overdue", 50);
  await invoice(client, m.id, "draft", 9999);
  await invoice(client, m.id, "void", 7777);

  for (const s of ["submitted", "triaged", "sourcing", "options_sent", "held"]) await quote(client, m.id, s);
  for (const s of ["draft", "accepted", "declined", "converted"]) await quote(client, m.id, s);
  await quote(client, other.id, "submitted");

  await store.appendLedger({ memberId: m.id, kind: "top_up", amountUsd: 5000 });
  await store.appendLedger({ memberId: m.id, kind: "charter_draw", amountUsd: -1200 });

  const rows = await store.listClientRows(null, today);
  const row = rows.find((r) => r.id === m.id)!;
  assert.equal(row.tripCount, 5);
  assert.equal(row.lifetimeUsd, 1300);
  assert.equal(row.lastFlownOn, "2026-10-03", "draft and cancelled trips do not count as flown");
  assert.equal(row.nextTripId, sooner, "the earliest leg on or after today, on a trip not yet flown or cancelled");
  assert.equal(row.openRequests, 5);
  assert.equal(row.reserveUsd, 3800);
  assert.equal(row.program, null);
  assert.equal(row.prefs, null);
  assert.equal(row.email.length > 0, true);

  const o = rows.find((r) => r.id === other.id)!;
  assert.equal(o.tripCount, 1);
  assert.equal(o.lifetimeUsd, 0);
  assert.equal(o.lastFlownOn, null);
  assert.equal(o.nextTripId, null);
  assert.equal(o.openRequests, 1);
  assert.equal(o.reserveUsd, 0);
});

test("listClientRows: the active membership and the preferences join in; a paused one does not", async () => {
  const { client, store } = fresh();
  const a = await member(client, {}, { lastName: "Active" });
  const b = await member(client, {}, { lastName: "Paused" });
  await store.insertMembership(membershipValues(a.id, { status: "active", activatedOn: "2026-01-05", nextRenewalDate: "2027-01-05", expiresOn: "2028-01-05" }));
  await store.insertMembership(membershipValues(b.id, { status: "paused" }));
  await store.upsertPreferences({ memberId: a.id, cabinWifi: false, dietary: "none" });
  const rows = await store.listClientRows(null, "2026-11-17");
  const ra = rows.find((r) => r.id === a.id)!;
  const rb = rows.find((r) => r.id === b.id)!;
  assert.equal(ra.program, "card_100");
  assert.equal(ra.programSince, "2026-01-05");
  assert.equal(ra.programRenews, "2027-01-05");
  assert.equal(ra.programEnds, "2028-01-05");
  assert.equal(ra.prefs?.cabinWifi, false);
  assert.equal(ra.prefs?.dietary, "none");
  assert.equal(rb.program, null);
  assert.equal(rb.prefs, null);
});

test("listClientRows: a user with no last name sorts last, as Postgres sorts NULL on asc", async () => {
  const { client, store } = fresh();
  await member(client, {}, { lastName: null, firstName: "Nameless" });
  await member(client, {}, { lastName: "Zulu" });
  const rows = await store.listClientRows(null, "2026-11-17");
  assert.deepEqual(rows.map((r) => r.lastName), ["Zulu", null]);
});

test("nextTripFacts returns passengers, status and legs by leg number, and reads more than 50 ids in chunks", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const t = await trip(client, m.id, { paxCount: 6, status: "confirmed" });
  await leg(client, t, 2, "2026-12-02", { fromIata: "TEB", toIata: "VNY" });
  await leg(client, t, 1, "2026-12-01", { fromIata: "VNY", toIata: "TEB" });
  const ids = [t, ...Array.from({ length: 120 }, (_, i) => `ghost-${i}`)];
  const { trips: rows, legs } = await store.nextTripFacts(ids);
  assert.deepEqual(rows, [{ id: t, paxCount: 6, status: "confirmed" }]);
  assert.deepEqual(legs.map((l) => [l.tripId, l.fromIata, l.departDate]), [
    [t, "VNY", "2026-12-01"],
    [t, "TEB", "2026-12-02"],
  ]);
  assert.deepEqual(await store.nextTripFacts([]), { trips: [], legs: [] });
});

// ─── one client ─────────────────────────────────────────────────────────────

test("clientHead: the member with their user, and undefined for an unknown id", async () => {
  const { client, store } = fresh();
  const m = await member(
    client,
    { legalName: "Ada King", companyName: "Engines", roleTitle: "CEO", twoFactorEnabled: true, marketingOptIn: true, mobileE164: "+13105550100" },
    { firstName: "Ada", lastName: "Lovelace", phoneE164: "+13105550111", role: "member" },
  );
  const head = (await store.clientHead(m.id))!;
  assert.equal(head.id, m.id);
  assert.equal(head.memberCode, m.memberCode);
  assert.equal(head.legalName, "Ada King");
  assert.equal(head.tier, "on_demand");
  assert.equal(head.status, "active");
  assert.equal(head.twoFactorEnabled, true);
  assert.equal(head.marketingOptIn, true);
  assert.equal(head.lifetimeTripsCache, 0);
  assert.equal(head.primaryDispatcherId, null);
  assert.equal(head.firstName, "Ada");
  assert.equal(head.phoneE164, "+13105550111");
  assert.equal(head.mobileE164, "+13105550100");
  assert.equal(head.role, "member");
  assert.equal(await store.clientHead("no-such-member"), undefined);
});

test("clientBody: every block, with the Postgres orderings and limits", async () => {
  const { client, store } = fresh();
  const dispatcherUser = await user(client, { role: "dispatcher" });
  const [st] = await client.insert(staff).values({ userId: dispatcherUser, displayName: "Dana Dispatch", status: "on" } as never).returning({ id: staff.id });
  const m = await member(client, { primaryDispatcherId: st.id });
  const other = await member(client);

  await store.upsertPreferences({ memberId: m.id, cateringTier: "premium" });

  // Lanes: a frequent one, a rare one and one with no frequency (Postgres desc puts NULL first).
  await store.addLane({ memberId: m.id, fromIcao: "KVNY", toIcao: "KTEB", frequencyPerYear: 12 });
  await store.addLane({ memberId: m.id, fromIcao: "KVNY", toIcao: "KLAS", frequencyPerYear: 2 });
  await store.addLane({ memberId: m.id, fromIcao: "KVNY", toIcao: "KASE", frequencyPerYear: null });

  // Companions by legal name; no birth date or KTN in the facts.
  await store.addCompanion({ memberId: m.id, relation: "spouse", legalName: "Zoe Lovelace", birthDate: "1980-01-01", ktnEnc: "secret" });
  await store.addCompanion({ memberId: m.id, relation: "pet", legalName: "Biscuit", speciesBreed: "Corgi", weightLb: 25 });

  // Memberships: newest activation first.
  await store.insertMembership(membershipValues(m.id, { status: "cancelled", activatedOn: "2025-01-01" }));
  await store.insertMembership(membershipValues(m.id, { status: "active", activatedOn: "2026-02-01" }));

  // Trips: 12 of them, 10 newest come back; open ones are those not yet flown or cancelled.
  const tripIds: string[] = [];
  for (let i = 0; i < 12; i++) {
    tripIds.push(await trip(client, m.id, { status: i === 0 ? "completed" : "confirmed", createdAt: new Date(Date.UTC(2026, 0, 1 + i)) }));
  }
  await trip(client, other.id);
  // Invoices: ten newest by issue date, with the trip code joined.
  const inv0 = await invoice(client, m.id, "paid", 500, { tripId: tripIds[11], issuedOn: "2026-03-01" });
  await invoice(client, m.id, "due", 300, { issuedOn: "2026-04-01" });
  await invoice(client, m.id, "draft", 9000, { issuedOn: "2026-05-01" });
  // Quotes newest first.
  await quote(client, m.id, "submitted", { receivedAt: new Date("2026-06-01T00:00:00Z") });
  const newestQuote = await quote(client, m.id, "held", { receivedAt: new Date("2026-07-01T00:00:00Z") });
  // Ledger: ten rows, the eight newest.
  for (let i = 0; i < 10; i++) {
    await store.appendLedger({ memberId: m.id, kind: "top_up", amountUsd: 100, occurredAt: new Date(Date.UTC(2026, 5, 1 + i)), description: `row ${i}` });
  }

  const body = await store.clientBody(m.id, st.id);
  assert.deepEqual(body.dispatcher, { displayName: "Dana Dispatch", status: "on" });
  assert.equal(body.prefs?.cateringTier, "premium");
  assert.deepEqual(body.lanes.map((l) => l.toIcao), ["KASE", "KTEB", "KLAS"], "NULL frequency first, then most frequent");
  assert.deepEqual(body.companions.map((c) => c.legalName), ["Biscuit", "Zoe Lovelace"]);
  assert.ok(!("birthDate" in body.companions[0]) && !("ktnEnc" in body.companions[0]));
  assert.deepEqual(body.programs.map((p) => p.activatedOn), ["2026-02-01", "2025-01-01"]);
  assert.equal(body.balance, 1000);
  assert.equal(body.trips.length, 10);
  assert.equal(body.trips[0].id, tripIds[11], "newest first");
  assert.equal(body.openTrips.length, 11, "the completed trip is not open");
  assert.ok(!body.openTrips.some((t) => t.id === tripIds[0]));
  assert.deepEqual(body.invoices.map((i) => i.status), ["draft", "due", "paid"]);
  const joined = body.invoices.find((i) => i.id === inv0)!;
  assert.equal(joined.tripId, tripIds[11]);
  assert.ok(joined.tripCode?.startsWith("JN-2026-"));
  assert.equal(body.quotes[0].id, newestQuote);
  assert.equal(body.quotes.length, 2);
  assert.equal(body.lifetimeInvoiced, 800, "paid and due, not draft");
  assert.equal(body.ledger.length, 8);
  assert.equal(body.ledger[0].description, "row 9");

  const noDispatcher = await store.clientBody(other.id, null);
  assert.equal(noDispatcher.dispatcher, null);
  assert.equal(noDispatcher.prefs, null);
  assert.equal(noDispatcher.balance, 0);
  assert.equal(noDispatcher.lifetimeInvoiced, 0);
  assert.deepEqual(noDispatcher.lanes, []);
});

test("clientBody: documents come primary first, then by type", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const { memberDocuments } = await import("@/db/d1/schema/member-prefs");
  await client.insert(memberDocuments).values([
    { memberId: m.id, docType: "known_traveler", isPrimary: false },
    { memberId: m.id, docType: "passport", countryIso2: "US", expiresOn: "2030-01-01", isPrimary: true },
    { memberId: m.id, docType: "second_passport", isPrimary: false },
  ] as never);
  const body = await store.clientBody(m.id, null);
  assert.equal(body.documents[0].docType, "passport");
  assert.equal(body.documents[0].isPrimary, true);
  assert.equal(body.documents[0].countryIso2, "US");
  assert.equal(body.documents.length, 3);
  assert.deepEqual(Object.keys(body.documents[0]).sort(), ["countryIso2", "docType", "expiresOn", "id", "isPrimary"]);
});

test("clientLegFacts: trip legs and quote legs by leg number, lane airports, and long id lists in chunks", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  await airport(client, "KVNY", "Van Nuys");
  await airport(client, "KTEB", "Teterboro");
  const t = await trip(client, m.id);
  await leg(client, t, 2, "2026-12-02", { toIata: "VNY" });
  await leg(client, t, 1, "2026-12-01", { toIata: "TEB" });
  const q = await quote(client, m.id, "submitted");
  await client.insert(quoteLegs).values([
    { quoteId: q, legNumber: 2, fromIata: "TEB", departDate: "2026-12-05" },
    { quoteId: q, legNumber: 1, fromIata: "VNY", departDate: "2026-12-04" },
  ] as never);

  const manyIds = Array.from({ length: 130 }, (_, i) => `ghost-${i}`);
  const facts = await store.clientLegFacts([t, ...manyIds], [q, ...manyIds], ["KVNY", "KTEB", ...manyIds]);
  assert.deepEqual(facts.legs.map((l) => l.departDate), ["2026-12-01", "2026-12-02"]);
  assert.deepEqual(facts.quoteLegs.map((l) => l.fromIata), ["VNY", "TEB"]);
  assert.deepEqual(facts.laneAirports.map((a) => [a.icao, a.city]).sort(), [["KTEB", "Teterboro"], ["KVNY", "Van Nuys"]]);
  assert.deepEqual(await store.clientLegFacts([], [], []), { legs: [], quoteLegs: [], laneAirports: [] });
});

test("aircraftModel reads the make and model, or null", async () => {
  const { client, store } = fresh();
  const [op] = await client.insert(operators).values({ name: "Acme Air" } as never).returning({ id: operators.id });
  const [ac] = await client
    .insert(aircraft)
    .values({ tailNumber: "N123JN", operatorId: op.id, category: "midsize", makeModel: "Citation Latitude", seats: 8, rangeNm: 2700, speedKt: 440 } as never)
    .returning({ id: aircraft.id });
  assert.equal(await store.aircraftModel(ac.id), "Citation Latitude");
  assert.equal(await store.aircraftModel("nope"), null);
});

// ─── the reserve ledger ─────────────────────────────────────────────────────

test("ledgerTarget: the client and the newest ACTIVE membership; undefined for an unknown member", async () => {
  const { client, store } = fresh();
  const m = await member(client, {}, { firstName: "Ada", lastName: "Lovelace", email: "ada@x.test" });
  assert.equal(await store.ledgerTarget("nope"), undefined);
  let target = (await store.ledgerTarget(m.id))!;
  assert.deepEqual(target.member, { id: m.id, memberCode: m.memberCode, firstName: "Ada", lastName: "Lovelace", email: "ada@x.test" });
  assert.equal(target.activeMembershipId, null);

  await store.insertMembership(membershipValues(m.id, { status: "cancelled", activatedOn: "2027-01-01" }));
  const { id: active } = await store.insertMembership(membershipValues(m.id, { status: "active", activatedOn: "2026-01-01" }));
  target = (await store.ledgerTarget(m.id))!;
  assert.equal(target.activeMembershipId, active, "a cancelled row is never the bucket");
});

test("ledger: append, balance, credit accruals only, recent rows newest first, and the trip and invoice codes", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const other = await member(client);
  const t = await trip(client, m.id);
  const inv = await invoice(client, m.id, "paid", 100);
  assert.equal(await store.balance(m.id), 0);
  assert.equal(await store.creditAccrualTotal(m.id), 0);

  const { id } = await store.appendLedger({ memberId: m.id, kind: "top_up", amountUsd: 5000, description: "deposit", occurredAt: new Date("2026-06-01T00:00:00Z") });
  assert.ok(id.length > 0);
  await store.appendLedger({ memberId: m.id, kind: "credit_accrual", amountUsd: 150, occurredAt: new Date("2026-06-02T00:00:00Z") });
  await store.appendLedger({ memberId: m.id, kind: "charter_draw", amountUsd: -1200, tripId: t, invoiceId: inv, occurredAt: new Date("2026-06-03T00:00:00Z") });
  await store.appendLedger({ memberId: other.id, kind: "top_up", amountUsd: 999 });

  assert.equal(await store.balance(m.id), 3950);
  assert.equal(await store.creditAccrualTotal(m.id), 150);

  const recent = await store.recentLedger(m.id, 2);
  assert.deepEqual(recent.map((r) => r.amountUsd), [-1200, 150]);
  assert.ok(recent[0].occurredAt instanceof Date);
  assert.deepEqual(Object.keys(recent[0]).sort(), ["amountUsd", "description", "id", "kind", "occurredAt"]);

  const withRefs = await store.recentLedgerWithRefs(m.id, 25);
  assert.equal(withRefs.length, 3);
  assert.equal(withRefs[0].tripId, t);
  assert.ok(withRefs[0].tripCode?.startsWith("JN-2026-"));
  assert.equal(withRefs[0].invoiceId, inv);
  assert.ok(withRefs[0].invoiceCode?.startsWith("INV-2026-"));
  assert.equal(withRefs[2].tripCode, null);
  assert.equal(withRefs[2].invoiceCode, null);
});

test("the ledger refuses a second top-up for one Stripe payment intent, and a second refund for one draw", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const t = await trip(client, m.id);
  const inv = await invoice(client, m.id, "paid", 100);

  await store.appendLedger({ memberId: m.id, kind: "top_up", amountUsd: 5000, stripePaymentIntentId: "pi_1" });
  await assert.rejects(() => store.appendLedger({ memberId: m.id, kind: "top_up", amountUsd: 5000, stripePaymentIntentId: "pi_1" }), isUnique);
  // A different intent, and a top-up with no intent (a desk entry), are fine, more than once.
  await store.appendLedger({ memberId: m.id, kind: "top_up", amountUsd: 10, stripePaymentIntentId: "pi_2" });
  await store.appendLedger({ memberId: m.id, kind: "top_up", amountUsd: 10 });
  await store.appendLedger({ memberId: m.id, kind: "top_up", amountUsd: 10 });
  // The same intent on another kind of row is not a top-up.
  await store.appendLedger({ memberId: m.id, kind: "adjustment", amountUsd: 1, stripePaymentIntentId: "pi_1" });

  await store.appendLedger({ memberId: m.id, kind: "refund", amountUsd: 1200, tripId: t, invoiceId: inv });
  await assert.rejects(() => store.appendLedger({ memberId: m.id, kind: "refund", amountUsd: 1200, tripId: t, invoiceId: inv }), isUnique);
  // A draw for the same trip and invoice is not a refund.
  await store.appendLedger({ memberId: m.id, kind: "charter_draw", amountUsd: -1200, tripId: t, invoiceId: inv });
  assert.equal(await store.balance(m.id), 5000 + 10 + 10 + 10 + 1 + 1200 - 1200);
});

// ─── invite ─────────────────────────────────────────────────────────────────

test("insertMember gives M-YYYY-0001, then 0002; a failed insert gives its number back", async () => {
  const { client, store, sqlite } = fresh();
  const year = codeYear();
  const u1 = await user(client);
  const u2 = await user(client);
  const u3 = await user(client);

  const first = await store.insertMember({ userId: u1, memberCode: "", legalName: "One", tier: "on_demand", status: "active" });
  assert.equal(first.memberCode, `M-${year}-0001`);
  const second = await store.insertMember({ userId: u2, memberCode: "ignored", tier: "on_demand", status: "active" });
  assert.equal(second.memberCode, `M-${year}-0002`, "the caller's memberCode is ignored");

  // The same user twice: the unique user_id refuses the insert and the batch rolls the counter back.
  await assert.rejects(() => store.insertMember({ userId: u1, memberCode: "", tier: "on_demand", status: "active" }));
  const counter = sqlite.prepare("select year, last_value from member_code_sequence").all();
  assert.deepEqual(counter.map((r) => ({ year: r.year, last_value: r.last_value })), [{ year, last_value: 2 }]);

  const third = await store.insertMember({ userId: u3, memberCode: "", tier: "card_100", status: "active", memberSince: "2026-11-17" });
  assert.equal(third.memberCode, `M-${year}-0003`, "the next insert takes the number the failed one would have");
  assert.equal((await store.memberByUserId(u3))?.memberCode, third.memberCode);
  assert.equal((await store.memberRefByUserId(u3))?.id, third.id);
});

// ─── memberships and the tier ───────────────────────────────────────────────

test("insertMembership, membershipsOf (newest activation first), activeMembership and patchMembership", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  assert.equal(await store.activeMembership(m.id), undefined);
  const { id: old } = await store.insertMembership(membershipValues(m.id, { status: "expired", activatedOn: "2024-01-01" }));
  const { id: paused } = await store.insertMembership(membershipValues(m.id, { status: "paused", activatedOn: "2026-05-01" }));
  assert.deepEqual((await store.membershipsOf(m.id)).map((r) => r.id), [paused, old]);
  assert.equal(await store.activeMembership(m.id), undefined);

  const before = (await store.membershipsOf(m.id)).find((r) => r.id === paused)!;
  await new Promise((r) => setTimeout(r, 5));
  await store.patchMembership(paused, { stripeCheckoutSessionId: "cs_test_1" });
  const afterRow = (await store.membershipsOf(m.id)).find((r) => r.id === paused)!;
  assert.equal(afterRow.stripeCheckoutSessionId, "cs_test_1");
  assert.equal(afterRow.status, "paused");
  assert.ok(afterRow.updatedAt.getTime() > before.updatedAt.getTime(), "updated_at is stamped");

  await store.patchMembership(paused, { status: "active" });
  assert.equal((await store.activeMembership(m.id))?.id, paused);
  await store.patchMembership(paused, { status: "cancelled", notes: "checkout-session-create-failed" });
  const cancelled = (await store.membershipsOf(m.id)).find((r) => r.id === paused)!;
  assert.equal(cancelled.notes, "checkout-session-create-failed");
});

test("a second ACTIVE membership for one member is refused by the index; paused and cancelled rows may repeat", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const other = await member(client);
  await store.insertMembership(membershipValues(m.id, { status: "active" }));
  await assert.rejects(() => store.insertMembership(membershipValues(m.id, { status: "active", program: "card_250" })), isUnique);
  await store.insertMembership(membershipValues(m.id, { status: "paused" }));
  await store.insertMembership(membershipValues(m.id, { status: "paused" }));
  await store.insertMembership(membershipValues(m.id, { status: "cancelled" }));
  await store.insertMembership(membershipValues(other.id, { status: "active" })); // another member is fine
  // Flipping a paused row to active while one is active is refused too (the double-click buy).
  const { id: p } = await store.insertMembership(membershipValues(m.id, { status: "paused" }));
  await assert.rejects(() => store.patchMembership(p, { status: "active" }), isUnique);
});

test("syncTier follows the trigger: active sets tier and since; a stopped one resets to on_demand unless another is active; paused changes nothing", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const tierOf = async () => {
    const row = await store.memberByUserId(m.userId);
    return { tier: row?.tier, since: row?.tierSince };
  };

  // A paused insert changes nothing.
  const { id: a } = await store.insertMembership(membershipValues(m.id, { program: "card_250", status: "paused", activatedOn: "2026-03-01" }));
  await store.syncTier(a, null);
  assert.deepEqual(await tierOf(), { tier: "on_demand", since: null });

  // Activation sets the tier from the program and the date from activated_on.
  await store.patchMembership(a, { status: "active" });
  await store.syncTier(a, "paused");
  assert.deepEqual(await tierOf(), { tier: "card_250", since: "2026-03-01" });

  // Running it again arrives at the same values.
  await store.syncTier(a, "active");
  assert.deepEqual(await tierOf(), { tier: "card_250", since: "2026-03-01" });

  // Cancelled, with no other active membership: back to on_demand, tier_since left alone.
  await store.patchMembership(a, { status: "cancelled" });
  await store.syncTier(a, "active");
  assert.deepEqual(await tierOf(), { tier: "on_demand", since: "2026-03-01" });

  // An unknown membership is a no-op.
  await store.syncTier("no-such-membership", "active");
  assert.deepEqual(await tierOf(), { tier: "on_demand", since: "2026-03-01" });
});

test("syncTier: a stopped membership keeps the tier when the member has another active one", async () => {
  const { client, store, sqlite } = fresh();
  const m = await member(client);
  const { id: a } = await store.insertMembership(membershipValues(m.id, { program: "card_100", status: "active", activatedOn: "2026-01-01" }));
  await store.syncTier(a, null);
  // Make a second active row by bypassing the index, as only the Postgres trigger era's data could hold.
  sqlite.exec("drop index memberships_active_per_member_uniq");
  const { id: b } = await store.insertMembership(membershipValues(m.id, { program: "card_500", status: "active", activatedOn: "2026-02-01" }));
  await store.syncTier(b, null);
  assert.equal((await store.memberByUserId(m.userId))?.tier, "card_500");
  await store.patchMembership(a, { status: "expired" });
  await store.syncTier(a, "active");
  assert.equal((await store.memberByUserId(m.userId))?.tier, "card_500", "another active membership holds the tier");
});

// ─── preferences, companions, lanes ─────────────────────────────────────────

test("preferences: the first save creates, the second updates; JSON and booleans round-trip", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  assert.equal(await store.preferencesOf(m.id), undefined);
  assert.deepEqual(await store.upsertPreferences({ memberId: m.id, cabinWifi: false, dietary: "vegan", quietHoursStart: "22:00:00" }), { created: true });
  let prefs = (await store.preferencesOf(m.id))!;
  assert.equal(prefs.cabinWifi, false);
  assert.equal(prefs.dietary, "vegan");
  assert.equal(prefs.cateringTier, "standard");
  assert.equal(prefs.emptyLegAlertThresholdPct, 40);
  assert.ok(prefs.createdAt instanceof Date);

  assert.deepEqual(await store.upsertPreferences({ memberId: m.id, cabinWifi: true, dietary: null, groundType: "suv_sprinter" }), { created: false });
  prefs = (await store.preferencesOf(m.id))!;
  assert.equal(prefs.cabinWifi, true);
  assert.equal(prefs.dietary, null);
  assert.equal(prefs.groundType, "suv_sprinter");
});

test("companions: add, list oldest first, ownership check, delete", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const other = await member(client);
  const a = await store.addCompanion({ memberId: m.id, relation: "spouse", legalName: "Zoe", createdAt: new Date("2026-01-01T00:00:00Z") });
  const b = await store.addCompanion({ memberId: m.id, relation: "pet", legalName: "Biscuit", speciesBreed: "Corgi", weightLb: 25, createdAt: new Date("2026-02-01T00:00:00Z") });
  assert.deepEqual((await store.companionsOf(m.id)).map((c) => c.id), [a.id, b.id]);
  assert.deepEqual(await store.companionsOf(other.id), []);

  assert.deepEqual(await store.companionOf(a.id, m.id), { id: a.id, legalName: "Zoe", relation: "spouse" });
  assert.equal(await store.companionOf(a.id, other.id), undefined, "another member's companion is not found");
  assert.equal(await store.companionOf("nope", m.id), undefined);

  await store.deleteCompanion(a.id);
  assert.deepEqual((await store.companionsOf(m.id)).map((c) => c.id), [b.id]);
});

test("lanes: add, list oldest first, laneExists, the unique route, ownership check, delete", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const other = await member(client);
  assert.equal(await store.laneExists(m.id, "KVNY", "KTEB"), false);
  const a = await store.addLane({ memberId: m.id, fromIcao: "KVNY", toIcao: "KTEB", frequencyPerYear: 6, seasonal: true });
  const b = await store.addLane({ memberId: m.id, fromIcao: "KTEB", toIcao: "KVNY" });
  assert.equal(await store.laneExists(m.id, "KVNY", "KTEB"), true);
  assert.equal(await store.laneExists(other.id, "KVNY", "KTEB"), false);
  assert.equal(await store.laneExists(m.id, "KVNY", "KLAS"), false);
  await assert.rejects(() => store.addLane({ memberId: m.id, fromIcao: "KVNY", toIcao: "KTEB" }), isUnique);

  const lanes = await store.lanesOf(m.id);
  assert.deepEqual(lanes.map((l) => l.id).sort(), [a.id, b.id].sort());
  assert.equal(lanes.find((l) => l.id === a.id)?.seasonal, true);
  assert.equal(lanes.find((l) => l.id === b.id)?.frequencyPerYear, null);

  assert.deepEqual(await store.laneOf(a.id, m.id), { id: a.id, fromIcao: "KVNY", toIcao: "KTEB" });
  assert.equal(await store.laneOf(a.id, other.id), undefined);
  await store.deleteLane(a.id);
  assert.equal(await store.laneExists(m.id, "KVNY", "KTEB"), false);
  assert.equal((await client.select().from(memberLanes)).length, 1);
});

// ─── the other four guards the migration carries ────────────────────────────

test("one trip per quote, and one soft hold per aircraft and quote, are refused by the D1 indexes", async () => {
  const { client } = fresh();
  const m = await member(client);
  const q = await quote(client, m.id, "accepted");
  await trip(client, m.id, { quoteId: q });
  await assert.rejects(() => trip(client, m.id, { quoteId: q }), isUnique);
  await trip(client, m.id); // trips with no quote may repeat
  await trip(client, m.id);

  const [op] = await client.insert(operators).values({ name: "Acme Air" } as never).returning({ id: operators.id });
  const [ac] = await client
    .insert(aircraft)
    .values({ tailNumber: "N9JN", operatorId: op.id, category: "light", makeModel: "Phenom 300", seats: 7, rangeNm: 1900, speedKt: 450 } as never)
    .returning({ id: aircraft.id });
  const block = (kind: string, quoteId: string | null) => ({
    aircraftId: ac.id,
    kind: kind as never,
    startAt: new Date("2026-12-01T00:00:00Z"),
    endAt: new Date("2026-12-02T00:00:00Z"),
    relatedQuoteId: quoteId,
  });
  await client.insert(aircraftScheduleBlocks).values(block("hold", q));
  await assert.rejects(() => client.insert(aircraftScheduleBlocks).values(block("hold", q)), isUnique);
  await client.insert(aircraftScheduleBlocks).values(block("maintenance", q)); // not a hold
  await client.insert(aircraftScheduleBlocks).values(block("hold", null));
  await client.insert(aircraftScheduleBlocks).values(block("hold", null));
});
