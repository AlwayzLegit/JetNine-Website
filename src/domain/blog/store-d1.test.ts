import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { d1BlogStore } from "./store-d1";

// OPS-109: contract tests for the D1 blog store, on a real SQLite (node:sqlite)
// with the repo's own D1 migration applied, so the CHECKs, the unique indexes
// and the stored forms (JSON text, UTC milliseconds) are the real ones.

function freshStore() {
  const sqlite = new DatabaseSync(":memory:");
  const migration = readFileSync(new URL("../../db/d1/migrations/0000_fair_proteus.sql", import.meta.url), "utf8");
  for (const stmt of migration.split("--> statement-breakpoint")) {
    if (stmt.trim()) sqlite.exec(stmt);
  }
  const client = drizzle(
    async (query, params, method) => {
      const stmt = sqlite.prepare(query);
      if (method === "run") {
        stmt.run(...(params as never[]));
        return { rows: [] };
      }
      stmt.setReturnArrays(true);
      const bound = params as never[];
      if (method === "get") {
        const row = stmt.get(...bound) as unknown[] | undefined;
        return { rows: row as never };
      }
      return { rows: stmt.all(...bound) as unknown as unknown[][] };
    },
  ) as unknown as DrizzleD1Database;
  return { sqlite, store: d1BlogStore(client) };
}

const post = (slug: string, over: Record<string, unknown> = {}) => ({
  slug,
  title: `Title ${slug}`,
  description: `Description ${slug}`,
  bodyMd: "Body",
  tags: ["jets", "Safety"],
  faq: [{ q: "Q?", a: "A." }],
  status: "published" as const,
  publishedAt: new Date("2026-11-01T12:00:00Z"),
  ...over,
});

test("insert then bySlug round-trips tags, faq and publishedAt as a Date", async () => {
  const { store } = freshStore();
  const created = await store.insertPost(post("one"));
  assert.ok(created.id.length > 10);
  const got = await store.bySlug("one");
  assert.deepEqual(got?.tags, ["jets", "Safety"]);
  assert.deepEqual(got?.faq, [{ q: "Q?", a: "A." }]);
  assert.ok(got?.publishedAt instanceof Date);
  assert.equal(got?.publishedAt?.toISOString(), "2026-11-01T12:00:00.000Z");
  assert.equal(got?.author, "JetNine dispatch desk");
  assert.ok(got?.createdAt instanceof Date);
});

test("a second insert with the same slug fails on the unique index", async () => {
  const { store } = freshStore();
  await store.insertPost(post("dup"));
  await assert.rejects(() => store.insertPost(post("dup")));
  assert.equal(await store.slugTaken("dup"), true);
  assert.equal(await store.slugTaken("free"), false);
});

test("the status CHECK refuses a value outside the enum", async () => {
  const { store } = freshStore();
  await assert.rejects(() => store.insertPost(post("bad", { status: "bogus" })));
});

test("publishedPosts holds only published posts, newest first", async () => {
  const { store } = freshStore();
  await store.insertPost(post("old", { publishedAt: new Date("2026-10-01T00:00:00Z") }));
  await store.insertPost(post("new", { publishedAt: new Date("2026-11-10T00:00:00Z") }));
  await store.insertPost(post("draft", { status: "draft", publishedAt: null }));
  const list = await store.publishedPosts();
  assert.deepEqual(list.map((p) => p.slug), ["new", "old"]);
  assert.equal((await store.sitemapPosts()).length, 2);
  assert.equal(await store.publishedPost("draft"), undefined);
  assert.equal((await store.publishedPost("new"))?.slug, "new");
});

test("a published post with no publishedAt sorts first, as it does on Postgres", async () => {
  const { store } = freshStore();
  await store.insertPost(post("dated"));
  await store.insertPost(post("undated", { publishedAt: null }));
  assert.deepEqual((await store.publishedPosts()).map((p) => p.slug), ["undated", "dated"]);
});

test("otherPublished leaves out the given post and honours the limit", async () => {
  const { store } = freshStore();
  const a = await store.insertPost(post("a", { publishedAt: new Date("2026-11-01T00:00:00Z") }));
  await store.insertPost(post("b", { publishedAt: new Date("2026-11-02T00:00:00Z") }));
  await store.insertPost(post("c", { publishedAt: new Date("2026-11-03T00:00:00Z") }));
  const others = await store.otherPublished(a.id, 1);
  assert.deepEqual(others.map((p) => p.slug), ["c"]);
});

test("updatePost changes only what it is given and returns the row; deletePost removes it", async () => {
  const { store } = freshStore();
  const created = await store.insertPost(post("upd"));
  const updated = await store.updatePost(created.id, { title: "New title", tags: ["x"], updatedAt: new Date() });
  assert.equal(updated.title, "New title");
  assert.deepEqual(updated.tags, ["x"]);
  assert.equal(updated.description, "Description upd");
  assert.equal((await store.summaries()).length, 1);
  await store.deletePost(created.id);
  assert.equal(await store.bySlug("upd"), undefined);
});

