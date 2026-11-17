import test from "node:test";
import assert from "node:assert/strict";
import { freshD1WithBatch } from "@/db/d1/test-batch-client";
import { staffNotificationPrefs } from "@/db/d1/schema/desk";
import { users } from "@/db/d1/schema/users";
import { REPLY_PROMISE_KEY } from "@/db/schema/desk";
import { d1SettingsStore } from "./store-d1";

// OPS-126: contract tests for the D1 settings store (desk_settings, the
// per-person notification choices and the "who gets paged" read), on a real
// SQLite with the repo's own D1 migrations applied and foreign keys on, as D1
// has them.

function fresh() {
  const { sqlite, client } = freshD1WithBatch();
  return { sqlite, client, store: d1SettingsStore(client) };
}

async function user(client: ReturnType<typeof fresh>["client"], email: string, role: string) {
  const [u] = await client.insert(users).values({ email, role } as never).returning({ id: users.id });
  return u.id;
}

const prefs = (over: Record<string, boolean> = {}) => ({
  newRequest: true,
  replyDueSoon: true,
  clientPick: true,
  morningSummary: false,
  ...over,
});

test("getSetting of a key that was never written is undefined", async () => {
  const { store } = fresh();
  assert.equal(await store.getSetting("nothing_here"), undefined);
});

test("upsert then read the reply promise back as a number", async () => {
  const { store } = fresh();
  await store.upsertSetting(REPLY_PROMISE_KEY, 60, null, new Date("2026-11-17T10:00:00Z"));
  assert.equal(await store.getSetting(REPLY_PROMISE_KEY), 60);
});

test("an object value (voice routing) round-trips equal", async () => {
  const { store } = fresh();
  const routing = { ringFirst: true, numbers: ["+13105550100"], rings: 4, schedule: "always", screen: false };
  await store.upsertSetting("voice_routing", routing, null, new Date());
  assert.deepEqual(await store.getSetting("voice_routing"), routing);
});

test("a second upsert replaces the value and who changed it", async () => {
  const { store, client, sqlite } = fresh();
  const a = await user(client, "a@example.com", "admin");
  const b = await user(client, "b@example.com", "admin");
  await store.upsertSetting(REPLY_PROMISE_KEY, 15, a, new Date("2026-11-17T10:00:00Z"));
  await store.upsertSetting(REPLY_PROMISE_KEY, 30, b, new Date("2026-11-17T11:00:00Z"));
  assert.equal(await store.getSetting(REPLY_PROMISE_KEY), 30);
  const rows = sqlite.prepare("select updated_by, updated_at from desk_settings where key = ?").all(REPLY_PROMISE_KEY) as {
    updated_by: string;
    updated_at: number;
  }[];
  assert.equal(rows.length, 1);
  assert.equal(rows[0].updated_by, b);
  assert.equal(rows[0].updated_at, new Date("2026-11-17T11:00:00Z").getTime());
});

test("a setting changed by an unknown user fails on the foreign key", async () => {
  const { store } = fresh();
  await assert.rejects(() => store.upsertSetting(REPLY_PROMISE_KEY, 15, "no-such-user", new Date()));
});

test("notification prefs: no row reads undefined, a save reads back", async () => {
  const { store, client } = fresh();
  const id = await user(client, "desk@example.com", "dispatcher");
  assert.equal(await store.getNotificationPrefs(id), undefined);
  await store.upsertNotificationPrefs(id, prefs({ morningSummary: true }), { morningSummary: true }, new Date());
  assert.deepEqual(await store.getNotificationPrefs(id), prefs({ morningSummary: true }));
});

test("a second save sets only the keys in the patch", async () => {
  const { store, client } = fresh();
  const id = await user(client, "desk@example.com", "dispatcher");
  await store.upsertNotificationPrefs(id, prefs({ clientPick: false }), { clientPick: false }, new Date());
  // The caller worked out next = current + patch; the stored row keeps the other keys as they were.
  await store.upsertNotificationPrefs(id, prefs({ clientPick: false, newRequest: false }), { newRequest: false }, new Date());
  assert.deepEqual(await store.getNotificationPrefs(id), prefs({ clientPick: false, newRequest: false }));
});

test("notification prefs for an unknown user fail on the foreign key", async () => {
  const { store } = fresh();
  await assert.rejects(() => store.upsertNotificationPrefs("no-such-user", prefs(), {}, new Date()));
});

test("recipientEmails returns staff with the toggle on or no row, leaves out staff with it off, never a client", async () => {
  const { store, client } = fresh();
  const on = await user(client, "on@example.com", "dispatcher");
  const off = await user(client, "off@example.com", "admin");
  await user(client, "default@example.com", "superadmin");
  await user(client, "client@example.com", "member");
  await store.upsertNotificationPrefs(on, prefs(), { newRequest: true }, new Date());
  await store.upsertNotificationPrefs(off, prefs({ newRequest: false }), { newRequest: false }, new Date());

  const got = (await store.recipientEmails("newRequest")).sort();
  assert.deepEqual(got, ["default@example.com", "on@example.com"]);
});

test("recipientEmails uses each kind's own default when there is no row", async () => {
  const { store, client } = fresh();
  await user(client, "desk@example.com", "dispatcher");
  // morningSummary defaults to off, the others to on.
  assert.deepEqual(await store.recipientEmails("morningSummary"), []);
  assert.deepEqual(await store.recipientEmails("replyDueSoon"), ["desk@example.com"]);
  assert.deepEqual(await store.recipientEmails("clientPick"), ["desk@example.com"]);
});

test("recipientEmails: a morning summary toggled on is returned", async () => {
  const { store, client } = fresh();
  const id = await user(client, "early@example.com", "admin");
  await store.upsertNotificationPrefs(id, prefs({ morningSummary: true }), { morningSummary: true }, new Date());
  assert.deepEqual(await store.recipientEmails("morningSummary"), ["early@example.com"]);
});

test("prefs rows are removed with their user (cascade), as in Postgres", async () => {
  const { store, client, sqlite } = fresh();
  const id = await user(client, "gone@example.com", "dispatcher");
  await store.upsertNotificationPrefs(id, prefs(), {}, new Date());
  sqlite.prepare("delete from users where id = ?").run(id);
  const left = await client.select().from(staffNotificationPrefs);
  assert.equal(left.length, 0);
});
