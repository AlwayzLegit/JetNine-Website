import test from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { freshD1WithBatch } from "@/db/d1/test-batch-client";
import { invoices, stripeWebhookEvents } from "@/db/d1/schema/invoices";
import { members } from "@/db/d1/schema/members";
import { memberships, reserveTransactions } from "@/db/d1/schema/memberships";
import { users } from "@/db/d1/schema/users";
import { isUniqueViolation } from "@/db/unique";
import { d1PaymentStore } from "./store-d1";

// OPS-162: contract tests for the D1 payment store (the Stripe webhook's event claim, invoice paid,
// reserve credits, membership activation with its tier, and the void on a full refund), on a real
// SQLite with the repo's own D1 migrations applied and foreign keys on, as D1 has them. Each case
// is the call the Postgres adapter answers.

const NOW = new Date("2026-11-18T12:00:00.000Z");

function fresh() {
  const { client } = freshD1WithBatch();
  return { client, store: d1PaymentStore(client) };
}
type Fresh = ReturnType<typeof fresh>;

let seq = 0;
const n = () => ++seq;
const one = async <T>(rows: Promise<T[]>): Promise<T> => (await rows)[0];

async function member(c: Fresh["client"]) {
  const [u] = await c.insert(users).values({ email: `u${n()}@example.com` } as never).returning({ id: users.id });
  const [m] = await c
    .insert(members)
    .values({ userId: u.id, memberCode: `M-2026-${String(n()).padStart(4, "0")}` })
    .returning({ id: members.id });
  return m.id;
}

async function membership(
  c: Fresh["client"],
  memberId: string,
  over: Partial<typeof memberships.$inferInsert> = {},
) {
  const [row] = await c
    .insert(memberships)
    .values({
      memberId,
      program: "card_250",
      depositUsd: 250_000,
      calloutHours: 24,
      status: "paused",
      activatedOn: "2026-01-01",
      ...over,
    } as never)
    .returning({ id: memberships.id });
  return row.id;
}

async function invoice(c: Fresh["client"], memberId: string, over: Partial<typeof invoices.$inferInsert> = {}) {
  const [row] = await c
    .insert(invoices)
    .values({ memberId, invoiceCode: `INV-2026-${String(n()).padStart(4, "0")}`, kind: "charter", status: "due", totalUsd: 1_000, ...over } as never)
    .returning({ id: invoices.id });
  return row.id;
}

// ─── The event claim ─────────────────────────────────────────────────────

test("claimEvent is true once and false for the same event id", async () => {
  const { store } = fresh();
  const args = { id: "evt_1", type: "checkout.session.completed", payload: { id: "evt_1", n: 1 } };
  assert.equal(await store.claimEvent(args), true);
  assert.equal(await store.claimEvent(args), false);
});

test("processed_at stays null until marked; the error is set and cleared", async () => {
  const { client, store } = fresh();
  await store.claimEvent({ id: "evt_2", type: "charge.refunded", payload: { a: 1 } });
  assert.equal(await store.eventProcessedAt("evt_2"), null);
  assert.equal(await store.eventProcessedAt("evt_unknown"), null);

  await store.markEventError("evt_2", "boom");
  assert.equal((await one(client.select().from(stripeWebhookEvents).where(eq(stripeWebhookEvents.id, "evt_2")))).error, "boom");
  await store.clearEventError("evt_2");
  assert.equal((await one(client.select().from(stripeWebhookEvents).where(eq(stripeWebhookEvents.id, "evt_2")))).error, null);

  await store.markEventProcessed("evt_2", NOW);
  assert.equal((await store.eventProcessedAt("evt_2"))?.getTime(), NOW.getTime());
  const row = await one(client.select().from(stripeWebhookEvents).where(eq(stripeWebhookEvents.id, "evt_2")));
  assert.deepEqual(row.payload, { a: 1 });
});

// ─── The reserve credits ─────────────────────────────────────────────────

test("crediting the same payment intent as a top-up twice throws a unique violation and leaves one row", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const ms = await membership(client, m, { status: "active" });
  const credit = {
    memberId: m,
    membershipId: ms,
    kind: "top_up" as const,
    amountUsd: 5_000,
    description: "Balance top-up via Stripe",
    stripePaymentIntentId: "pi_topup_1",
  };
  await store.creditLedger(credit);
  await assert.rejects(store.creditLedger(credit), (err) => isUniqueViolation(err));
  const rows = await client.select().from(reserveTransactions).where(eq(reserveTransactions.memberId, m));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].amountUsd, 5_000);
  assert.equal(rows[0].stripePaymentIntentId, "pi_topup_1");
});

test("membershipForTopUp and membershipForActivation answer the row, undefined for an unknown id", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const ms = await membership(client, m);
  assert.deepEqual(await store.membershipForTopUp(ms), { id: ms, memberId: m, status: "paused" });
  assert.deepEqual(await store.membershipForActivation(ms), {
    id: ms,
    memberId: m,
    depositUsd: 250_000,
    program: "card_250",
    status: "paused",
  });
  assert.equal(await store.membershipForTopUp("nope"), undefined);
  assert.equal(await store.membershipForActivation("nope"), undefined);
});

// ─── The invoice paid ────────────────────────────────────────────────────