test("publishedSince excludes older posts and drafts", async () => {
  const { store } = freshStore();
  await store.insertPost(post("recent", { publishedAt: new Date("2026-11-10T00:00:00Z") }));
  await store.insertPost(post("stale", { publishedAt: new Date("2026-10-01T00:00:00Z") }));
  await store.insertPost(post("draft", { status: "draft", publishedAt: new Date("2026-11-11T00:00:00Z") }));
  const rows = await store.publishedSince(new Date("2026-11-03T00:00:00Z"), 7);
  assert.deepEqual(rows.map((r) => r.slug), ["recent"]);
});

test("byEmail finds a subscriber whatever the case of the stored address", async () => {
  const { store } = freshStore();
  const now = new Date();
  await store.insertPendingSubscriber({ email: "MIXED@Case.com", hash: "h1", expiresAt: new Date(now.getTime() + 1000), sentAt: now });
  const found = await store.subscriberByEmail("mixed@case.com");
  assert.equal(found?.status, "pending");
  assert.ok(found?.confirmSentAt instanceof Date);
  assert.equal(await store.subscriberByEmail("nobody@case.com"), undefined);
});

test("the subscriber lifecycle: confirm by hash, unsubscribe by token, opt back in", async () => {
  const { store, sqlite } = freshStore();
  const now = new Date("2026-11-16T00:00:00Z");
  await store.insertPendingSubscriber({ email: "a@b.co", hash: "hash-a", expiresAt: new Date(now.getTime() + 3600_000), sentAt: now });
  const row = await store.subscriberByConfirmHash("hash-a");
  assert.ok(row);
  assert.equal(row.expiresAt?.toISOString(), "2026-11-16T01:00:00.000Z");
  await store.confirmSubscriber(row.id, now);
  assert.equal(await store.subscriberByConfirmHash("hash-a"), undefined);
  assert.equal((await store.subscriberByEmail("a@b.co"))?.status, "confirmed");

  const { unsubscribe_token } = sqlite.prepare("select unsubscribe_token from blog_subscribers").get() as { unsubscribe_token: string };
  assert.equal(unsubscribe_token.length, 48);
  await store.unsubscribeByToken(unsubscribe_token, now);
  assert.equal((await store.subscriberByEmail("a@b.co"))?.status, "unsubscribed");

  await store.resetSubscriberToPending(row.id, { hash: "hash-b", expiresAt: new Date(now.getTime() + 3600_000), sentAt: now });
  assert.equal((await store.subscriberByEmail("a@b.co"))?.status, "pending");
  assert.ok(await store.subscriberByConfirmHash("hash-b"));
});

test("a subscriber status outside the enum is refused", () => {
  const { sqlite } = freshStore();
  assert.throws(() =>
    sqlite
      .prepare("insert into blog_subscribers (id, email, status, unsubscribe_token, source, created_at, updated_at) values ('x','x@y.z','bogus','t','blog',0,0)")
      .run(),
  );
});

test("claimDigest takes only confirmed rows older than the cutoff, at most the limit, oldest first, and a second claim takes none", async () => {
  const { store, sqlite } = freshStore();
  const t0 = new Date("2026-11-01T00:00:00Z").getTime();
  const add = (id: string, email: string, status: string, createdOffset: number, last: number | null) =>
    sqlite
      .prepare(
        "insert into blog_subscribers (id, email, status, unsubscribe_token, source, created_at, updated_at, last_digest_at) values (?,?,?,?,?,?,?,?)",
      )
      .run(id, email, status, `tok-${id}`, "blog", t0 + createdOffset, t0, last);
  const day = 24 * 3600_000;
  const now = new Date("2026-11-16T12:00:00Z");
  const cutoff = new Date(now.getTime() - 6 * day);
  add("s1", "one@x.co", "confirmed", 1, null);
  add("s2", "two@x.co", "confirmed", 2, now.getTime() - 7 * day); // old enough
  add("s3", "three@x.co", "confirmed", 3, now.getTime() - 2 * day); // too recent
  add("s4", "four@x.co", "pending", 4, null);
  add("s5", "five@x.co", "unsubscribed", 5, null);
  add("s6", "six@x.co", "confirmed", 6, null);

  const first = await store.claimDigest(cutoff, 2, now);
  assert.deepEqual(first.map((r) => r.id), ["s1", "s2"]);
  assert.equal(first[0].unsubscribeToken, "tok-s1");
  assert.equal(first[0].email, "one@x.co");

  const second = await store.claimDigest(cutoff, 10, now);
  assert.deepEqual(second.map((r) => r.id), ["s6"]);
  const third = await store.claimDigest(cutoff, 10, now);
  assert.deepEqual(third, []);
});
