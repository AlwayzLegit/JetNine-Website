import test from "node:test";
import assert from "node:assert/strict";
import { freshD1 } from "@/db/d1/test-client";
import { members } from "@/db/d1/schema/members";
import { quotes } from "@/db/d1/schema/quotes";
import { trips } from "@/db/d1/schema/trips";
import { users } from "@/db/d1/schema/users";
import { d1ApiKeyStore } from "@/lib/api-key-store/store-d1";
import { d1AgentStore } from "./store-d1";
import type { NewItem } from "./store";

// OPS-142: contract tests for the D1 agent store (playbooks, runs, run items, memory), on a real
// SQLite with the repo's own D1 migrations applied and foreign keys on, as D1 has them. The
// conditional statements that replace the three Postgres advisory locks are the point: the caps
// and the one-open-flag rule hold even when two adds start together.

function fresh() {
  const { sqlite, client } = freshD1();
  return { sqlite, client, store: d1AgentStore(client) };
}
type Fresh = ReturnType<typeof fresh>;

async function user(client: Fresh["client"]) {
  const [u] = await client
    .insert(users)
    .values({ email: `u${Math.random().toString(36).slice(2)}@example.com`, role: "admin" } as never)
    .returning({ id: users.id });
  return u.id;
}

let k = 0;
async function key(client: Fresh["client"], createdBy: string) {
  k += 1;
  const made = await d1ApiKeyStore(client).createIfUnderCap(
    {
      name: `Key ${k}`,
      prefix: `agt${String(k).padStart(5, "0")}`,
      tokenHash: `hash-${k}`,
      last4: "abcd",
      scopes: ["read"],
      requiresApproval: false,
      createdBy,
      expiresAt: null,
    },
    25,
  );
  assert.ok(made);
  return made.id;
}

const item = (over: Partial<NewItem> = {}): NewItem => ({ kind: "note", title: "A note", ...over });
const DAY = 86_400_000;

// ─── Runs ────────────────────────────────────────────────────────────────

test("two opens for one key: the second is refused as a conflict, and the first is still the open run", async () => {
  const { client, store } = fresh();
  const keyId = await key(client, await user(client));
  const first = await store.insertRun({ runDate: "2026-11-17", keyId, playbookVersion: 0 });
  assert.equal(first.conflict, false);
  assert.ok(first.run && first.run.id.length > 0);
  assert.equal(first.run.status, "open");
  assert.ok(first.run.startedAt instanceof Date);
  const second = await store.insertRun({ runDate: "2026-11-17", keyId, playbookVersion: 0 });
  assert.equal(second.conflict, true);
  assert.equal((await store.openRunForKey(keyId))?.id, first.run!.id);
  assert.equal(await store.runIsOpenForKey(first.run!.id, keyId), true);
});

test("runs of a person (no key) are not limited to one open run", async () => {
  const { store } = fresh();
  assert.equal((await store.insertRun({ runDate: "2026-11-17", keyId: null, playbookVersion: 0 })).conflict, false);
  assert.equal((await store.insertRun({ runDate: "2026-11-17", keyId: null, playbookVersion: 0 })).conflict, false);
});

test("closing a run frees the key for the next one, and the report reads back as an object", async () => {
  const { client, store } = fresh();
  const keyId = await key(client, await user(client));
  const { run } = await store.insertRun({ runDate: "2026-11-16", keyId, playbookVersion: 1 });
  const report = { jobs: [{ slug: "posts", did: "Checked" }], errors: [] as string[] };
  const closed = await store.closeRun(run!.id, { closedAt: new Date("2026-11-16T20:00:00Z"), summaryMd: "Done", report, metrics: { posts: 2 } });
  assert.equal(closed.status, "closed");
  assert.deepEqual(closed.report, report);
  assert.deepEqual(closed.metrics, { posts: 2 });
  assert.equal(await store.runIsOpenForKey(run!.id, keyId), false);
  assert.equal((await store.insertRun({ runDate: "2026-11-17", keyId, playbookVersion: 1 })).conflict, false);
});

