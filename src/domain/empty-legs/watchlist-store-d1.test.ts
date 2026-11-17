import test from "node:test";
import assert from "node:assert/strict";
import { freshD1WithBatch } from "@/db/d1/test-batch-client";
import { aircraft } from "@/db/d1/schema/aircraft";
import { airports } from "@/db/d1/schema/airports";
import { emptyLegs } from "@/db/d1/schema/empty-legs";
import { members } from "@/db/d1/schema/members";
import { operators } from "@/db/d1/schema/operators";
import { users } from "@/db/d1/schema/users";
import { d1WatchlistStore, LEDGER_CHUNK } from "./watchlist-store-d1";
import { watchlistStore } from "./watchlist-store";

// OPS-116: contract tests for the D1 watchlist store, on a real SQLite with the
// repo's own D1 migration applied and foreign keys on, as D1 has them. No real
// data: every value below is made up for the test.

const HOUR = 3_600_000;

async function fresh() {
  const { sqlite, client } = freshD1WithBatch();
  const store = d1WatchlistStore(client);
  const [op] = await client.insert(operators).values({ name: "bravo air" }).returning({ id: operators.id });
  await client.insert(airports).values([
    { icao: "KVNY", name: "Van Nuys", city: "Van Nuys", countryIso2: "US", region: "CA", lat: "34.2", lon: "-118.5" },
    { icao: "KTEB", name: "Teterboro", city: "Teterboro", countryIso2: "US", region: "NJ", lat: "40.8", lon: "-74.0" },
  ]);
  const [ac] = await client
    .insert(aircraft)
    .values({
      tailNumber: "N100AA",
      operatorId: op.id,
      category: "midsize",
      makeModel: "Citation XLS",
      seats: 8,
      rangeNm: 1800,
      speedKt: 430,
    })
    .returning({ id: aircraft.id });
  return { sqlite, client, store, operatorId: op.id, aircraftId: ac.id };
}

type Ctx = Awaited<ReturnType<typeof fresh>>;

let legCounter = 0;
async function seedLeg(c: Ctx): Promise<string> {
  legCounter += 1;
  const [row] = await c.client
    .insert(emptyLegs)
    .values({
      code: `EL-2026-${String(legCounter).padStart(4, "0")}`,
      aircraftId: c.aircraftId,
      operatorId: c.operatorId,
      category: "midsize",
      fromIcao: "KVNY",
      toIcao: "KTEB",
      wheelsUpAt: new Date(Date.now() + 48 * HOUR),
      seatsAvailable: 6,
      fullCharterRefUsd: 30000,
      listedPriceUsd: 15000,
      discountPct: 50,
      status: "live",
    })
    .returning({ id: emptyLegs.id });
  return row.id;
}

// A member row, made with plain SQL values, for the watchlists that belong to one.
async function seedMember(c: Ctx, tag: string): Promise<string> {
  const [u] = await c.client
    .insert(users)
    .values({ id: `user-${tag}`, email: `${tag}@example.test` })
    .returning({ id: users.id });
  const [m] = await c.client
    .insert(members)
    .values({ userId: u.id, memberCode: `M-2026-${tag}` })
    .returning({ id: members.id });
  return m.id;
}

type Over = Record<string, unknown>;
const wl = (over: Over = {}) =>
  ({
    email: "a@example.test",
    phoneE164: "+15550000001",
    fromIcao: "KVNY",
    fromText: "Van Nuys",
    toIcao: "KTEB",
    toText: "Teterboro",
    earliestOn: "2026-12-01",
    latestOn: "2026-12-31",
    minDiscountPct: 30,
    notifyChannels: { email: true, sms: true },
    active: true,
    confirmSmsTokenHash: "sms-hash-1",
    confirmEmailTokenHash: "email-hash-1",
    confirmSentAt: new Date("2026-11-20T10:00:00Z"),
    confirmExpiresAt: new Date("2026-11-22T10:00:00Z"),
    ...over,
  }) as never;

const row = (c: Ctx, id: string) =>
  c.sqlite.prepare("select * from empty_leg_watchlists where id = ?").get(id) as Record<string, unknown>;

test("create, then the confirm lookup finds the row by either hash", async () => {
  const c = await fresh();
  const id = await c.store.createWatchlist(wl());
  const bySms = await c.store.byConfirmHash("sms-hash-1");
  const byEmail = await c.store.byConfirmHash("email-hash-1");
  assert.equal(bySms?.id, id);
  assert.equal(byEmail?.id, id);
  assert.equal(bySms?.smsHash, "sms-hash-1");
  assert.equal(bySms?.fromText, "Van Nuys");
  assert.equal(bySms?.earliestOn, "2026-12-01");
  assert.deepEqual(bySms?.expiresAt, new Date("2026-11-22T10:00:00Z"));
  assert.equal(await c.store.byConfirmHash("no-such-hash"), undefined);
});

