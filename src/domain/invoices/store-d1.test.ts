import test from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { freshD1WithBatch } from "@/db/d1/test-batch-client";
import { invoices } from "@/db/d1/schema/invoices";
import { members } from "@/db/d1/schema/members";
import { memberships, reserveTransactions } from "@/db/d1/schema/memberships";
import { tripLegs, trips } from "@/db/d1/schema/trips";
import { users } from "@/db/d1/schema/users";
import { isUniqueViolation } from "@/db/unique";
import { d1InvoiceStore } from "./store-d1";

// OPS-161: contract tests for the D1 invoice store (the cancel refunds, the invoice editor, the
// invoice watch cron's two claims, the client's invoice page and the Checkout claim), on a real
// SQLite with the repo's own D1 migrations applied and foreign keys on, as D1 has them. Each
// case is the call the Postgres adapter answers.

const MIN = 60_000;
const NOW = new Date("2026-11-18T12:00:00.000Z");
const at = (ms: number) => new Date(NOW.getTime() + ms);

function fresh() {
  const { sqlite, client } = freshD1WithBatch();
  return { sqlite, client, store: d1InvoiceStore(client) };
}
type Fresh = ReturnType<typeof fresh>;

let seq = 0;
const n = () => ++seq;

async function member(c: Fresh["client"], userOver: Partial<typeof users.$inferInsert> = {}) {
  const [u] = await c
    .insert(users)
    .values({ email: `u${n()}@example.com`, ...userOver } as never)
    .returning({ id: users.id });
  const [m] = await c
    .insert(members)
    .values({ userId: u.id, memberCode: `M-2026-${String(n()).padStart(4, "0")}` })
    .returning({ id: members.id });
  return { id: m.id, userId: u.id };
}

async function membership(c: Fresh["client"], memberId: string) {
  const [row] = await c
    .insert(memberships)
    .values({ memberId, program: "card_250", depositUsd: 250_000, calloutHours: 24, status: "active", activatedOn: "2026-01-01" } as never)
    .returning({ id: memberships.id });
  return row.id;
}

async function trip(c: Fresh["client"], memberId: string) {
  const k = n();
  const [t] = await c
    .insert(trips)
    .values({ tripCode: `JN-2026-${String(k).padStart(4, "0")}`, memberId, missionType: "one_way", paxCount: 2, status: "confirmed" } as never)
    .returning({ id: trips.id, code: trips.tripCode });
  return t;
}

async function invoice(c: Fresh["client"], memberId: string, over: Partial<typeof invoices.$inferInsert> = {}) {
  const [row] = await c
    .insert(invoices)
    .values({ memberId, invoiceCode: `INV-2026-${String(n()).padStart(4, "0")}`, kind: "charter", status: "due", totalUsd: 1_000, ...over } as never)
    .returning({ id: invoices.id });
  return row.id;
}

async function draw(c: Fresh["client"], args: { memberId: string; membershipId: string | null; tripId: string; invoiceId: string | null; amountUsd: number }) {
  const [row] = await c
    .insert(reserveTransactions)
    .values({ ...args, kind: "charter_draw" } as never)
    .returning({ id: reserveTransactions.id });
  return row.id;
}

/** The ids of claimed rows, in a fixed order: UPDATE ... RETURNING does not promise the subquery's order. */
const sortIds = (rows: { id: string }[]) => rows.map((r) => r.id).sort();

const one = async <T>(rows: Promise<T[]>): Promise<T> => (await rows)[0];

// ─── The cancel refunds ──────────────────────────────────────────────────