test("markInvoicePaid sets paid, paid_on the UTC day, paid_at and both Stripe ids, and returns the row", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const id = await invoice(client, m, { totalUsd: 4_200 });
  const row = await store.markInvoicePaid({ invoiceId: id, paymentIntentId: "pi_1", sessionId: "cs_1", paidAt: NOW });
  assert.ok(row);
  assert.equal(row.id, id);
  assert.equal(row.memberId, m);
  assert.equal(row.totalUsd, 4_200);
  assert.equal(row.tripId, null);
  const stored = await one(client.select().from(invoices).where(eq(invoices.id, id)));
  assert.equal(stored.status, "paid");
  assert.equal(stored.paidOn, "2026-11-18");
  assert.equal(stored.paidAt?.getTime(), NOW.getTime());
  assert.equal(stored.stripePaymentIntentId, "pi_1");
  assert.equal(stored.stripeCheckoutSessionId, "cs_1");
});

test("markInvoicePaid returns null for an unknown invoice", async () => {
  const { store } = fresh();
  assert.equal(await store.markInvoicePaid({ invoiceId: "nope", paymentIntentId: null, sessionId: "cs_x", paidAt: NOW }), null);
});

test("invoiceForFailedPayment answers the code, the member and the trip; undefined for none", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const id = await invoice(client, m);
  const row = await store.invoiceForFailedPayment(id);
  assert.ok(row);
  assert.equal(row.memberId, m);
  assert.match(row.invoiceCode, /^INV-2026-/);
  assert.equal(row.tripId, null);
  assert.equal(await store.invoiceForFailedPayment("nope"), undefined);
});

// ─── The membership activation ───────────────────────────────────────────

test("activateMembership on a paused membership sets it active and the member's tier with tier_since = activated_on", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const ms = await membership(client, m, { program: "card_500", activatedOn: "2026-03-05" });
  assert.equal((await one(client.select().from(members).where(eq(members.id, m)))).tier, "on_demand");

  await store.activateMembership({ id: ms, memberId: m, previousStatus: "paused", paymentIntentId: "pi_a", sessionId: "cs_a", now: NOW });

  const row = await one(client.select().from(memberships).where(eq(memberships.id, ms)));
  assert.equal(row.status, "active");
  assert.equal(row.stripePaymentIntentId, "pi_a");
  assert.equal(row.stripeCheckoutSessionId, "cs_a");
  assert.equal(row.activatedAt?.getTime(), NOW.getTime());
  const mem = await one(client.select().from(members).where(eq(members.id, m)));
  assert.equal(mem.tier, "card_500");
  assert.equal(mem.tierSince, "2026-03-05");
});

test("a second active membership for the same member throws a unique violation and changes nothing (the batch rolls back)", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const first = await membership(client, m, { program: "card_100", activatedOn: "2026-01-01" });
  const second = await membership(client, m, { program: "card_500", activatedOn: "2026-02-02" });
  await store.activateMembership({ id: first, memberId: m, previousStatus: "paused", paymentIntentId: "pi_1", sessionId: "cs_1", now: NOW });

  await assert.rejects(
    store.activateMembership({ id: second, memberId: m, previousStatus: "paused", paymentIntentId: "pi_2", sessionId: "cs_2", now: NOW }),
    (err) => isUniqueViolation(err),
  );

  const row = await one(client.select().from(memberships).where(eq(memberships.id, second)));
  assert.equal(row.status, "paused");
  assert.equal(row.stripePaymentIntentId, null);
  const mem = await one(client.select().from(members).where(eq(members.id, m)));
  assert.equal(mem.tier, "card_100");
  assert.equal(mem.tierSince, "2026-01-01");
});

test("two memberships with the same session id, or the same payment intent, throw a unique violation", async () => {
  const { client, store } = fresh();
  const m1 = await member(client);
  const m2 = await member(client);
  const a = await membership(client, m1);
  const b = await membership(client, m2);
  const c = await membership(client, await member(client));
  await store.activateMembership({ id: a, memberId: m1, previousStatus: "paused", paymentIntentId: "pi_same", sessionId: "cs_same", now: NOW });

  await assert.rejects(
    store.activateMembership({ id: b, memberId: m2, previousStatus: "paused", paymentIntentId: "pi_other", sessionId: "cs_same", now: NOW }),
    (err) => isUniqueViolation(err),
  );
  const m3 = (await one(client.select().from(memberships).where(eq(memberships.id, c)))).memberId;
  await assert.rejects(
    store.activateMembership({ id: c, memberId: m3, previousStatus: "paused", paymentIntentId: "pi_same", sessionId: "cs_other", now: NOW }),
    (err) => isUniqueViolation(err),
  );
  assert.equal((await one(client.select().from(memberships).where(eq(memberships.id, b)))).status, "paused");
  assert.equal((await one(client.select().from(memberships).where(eq(memberships.id, c)))).status, "paused");
});

test("two paused memberships can both carry no Stripe ids (the indexes are partial)", async () => {
  const { client } = fresh();
  const m = await member(client);
  await membership(client, m);
  await membership(client, m);
  const rows = await client.select().from(memberships).where(eq(memberships.memberId, m));
  assert.equal(rows.length, 2);
});

// ─── The refund ──────────────────────────────────────────────────────────

test("voidInvoiceByPaymentIntent voids the matching invoice and returns null when none matches", async () => {
  const { client, store } = fresh();
  const m = await member(client);
  const id = await invoice(client, m, { status: "paid", stripePaymentIntentId: "pi_ref" });
  const other = await invoice(client, m, { status: "paid", stripePaymentIntentId: "pi_other" });

  const row = await store.voidInvoiceByPaymentIntent("pi_ref", NOW);
  assert.ok(row);
  assert.equal(row.id, id);
  assert.equal((await one(client.select().from(invoices).where(eq(invoices.id, id)))).status, "void");
  assert.equal((await one(client.select().from(invoices).where(eq(invoices.id, other)))).status, "paid");
  assert.equal(await store.voidInvoiceByPaymentIntent("pi_none", NOW), null);
});