test("confirming the sms channel stamps it and clears only the sms hash, and the link works once", async () => {
  const c = await fresh();
  const id = await c.store.createWatchlist(wl());
  const at = new Date("2026-11-21T09:00:00Z");
  await c.store.confirmChannel(id, "sms", at);
  const r = row(c, id);
  assert.equal(r.sms_confirmed_at, at.getTime());
  assert.equal(r.confirm_sms_token_hash, null);
  assert.equal(r.confirm_email_token_hash, "email-hash-1");
  assert.equal(r.email_confirmed_at, null);
  assert.equal(await c.store.byConfirmHash("sms-hash-1"), undefined);
  assert.equal((await c.store.byConfirmHash("email-hash-1"))?.id, id);
  await c.store.confirmChannel(id, "email", at);
  assert.equal(row(c, id).email_confirmed_at, at.getTime());
  assert.equal(row(c, id).confirm_email_token_hash, null);
});

test("the unsubscribe token is made by the store and finds the row", async () => {
  const c = await fresh();
  const id = await c.store.createWatchlist(wl());
  const token = row(c, id).unsubscribe_token as string;
  assert.match(token, /^[0-9a-f]{48}$/);
  const found = await c.store.byUnsubscribeToken(token);
  assert.equal(found?.id, id);
  assert.equal(found?.email, "a@example.test");
  assert.equal(found?.smsConfirmedAt, null);
  assert.equal(await c.store.byUnsubscribeToken("nope"), undefined);
});

test("unsubscribe(all) ends the watchlist; unsubscribe(email) keeps sms on", async () => {
  const c = await fresh();
  const all = await c.store.createWatchlist(wl({ confirmSmsTokenHash: "s2", confirmEmailTokenHash: "e2" }));
  const mail = await c.store.createWatchlist(wl({ confirmSmsTokenHash: "s3", confirmEmailTokenHash: "e3" }));
  const at = new Date("2026-11-21T09:00:00Z");
  await c.store.confirmChannel(all, "email", at);
  await c.store.confirmChannel(mail, "email", at);

  await c.store.unsubscribe(all, "all", at);
  const a = row(c, all);
  assert.equal(a.active, 0);
  assert.equal(a.deactivated_reason, "email_unsubscribe");
  assert.equal(a.deactivated_at, at.getTime());
  assert.equal(a.email_confirmed_at, null);
  assert.equal(a.notify_channels, JSON.stringify({ email: false, sms: false }));

  await c.store.unsubscribe(mail, "email", at);
  const m = row(c, mail);
  assert.equal(m.active, 1);
  assert.equal(m.email_confirmed_at, null);
  assert.equal(m.notify_channels, JSON.stringify({ email: false, sms: true }));
});

test("STOP pauses only the active rows on that number and returns the count; START resumes only what STOP paused", async () => {
  const c = await fresh();
  const a = await c.store.createWatchlist(wl({ phoneE164: "+15550000009" }));
  const b = await c.store.createWatchlist(wl({ phoneE164: "+15550000009" }));
  const other = await c.store.createWatchlist(wl({ phoneE164: "+15550000008" }));
  const pausedByMember = await c.store.createWatchlist(wl({ phoneE164: "+15550000009" }));
  await c.store.setActive(pausedByMember, false);
  const at = new Date("2026-11-21T09:00:00Z");

  assert.equal(await c.store.smsKeyword("stop", "+15550000009", at), 2);
  assert.equal(row(c, a).active, 0);
  assert.equal(row(c, a).deactivated_reason, "sms_stop");
  assert.equal(row(c, a).deactivated_at, at.getTime());
  assert.equal(row(c, b).active, 0);
  assert.equal(row(c, other).active, 1);
  // A second STOP finds nothing active.
  assert.equal(await c.store.smsKeyword("stop", "+15550000009", at), 0);

  assert.equal(await c.store.smsKeyword("start", "+15550000009", at), 2);
  assert.equal(row(c, a).active, 1);
  assert.equal(row(c, a).deactivated_reason, null);
  assert.equal(row(c, a).deactivated_at, null);
  // The row the member paused by hand stays off.
  assert.equal(row(c, pausedByMember).active, 0);
  assert.equal(await c.store.smsKeyword("start", "+15550000009", at), 0);
});