test("two draws give two refund rows of the opposite amounts, both invoices void with the note on a new line", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const ms = await membership(client, m.id);
  const t = await trip(client, m.id);
  const inv1 = await invoice(client, m.id, { tripId: t.id, status: "paid", notes: "first note" });
  const inv2 = await invoice(client, m.id, { tripId: t.id, status: "paid", notes: null });
  await draw(client, { memberId: m.id, membershipId: ms, tripId: t.id, invoiceId: inv1, amountUsd: -700 });
  await draw(client, { memberId: m.id, membershipId: ms, tripId: t.id, invoiceId: inv2, amountUsd: -300 });

  const draws = await store.unrefundedDraws(t.id);
  assert.equal(draws.length, 2);
  assert.deepEqual(draws.map((d) => d.amountUsd).sort((a, b) => a - b), [-700, -300]);

  await store.postDrawRefunds({
    tripId: t.id,
    refunds: draws.map((d) => ({
      memberId: d.memberId,
      membershipId: d.membershipId,
      amountUsd: -d.amountUsd,
      description: `Refund — trip ${t.code} (cancelled_wx)`,
      invoiceId: d.invoiceId,
    })),
    voidInvoiceIds: [inv1, inv2],
    note: "Voided on trip cancel (cancelled_wx)",
  });

  const refunds = await client.select().from(reserveTransactions).where(eq(reserveTransactions.kind, "refund"));
  assert.deepEqual(refunds.map((r) => r.amountUsd).sort((a, b) => a - b), [300, 700]);
  assert.ok(refunds.every((r) => r.tripId === t.id && r.memberId === m.id && r.membershipId === ms));
  assert.ok(refunds.every((r) => r.description === `Refund — trip ${t.code} (cancelled_wx)`));

  const a = await one(client.select().from(invoices).where(eq(invoices.id, inv1)));
  const b = await one(client.select().from(invoices).where(eq(invoices.id, inv2)));
  assert.equal(a.status, "void");
  assert.equal(a.notes, "first note\nVoided on trip cancel (cancelled_wx)");
  assert.equal(b.status, "void");
  assert.equal(b.notes, "Voided on trip cancel (cancelled_wx)");

  // A second look finds nothing left to refund.
  assert.deepEqual(await store.unrefundedDraws(t.id), []);
});

test("a draw with no invoice is matched with IS: its refund (no invoice either) takes it off the list", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const t = await trip(client, m.id);
  await draw(client, { memberId: m.id, membershipId: null, tripId: t.id, invoiceId: null, amountUsd: -500 });
  const draws = await store.unrefundedDraws(t.id);
  assert.equal(draws.length, 1);
  assert.equal(draws[0].invoiceId, null);

  await store.postDrawRefunds({
    tripId: t.id,
    refunds: [{ memberId: m.id, membershipId: null, amountUsd: 500, description: "Refund", invoiceId: null }],
    voidInvoiceIds: [],
    note: "unused",
  });
  assert.deepEqual(await store.unrefundedDraws(t.id), []);
});

test("a refund already there for one draw makes postDrawRefunds throw a unique violation and write nothing", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const t = await trip(client, m.id);
  const inv1 = await invoice(client, m.id, { tripId: t.id, status: "paid" });
  const inv2 = await invoice(client, m.id, { tripId: t.id, status: "paid" });
  await draw(client, { memberId: m.id, membershipId: null, tripId: t.id, invoiceId: inv1, amountUsd: -700 });
  await draw(client, { memberId: m.id, membershipId: null, tripId: t.id, invoiceId: inv2, amountUsd: -300 });
  // A racing cancel already posted the refund of the second draw.
  await client.insert(reserveTransactions).values({ memberId: m.id, kind: "refund", amountUsd: 300, tripId: t.id, invoiceId: inv2 } as never);

  await assert.rejects(
    store.postDrawRefunds({
      tripId: t.id,
      refunds: [
        { memberId: m.id, membershipId: null, amountUsd: 700, description: "Refund", invoiceId: inv1 },
        { memberId: m.id, membershipId: null, amountUsd: 300, description: "Refund", invoiceId: inv2 },
      ],
      voidInvoiceIds: [inv1, inv2],
      note: "Voided on trip cancel (cancelled_other)",
    }),
    (e: unknown) => isUniqueViolation(e),
  );

  // All or nothing: the first refund is not there, and neither invoice is void.
  const refunds = await client.select().from(reserveTransactions).where(eq(reserveTransactions.kind, "refund"));
  assert.equal(refunds.length, 1);
  assert.equal(refunds[0].amountUsd, 300);
  assert.equal((await one(client.select().from(invoices).where(eq(invoices.id, inv1)))).status, "paid");
  assert.equal((await one(client.select().from(invoices).where(eq(invoices.id, inv2)))).status, "paid");
});

