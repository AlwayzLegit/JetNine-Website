import test from "node:test";
import assert from "node:assert/strict";
import { freshD1 } from "@/db/d1/test-client";
import { auditLog } from "@/db/d1/schema/audit";
import { users } from "@/db/d1/schema/users";
import { auditStore, d1AuditStore } from "./audit-store";
import { logAudit } from "./audit";

// OPS-123: contract tests for the D1 side of the audit log (append only), on a real SQLite
// with the repo's own D1 migrations applied and foreign keys on, as D1 has them.

test("an audit row round-trips diff and metadata JSON, occurredAt as a Date and the nulls", async () => {
  const { client } = freshD1();
  const store = d1AuditStore(client);
  await store.insertAudit({
    actorRole: "dispatcher",
    action: "contact_inquiry.handle",
    subjectType: "contact_inquiry",
    subjectId: "inq-1",
    diff: { status: ["new", "handled"] },
    metadata: { reason: "quote", note: "ok" },
    ip: "203.0.113.9",
    userAgent: "test",
  });
  const [row] = await client.select().from(auditLog);
  assert.equal(row.action, "contact_inquiry.handle");
  assert.equal(row.subjectType, "contact_inquiry");
  assert.deepEqual(row.diff, { status: ["new", "handled"] });
  assert.deepEqual(row.metadata, { reason: "quote", note: "ok" });
  assert.equal(row.actorUserId, null);
  assert.equal(row.subjectCode, null);
  assert.ok(row.occurredAt instanceof Date);
  assert.ok(row.id.length > 0);
});

test("a known actor is kept, an unknown actor id fails on the foreign key", async () => {
  const { client } = freshD1();
  const store = d1AuditStore(client);
  const [u] = await client.insert(users).values({ email: "desk@example.com", role: "dispatcher" } as never).returning({ id: users.id });
  await store.insertAudit({ actorUserId: u.id, action: "trip.update", subjectType: "trip" });
  await assert.rejects(() => store.insertAudit({ actorUserId: "no-such-user", action: "trip.update", subjectType: "trip" }));
  assert.equal((await client.select().from(auditLog)).length, 1);
});

test("a subject type outside the enum fails on the CHECK", async () => {
  const { client } = freshD1();
  await assert.rejects(() => d1AuditStore(client).insertAudit({ action: "x", subjectType: "nonsense" as never }));
});

test("target d1 with no binding throws from auditStore()", () => {
  const before = { t: process.env.DB_TARGET, e: process.env.DEPLOY_ENV };
  process.env.DB_TARGET = "d1";
  process.env.DEPLOY_ENV = "staging";
  try {
    assert.throws(() => auditStore(), /DB_TARGET is d1 but the DB binding is missing/);
  } finally {
    if (before.t === undefined) delete process.env.DB_TARGET;
    else process.env.DB_TARGET = before.t;
    if (before.e === undefined) delete process.env.DEPLOY_ENV;
    else process.env.DEPLOY_ENV = before.e;
  }
});

test("logAudit never throws, even when the target is d1 with no binding", async () => {
  const before = { t: process.env.DB_TARGET, e: process.env.DEPLOY_ENV };
  process.env.DB_TARGET = "d1";
  process.env.DEPLOY_ENV = "staging";
  const logged: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => void logged.push(args.map(String).join(" "));
  try {
    await logAudit({ action: "contact_inquiry.submit", subjectType: "contact_inquiry", subjectId: "inq-1" });
    assert.ok(logged.some((l) => l.includes("[audit-failure]")), "the failure is logged with its tag");
  } finally {
    console.error = original;
    if (before.t === undefined) delete process.env.DB_TARGET;
    else process.env.DB_TARGET = before.t;
    if (before.e === undefined) delete process.env.DEPLOY_ENV;
    else process.env.DEPLOY_ENV = before.e;
  }
});