test("memberWatchlists returns only that member's rows, newest first, and memberWatchlist checks ownership", async () => {
  const c = await fresh();
  const m1 = await seedMember(c, "0001");
  const m2 = await seedMember(c, "0002");
  const old = await c.store.createWatchlist(wl({ memberId: m1, confirmSmsTokenHash: "o" }));
  const mine2 = await c.store.createWatchlist(wl({ memberId: m1, confirmSmsTokenHash: "n" }));
  const theirs = await c.store.createWatchlist(wl({ memberId: m2, confirmSmsTokenHash: "t" }));
  c.sqlite.prepare("update empty_leg_watchlists set created_at = ? where id = ?").run(1_000, old);
  c.sqlite.prepare("update empty_leg_watchlists set created_at = ? where id = ?").run(2_000, mine2);

  const list = await c.store.memberWatchlists(m1);
  assert.deepEqual(list.map((r) => r.id), [mine2, old]);
  assert.equal(list[0].active, true);
  assert.deepEqual(list[0].notifyChannels, { email: true, sms: true });
  assert.ok(list[0].createdAt instanceof Date);

  assert.equal((await c.store.memberWatchlist(mine2, m1))?.id, mine2);
  assert.equal(await c.store.memberWatchlist(theirs, m1), undefined);
  const owned = await c.store.memberWatchlist(mine2, m1);
  assert.equal(owned?.active, true);
  assert.equal(owned?.smsConfirmedAt, null);
});

test("deleteWatchlist removes the row and its match rows go with it", async () => {
  const c = await fresh();
  const id = await c.store.createWatchlist(wl());
  const leg = await seedLeg(c);
  assert.ok(await c.store.claimMatch(id, leg, "sms"));
  await c.store.deleteWatchlist(id);
  assert.equal(row(c, id), undefined);
  const left = c.sqlite.prepare("select count(*) as n from empty_leg_watchlist_matches").get() as { n: number };
  assert.equal(left.n, 0);
});

test("activeWatchlists lists only active rows, with the matcher's fields", async () => {
  const c = await fresh();
  const on = await c.store.createWatchlist(wl({ confirmSmsTokenHash: "a" }));
  const off = await c.store.createWatchlist(wl({ confirmSmsTokenHash: "b" }));
  await c.store.setActive(off, false);
  const list = await c.store.activeWatchlists();
  assert.deepEqual(list.map((r) => r.id), [on]);
  const w = list[0];
  assert.equal(w.minDiscountPct, 30);
  assert.equal(w.active, true);
  assert.equal(w.smsConfirmedAt, null);
  assert.deepEqual(w.notifyChannels, { email: true, sms: true });
  assert.match(w.unsubscribeToken, /^[0-9a-f]{48}$/);
});

test("sweepUnconfirmed deletes only unconfirmed rows past expiry, and their match rows with them", async () => {
  const c = await fresh();
  const now = new Date("2026-11-25T00:00:00Z");
  const stale = await c.store.createWatchlist(wl({ confirmSmsTokenHash: "s1" }));
  const fresh1 = await c.store.createWatchlist(
    wl({ confirmSmsTokenHash: "s2", confirmExpiresAt: new Date("2026-11-26T00:00:00Z") }),
  );
  const confirmed = await c.store.createWatchlist(wl({ confirmSmsTokenHash: "s3" }));
  await c.store.confirmChannel(confirmed, "sms", new Date("2026-11-21T00:00:00Z"));
  const noExpiry = await c.store.createWatchlist(wl({ confirmSmsTokenHash: "s4", confirmExpiresAt: null }));
  const leg = await seedLeg(c);
  assert.ok(await c.store.claimMatch(stale, leg, "sms"));

  assert.equal(await c.store.sweepUnconfirmed(now), 1);
  assert.equal(row(c, stale), undefined);
  for (const id of [fresh1, confirmed, noExpiry]) assert.ok(row(c, id));
  const left = c.sqlite.prepare("select count(*) as n from empty_leg_watchlist_matches").get() as { n: number };
  assert.equal(left.n, 0);
  assert.equal(await c.store.sweepUnconfirmed(now), 0);
});

test("claimMatch twice for the same pair and channel gives an id, then nothing; another channel is its own claim", async () => {
  const c = await fresh();
  const id = await c.store.createWatchlist(wl());
  const leg = await seedLeg(c);
  const first = await c.store.claimMatch(id, leg, "sms");
  assert.ok(first);
  assert.equal(await c.store.claimMatch(id, leg, "sms"), undefined);
  assert.ok(await c.store.claimMatch(id, leg, "email"));
  const claimed = c.sqlite.prepare("select status from empty_leg_watchlist_matches where id = ?").get(first) as {
    status: string;
  };
  assert.equal(claimed.status, "pending");
});