test("more than 50 invoices to void are written in chunks of 50 in the one batch", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const t = await trip(client, m.id);
  const ids: string[] = [];
  for (let i = 0; i < 120; i++) ids.push(await invoice(client, m.id, { tripId: t.id, status: "paid", totalUsd: 10 }));
  await store.postDrawRefunds({
    tripId: t.id,
    refunds: [{ memberId: m.id, membershipId: null, amountUsd: 1_200, description: "Refund", invoiceId: ids[0] }],
    voidInvoiceIds: ids,
    note: "Voided on trip cancel (cancelled_wx)",
  });
  const rows = await client.select({ status: invoices.status }).from(invoices);
  assert.equal(rows.filter((r) => r.status === "void").length, 120);
});

test("paidInvoicesOfTrip lists only the trip's paid invoices, and voidPaidInvoice changes only a paid one", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const t = await trip(client, m.id);
  const other = await trip(client, m.id);
  const paid = await invoice(client, m.id, { tripId: t.id, status: "paid", stripePaymentIntentId: "pi_1", totalUsd: 900 });
  const due = await invoice(client, m.id, { tripId: t.id, status: "due" });
  await invoice(client, m.id, { tripId: other.id, status: "paid" });

  const rows = await store.paidInvoicesOfTrip(t.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, paid);
  assert.equal(rows[0].stripePaymentIntentId, "pi_1");
  assert.equal(rows[0].totalUsd, 900);

  await store.voidPaidInvoice(due);
  assert.equal((await one(client.select().from(invoices).where(eq(invoices.id, due)))).status, "due");
  await store.voidPaidInvoice(paid);
  assert.equal((await one(client.select().from(invoices).where(eq(invoices.id, paid)))).status, "void");
});

test("memberContact and tripCode read the client's email and the trip's code, and answer null for no such row", async () => {
  const { client, store } = fresh();
  const m = await member(client, { email: "ada@example.com", firstName: "Ada" });
  const t = await trip(client, m.id);
  assert.deepEqual(await store.memberContact(m.id), { email: "ada@example.com", firstName: "Ada" });
  assert.equal(await store.memberContact(crypto.randomUUID()), null);
  assert.equal(await store.tripCode(t.id), t.code);
  assert.equal(await store.tripCode(crypto.randomUUID()), null);
});

// ─── The invoice editor ──────────────────────────────────────────────────

test("updateDraftInvoice writes a draft once and answers false on a due invoice", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const id = await invoice(client, m.id, { status: "draft", totalUsd: null, dueOn: null });

  const wrote = await store.updateDraftInvoice(id, {
    subtotalUsd: 1_000,
    fetUsd: 75,
    segmentFeeUsd: 10,
    totalUsd: 1_085,
    notes: "n",
    dueOn: "2026-11-25",
    status: "due",
  });
  assert.equal(wrote, true);
  const row = await store.invoiceById(id);
  assert.equal(row?.status, "due");
  assert.equal(row?.totalUsd, 1_085);
  assert.equal(row?.dueOn, "2026-11-25");
  assert.equal(row?.notes, "n");

  // Finalized already: a second write loses.
  assert.equal(await store.updateDraftInvoice(id, { subtotalUsd: 1, fetUsd: 1, segmentFeeUsd: 1, totalUsd: 3, notes: null }), false);
  assert.equal((await store.invoiceById(id))?.totalUsd, 1_085);
  assert.equal(await store.invoiceById(crypto.randomUUID()), undefined);
});

