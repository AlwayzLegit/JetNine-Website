#!/usr/bin/env node
// Publishes one queued blog post to jetnine.com through /api/v1/blog/*.
//
//   node scripts/blog-publisher/publish.mjs <post.json>             real run
//   node scripts/blog-publisher/publish.mjs <post.json> --dry-run   checks only, sends nothing
//   node scripts/blog-publisher/publish.mjs --cap                   print the cap line, exit 1 when refused
//
// The key comes from JETNINE_BLOG_API_KEY and is never printed. The cap
// (CAP posts in WINDOW_DAYS days) is a constant: no flag, env var or queue
// field changes it. Create only: this script never calls PUT or DELETE.
import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const CAP = 3;
export const WINDOW_DAYS = 7;
export const SITE = "https://jetnine.com";
const DAY_MS = 24 * 60 * 60 * 1000;
const DASHES = /[–—]/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Posts counted against the cap: published, dated inside the window (future dates count). */
export function capCheck(posts, now = new Date()) {
  const since = now.getTime() - WINDOW_DAYS * DAY_MS;
  const dates = posts
    .filter((p) => p.status === undefined || p.status === "published")
    .map((p) => (p.publishedAt ? new Date(p.publishedAt).getTime() : NaN))
    .filter((t) => Number.isFinite(t) && t > since)
    .sort((a, b) => a - b);
  const count = dates.length;
  const allowed = count < CAP;
  // The slot opens when enough of the oldest counted posts have aged out.
  const nextSlotAt = allowed ? null : new Date(dates[count - CAP] + WINDOW_DAYS * DAY_MS);
  return { count, limit: CAP, allowed, nextSlotAt };
}

export function capLine(result, source) {
  const tail = result.allowed ? "" : `, next slot opens ${result.nextSlotAt.toISOString()}`;
  return `cap: ${result.count} of ${CAP} posts in the last ${WINDOW_DAYS} days (source: ${source})${tail}`;
}

const wordCount = (s) => (s ?? "").split(/\s+/).filter(Boolean).length;
const textFields = (p) => [p.title, p.description, p.bodyMd, p.heroImageAlt, ...(p.tags ?? []), ...(p.faq ?? []).flatMap((f) => [f.q, f.a])];