test("a run failed with a reason keeps the report; one left open is closed as failed", async () => {
  const { store } = fresh();
  const { run: a } = await store.insertRun({ runDate: "2026-11-17", keyId: null, playbookVersion: 0 });
  const failed = await store.failRun(a!.id, { closedAt: new Date(), summaryMd: "Broke", report: { jobs: [], errors: ["Broke"] } });
  assert.equal(failed.status, "failed");
  assert.deepEqual(failed.report, { jobs: [], errors: ["Broke"] });
  const { run: b } = await store.insertRun({ runDate: "2026-11-17", keyId: null, playbookVersion: 0 });
  await store.failRunLeftOpen(b!.id, new Date(), "Left open; closed automatically when the next run started.");
  assert.equal((await store.getRun(b!.id))?.status, "failed");
});

test("failStaleRuns closes runs open for more than the cutoff and leaves fresh and closed ones", async () => {
  const { client, sqlite, store } = fresh();
  const keyOld = await key(client, await user(client));
  const keyNew = await key(client, await user(client));
  const old = (await store.insertRun({ runDate: "2026-11-15", keyId: keyOld, playbookVersion: 0 })).run!;
  const young = (await store.insertRun({ runDate: "2026-11-17", keyId: keyNew, playbookVersion: 0 })).run!;
  const now = new Date("2026-11-17T12:00:00Z");
  sqlite.prepare("update agent_runs set started_at = ? where id = ?").run(now.getTime() - 30 * 3_600_000, old.id);
  sqlite.prepare("update agent_runs set started_at = ? where id = ?").run(now.getTime() - 2 * 3_600_000, young.id);
  assert.equal(await store.failStaleRuns(new Date(now.getTime() - 24 * 3_600_000), now), 1);
  const swept = await store.getRun(old.id);
  assert.equal(swept?.status, "failed");
  assert.equal(swept?.summaryMd, "Left open; closed automatically.");
  assert.equal(swept?.closedAt?.getTime(), now.getTime());
  assert.equal((await store.getRun(young.id))?.status, "open");
  assert.equal(await store.failStaleRuns(new Date(now.getTime() - 24 * 3_600_000), now), 0, "nothing left to sweep");
});

test("listRunsWithCounts: newest first, item counts as numbers, and the limit", async () => {
  const { store } = fresh();
  const a = (await store.insertRun({ runDate: "2026-11-15", keyId: null, playbookVersion: 0 })).run!;
  const b = (await store.insertRun({ runDate: "2026-11-17", keyId: null, playbookVersion: 0 })).run!;
  await store.addItemGuarded(b.id, item(), 100);
  await store.addItemGuarded(b.id, item({ title: "Another" }), 100);
  const rows = await store.listRunsWithCounts(10);
  assert.deepEqual(rows.map((r) => [r.id, r.itemCount]), [[b.id, 2], [a.id, 0]]);
  assert.equal(typeof rows[0].itemCount, "number");
  assert.ok(rows[0].startedAt instanceof Date);
  assert.equal((await store.listRunsWithCounts(1)).length, 1);
});

test("closedRunDatesSince lists each closed day once and ignores open and older runs", async () => {
  const { store } = fresh();
  const report = { jobs: [], errors: [] as string[] };
  for (const [d, close] of [["2026-11-14", true], ["2026-11-16", true], ["2026-11-16", true], ["2026-11-17", false]] as const) {
    const { run } = await store.insertRun({ runDate: d, keyId: null, playbookVersion: 0 });
    if (close) await store.closeRun(run!.id, { closedAt: new Date(), summaryMd: "x", report, metrics: null });
  }
  assert.deepEqual((await store.closedRunDatesSince("2026-11-15")).sort(), ["2026-11-16"]);
});

// ─── Run items ───────────────────────────────────────────────────────────

