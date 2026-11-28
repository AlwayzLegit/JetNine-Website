import test from "node:test";
import assert from "node:assert/strict";
import { freshD1 } from "@/db/d1/test-client";
import { contactInquiries } from "@/db/d1/schema/contact";
import { leadDesk } from "@/db/d1/schema/lead-desk";
import {
  buildLeadInput,
  cleanKind,
  leadHealthWith,
  markAlertFailedWith,
  markRepliedWith,
  scoreFor,
  sendPointerWith,
  type LeadsBinding,
  type PointerArgs,
  type PointerDeps,
} from "./pointer";
import { reportNotStoredWith } from "./not-stored";
import { claimContactOverdue, waitingContactEnquiries } from "./contact-sla";

// OPS-373: the lead pointer, on a real SQLite with the repo's own D1 migrations (as the other D1
// tests do). The receiver's rules are copied here as a fixture from crew-intake (intake/src/validate.ts
// validateLead, Crew repo main a277d68), so a pointer the receiver would refuse fails here first.

const ALLOWED_KEYS = ["source", "kind", "siteRef", "adminUrl", "receivedAt", "replyDue", "score", "status", "rehearsal"];
const SOURCES = ["Form", "Quote", "Contact", "Chat", "Voice call", "Text", "Email", "Booking", "Waitlist", "Unfinished booking", "Claim", "Ad request", "Billing request"];
const CHECK_CHARS = /^[A-Za-z0-9 /_?=.,:()'-]+$/;
const SITE_REF = /^[A-Za-z0-9_-]{1,40}$/;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const ADMIN_HOSTS = ["jetnine.com", "www.jetnine.com", "staging.jetnine.com"];
const FORBIDDEN_KEY = /name|email|phone|address|user/i;

function receiverAccepts(input: Record<string, unknown>): string | null {
  if (Object.keys(input).some((k) => !ALLOWED_KEYS.includes(k))) return "unknown field";
  if (Object.keys(input).some((k) => FORBIDDEN_KEY.test(k) && k !== "adminUrl")) return "personal key";
  if (!SOURCES.includes(String(input.source))) return "bad source";
  const kind = String(input.kind);
  if (kind.length < 1 || kind.length > 80 || !CHECK_CHARS.test(kind)) return "bad kind";
  if (!SITE_REF.test(String(input.siteRef))) return "bad siteRef";
  const url = new URL(String(input.adminUrl));
  if (url.protocol !== "https:" || !ADMIN_HOSTS.includes(url.hostname) || url.search || !/^[A-Za-z0-9._~/-]+$/.test(url.pathname)) return "bad adminUrl";
  if (!ISO_TIME.test(String(input.receivedAt))) return "bad receivedAt";
  if (input.replyDue !== null && !ISO_TIME.test(String(input.replyDue))) return "bad replyDue";
  if (input.score !== null && !["Hot", "Warm", "Cold", "Spam"].includes(String(input.score))) return "bad score";
  if (!["New", "Not stored"].includes(String(input.status))) return "bad status";
  if (typeof input.rehearsal !== "boolean") return "bad rehearsal";
  return null;
}

const NOW = new Date("2026-11-27T20:00:00.000Z");
const QUOTE_ID = "11111111-2222-4333-8444-555555555555";

function args(over: Partial<PointerArgs> = {}): PointerArgs {
  return {
    subjectType: "quote",
    subjectId: QUOTE_ID,
    source: "Quote",
    kind: "quote roundtrip",
    receivedAt: NOW,
    replyDue: new Date(NOW.getTime() + 30 * 60_000),
    score: "Hot",
    adminPath: `/admin/requests/${QUOTE_ID}`,
    ...over,
  };
}

function binding(over: Partial<LeadsBinding> = {}): { b: LeadsBinding; created: unknown[]; updated: unknown[] } {
  const created: unknown[] = [];
  const updated: unknown[] = [];
  const b: LeadsBinding = {
    async createLead(input) {
      created.push(input);
      return { ok: true, pageId: "page-1" };
    },
    async updateLead(input) {
      updated.push(input);
      return { ok: true, pageId: "page-1" };
    },
    ...over,
  };
  return { b, created, updated };
}

function deps(b: LeadsBinding | null, db: PointerDeps["db"], rehearsal = false): PointerDeps {
  return { binding: b, db, siteBase: "https://jetnine.com", rehearsal };
}

test("the pointer input passes the receiver's rules and holds no personal key", () => {
  for (const a of [
    args(),
    args({ subjectType: "contact", source: "Contact", kind: "contact quote", adminPath: "/admin/messages", score: "Warm" }),
    args({ status: "Not stored", subjectId: `ns-${QUOTE_ID}`, adminPath: "/admin/requests", replyDue: null, score: null }),
  ]) {
    const input = buildLeadInput(a, { siteBase: "https://jetnine.com", rehearsal: false });
    assert.equal(receiverAccepts(input), null, JSON.stringify(input));
    assert.equal(Object.keys(input).sort().join(","), [...ALLOWED_KEYS].sort().join(","));
  }
  const staging = buildLeadInput(args(), { siteBase: "https://staging.jetnine.com/", rehearsal: true });
  assert.equal(receiverAccepts(staging), null);
  assert.equal(staging.rehearsal, true);
  assert.equal(staging.adminUrl, `https://staging.jetnine.com/admin/requests/${QUOTE_ID}`);
});

test("a kind with characters the receiver refuses is cleaned, never empty, never over 80", () => {
  assert.equal(cleanKind("quote <script>alert(1)</script>"), "quote scriptalert(1)/script");
  assert.equal(cleanKind("!!!"), "lead");
  assert.equal(cleanKind("x".repeat(200)).length, 80);
});

test("score is Hot within 7 days of the first departure, else Warm", () => {
  assert.equal(scoreFor("2026-11-30", NOW), "Hot");
  assert.equal(scoreFor("2026-12-04", NOW), "Hot");
  assert.equal(scoreFor("2026-12-20", NOW), "Warm");
  assert.equal(scoreFor(null, NOW), "Warm");
  assert.equal(scoreFor("not a date", NOW), "Warm");
});

test("a sent pointer is recorded as sent, with no visitor field in the row", async () => {
  const { client, sqlite } = freshD1();
  const { b, created } = binding();
  const page = await sendPointerWith(deps(b, client), args());
  assert.equal(page, "page-1");
  assert.equal(created.length, 1);
  const rows = sqlite.prepare("select * from lead_desk").all() as Record<string, unknown>[];
  assert.equal(rows.length, 1);
  assert.equal(rows[0].pointer, "sent");
  assert.equal(rows[0].subject_type, "quote");
  assert.equal(rows[0].subject_id, QUOTE_ID);
  assert.deepEqual(Object.keys(rows[0]).sort(), ["created_at", "id", "pointer", "received_at", "reply_due_at", "sla_alerted_at", "source", "subject_id", "subject_type"]);
});

test("a binding that throws, refuses or is missing does not throw and counts one failed pointer", async () => {
  const { client } = freshD1();
  const throwing = binding({ createLead: async () => { throw new Error("boom"); } }).b;
  const refusing = binding({ createLead: async () => ({ ok: false, reason: "intake refused" }) }).b;
  assert.equal(await sendPointerWith(deps(throwing, client), args({ subjectId: "a1" })), null);
  assert.equal(await sendPointerWith(deps(refusing, client), args({ subjectId: "a2" })), null);
  assert.equal(await sendPointerWith(deps(null, client), args({ subjectId: "a3" })), null);
  const h = await leadHealthWith(client, new Date());
  assert.equal(h.failedPointers24h, 3);
  assert.equal(h.failedStores24h, 0);
  // The three leads were stored; only their pointers failed, so the last stored time is set (review finding).
  assert.ok(h.lastStoredAt);
});

test("a pointer is sent and counted even when the lead_desk table cannot be written", async () => {
  const { b, created } = binding();
  const broken = { insert() { throw new Error("no table"); } } as unknown as PointerDeps["db"];
  assert.equal(await sendPointerWith(deps(b, broken), args()), "page-1");
  assert.equal(created.length, 1);
});

test("health counts: last stored, failed stores and failed pointers in 24 hours", async () => {
  const { client } = freshD1();
  const now = new Date();
  const old = new Date(now.getTime() - 3 * 86_400_000);
  const mk = (pointer: "sent" | "failed" | "not_stored", createdAt: Date, id: string) =>
    client.insert(leadDesk).values({ subjectType: "quote", subjectId: id, source: "Quote", receivedAt: createdAt, pointer, createdAt });
  await mk("sent", old, "s-old");
  await mk("sent", new Date(now.getTime() - 3_600_000), "s-new");
  await mk("failed", new Date(now.getTime() - 2 * 3_600_000), "f-1");
  await mk("failed", old, "f-old");
  await mk("not_stored", new Date(now.getTime() - 3_600_000), "n-1");
  await mk("not_stored", new Date(now.getTime() - 2 * 3_600_000), "n-2");
  const h = await leadHealthWith(client, now);
  assert.equal(h.failedPointers24h, 1);
  assert.equal(h.failedStores24h, 2);
  assert.equal(h.lastStoredAt, new Date(now.getTime() - 3_600_000).toISOString());
});

test("health lastStoredAt counts a stored lead whose pointer failed, and never a Not stored one", async () => {
  const { client } = freshD1();
  const now = new Date();
  const mk = (pointer: "sent" | "failed" | "not_stored", createdAt: Date, id: string) =>
    client.insert(leadDesk).values({ subjectType: "quote", subjectId: id, source: "Quote", receivedAt: createdAt, pointer, createdAt });
  const failedAt = new Date(now.getTime() - 2 * 3_600_000);
  await mk("failed", failedAt, "f-1");
  await mk("not_stored", new Date(now.getTime() - 3_600_000), "n-1");
  assert.equal((await leadHealthWith(client, now)).lastStoredAt, failedAt.toISOString());
});

test("the first reply is told to the board as Replied with a time, and a failure is swallowed", async () => {
  const { b, updated } = binding();
  assert.equal(await markRepliedWith({ binding: b }, QUOTE_ID, NOW), true);
  assert.deepEqual(updated[0], { siteRef: QUOTE_ID, status: "Replied", firstReplyAt: "2026-11-27T20:00:00.000Z" });
  assert.equal(await markRepliedWith({ binding: null }, QUOTE_ID, NOW), false);
  const bad = binding({ updateLead: async () => { throw new Error("x"); } }).b;
  assert.equal(await markRepliedWith({ binding: bad }, QUOTE_ID, NOW), false);
  assert.equal(await markAlertFailedWith({ binding: b }, "ns-1"), true);
  assert.deepEqual(updated[1], { siteRef: "ns-1", status: "Missed", missedReason: "Alert failed" });
});

const notStoredArgs = {
  subjectType: "contact" as const,
  source: "Contact" as const,
  what: "a contact enquiry",
  kind: "contact quote",
  fields: ["Name: Test Visitor", "Email: visitor@example.test"],
  receivedAt: NOW,
  replyDue: new Date(NOW.getTime() + 30 * 60_000),
};

test("not stored: the desk gets the alert with the visitor's fields, the board gets a pointer without them", async () => {
  const { client, sqlite } = freshD1();
  const { b, created, updated } = binding();
  const alerts: { subject: string; lines: string[] }[] = [];
  const alert = (async (a: { subject: string; lines: string[] }) => {
    alerts.push(a);
    return { ok: true, provider: "resend" };
  }) as never;
  const audits: Record<string, unknown>[] = [];
  const audit = (async (a: Record<string, unknown>) => { audits.push(a); }) as never;
  const r = await reportNotStoredWith(deps(b, client), alert, notStoredArgs, audit);
  assert.equal(r.alertOk, true);
  // The delivery report sees it: one "*.notify.email" audit row, no subject id, no visitor text.
  assert.equal(audits.length, 1);
  assert.match(String(audits[0].action), /\.notify\.email$/);
  assert.equal(audits[0].subjectId, undefined);
  assert.ok(!JSON.stringify(audits[0]).includes("visitor@example.test"));
  assert.equal(alerts.length, 1);
  assert.ok(alerts[0].lines.some((l) => l.includes("visitor@example.test")));
  assert.equal(alerts[0].subject, "Not stored: a contact enquiry");
  const input = created[0] as Record<string, unknown>;
  assert.equal(input.status, "Not stored");
  assert.match(String(input.siteRef), /^ns-[0-9a-f-]{36}$/);
  assert.equal(receiverAccepts(input), null);
  assert.ok(!JSON.stringify(input).includes("visitor@example.test"));
  assert.ok(!JSON.stringify(input).includes("Test Visitor"));
  assert.equal(updated.length, 0);
  const rows = sqlite.prepare("select pointer from lead_desk").all() as { pointer: string }[];
  assert.deepEqual(rows.map((r) => r.pointer), ["not_stored"]);
});

test("not stored: email in logger mode or a failed send counts as a failed alert and marks the row Missed", async () => {
  for (const result of [{ ok: true, provider: "logger" }, { ok: false, error: "provider said no" }]) {
    const { client } = freshD1();
    const { b, updated } = binding();
    const alert = (async () => result) as never;
    const audits: Record<string, unknown>[] = [];
    const audit = (async (a: Record<string, unknown>) => { audits.push(a); }) as never;
    const r = await reportNotStoredWith(deps(b, client), alert, notStoredArgs, audit);
    assert.equal(r.alertOk, false);
    assert.equal(audits.length, 1, "a failed or logger-only alert is still audited");
    assert.equal(updated.length, 1);
    assert.equal((updated[0] as Record<string, unknown>).missedReason, "Alert failed");
  }
  const { client } = freshD1();
  const { b, updated } = binding();
  const throwing = (async () => { throw new Error("smtp"); }) as never;
  const thrownAudits: Record<string, unknown>[] = [];
  const thrownAudit = (async (a: Record<string, unknown>) => { thrownAudits.push(a); }) as never;
  assert.equal((await reportNotStoredWith(deps(b, client), throwing, notStoredArgs, thrownAudit)).alertOk, false);
  assert.equal(thrownAudits.length, 1);
  assert.equal((thrownAudits[0].result as { status: string }).status, "rejected");
  assert.equal(updated.length, 1);
});

async function inquiry(client: ReturnType<typeof freshD1>["client"], status: "new" | "handled") {
  const [row] = await client
    .insert(contactInquiries)
    .values({ firstName: "T", lastName: "V", email: "t@example.test", status })
    .returning({ id: contactInquiries.id });
  return row.id;
}

test("the contact reply deadline: a pass claims an overdue new enquiry once, and skips handled, early and stale ones", async () => {
  const { client } = freshD1();
  const now = new Date("2026-11-27T20:00:00.000Z");
  const ago = (min: number) => new Date(now.getTime() - min * 60_000);
  const add = async (status: "new" | "handled", dueMinutesAgo: number) => {
    const id = await inquiry(client, status);
    await client.insert(leadDesk).values({ subjectType: "contact", subjectId: id, source: "Contact", receivedAt: ago(dueMinutesAgo + 30), replyDueAt: ago(dueMinutesAgo), pointer: "sent" });
    return id;
  };
  const overdue = await add("new", 5);
  await add("handled", 5);
  await add("new", -10); // due in the future
  await add("new", 25 * 60); // stale, left to the desk's own list
  const first = await claimContactOverdue(client, now, 10);
  assert.deepEqual(first.map((c) => c.inquiryId), [overdue]);
  assert.deepEqual(await claimContactOverdue(client, now, 10), []);
  const waiting = await waitingContactEnquiries(client);
  assert.equal(waiting.count, 3);
  assert.ok(waiting.oldestAt instanceof Date);
});

test("the contact pass pages at most the limit and the rest wait for the next run", async () => {
  const { client } = freshD1();
  const now = new Date("2026-11-27T20:00:00.000Z");
  for (let i = 0; i < 4; i++) {
    const id = await inquiry(client, "new");
    await client.insert(leadDesk).values({ subjectType: "contact", subjectId: id, source: "Contact", receivedAt: new Date(now.getTime() - 3_600_000), replyDueAt: new Date(now.getTime() - (10 + i) * 60_000), pointer: "sent" });
  }
  assert.equal((await claimContactOverdue(client, now, 3)).length, 3);
  assert.equal((await claimContactOverdue(client, now, 3)).length, 1);
});