test("recordMatch writes the outcome on the claimed row", async () => {
  const c = await fresh();
  const id = await c.store.createWatchlist(wl());
  const leg = await seedLeg(c);
  const claim = (await c.store.claimMatch(id, leg, "sms"))!;
  const sentAt = new Date("2026-11-21T09:30:00Z");
  await c.store.recordMatch(claim, {
    status: "sent",
    provider: "twilio",
    providerMessageId: "SM-made-up",
    error: null,
    sentAt,
  });
  const r = c.sqlite.prepare("select * from empty_leg_watchlist_matches where id = ?").get(claim) as Record<
    string,
    unknown
  >;
  assert.equal(r.status, "sent");
  assert.equal(r.provider, "twilio");
  assert.equal(r.provider_message_id, "SM-made-up");
  assert.equal(r.error, null);
  assert.equal(r.sent_at, sentAt.getTime());

  const claim2 = (await c.store.claimMatch(id, leg, "email"))!;
  await c.store.recordMatch(claim2, {
    status: "failed",
    provider: "logger",
    providerMessageId: null,
    error: "channel not configured",
    sentAt,
  });
  const r2 = c.sqlite.prepare("select status, error from empty_leg_watchlist_matches where id = ?").get(claim2) as Record<
    string,
    unknown
  >;
  assert.equal(r2.status, "failed");
  assert.equal(r2.error, "channel not configured");
});

test("notifiedFor with 120 leg ids reads all of them in chunks, and an empty list asks nothing", async () => {
  const c = await fresh();
  const id = await c.store.createWatchlist(wl());
  const legs: string[] = [];
  for (let i = 0; i < 120; i++) legs.push(await seedLeg(c));
  // One ledger row on the first, a middle and the last leg: all three chunks must be read.
  const picked = [legs[0], legs[LEDGER_CHUNK + 5], legs[119]];
  for (const leg of picked) assert.ok(await c.store.claimMatch(id, leg, "sms"));

  // A client that refuses a query with more than 100 bound values, as D1 does.
  const seen: number[] = [];
  const realPrepare = c.sqlite.prepare.bind(c.sqlite);
  c.sqlite.prepare = ((sql: string) => {
    const bound = (sql.match(/\?/g) ?? []).length;
    if (/empty_leg_watchlist_matches/.test(sql) && /select/i.test(sql)) seen.push(bound);
    if (bound > 100) throw new Error("too many SQL variables");
    return realPrepare(sql);
  }) as typeof c.sqlite.prepare;

  const rows = await c.store.notifiedFor(legs);
  assert.deepEqual(rows.map((r) => r.legId).sort(), [...picked].sort());
  assert.deepEqual(rows[0].channel, "sms");
  assert.ok(seen.length >= 3, `expected three chunked reads, got ${seen.length}`);
  assert.ok(seen.every((n) => n <= LEDGER_CHUNK));

  seen.length = 0;
  assert.deepEqual(await c.store.notifiedFor([]), []);
  assert.equal(seen.length, 0);
});

test("a match row needs its leg and its watchlist (foreign keys are on)", async () => {
  const c = await fresh();
  const id = await c.store.createWatchlist(wl());
  // drizzle wraps the driver's error, so the rule is read from the cause.
  const isFk = (e: unknown) => /FOREIGN KEY/i.test(String((e as { cause?: unknown }).cause ?? e));
  await assert.rejects(() => c.store.claimMatch(id, "no-such-leg", "sms"), isFk);
  const leg = await seedLeg(c);
  await assert.rejects(() => c.store.claimMatch("no-such-watchlist", leg, "sms"), isFk);
});

function withEnv(env: Record<string, string>, fn: () => void) {
  const before = { t: process.env.DB_TARGET, e: process.env.DEPLOY_ENV };
  Object.assign(process.env, env);
  try {
    fn();
  } finally {
    if (before.t === undefined) delete process.env.DB_TARGET;
    else process.env.DB_TARGET = before.t;
    if (before.e === undefined) delete process.env.DEPLOY_ENV;
    else process.env.DEPLOY_ENV = before.e;
  }
}

test("watchlistStore(): target d1 with no DB binding throws", () => {
  withEnv({ DB_TARGET: "d1", DEPLOY_ENV: "staging" }, () => {
    assert.throws(() => watchlistStore(), /DB_TARGET is d1 but the DB binding is missing/);
  });
});

test("watchlistStore(): production never gets the d1 store, whatever DB_TARGET says", () => {
  withEnv({ DB_TARGET: "d1", DEPLOY_ENV: "production" }, () => {
    assert.equal(typeof watchlistStore().smsKeyword, "function");
  });
});