test("the run holds at most the cap: 100 items then the next is refused as cap", async () => {
  const { store } = fresh();
  const run = (await store.insertRun({ runDate: "2026-11-17", keyId: null, playbookVersion: 0 })).run!;
  for (let i = 0; i < 100; i++) {
    const r = await store.addItemGuarded(run.id, item({ title: `Item ${i}` }), 100);
    assert.equal(r.ok, true, `item ${i}`);
  }
  assert.deepEqual(await store.addItemGuarded(run.id, item({ title: "One too many" }), 100), { ok: false, reason: "cap" });
  const other = (await store.insertRun({ runDate: "2026-11-17", keyId: null, playbookVersion: 0 })).run!;
  assert.equal((await store.addItemGuarded(other.id, item(), 100)).ok, true, "the cap is per run");
});

test("two flags on one subject started together: one lands, the other is refused and names the first", async () => {
  const { store } = fresh();
  const run = (await store.insertRun({ runDate: "2026-11-17", keyId: null, playbookVersion: 0 })).run!;
  const flag = (title: string): NewItem => ({ kind: "flag", subjectType: "quote", subjectId: "q-1", subjectCode: "R-1", title });
  const [a, b] = await Promise.all([store.addItemGuarded(run.id, flag("First"), 100), store.addItemGuarded(run.id, flag("Second"), 100)]);
  const landed = [a, b].filter((r) => r.ok);
  const refused = [a, b].filter((r) => !r.ok);
  assert.equal(landed.length, 1);
  assert.equal(refused.length, 1);
  const first = landed[0] as Extract<typeof a, { ok: true }>;
  assert.deepEqual(refused[0], { ok: false, reason: "flag", itemId: first.item.id });
  assert.equal((await store.openFlags()).length, 1);
});

test("an open flag on a subject blocks a flag from another run, a dismissed one does not, other kinds are not limited", async () => {
  const { client, store } = fresh();
  const who = await user(client);
  const r1 = (await store.insertRun({ runDate: "2026-11-16", keyId: null, playbookVersion: 0 })).run!;
  const r2 = (await store.insertRun({ runDate: "2026-11-17", keyId: null, playbookVersion: 0 })).run!;
  const flag: NewItem = { kind: "flag", subjectType: "trip", subjectId: "t-1", title: "Look at this" };
  const first = await store.addItemGuarded(r1.id, flag, 100);
  assert.equal(first.ok, true);
  const blocked = await store.addItemGuarded(r2.id, flag, 100);
  assert.equal(blocked.ok, false);
  assert.equal((blocked as { reason: string }).reason, "flag");
  assert.equal((await store.addItemGuarded(r2.id, { ...flag, kind: "note" }, 100)).ok, true, "a note on the same subject is fine");
  assert.equal((await store.addItemGuarded(r2.id, { kind: "flag", title: "No subject" }, 100)).ok, true);
  assert.equal((await store.addItemGuarded(r2.id, { kind: "flag", title: "No subject either" }, 100)).ok, true, "a flag without a subject is not deduplicated");
  const id = (first as { item: { id: string } }).item.id;
  const dismissed = await store.dismissItem(id, who, new Date("2026-11-17T10:00:00Z"));
  assert.equal(dismissed?.status, "dismissed");
  assert.equal(dismissed?.dismissedBy, who);
  assert.equal(await store.dismissItem(id, who, new Date()), undefined, "dismissing twice finds nothing open");
  assert.equal((await store.addItemGuarded(r2.id, flag, 100)).ok, true, "a dismissed flag no longer blocks");
});

test("an item reads back with its fields, a Date and an open status; the table's own refusals hold", async () => {
  const { sqlite, store } = fresh();
  const run = (await store.insertRun({ runDate: "2026-11-17", keyId: null, playbookVersion: 0 })).run!;
  const added = await store.addItemGuarded(run.id, { kind: "draft", subjectType: "quote", subjectId: "q-9", subjectCode: "R-9", title: "Draft", bodyMd: "Body", url: "https://example.com/x" }, 100);
  assert.ok(added.ok);
  const it = (added as { item: Record<string, unknown> }).item;
  assert.equal(it.status, "open");
  assert.equal(it.bodyMd, "Body");
  assert.equal(it.url, "https://example.com/x");
  assert.ok(it.createdAt instanceof Date);
  // The CHECK on title length still holds on D1 (an empty title is refused).
  await assert.rejects(() => store.addItemGuarded(run.id, { kind: "note", title: "" }, 100));
  assert.equal((sqlite.prepare("select count(*) as n from agent_run_items").get() as { n: number }).n, 1);
});

