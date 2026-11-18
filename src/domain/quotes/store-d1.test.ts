import test from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { formatCode } from "@/db/codes";
import { freshD1WithBatch } from "@/db/d1/test-batch-client";
import { aircraft } from "@/db/d1/schema/aircraft";
import { airports } from "@/db/d1/schema/airports";
import { members } from "@/db/d1/schema/members";
import { operators } from "@/db/d1/schema/operators";
import { quoteLegs, quotes } from "@/db/d1/schema/quotes";
import { sourcedOptions } from "@/db/d1/schema/sourced-option";
import { staff } from "@/db/d1/schema/staff";
import { tripLegs, trips } from "@/db/d1/schema/trips";
import { users } from "@/db/d1/schema/users";
import { airportRowFromCatalog, type AirportRow } from "@/lib/airport-rows";
import { findAirport } from "@/lib/airports";
import { DuplicateIdempotencyKey, type NewQuoteInput } from "./store";
import { d1QuoteStore } from "./store-d1";

// OPS-153: contract tests for the D1 quote store (the quote wizard's submit, the
// client's request page and the client choosing an option), on a real SQLite with
// the repo's own D1 migrations applied, foreign keys on and a batch that is one
// transaction, as D1 has them.

const YEAR = 2026;

function fresh() {
  const { sqlite, client } = freshD1WithBatch();
  return { sqlite, client, store: d1QuoteStore(client) };
}

function catalog(iata: string): AirportRow {
  const a = findAirport(iata);
  assert.ok(a, `picker airport ${iata}`);
  const row = airportRowFromCatalog(a);
  assert.ok(row);
  return row;
}

function input(over: { key?: string | null; legs?: number; airports?: AirportRow[]; token?: string } = {}): NewQuoteInput {
  const legCount = over.legs ?? 2;
  return {
    year: YEAR,
    airports: over.airports ?? [catalog("VNY"), catalog("TEB")],
    values: {
      source: "quote_wizard",
      tripType: legCount === 1 ? "one_way" : "round",
      paxCount: 4,
      contactSnapshot: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", phoneE164: "+18188005678" },
      consentBroker: true,
      consentContact: true,
      clientIdempotencyKey: over.key === undefined ? null : over.key,
      ...(over.token ? { statusToken: over.token } : {}),
      status: "submitted",
    } as never,
    legs: Array.from({ length: legCount }, (_, i) => ({
      legNumber: i + 1,
      fromIcao: i % 2 === 0 ? "KVNY" : "KTEB",
      fromIata: i % 2 === 0 ? "VNY" : "TEB",
      toIcao: i % 2 === 0 ? "KTEB" : "KVNY",
      toIata: i % 2 === 0 ? "TEB" : "VNY",
      departDate: "2026-12-01",
    })) as never,
  };
}

test("a quote with two legs and airports the table lacks gets JN-year-code, its legs and the airports", async () => {
  const { client, store } = fresh();
  const made = await store.createQuote(input());
  assert.equal(made.quoteCode, formatCode("quote", YEAR, 1));
  const [row] = await client.select().from(quotes).where(eq(quotes.id, made.id));
  assert.equal(row.quoteCode, made.quoteCode);
  assert.equal(row.status, "submitted");
  assert.equal(row.contactSnapshot?.firstName, "Ada");
  assert.ok(row.receivedAt instanceof Date);
  const legs = await client.select().from(quoteLegs).where(eq(quoteLegs.quoteId, made.id));
  assert.equal(legs.length, 2);
  const icaos = (await client.select({ icao: airports.icao }).from(airports)).map((a) => a.icao).sort();
  assert.deepEqual(icaos, ["KTEB", "KVNY"]);
});

test("an airport that is already in the table is left as it is, and a repeated airport is added once", async () => {
  const { client, store } = fresh();
  await client.insert(airports).values({ ...(catalog("VNY") as object), name: "Curated name" } as never);
  const made = await store.createQuote(input({ airports: [catalog("VNY"), catalog("TEB"), catalog("TEB")] }));
  assert.ok(made.id);
  const [vny] = await client.select().from(airports).where(eq(airports.icao, "KVNY"));
  assert.equal(vny.name, "Curated name");
  assert.equal((await client.select().from(airports)).length, 2);
});

test("two quotes in one year get consecutive codes", async () => {
  const { store } = fresh();
  const a = await store.createQuote(input());
  const b = await store.createQuote(input());
  assert.equal(a.quoteCode, formatCode("quote", YEAR, 1));
  assert.equal(b.quoteCode, formatCode("quote", YEAR, 2));
});

