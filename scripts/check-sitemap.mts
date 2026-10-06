/* eslint-disable no-console */
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { buildSitemap, loadSitemap, sitemapOrigin, sitemapMetadata } from "../src/lib/sitemap-data";

const entries = buildSitemap([]);
const urls = new Set(entries.map((entry) => entry.url));
assert.equal(urls.size, entries.length, "Duplicate canonical URLs");
assert(entries.length <= 50_000, "Split the sitemap at 50,000 URLs");
for (const entry of entries) {
  const url = new URL(entry.url);
  assert.equal(url.origin, "https://jetnine.com");
  assert(!url.search && !url.hash);
  assert(!/^\/(account|admin|api|auth|sign-in|request|downloads)(\/|$)/.test(url.pathname));
  assert(!/^\/quote\/(aircraft|contact|review)$/.test(url.pathname));
  assert(!/\/(confirm|unsubscribe)\//.test(url.pathname));
  assert(!("priority" in entry) && !("changeFrequency" in entry));
  assert(!("lastModified" in entry), "Static pages must not receive fabricated dates");
  for (const image of entry.images ?? []) {
    const imageUrl = new URL(image);
    assert.equal(imageUrl.origin, url.origin);
    assert(existsSync(join("public", decodeURIComponent(imageUrl.pathname))), `Missing image: ${image}`);
  }
}
function pages(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? pages(join(directory, entry.name)) : entry.name === "page.tsx" ? [join(directory, entry.name)] : [],
  );
}
for (const file of pages("src/app/(marketing)")) {
  const relative = file.replace("src/app/(marketing)", "").replace(/\/page\.tsx$/, "");
  if (!relative.includes("[")) assert(urls.has(`https://jetnine.com${relative || "/"}`), `Missing public page: ${file}`);
}
assert.equal(sitemapOrigin("https://jetnine.com/"), "https://jetnine.com");
for (const invalid of ["https://jetnine.com/path", "https://jetnine.com/?x=1", "https://user:pass@jetnine.com", "ftp://jetnine.com"]) {
  assert.throws(() => sitemapOrigin(invalid));
}
const changed = new Date("2026-01-02T12:00:00Z");
const posts = [{ slug: "charter-pricing", updatedAt: changed, heroImageUrl: "/images/light/wing-clouds.webp" }];
const withBlog = buildSitemap(posts);
const post = withBlog.find((entry) => entry.url.endsWith("/blog/charter-pricing"));
assert.equal(post?.lastModified, changed);
assert.deepEqual(post?.images, ["https://jetnine.com/images/light/wing-clouds.webp"]);
assert(!buildSitemap([{ ...posts[0], updatedAt: new Date("invalid") }]).find((entry) => entry.url.endsWith("/blog/charter-pricing"))?.lastModified);
assert.equal((await loadSitemap(async () => posts)).length, entries.length + 1);
await assert.rejects(loadSitemap(async () => { throw new Error("database unavailable"); }, {
  buildPhase: true, production: true,
}), /database unavailable/, "Production builds must fail instead of dropping blog URLs");
const offline = async () => { throw new Error("database unavailable"); };
await assert.rejects(loadSitemap(offline), /database unavailable/, "Runtime outages must not publish a truncated sitemap");
assert.deepEqual(await loadSitemap(offline, { buildPhase: true }), entries, "Offline builds should retain catalog coverage");
const escaped = sitemapMetadata(buildSitemap([{ ...posts[0], heroImageUrl: "https://cdn.example.com/hero.jpg?w=1200&fit=crop" }]));
assert.equal(escaped.find((entry) => entry.url.endsWith("/blog/charter-pricing"))?.images?.[0], "https://cdn.example.com/hero.jpg?w=1200&amp;fit=crop", "Image query strings must remain valid XML");
assert.throws(() => buildSitemap([{ ...posts[0], heroImageUrl: "data:image/png,invalid" }]));
console.log(`Sitemap invariants passed: ${entries.length} public catalog URLs, accurate blog dates, images, exclusions, and outage policy.`);

// Vercel preview builds also have NODE_ENV=production; they must stay blocked.
const { default: robots } = await import("../src/app/robots");
const originalVercel = process.env.VERCEL_ENV;
const originalNodeEnv = process.env.NODE_ENV;
try {
  Object.assign(process.env, { NODE_ENV: "production" });
  process.env.VERCEL_ENV = "preview";
  assert.deepEqual(robots(), { rules: { userAgent: "*", disallow: "/" } });
  process.env.VERCEL_ENV = "development";
  assert.deepEqual(robots(), { rules: { userAgent: "*", disallow: "/" } });
  process.env.VERCEL_ENV = "production";
  assert(Array.isArray(robots().rules));
} finally {
  if (originalNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
  else Object.assign(process.env, { NODE_ENV: originalNodeEnv });
  if (originalVercel === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = originalVercel;
}