test("itemsForSubject: newest first, open only unless asked, with the run date; getRunWithItems keeps item order", async () => {
  const { client, store } = fresh();
  const who = await user(client);
  const run = (await store.insertRun({ runDate: "2026-11-17", keyId: null, playbookVersion: 0 })).run!;
  const sub = { subjectType: "quote", subjectId: "q-5" };
  const first = await store.addItemGuarded(run.id, item({ ...sub, title: "First" }), 100);
  await new Promise((r) => setTimeout(r, 5));
  const second = await store.addItemGuarded(run.id, item({ ...sub, title: "Second" }), 100);
  await store.addItemGuarded(run.id, item({ subjectType: "quote", subjectId: "q-other", title: "Elsewhere" }), 100);
  assert.deepEqual((await store.itemsForSubject("quote", "q-5", false)).map((i) => i.title), ["Second", "First"]);
  await store.dismissItem((first as { item: { id: string } }).item.id, who, new Date());
  assert.deepEqual((await store.itemsForSubject("quote", "q-5", false)).map((i) => i.title), ["Second"]);
  const all = await store.itemsForSubject("quote", "q-5", true);
  assert.deepEqual(all.map((i) => i.title), ["Second", "First"]);
  assert.equal(all[0].runDate, "2026-11-17");
  assert.ok(all[0].createdAt instanceof Date);
  assert.ok(all[1].dismissedAt instanceof Date);
  const detail = await store.getRunWithItems(run.id);
  assert.deepEqual(detail?.items.map((i) => i.title), ["First", "Second", "Elsewhere"]);
  assert.equal(await store.getRunWithItems("nope"), undefined);
  void second;
});

test("openFlags returns only open flags, newest first, with the run id", async () => {
  const { client, store } = fresh();
  const who = await user(client);
  const run = (await store.insertRun({ runDate: "2026-11-17", keyId: null, playbookVersion: 0 })).run!;
  const a = await store.addItemGuarded(run.id, { kind: "flag", subjectType: "quote", subjectId: "q-1", title: "A" }, 100);
  await new Promise((r) => setTimeout(r, 5));
  await store.addItemGuarded(run.id, { kind: "flag", subjectType: "trip", subjectId: "t-1", title: "B" }, 100);
  await store.addItemGuarded(run.id, item({ title: "Not a flag" }), 100);
  assert.deepEqual((await store.openFlags()).map((f) => f.title), ["B", "A"]);
  assert.equal((await store.openFlags())[0].runId, run.id);
  await store.dismissItem((a as { item: { id: string } }).item.id, who, new Date());
  assert.deepEqual((await store.openFlags()).map((f) => f.title), ["B"]);
});

// ─── Memory ──────────────────────────────────────────────────────────────

const memory = (over: Record<string, unknown> = {}) => ({
  kind: "fact" as const,
  body: "A fact",
  pinned: false,
  author: "owner" as const,
  sourceRunId: null,
  createdBy: null,
  ...over,
});

test("memory at the cap is refused as full; archiving frees a place", async () => {
  const { store } = fresh();
  const rows = [];
  for (let i = 0; i < 3; i++) {
    const r = await store.addMemoryGuarded(memory({ body: `Fact ${i}` }), 3, null);
    assert.equal(r.ok, true);
    rows.push((r as { row: { id: string } }).row);
  }
  assert.deepEqual(await store.addMemoryGuarded(memory({ body: "Too many" }), 3, null), { ok: false, reason: "full" });
  await store.updateMemory(rows[0].id, { archived: true }, new Date());
  assert.equal((await store.addMemoryGuarded(memory({ body: "Fits now" }), 3, null)).ok, true);
});