// ─── The invoice watch ───────────────────────────────────────────────────

test("claimOverdue takes due invoices past today and not yet notified, oldest first, to the limit, once", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const old = await invoice(client, m.id, { dueOn: "2026-11-10" });
  const newer = await invoice(client, m.id, { dueOn: "2026-11-17" });
  const third = await invoice(client, m.id, { dueOn: "2026-11-12" });
  const today = await invoice(client, m.id, { dueOn: "2026-11-18" });
  const future = await invoice(client, m.id, { dueOn: "2026-11-30" });
  const noDate = await invoice(client, m.id, { dueOn: null });
  const paid = await invoice(client, m.id, { dueOn: "2026-11-01", status: "paid" });
  const draft = await invoice(client, m.id, { dueOn: "2026-11-01", status: "draft" });
  const notified = await invoice(client, m.id, { dueOn: "2026-11-02", overdueNotifiedAt: at(-60 * MIN) } as never);

  const first = await store.claimOverdue({ today: "2026-11-18", limit: 2, now: NOW });
  // The oldest two by due date are the ones claimed (RETURNING does not promise their order).
  assert.deepEqual(sortIds(first), sortIds([old, third].map((id) => ({ id }))));
  const firstOld = first.find((r) => r.id === old);
  assert.equal(firstOld?.dueOn, "2026-11-10");
  assert.ok(firstOld?.invoiceCode.startsWith("INV-"));
  assert.equal(firstOld?.memberId, m.id);
  const stamped = await one(client.select().from(invoices).where(eq(invoices.id, old)));
  assert.equal(stamped.status, "overdue");
  assert.equal(stamped.overdueNotifiedAt?.getTime(), NOW.getTime());
  assert.equal(stamped.updatedAt.getTime(), NOW.getTime());

  // The next run takes the one left, and the one after that takes none.
  assert.deepEqual((await store.claimOverdue({ today: "2026-11-18", limit: 20, now: NOW })).map((r) => r.id), [newer]);
  assert.deepEqual(await store.claimOverdue({ today: "2026-11-18", limit: 20, now: NOW }), []);

  for (const [id, status] of [[today, "due"], [future, "due"], [noDate, "due"], [paid, "paid"], [draft, "draft"], [notified, "due"]] as const) {
    assert.equal((await one(client.select().from(invoices).where(eq(invoices.id, id)))).status, status);
  }
});

test("claimDueSoon takes due invoices from today to today plus 2, once, and never touches the status", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const dToday = await invoice(client, m.id, { dueOn: "2026-11-18" });
  const dPlus2 = await invoice(client, m.id, { dueOn: "2026-11-20" });
  const dPlus1 = await invoice(client, m.id, { dueOn: "2026-11-19" });
  const dPlus3 = await invoice(client, m.id, { dueOn: "2026-11-21" });
  const yesterday = await invoice(client, m.id, { dueOn: "2026-11-17" });
  const overdue = await invoice(client, m.id, { dueOn: "2026-11-19", status: "overdue" });
  const reminded = await invoice(client, m.id, { dueOn: "2026-11-19", dueReminderSentAt: at(-60 * MIN) } as never);

  const got = await store.claimDueSoon({ today: "2026-11-18", until: "2026-11-20", limit: 20, now: NOW });
  assert.deepEqual(sortIds(got), sortIds([dToday, dPlus1, dPlus2].map((id) => ({ id }))));
  assert.equal((await one(client.select().from(invoices).where(eq(invoices.id, dToday)))).status, "due");
  assert.equal((await one(client.select().from(invoices).where(eq(invoices.id, dToday)))).dueReminderSentAt?.getTime(), NOW.getTime());
  assert.deepEqual(await store.claimDueSoon({ today: "2026-11-18", until: "2026-11-20", limit: 20, now: NOW }), []);

  // A wider window with limit 1 takes the oldest due date still unreminded, and no other row.
  const limited = await store.claimDueSoon({ today: "2026-11-01", until: "2026-12-31", limit: 1, now: NOW });
  assert.deepEqual(limited.map((r) => r.id), [yesterday]);
  const stampOf = async (id: string) => (await one(client.select().from(invoices).where(eq(invoices.id, id)))).dueReminderSentAt?.getTime() ?? null;
  assert.equal(await stampOf(dPlus3), null);
  assert.equal(await stampOf(overdue), null);
  assert.equal(await stampOf(reminded), at(-60 * MIN).getTime());
});

