import test from "node:test";
import assert from "node:assert/strict";
import { freshD1WithBatch } from "@/db/d1/test-batch-client";
import { users } from "@/db/d1/schema/users";
import { d1AiProviderStore } from "./ai-store-d1";

// OPS-166: contract tests for the D1 AI provider store (ai_providers and
// ai_routes), on a real SQLite with the repo's own D1 migrations applied and
// foreign keys on, as D1 has them. Sealed strings here are made up: no key.

function fresh() {
  const { sqlite, client } = freshD1WithBatch();
  return { sqlite, client, store: d1AiProviderStore(client) };
}

const provider = (over: Record<string, unknown> = {}) => ({
  provider: "anthropic" as const,
  label: "Anthropic (Claude)",
  apiKeyEnc: "v1.made-up-sealed-text-a",
  apiKeyLast4: "abcd",
  defaultModel: "model-a",
  createdBy: undefined as unknown as string,
  ...over,
});

test("insert then list: the row comes back with the types Postgres gives", async () => {
  const { store } = fresh();
  const row = await store.insertProvider(provider());
  assert.equal(typeof row.id, "string");
  assert.ok(row.id.length > 0);
  assert.equal(row.provider, "anthropic");
  assert.equal(row.enabled, true);
  assert.equal(row.lastTestedAt, null);
  assert.equal(row.lastTestOk, null);
  assert.ok(row.createdAt instanceof Date);
  assert.ok(row.updatedAt instanceof Date);
  const list = await store.listProviders();
  assert.equal(list.length, 1);
  assert.equal(list[0].id, row.id);
  assert.equal(list[0].apiKeyEnc, "v1.made-up-sealed-text-a");
  assert.ok(list[0].updatedAt instanceof Date);
});

test("a second insert of the same provider fails (provider is unique)", async () => {
  const { store } = fresh();
  await store.insertProvider(provider());
  await assert.rejects(() => store.insertProvider(provider({ apiKeyEnc: "v1.made-up-sealed-text-b" })));
  assert.equal((await store.listProviders()).length, 1);
});

test("providerByKind finds the row, or undefined", async () => {
  const { store } = fresh();
  assert.equal(await store.providerByKind("openai"), undefined);
  const row = await store.insertProvider(provider({ provider: "openai", label: "OpenAI" }));
  assert.equal((await store.providerByKind("openai"))?.id, row.id);
  assert.equal(await store.providerByKind("anthropic"), undefined);
});

test("updateProvider by id returns the new row; an unknown id gives undefined", async () => {
  const { store } = fresh();
  const row = await store.insertProvider(provider());
  const when = new Date("2026-11-18T12:00:00Z");
  const next = await store.updateProvider(row.id, {
    apiKeyEnc: "v1.made-up-sealed-text-b",
    apiKeyLast4: "wxyz",
    lastTestedAt: when,
    lastTestOk: true,
    lastTestNote: "5 models",
    updatedAt: when,
  });
  assert.equal(next?.apiKeyEnc, "v1.made-up-sealed-text-b");
  assert.equal(next?.apiKeyLast4, "wxyz");
  assert.equal(next?.lastTestOk, true);
  assert.equal(next?.lastTestedAt?.getTime(), when.getTime());
  assert.equal(await store.updateProvider("no-such-id", { label: "x", updatedAt: when }), undefined);
});

test("updateProvider can clear the last test back to null", async () => {
  const { store } = fresh();
  const row = await store.insertProvider(provider());
  await store.updateProvider(row.id, { lastTestedAt: new Date(), lastTestOk: false, lastTestNote: "no" });
  const cleared = await store.updateProvider(row.id, { lastTestedAt: null, lastTestOk: null, lastTestNote: null });
  assert.equal(cleared?.lastTestedAt, null);
  assert.equal(cleared?.lastTestOk, null);
  assert.equal(cleared?.lastTestNote, null);
});

test("updateProviderByKind changes label, model and enabled; an unknown kind gives undefined", async () => {
  const { store } = fresh();
  assert.equal(await store.updateProviderByKind("openai", { label: "x", updatedAt: new Date() }), undefined);
  const row = await store.insertProvider(provider({ provider: "openai", label: "OpenAI" }));
  const next = await store.updateProviderByKind("openai", {
    label: "OpenAI (work)",
    defaultModel: "model-b",
    enabled: false,
    updatedAt: new Date(),
  });
  assert.equal(next?.id, row.id);
  assert.equal(next?.label, "OpenAI (work)");
  assert.equal(next?.defaultModel, "model-b");
  assert.equal(next?.enabled, false);
});

test("deleteByKind returns the id and clears a route that pointed at it", async () => {
  const { store } = fresh();
  const a = await store.insertProvider(provider());
  const b = await store.insertProvider(provider({ provider: "openai", label: "OpenAI" }));
  await store.upsertRoute("voice_agent", a.id, b.id, new Date());
  assert.deepEqual(await store.deleteByKind("anthropic"), { id: a.id });
  const route = await store.getRoute("voice_agent");
  assert.equal(route?.primaryProviderId, null);
  assert.equal(route?.fallbackProviderId, b.id);
  assert.equal((await store.listProviders()).length, 1);
});

test("deleteByKind of an unknown kind returns null", async () => {
  const { store } = fresh();
  assert.equal(await store.deleteByKind("openai"), null);
});

test("getRoute of a purpose that was never set is undefined", async () => {
  const { store } = fresh();
  assert.equal(await store.getRoute("voice_agent"), undefined);
});

test("upsertRoute twice keeps one row with the second values", async () => {
  const { store, sqlite } = fresh();
  const a = await store.insertProvider(provider());
  const b = await store.insertProvider(provider({ provider: "openai", label: "OpenAI" }));
  await store.upsertRoute("voice_agent", a.id, null, new Date("2026-11-18T10:00:00Z"));
  await store.upsertRoute("voice_agent", b.id, a.id, new Date("2026-11-18T11:00:00Z"));
  const n = sqlite.prepare("select count(*) as n from ai_routes").get() as { n: number };
  assert.equal(n.n, 1);
  const route = await store.getRoute("voice_agent");
  assert.equal(route?.primaryProviderId, b.id);
  assert.equal(route?.fallbackProviderId, a.id);
  assert.equal(route?.updatedAt.getTime(), new Date("2026-11-18T11:00:00Z").getTime());
});

test("a route to an unknown provider fails on the foreign key", async () => {
  const { store } = fresh();
  await assert.rejects(() => store.upsertRoute("voice_agent", "no-such-provider", null, new Date()));
});

test("countEnabled counts only the enabled rows", async () => {
  const { store } = fresh();
  assert.equal(await store.countEnabled(), 0);
  await store.insertProvider(provider());
  await store.insertProvider(provider({ provider: "openai", label: "OpenAI" }));
  assert.equal(await store.countEnabled(), 2);
  await store.updateProviderByKind("openai", { enabled: false, updatedAt: new Date() });
  assert.equal(await store.countEnabled(), 1);
});

test("createdBy points at a real user, or fails on the foreign key", async () => {
  const { store, client } = fresh();
  const [u] = await client.insert(users).values({ email: "owner@example.com", role: "admin" } as never).returning({ id: users.id });
  const row = await store.insertProvider(provider({ createdBy: u.id }));
  assert.equal(row.createdBy, u.id);
  await assert.rejects(() => store.insertProvider(provider({ provider: "openai", createdBy: "no-such-user" })));
});