test("the assistant's sixth item in one run is refused; an owner's items are not counted; another run starts at zero", async () => {
  const { client, store } = fresh();
  const who = await user(client);
  const run = (await store.insertRun({ runDate: "2026-11-17", keyId: null, playbookVersion: 0 })).run!;
  const run2 = (await store.insertRun({ runDate: "2026-11-17", keyId: null, playbookVersion: 0 })).run!;
  const byAgent = (runId: string, n: number) => memory({ body: `Agent ${n}`, author: "agent", sourceRunId: runId, createdBy: who });
  for (let i = 0; i < 5; i++) assert.equal((await store.addMemoryGuarded(byAgent(run.id, i), 200, { runId: run.id, max: 5 })).ok, true);
  assert.equal(await store.memoryAddedInRun(run.id), 5);
  assert.deepEqual(await store.addMemoryGuarded(byAgent(run.id, 6), 200, { runId: run.id, max: 5 }), { ok: false, reason: "perRun" });
  assert.equal((await store.addMemoryGuarded(memory({ body: "Owner's", sourceRunId: run.id, createdBy: who }), 200, null)).ok, true, "an owner is not held to the per-run cap");
  assert.equal(await store.memoryAddedInRun(run.id), 5, "the owner's item is not the assistant's");
  assert.equal((await store.addMemoryGuarded(byAgent(run2.id, 1), 200, { runId: run2.id, max: 5 })).ok, true);
});

test("when both caps would refuse, the memory cap is named first, as on Postgres", async () => {
  const { store } = fresh();
  const run = (await store.insertRun({ runDate: "2026-11-17", keyId: null, playbookVersion: 0 })).run!;
  for (let i = 0; i < 2; i++) await store.addMemoryGuarded(memory({ author: "agent", sourceRunId: run.id, body: `F${i}` }), 2, { runId: run.id, max: 2 });
  assert.deepEqual(await store.addMemoryGuarded(memory({ author: "agent", sourceRunId: run.id, body: "X" }), 2, { runId: run.id, max: 2 }), { ok: false, reason: "full" });
});

test("memory reads back with a boolean pinned and Dates; list order is pinned then newest; archived are hidden unless asked", async () => {
  const { store } = fresh();
  const a = await store.addMemoryGuarded(memory({ body: "Plain" }), 200, null);
  await new Promise((r) => setTimeout(r, 5));
  const b = await store.addMemoryGuarded(memory({ body: "Pinned", pinned: true }), 200, null);
  await new Promise((r) => setTimeout(r, 5));
  const c = await store.addMemoryGuarded(memory({ body: "Newest" }), 200, null);
  const row = (b as { row: { pinned: unknown; createdAt: unknown; archivedAt: unknown } }).row;
  assert.strictEqual(row.pinned, true);
  assert.ok(row.createdAt instanceof Date);
  assert.equal(row.archivedAt, null);
  assert.deepEqual((await store.listMemory(false)).map((m) => m.body), ["Pinned", "Newest", "Plain"]);
  await store.updateMemory((a as { row: { id: string } }).row.id, { archived: true }, new Date());
  assert.deepEqual((await store.listMemory(false)).map((m) => m.body), ["Pinned", "Newest"]);
  assert.deepEqual((await store.listMemory(true)).map((m) => m.body).sort(), ["Newest", "Pinned", "Plain"]);
  void c;
});

test("updateMemory changes only what is given and stamps updated_at; un-archiving clears the stamp", async () => {
  const { store } = fresh();
  const added = (await store.addMemoryGuarded(memory({ body: "Old", pinned: true }), 200, null)) as { row: { id: string; updatedAt: Date } };
  const at = new Date(added.row.updatedAt.getTime() + 60_000);
  const edited = await store.updateMemory(added.row.id, { body: "New" }, at);
  assert.equal(edited.body, "New");
  assert.strictEqual(edited.pinned, true, "pinned is untouched");
  assert.equal(edited.updatedAt.getTime(), at.getTime());
  const archived = await store.updateMemory(added.row.id, { archived: true, pinned: false }, at);
  assert.equal(archived.archivedAt?.getTime(), at.getTime());
  assert.strictEqual(archived.pinned, false);
  assert.equal((await store.updateMemory(added.row.id, { archived: false }, at)).archivedAt, null);
  assert.equal((await store.getMemory(added.row.id))?.body, "New");
  assert.equal(await store.getMemory("nope"), undefined);
});