// ─── The client's invoice page ───────────────────────────────────────────

test("memberInvoices lists the client's own invoices newest issue first, to the limit, with the trip's code", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const other = await member(client);
  const t = await trip(client, m.id);
  const a = await invoice(client, m.id, { issuedOn: "2026-11-01", tripId: t.id, fetUsd: 75 });
  const b = await invoice(client, m.id, { issuedOn: "2026-11-10", kind: "top_up" });
  const c = await invoice(client, m.id, { issuedOn: "2026-10-01" });
  await invoice(client, other.id, { issuedOn: "2026-11-15" });

  const rows = await store.memberInvoices(m.id, 50);
  assert.deepEqual(rows.map((r) => r.id), [b, a, c]);
  assert.equal(rows[1].tripCode, t.code);
  assert.equal(rows[1].tripId, t.id);
  assert.equal(rows[1].fetUsd, 75);
  assert.equal(rows[0].tripCode, null);
  assert.deepEqual((await store.memberInvoices(m.id, 2)).map((r) => r.id), [b, a]);
});

test("tripRouteLegs reads legs across chunks of 50 and returns them by trip and leg number", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const ids: string[] = [];
  for (let i = 0; i < 60; i++) ids.push((await trip(client, m.id)).id);
  await client.insert(tripLegs).values({ tripId: ids[59], legNumber: 2, fromCity: "Aspen", toCity: "Denver" } as never);
  await client.insert(tripLegs).values({ tripId: ids[59], legNumber: 1, fromCity: "Los Angeles", fromIata: "LAX", toCity: "Aspen", toIata: "ASE" } as never);
  await client.insert(tripLegs).values({ tripId: ids[0], legNumber: 1, fromIata: "VNY", toIata: "TEB" } as never);

  assert.deepEqual(await store.tripRouteLegs([]), []);
  const rows = await store.tripRouteLegs(ids);
  assert.equal(rows.length, 3);
  const last = rows.filter((r) => r.tripId === ids[59]);
  assert.deepEqual(last.map((r) => r.legNumber), [1, 2]);
  assert.equal(last[0].fromCity, "Los Angeles");
  assert.equal(last[0].toIata, "ASE");
  const sorted = [...rows].sort((x, y) => (x.tripId < y.tripId ? -1 : x.tripId > y.tripId ? 1 : x.legNumber - y.legNumber));
  assert.deepEqual(rows, sorted);
});

// ─── The pay button ──────────────────────────────────────────────────────

test("invoiceWithOwner gives the invoice with its member's user id", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const id = await invoice(client, m.id, { totalUsd: 4_200 });
  const row = await store.invoiceWithOwner(id);
  assert.equal(row?.memberUserId, m.userId);
  assert.equal(row?.memberId, m.id);
  assert.equal(row?.totalUsd, 4_200);
  assert.equal(row?.status, "due");
  assert.equal(await store.invoiceWithOwner(crypto.randomUUID()), undefined);
});