/** Pure checks. existing is [{ slug, title }]. Returns a list of problems. */
export function validate(post, existing = []) {
  const problems = [];
  const t = post.title ?? "";
  if (t.length < 1 || t.length > 60) problems.push("title must be 1 to 60 characters");
  const d = post.description ?? "";
  if (d.length < 1 || d.length > 160) problems.push("description must be 1 to 160 characters");
  if (!SLUG_RE.test(post.slug ?? "")) problems.push("slug must be kebab-case");
  else if (existing.some((p) => p.slug === post.slug)) problems.push(`slug already used: ${post.slug}`);
  if (t && existing.some((p) => (p.title ?? "").toLowerCase() === t.toLowerCase())) problems.push("a post with this title already exists");
  const words = wordCount(post.bodyMd);
  if (words < 900) problems.push(`bodyMd is ${words} words, minimum 900`);
  if (((post.bodyMd ?? "").match(/^## \S/gm) ?? []).length < 3) problems.push("bodyMd needs at least three ## sections");
  if (!Array.isArray(post.tags) || post.tags.length < 2 || post.tags.length > 4) problems.push("tags: 2 to 4 required");
  if (!Array.isArray(post.faq) || post.faq.length < 3 || post.faq.length > 5) problems.push("faq: 3 to 5 pairs required");
  else if (post.faq.some((f) => !f?.q || !f?.a)) problems.push("every faq pair needs q and a");
  if (!/^(https:\/\/|\/images\/blog\/library\/)/.test(post.heroImageUrl ?? "")) problems.push("heroImageUrl must be https or /images/blog/library/...");
  if (!post.heroImageAlt) problems.push("heroImageAlt is required");
  if ("author" in post) problems.push("author must not be set (the site leaves it unset)");
  if ("publishedAt" in post) problems.push("publishedAt must not be set");
  if ("status" in post && post.status !== "published") problems.push('status must be "published" or left out');
  if (textFields(post).some((s) => typeof s === "string" && DASHES.test(s))) problems.push("no em or en dashes in any text field");
  const priced = [post.title, post.description, post.bodyMd, ...(post.faq ?? []).flatMap((f) => [f.q, f.a])];
  if (priced.some((s) => typeof s === "string" && /\$\d/.test(s))) problems.push("no dollar amounts (never hand-type prices)");
  return problems;
}

/** Site-relative links in the body, deduplicated. */
export function siteLinks(bodyMd) {
  const out = new Set();
  for (const m of (bodyMd ?? "").matchAll(/\]\((\/[^)\s#]*)/g)) out.add(m[1]);
  return [...out];
}

function fail(msg) {
  console.error(`publish: ${msg}`);
  process.exit(1);
}

function summary(text) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
}

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json();
}

/** Returns { posts: [{ slug, title, status, publishedAt }], source }. */
async function loadPosts(key) {
  if (key) {
    const body = await getJson(`${SITE}/api/v1/blog/posts`, { authorization: `Bearer ${key}` });
    const rows = Array.isArray(body.data) ? body.data : (body.data?.posts ?? []);
    return { posts: rows, source: "api" };
  }
  const xml = await (await fetch(`${SITE}/blog/feed.xml`)).text();
  const posts = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => ({
    slug: (m[1].match(/\/blog\/([a-z0-9-]+)<\/link>/) ?? [])[1],
    title: (m[1].match(/<title>([\s\S]*?)<\/title>/) ?? [])[1],
    status: "published",
    publishedAt: (m[1].match(/<pubDate>([\s\S]*?)<\/pubDate>/) ?? [])[1],
  }));
  return { posts, source: "feed" };
}

async function checkLinks(bodyMd) {
  const bad = [];
  for (const path of siteLinks(bodyMd)) {
    const res = await fetch(`${SITE}${path}`, { method: "GET", redirect: "follow" }).catch(() => null);
    if (!res || res.status !== 200) bad.push(`${path} answered ${res ? res.status : "no response"}`);
  }
  return bad;
}

async function main() {
  const args = process.argv.slice(2);
  const key = process.env.JETNINE_BLOG_API_KEY || "";
  const { posts, source } = await loadPosts(key);
  const cap = capCheck(posts);
  const line = capLine(cap, source);
  console.log(line);
  summary(`**${line}**`);

  if (args.includes("--cap")) process.exit(cap.allowed ? 0 : 1);

  const file = args.find((a) => !a.startsWith("--"));
  if (!file) fail("usage: publish.mjs <post.json> [--dry-run] | --cap");
  const post = JSON.parse(readFileSync(resolve(file), "utf8"));
  const dry = args.includes("--dry-run");

  if (!dry && !cap.allowed) {
    fail(`not published: cap reached, ${cap.count} posts in the last ${WINDOW_DAYS} days (limit ${CAP}), next slot opens ${cap.nextSlotAt.toISOString()}`);
  }
  if (!dry && String(post.slug).startsWith("sample-")) fail("not published: sample slugs are never published");

  const problems = validate(post, posts);
  problems.push(...(await checkLinks(post.bodyMd)));
  if (problems.length) {
    summary(`Not published:\n${problems.map((p) => `- ${p}`).join("\n")}`);
    fail(`not published:\n  - ${problems.join("\n  - ")}`);
  }
  if (dry) {
    console.log(`dry run OK: ${post.slug}, nothing sent`);
    summary(`Dry run OK: ${post.slug}, nothing sent`);
    return;
  }
  if (!key) fail("JETNINE_BLOG_API_KEY is not set");

  const headers = { "content-type": "application/json", authorization: `Bearer ${key}` };
  const payload = { ...post, status: "published" };
  if (/^https:\/\//.test(payload.heroImageUrl)) {
    const res = await fetch(`${SITE}/api/v1/blog/images`, { method: "POST", headers, body: JSON.stringify({ slug: post.slug, sourceUrl: payload.heroImageUrl }) });
    const body = await res.json().catch(() => ({}));
    if (res.status !== 201 || !body.data?.url) fail(`hero ingest failed: ${res.status}`);
    payload.heroImageUrl = body.data.url;
  }
  const res = await fetch(`${SITE}/api/v1/blog/posts`, { method: "POST", headers, body: JSON.stringify(payload) });
  const body = await res.json().catch(() => ({}));
  if (res.status === 409) fail("not published: slug already taken (409)");
  if (res.status === 202) fail("not published: the key asks before acting (202). Use a key that does not");
  if (res.status !== 201) fail(`API answered ${res.status}: ${body.error?.message ?? "no message"}`);

  const url = body.data?.url ?? `${SITE}/blog/${post.slug}`;
  const page = await fetch(url);
  const html = page.ok ? await page.text() : "";
  const decoded = html.replace(/&amp;/g, "&").replace(/&#x27;|&#39;|&apos;/g, "'").replace(/&quot;/g, '"');
  if (!page.ok || !decoded.includes(post.title)) fail(`published but the live page failed the check (${page.status}): ${url}`);
  console.log(`published: ${url}`);
  summary(`Published: ${url}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => fail(e.message));
}
