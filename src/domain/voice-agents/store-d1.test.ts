import test from "node:test";
import assert from "node:assert/strict";
import { freshD1WithBatch } from "@/db/d1/test-batch-client";
import { users } from "@/db/d1/schema/users";
import { d1VoiceAgentStore } from "./store-d1";

// OPS-126: contract tests for the D1 voice agent store (voice_agents and
// voice_agent_versions), on a real SQLite with the repo's own D1 migrations
// applied, foreign keys on and db.batch() atomic, as D1 has them.

function fresh() {
  const { sqlite, client } = freshD1WithBatch();
  return { sqlite, client, store: d1VoiceAgentStore(client) };
}

async function user(
  client: ReturnType<typeof fresh>["client"],
  email: string,
  names: { firstName?: string; lastName?: string } = {},
) {
  const [u] = await client.insert(users).values({ email, role: "admin", ...names } as never).returning({ id: users.id });
  return u.id;
}

const config = (greeting: string) => ({ greeting, voice: "alloy" });

const newAgent = (over: Record<string, unknown> = {}) => ({
  name: "Front desk",
  description: null as string | null,
  config: config("Hello"),
  createdBy: null as string | null,
  note: "Created from the defaults",
  ...over,
});

const patch = (version: number, over: Record<string, unknown> = {}) => ({
  name: "Front desk",
  description: null as string | null,
  config: config(`Hello v${version}`),
  version,
  updatedBy: null as string | null,
  updatedAt: new Date("2026-11-17T12:00:00Z"),
  note: null as string | null,
  ...over,
});

function counts(sqlite: ReturnType<typeof fresh>["sqlite"]) {
  const a = sqlite.prepare("select count(*) as n from voice_agents").get() as { n: number };
  const v = sqlite.prepare("select count(*) as n from voice_agent_versions").get() as { n: number };
  return { agents: a.n, versions: v.n };
}

test("createAgent writes the agent and version 1 together and returns a uuid", async () => {
  const { store, sqlite } = fresh();
  const id = await store.createAgent(newAgent({ description: "Answers the main line" }));
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.deepEqual(counts(sqlite), { agents: 1, versions: 1 });
  const agent = await store.getAgent(id);
  assert.equal(agent?.name, "Front desk");
  assert.equal(agent?.description, "Answers the main line");
  assert.equal(agent?.version, 1);
  assert.equal(agent?.isLive, false);
  assert.equal(agent?.archivedAt, null);
  assert.ok(agent?.updatedAt instanceof Date);
  assert.deepEqual(agent?.config, config("Hello"));
  assert.deepEqual(await store.versionConfig(id, 1), config("Hello"));
});

test("createAgent with an unknown author writes nothing", async () => {
  const { store, sqlite } = fresh();
  // An unknown author breaks the foreign key; nothing is left behind, in either table.
  await assert.rejects(() => store.createAgent(newAgent({ createdBy: "no-such-user" })));
  assert.deepEqual(counts(sqlite), { agents: 0, versions: 0 });
});

test("getAgent of an unknown id is undefined", async () => {
  const { store } = fresh();
  assert.equal(await store.getAgent("00000000-0000-4000-8000-000000000000"), undefined);
});

test("saveAgent with the right version writes version 2 and its version row", async () => {
  const { store, sqlite } = fresh();
  const id = await store.createAgent(newAgent());
  const out = await store.saveAgent(id, 1, patch(2, { name: "Renamed", note: "Shorter greeting" }), null);
  assert.equal(out, "ok");
  assert.deepEqual(counts(sqlite), { agents: 1, versions: 2 });
  const agent = await store.getAgent(id);
  assert.equal(agent?.version, 2);
  assert.equal(agent?.name, "Renamed");
  assert.deepEqual(agent?.config, config("Hello v2"));
  assert.equal(agent?.updatedAt.getTime(), new Date("2026-11-17T12:00:00Z").getTime());
  assert.deepEqual(await store.versionConfig(id, 2), config("Hello v2"));
  const versions = await store.listVersions(id, 10);
  assert.deepEqual(
    versions.map((v) => [v.version, v.note]),
    [
      [2, "Shorter greeting"],
      [1, "Created from the defaults"],
    ],
  );
});