// ─── Playbook ────────────────────────────────────────────────────────────

test("two playbook saves give versions 1 and 2; the latest and the version list follow", async () => {
  const { client, store } = fresh();
  const who = await user(client);
  assert.equal(await store.latestPlaybook(), undefined);
  assert.equal(await store.savePlaybookNextVersion({ generalMd: "One", jobs: [], note: null, createdBy: who }), 1);
  assert.equal(await store.savePlaybookNextVersion({ generalMd: "Two", jobs: [], note: "second", createdBy: who }), 2);
  const latest = await store.latestPlaybook();
  assert.equal(latest?.version, 2);
  assert.equal(latest?.generalMd, "Two");
  assert.deepEqual(latest?.jobs, []);
  assert.ok(latest?.createdAt instanceof Date);
  const versions = await store.listPlaybookVersions(20);
  assert.deepEqual(versions.map((v) => [v.version, v.note]), [[2, "second"], [1, null]]);
  assert.equal((await store.listPlaybookVersions(1)).length, 1);
});

test("two playbook saves started together get different versions", async () => {
  const { client, store } = fresh();
  const who = await user(client);
  const [a, b] = await Promise.all([
    store.savePlaybookNextVersion({ generalMd: "A", jobs: [], note: null, createdBy: who }),
    store.savePlaybookNextVersion({ generalMd: "B", jobs: [], note: null, createdBy: who }),
  ]);
  assert.deepEqual([a, b].sort(), [1, 2]);
});

test("a playbook's jobs read back as an array of objects", async () => {
  const { client, store } = fresh();
  const who = await user(client);
  const jobs = [{ slug: "posts", title: "Posts", cadence: "daily", enabled: true, instructionsMd: "Do it" }];
  await store.savePlaybookNextVersion({ generalMd: "G", jobs: jobs as never, note: null, createdBy: who });
  assert.deepEqual((await store.latestPlaybook())?.jobs, jobs);
});

void DAY;

test("subjectStatuses reads the status of quotes and trips, 120 ids across the chunks, and empty lists run no query", async () => {
  const { client, store } = fresh();
  // Empty lists give empty results.
  assert.deepEqual(await store.subjectStatuses([], []), { quotes: [], trips: [] });

  const quoteIds: string[] = [];
  for (let i = 0; i < 60; i++) {
    const [q] = await client
      .insert(quotes)
      .values({
        quoteCode: `JN-2026-${String(1000 + i).padStart(4, "0")}`,
        tripType: "one_way",
        paxCount: 1,
        status: i % 2 === 0 ? "submitted" : "triaged",
        contactSnapshot: { firstName: "A", lastName: "B", email: "a@example.com" },
      } as never)
      .returning({ id: quotes.id });
    quoteIds.push(q.id);
  }
  const [u] = await client.insert(users).values({ email: "m@example.com" } as never).returning({ id: users.id });
  const [mem] = await client.insert(members).values({ userId: u.id, memberCode: "M-1" } as never).returning({ id: members.id });
  const tripIds: string[] = [];
  for (let i = 0; i < 60; i++) {
    const [t] = await client
      .insert(trips)
      .values({ tripCode: `JN-2026-${String(2000 + i).padStart(4, "0")}`, memberId: mem.id, missionType: "one_way", paxCount: 1, status: "confirmed" } as never)
      .returning({ id: trips.id });
    tripIds.push(t.id);
  }
  const got = await store.subjectStatuses([...quoteIds, "no-such-quote"], [...tripIds, "no-such-trip"]);
  assert.equal(got.quotes.length, 60);
  assert.equal(got.trips.length, 60);
  const byId = new Map(got.quotes.map((r) => [r.id, r.status]));
  assert.equal(byId.get(quoteIds[0]), "submitted");
  assert.equal(byId.get(quoteIds[1]), "triaged");
  assert.ok(got.trips.every((r) => r.status === "confirmed"));
  // One kind alone.
  assert.equal((await store.subjectStatuses(quoteIds.slice(0, 3), [])).trips.length, 0);
});
