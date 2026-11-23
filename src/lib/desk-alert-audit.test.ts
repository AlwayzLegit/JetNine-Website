import test from "node:test";
import assert from "node:assert/strict";
import { freshD1 } from "@/db/d1/test-client";
import { auditLog } from "@/db/d1/schema/audit";
import { d1AuditStore } from "./audit-store";
import { auditDeskAlert, deskAlertAuditRow, type DeskAlertResult } from "./desk-alert-audit";

// OPS-279: each desk alert's outcome becomes one audit row, on a real SQLite with the repo's own
// D1 migrations (as audit-store.test.ts does). The three outcomes of sendDispatchAlert as a caller
// sees them: an ok result, an error result, and a rejected promise.

const ALLOWED = new Set(["status", "provider", "messageId", "error", "staffRecipients", "channel", "callSid", "smsSent", "smsFailed"]);

const cases: Array<{ name: string; result: DeskAlertResult; status: string }> = [
  { name: "ok", result: { ok: true, provider: "resend", messageId: "m-1" }, status: "ok" },
  { name: "error", result: { ok: false, error: "provider said no" }, status: "error" },
  { name: "rejected", result: { status: "rejected", reason: new Error("boom") }, status: "rejected" },
  { name: "fulfilled", result: { status: "fulfilled", value: { ok: true, provider: "logger" } }, status: "ok" },
];

const alerts: Array<{
  action: string;
  subjectType: "contact_inquiry" | "system" | "quote" | "trip";
  subjectId?: string;
  subjectCode?: string;
  extra?: Record<string, string | number | boolean | null>;
}> = [
  { action: "pricing_guide.notify.email", subjectType: "contact_inquiry", subjectId: "inq-1" },
  { action: "voicemail.notify.email", subjectType: "system", extra: { callSid: "CA1", smsSent: 1, smsFailed: 0 } },
  { action: "quote.reply.notify.email", subjectType: "quote", subjectId: "q-1", subjectCode: "JN-1", extra: { channel: "sms" } },
  { action: "trip.reply.notify.email", subjectType: "trip", subjectId: "t-1", subjectCode: "JN-2", extra: { channel: "email" } },
  { action: "inbound_text.unrouted.notify.email", subjectType: "system" },
  { action: "inbound_email.unrouted.notify.email", subjectType: "system" },
];

for (const alert of alerts) {
  for (const c of cases) {
    test(`${alert.action}: ${c.name} result becomes one audit row`, async () => {
      const { client } = freshD1();
      const { row, status } = deskAlertAuditRow({ ...alert, result: c.result, staffRecipients: 2 });
      assert.equal(status, c.status);
      await d1AuditStore(client).insertAudit(row as never);
      const rows = await client.select().from(auditLog);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].action, alert.action);
      assert.equal(rows[0].subjectType, alert.subjectType);
      assert.equal(rows[0].subjectId ?? undefined, alert.subjectId);
      const meta = rows[0].metadata as Record<string, unknown>;
      assert.equal(meta.status, c.status);
      assert.equal(meta.staffRecipients, 2);
      for (const key of Object.keys(meta)) assert.ok(ALLOWED.has(key), `unexpected metadata key ${key}`);
    });
  }
}

test("an ok result keeps the provider and message id, an error keeps the error text only", () => {
  const ok = deskAlertAuditRow({ action: "x.notify.email", subjectType: "system", result: { ok: true, provider: "resend", messageId: "m-9" }, staffRecipients: 0 });
  assert.deepEqual(ok.row.metadata, { status: "ok", provider: "resend", messageId: "m-9", staffRecipients: 0 });
  const bad = deskAlertAuditRow({ action: "x.notify.email", subjectType: "system", result: { ok: false, error: "e" }, staffRecipients: 1 });
  assert.deepEqual(bad.row.metadata, { status: "error", error: "e", staffRecipients: 1 });
});

test("a long error or rejection reason is cut to 300 characters", () => {
  const long = "x".repeat(500);
  const a = deskAlertAuditRow({ action: "x.notify.email", subjectType: "system", result: { ok: false, error: long }, staffRecipients: 0 });
  const b = deskAlertAuditRow({ action: "x.notify.email", subjectType: "system", result: { status: "rejected", reason: long }, staffRecipients: 0 });
  assert.equal((a.row.metadata as { error: string }).error.length, 300);
  assert.equal((b.row.metadata as { error: string }).error.length, 300);
});

test("auditDeskAlert never throws, even when the target is d1 with no binding", async () => {
  const before = { t: process.env.DB_TARGET, e: process.env.DEPLOY_ENV };
  process.env.DB_TARGET = "d1";
  process.env.DEPLOY_ENV = "staging";
  const original = console.error;
  const logged: string[] = [];
  console.error = (...args: unknown[]) => void logged.push(args.map(String).join(" "));
  try {
    await auditDeskAlert({ action: "x.notify.email", subjectType: "system", result: { ok: false, error: "e" }, staffRecipients: 0 });
    assert.ok(logged.some((l) => l.includes("[desk-alert] x.notify.email error")), "the failed alert leaves its one line");
  } finally {
    console.error = original;
    if (before.t === undefined) delete process.env.DB_TARGET;
    else process.env.DB_TARGET = before.t;
    if (before.e === undefined) delete process.env.DEPLOY_ENV;
    else process.env.DEPLOY_ENV = before.e;
  }
});