test("a second create with the same idempotency key throws DuplicateIdempotencyKey and leaves one quote and one number used", async () => {
  const { client, store } = fresh();
  const first = await store.createQuote(input({ key: "key-1" }));
  await assert.rejects(store.createQuote(input({ key: "key-1" })), (e) => e instanceof DuplicateIdempotencyKey);
  assert.equal((await client.select().from(quotes)).length, 1);
  assert.equal((await client.select().from(quoteLegs)).length, 2);
  // The failed batch rolled back, the counter included: the next quote is number 2, not 3.
  const next = await store.createQuote(input({ key: "key-2" }));
  assert.equal(next.quoteCode, formatCode("quote", YEAR, 2));
  const found = await store.findByIdempotencyKey("key-1");
  assert.equal(found?.id, first.id);
  assert.equal(found?.quoteCode, first.quoteCode);
});

test("quotes without a key never collide with each other", async () => {
  const { client, store } = fresh();
  await store.createQuote(input({ key: null }));
  await store.createQuote(input({ key: null }));
  assert.equal((await client.select().from(quotes)).length, 2);
});

test("findByIdempotencyKey gives nothing for an unknown key", async () => {
  const { store } = fresh();
  assert.equal(await store.findByIdempotencyKey("nope"), undefined);
});

test("a failed leg insert rolls the whole quote back, number included", async () => {
  const { client, store } = fresh();
  const bad = input();
  (bad.legs[1] as { legNumber: number }).legNumber = 1; // breaks quote_legs_quote_leg_uq
  await assert.rejects(store.createQuote(bad));
  assert.equal((await client.select().from(quotes)).length, 0);
  assert.equal((await client.select().from(quoteLegs)).length, 0);
  const ok = await store.createQuote(input());
  assert.equal(ok.quoteCode, formatCode("quote", YEAR, 1));
});

// ── The request page and the client's pick ──

const TOKEN = "a".repeat(48);

async function withOptions(c: ReturnType<typeof fresh>, status: string = "options_sent") {
  const made = await c.store.createQuote(input({ token: TOKEN }));
  await c.client.update(quotes).set({ status: status as never }).where(eq(quotes.id, made.id));
  const opt = async (n: number, st: string, price: number | null) => {
    const [o] = await c.client
      .insert(sourcedOptions)
      .values({
        quoteId: made.id,
        optionNumber: n,
        aircraftType: `Jet ${n}`,
        status: st as never,
        clientPriceUsd: price,
      } as never)
      .returning({ id: sourcedOptions.id });
    return o.id;
  };
  const a = await opt(1, "sent_to_client", 30000);
  const b = await opt(2, "sent_to_client", 42000);
  const draft = await opt(3, "sourced", null);
  return { ...made, a, b, draft };
}

test("loadRequestRows reads the quote by its token with legs in order, options in order, no trip", async () => {
  const c = fresh();
  const q = await withOptions(c);
  const rows = await c.store.loadRequestRows(TOKEN);
  assert.ok(rows);
  assert.equal(rows.quote.id, q.id);
  assert.equal(rows.quote.code, q.quoteCode);
  assert.equal(rows.quote.status, "options_sent");
  assert.equal(rows.quote.contactSnapshot?.firstName, "Ada");
  assert.ok(rows.quote.receivedAt instanceof Date);
  assert.deepEqual(rows.legs.map((l) => l.legNumber), [1, 2]);
  assert.deepEqual(rows.options.map((o) => o.optionNumber), [1, 2, 3]);
  assert.equal(rows.options[0].isChosen, false);
  assert.equal(rows.dispatcher, null);
  assert.equal(rows.trip, null);
  assert.equal(await c.store.loadRequestRows("b".repeat(48)), null);
});

test("loadRequestRows returns the dispatcher and the trip with its legs and aircraft only when the quote has them", async () => {
  const c = fresh();
  const q = await withOptions(c, "converted");
  const [u] = await c.client.insert(users).values({ email: "d@example.com", role: "dispatcher" } as never).returning({ id: users.id });
  const [s] = await c.client
    .insert(staff)
    .values({ userId: u.id, displayName: "Dana Dispatch", directLineE164: "+18185550101" } as never)
    .returning({ id: staff.id });
  const [op] = await c.client.insert(operators).values({ name: "bravo air" }).returning({ id: operators.id });
  const [ac] = await c.client
    .insert(aircraft)
    .values({ tailNumber: "N100AA", operatorId: op.id, category: "midsize", makeModel: "Citation XLS", seats: 8, rangeNm: 1800, speedKt: 430 })
    .returning({ id: aircraft.id });
  const [mu] = await c.client.insert(users).values({ email: "m@example.com" } as never).returning({ id: users.id });
  const [mem] = await c.client
    .insert(members)
    .values({ userId: mu.id, memberCode: "M-2026-0001" } as never)
    .returning({ id: members.id });
  const [t] = await c.client
    .insert(trips)
    .values({ tripCode: "JN-2026-0001", memberId: mem.id, quoteId: q.id, missionType: "round", paxCount: 4, aircraftId: ac.id, status: "confirmed" } as never)
    .returning({ id: trips.id });
  await c.client.insert(tripLegs).values([{ tripId: t.id, legNumber: 2 }, { tripId: t.id, legNumber: 1 }] as never);
  await c.client.update(quotes).set({ assignedDispatcherId: s.id, convertedTripId: t.id }).where(eq(quotes.id, q.id));

  const rows = await c.store.loadRequestRows(TOKEN);
  assert.ok(rows);
  assert.equal(rows.dispatcher?.displayName, "Dana Dispatch");
  assert.equal(rows.trip?.code, "JN-2026-0001");
  assert.equal(rows.trip?.status, "confirmed");
  assert.equal(rows.trip?.aircraftMakeModel, "Citation XLS");
  assert.deepEqual(rows.trip?.legs.map((l) => l.legNumber), [1, 2]);
});