test("claimCheckout: the first claim wins, a second loses while the claim is fresh, and wins once it is stale", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const id = await invoice(client, m.id, { status: "due" });
  const stale = NOW.getTime() - 30 * MIN;

  assert.equal(await store.claimCheckout({ id, memberId: m.id, token: "pending:a", staleBeforeMs: stale }), true);
  const row = await one(client.select().from(invoices).where(eq(invoices.id, id)));
  assert.equal(row.stripeCheckoutSessionId, "pending:a");

  // Fresh: touched just now, so not older than the stale mark.
  assert.equal(await store.claimCheckout({ id, memberId: m.id, token: "pending:b", staleBeforeMs: Date.now() - 30 * MIN }), false);
  assert.equal((await one(client.select().from(invoices).where(eq(invoices.id, id)))).stripeCheckoutSessionId, "pending:a");

  // The mark moves past the row's updated_at: the claim is stale and can be taken over.
  assert.equal(await store.claimCheckout({ id, memberId: m.id, token: "pending:b", staleBeforeMs: Date.now() + 30 * MIN }), true);
  assert.equal((await one(client.select().from(invoices).where(eq(invoices.id, id)))).stripeCheckoutSessionId, "pending:b");
});

test("claimCheckout never claims a paid or draft invoice, or another member's", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const other = await member(client);
  const paid = await invoice(client, m.id, { status: "paid" });
  const draft = await invoice(client, m.id, { status: "draft" });
  const overdue = await invoice(client, m.id, { status: "overdue" });
  const mine = await invoice(client, m.id, { status: "due" });
  const stale = Date.now() + 60 * MIN;

  assert.equal(await store.claimCheckout({ id: paid, memberId: m.id, token: "t", staleBeforeMs: stale }), false);
  assert.equal(await store.claimCheckout({ id: draft, memberId: m.id, token: "t", staleBeforeMs: stale }), false);
  assert.equal(await store.claimCheckout({ id: mine, memberId: other.id, token: "t", staleBeforeMs: stale }), false);
  assert.equal(await store.claimCheckout({ id: overdue, memberId: m.id, token: "t", staleBeforeMs: stale }), true);
});

test("stamp, release and clear are each guarded on the value they expect", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const id = await invoice(client, m.id, { status: "due" });
  const session = async () => (await store.checkoutState(id))?.sessionId;

  await store.claimCheckout({ id, memberId: m.id, token: "pending:a", staleBeforeMs: 0 });
  await store.stampCheckout(id, "pending:other", "cs_wrong");
  assert.equal(await session(), "pending:a");
  await store.stampCheckout(id, "pending:a", "cs_1");
  assert.equal(await session(), "cs_1");
  assert.deepEqual(await store.checkoutState(id), { sessionId: "cs_1", status: "due" });

  await store.releaseCheckout(id, "pending:a");
  assert.equal(await session(), "cs_1");
  await store.clearCheckout(id, "cs_other");
  assert.equal(await session(), "cs_1");
  await store.clearCheckout(id, "cs_1");
  assert.equal(await session(), null);

  await store.claimCheckout({ id, memberId: m.id, token: "pending:b", staleBeforeMs: 0 });
  await store.releaseCheckout(id, "pending:b");
  assert.equal(await session(), null);
  assert.equal(await store.checkoutState(crypto.randomUUID()), undefined);
});

// ─── The two Stripe unique indexes (D1 migration 0007) ───────────────────

test("two invoices with the same payment intent, or the same Checkout session, throw a unique violation; null never collides", async () => {
  const { client } = fresh();
  const m = await member(client);
  await invoice(client, m.id, { stripePaymentIntentId: "pi_1", stripeCheckoutSessionId: "cs_1" });
  await assert.rejects(invoice(client, m.id, { stripePaymentIntentId: "pi_1" }), (e: unknown) => isUniqueViolation(e));
  await assert.rejects(invoice(client, m.id, { stripeCheckoutSessionId: "cs_1" }), (e: unknown) => isUniqueViolation(e));
  // Many invoices with no Stripe linkage are fine, and different ids are fine.
  await invoice(client, m.id);
  await invoice(client, m.id);
  await invoice(client, m.id, { stripePaymentIntentId: "pi_2", stripeCheckoutSessionId: "cs_2" });
});