test("saveAgent with a stale version returns version-conflict and changes nothing", async () => {
  const { store, sqlite } = fresh();
  const id = await store.createAgent(newAgent());
  assert.equal(await store.saveAgent(id, 1, patch(2), null), "ok");
  // A second save that still believes the agent is at version 1.
  const out = await store.saveAgent(id, 1, patch(2, { name: "Stale", config: config("Stale") }), null);
  assert.equal(out, "version-conflict");
  assert.deepEqual(counts(sqlite), { agents: 1, versions: 2 });
  const agent = await store.getAgent(id);
  assert.equal(agent?.version, 2);
  assert.equal(agent?.name, "Front desk");
  assert.deepEqual(agent?.config, config("Hello v2"));
  assert.deepEqual(await store.versionConfig(id, 2), config("Hello v2"));
});

test("saveAgent for an unknown agent is a version-conflict and writes no version row", async () => {
  const { store, sqlite } = fresh();
  const out = await store.saveAgent("00000000-0000-4000-8000-000000000000", 1, patch(2), null);
  assert.equal(out, "version-conflict");
  assert.deepEqual(counts(sqlite), { agents: 0, versions: 0 });
});

test("makeLive moves the flag so exactly one agent is live", async () => {
  const { store, sqlite } = fresh();
  const a = await store.createAgent(newAgent({ name: "A" }));
  const b = await store.createAgent(newAgent({ name: "B" }));
  await store.makeLive(a, null, new Date("2026-11-17T12:00:00Z"));
  await store.makeLive(b, null, new Date("2026-11-17T12:05:00Z"));
  const live = sqlite.prepare("select id from voice_agents where is_live = 1").all() as { id: string }[];
  assert.deepEqual(live.map((r) => r.id), [b]);
  assert.equal((await store.getAgent(a))?.isLive, false);
  assert.equal((await store.getAgent(b))?.isLive, true);
});

test("setArchived sets and clears archivedAt, and listAgents hides archived agents unless asked", async () => {
  const { store } = fresh();
  const a = await store.createAgent(newAgent({ name: "A" }));
  const b = await store.createAgent(newAgent({ name: "B" }));
  const when = new Date("2026-11-17T12:00:00Z");
  await store.setArchived(a, when, null, when);
  assert.equal((await store.getAgent(a))?.archivedAt?.getTime(), when.getTime());
  assert.deepEqual((await store.listAgents(false)).map((r) => r.id), [b]);
  assert.deepEqual((await store.listAgents(true)).map((r) => r.name).sort(), ["A", "B"]);
  await store.setArchived(a, null, null, when);
  assert.equal((await store.getAgent(a))?.archivedAt, null);
  assert.equal((await store.listAgents(false)).length, 2);
});

test("listAgents puts the live agent first, then orders by name", async () => {
  const { store } = fresh();
  const b = await store.createAgent(newAgent({ name: "B" }));
  await store.createAgent(newAgent({ name: "C" }));
  await store.createAgent(newAgent({ name: "A" }));
  assert.deepEqual((await store.listAgents(false)).map((r) => r.name), ["A", "B", "C"]);
  await store.makeLive(b, null, new Date());
  assert.deepEqual((await store.listAgents(false)).map((r) => r.name), ["B", "A", "C"]);
  assert.equal((await store.listAgents(false))[0].isLive, true);
});

test("listVersions joins the author's name and email, newest first, and respects the limit", async () => {
  const { store, client } = fresh();
  const ada = await user(client, "ada@example.com", { firstName: "Ada", lastName: "Lovelace" });
  const id = await store.createAgent(newAgent({ createdBy: ada }));
  assert.equal(await store.saveAgent(id, 1, patch(2, { updatedBy: ada }), ada), "ok");
  assert.equal(await store.saveAgent(id, 2, patch(3, { updatedBy: null }), null), "ok");
  const all = await store.listVersions(id, 30);
  assert.deepEqual(all.map((v) => v.version), [3, 2, 1]);
  assert.equal(all[0].firstName, null);
  assert.equal(all[0].email, null);
  assert.equal(all[1].firstName, "Ada");
  assert.equal(all[1].lastName, "Lovelace");
  assert.equal(all[1].email, "ada@example.com");
  assert.ok(all[2].createdAt instanceof Date);
  assert.equal((await store.listVersions(id, 2)).length, 2);
});

test("versionConfig of a version that does not exist is undefined", async () => {
  const { store } = fresh();
  const id = await store.createAgent(newAgent());
  assert.equal(await store.versionConfig(id, 9), undefined);
});