test("quoteForChoice and optionForChoice find their rows, and an option of another quote is not found", async () => {
  const c = fresh();
  const q = await withOptions(c);
  const found = await c.store.quoteForChoice(TOKEN);
  assert.equal(found?.id, q.id);
  assert.equal(found?.code, q.quoteCode);
  assert.equal(found?.status, "options_sent");
  assert.equal(found?.contactSnapshot?.firstName, "Ada");
  assert.equal(await c.store.quoteForChoice("c".repeat(48)), undefined);

  const o = await c.store.optionForChoice(q.id, q.a);
  assert.equal(o?.status, "sent_to_client");
  assert.equal(o?.clientPriceUsd, 30000);
  assert.equal(await c.store.optionForChoice("00000000-0000-4000-8000-000000000000", q.a), undefined);
});

async function chosenState(c: ReturnType<typeof fresh>, quoteId: string) {
  const [q] = await c.client.select().from(quotes).where(eq(quotes.id, quoteId));
  const opts = await c.client.select().from(sourcedOptions).where(eq(sourcedOptions.quoteId, quoteId));
  return { q, chosen: opts.filter((o) => o.isChosen).map((o) => o.id), accepted: opts.filter((o) => o.status === "accepted").map((o) => o.id) };
}

test("claimOption is true once: the quote is accepted, only the picked option is chosen and accepted", async () => {
  const c = fresh();
  const q = await withOptions(c);
  const at = new Date("2026-12-02T10:00:00Z");
  assert.equal(await c.store.claimOption(q.id, q.a, at), true);
  const s = await chosenState(c, q.id);
  assert.equal(s.q.status, "accepted");
  assert.equal(s.q.acceptedAt?.getTime(), at.getTime());
  assert.deepEqual(s.chosen, [q.a]);
  assert.deepEqual(s.accepted, [q.a]);
});

test("a second claim for another option is false and changes nothing", async () => {
  const c = fresh();
  const q = await withOptions(c);
  assert.equal(await c.store.claimOption(q.id, q.a, new Date("2026-12-02T10:00:00Z")), true);
  assert.equal(await c.store.claimOption(q.id, q.b, new Date("2026-12-02T10:00:05Z")), false);
  const s = await chosenState(c, q.id);
  assert.deepEqual(s.chosen, [q.a]);
  assert.deepEqual(s.accepted, [q.a]);
  assert.equal(s.q.acceptedAt?.getTime(), new Date("2026-12-02T10:00:00Z").getTime());
});

test("two claims in the same millisecond still give one chosen option", async () => {
  const c = fresh();
  const q = await withOptions(c);
  const at = new Date("2026-12-02T10:00:00Z");
  assert.equal(await c.store.claimOption(q.id, q.a, at), true);
  assert.equal(await c.store.claimOption(q.id, q.b, at), false);
  assert.deepEqual((await chosenState(c, q.id)).chosen, [q.a]);
});

test("claimOption works from held, and is false on a quote that is not open", async () => {
  const c = fresh();
  const held = await withOptions(c, "held");
  assert.equal(await c.store.claimOption(held.id, held.b, new Date()), true);
  assert.equal((await chosenState(c, held.id)).q.status, "accepted");

  const d = fresh();
  const closed = await withOptions(d, "expired");
  assert.equal(await d.store.claimOption(closed.id, closed.a, new Date()), false);
  const s = await chosenState(d, closed.id);
  assert.equal(s.q.status, "expired");
  assert.deepEqual(s.chosen, []);
  assert.deepEqual(s.accepted, []);
});

test("after the desk puts a quote back to held with an option still accepted, a fair new pick goes through", async () => {
  const c = fresh();
  const q = await withOptions(c);
  assert.equal(await c.store.claimOption(q.id, q.a, new Date("2026-12-02T10:00:00Z")), true);
  // The desk re-opens the request; option a keeps its accepted status.
  await c.client.update(quotes).set({ status: "held" }).where(eq(quotes.id, q.id));
  assert.equal(await c.store.claimOption(q.id, q.b, new Date("2026-12-03T09:00:00Z")), true);
  const s = await chosenState(c, q.id);
  assert.deepEqual(s.chosen, [q.b]);
  assert.equal(s.q.status, "accepted");
});
